// 把页面和浏览器的事件接到各个操作上。拖拽的事件在 drag.js。

import { $, FALLBACK_ICON } from './dom.js';
import { bindDrag } from './drag.js';
import { bindKeys } from './keys.js';
import { backToItem, closeItemTab, openItem, removeItem, toggleItemMute } from './items.js';
import { folderMenu, itemMenu, spaceMenu, tabMenu } from './menus.js';
import { moveToFolder, toggleFolder } from './folders.js';
import { applyStaticText, setLangPref, t } from './i18n.js';
import { MSG } from './protocol.js';
import { layoutFavs, markJump, refreshSleptLabels, refreshTrail, render, renderSoon, schedule, updateScrollFades } from './render.js';
import { bindLeaves, refreshLeaves } from './leaves.js';
import { revealTab } from './locate.js';
import { deleteHistory, expandHistory } from './history.js';
import { switchSpace } from './spaces.js';
import { activeSpace, applySession, bind, findItem, followSpace, normalize, pressing, renderPending, replaceTabId, save, setLeafHours, setPressing, setQuery, setState, setTabParent, setTrailCount, state, tabScattered, tabs, visibleTabs, windowId } from './store.js';
import { clearTabs, closeTab, discardTabs, endSearch, submitSearch } from './tabs.js';
import { closeSearch, hideMenu, isMenuOwner, openSearch, pushUndo, setMenuTarget, toggleMenuFrom, undo } from './ui.js';

const tabOf = (el) => tabs.find((t) => t.id === +el.dataset.id);

// Shift+点击连选的起点:上一次普通点击或 Cmd/Ctrl+点击的标签页,没有就从当前标签页算
let anchorId = null;

// Shift+点击:选中起点到这个标签页之间(按列表里的顺序)的所有标签页,其他的取消选中,和顶部标签栏一样。
// tabs.highlight 会切到给出的第一个标签页,所以把起点放在最前面,当前标签页一般就不变
function selectRange(tab) {
  const list = visibleTabs().map((x) => x.tab);
  const anchor = list.find((x) => x.id === anchorId) ?? list.find((x) => x.active) ?? tab;
  const [a, b] = [list.indexOf(anchor), list.indexOf(tab)].sort((x, y) => x - y);
  const range = list.slice(a, b + 1).filter((x) => x !== anchor);
  chrome.tabs.highlight({ windowId, tabs: [anchor, ...range].map((x) => x.index) }).catch(() => {});
}

// 取消多选:只留当前标签页
function clearSelection() {
  for (const tab of tabs) if (tab.highlighted && !tab.active) chrome.tabs.update(tab.id, { highlighted: false }).catch(() => {});
}

// 列表里的行和磁贴:点击、中键
function bindRows(root) {
  // 按下到松开之间不重画(见 store.js 的 pressing)。松开后等这次 click 先派发完再补画;
  // 松手的地方在侧边栏外面收不到 mouseup 时,失去焦点或几秒后也放开
  let pressTimer;
  const release = () => {
    clearTimeout(pressTimer);
    if (!pressing) return;
    setPressing(false);
    if (renderPending) render();
  };
  root.addEventListener('mousedown', () => {
    setPressing(true);
    pressTimer = setTimeout(release, 3000);
  });
  addEventListener('mouseup', () => setTimeout(release));
  addEventListener('blur', release);
  // 开始拖了:交给拖拽那边暂停重画,松手时它会补画(这里补画会把正要拖的那一行换掉)
  document.addEventListener('dragstart', () => (clearTimeout(pressTimer), setPressing(false)));

  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-kind]');
    if (!el) return;
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (el.dataset.kind === 'folder') return toggleFolder(el.dataset.id);
    if (el.dataset.kind === 'hist-more') return expandHistory();
    // 搜索结果里的历史记录:在新标签页打开(归入当前空间)。
    // 点开搜索结果里的任何一项(不是行上的按钮)都退出搜索
    if (el.dataset.kind === 'hist') {
      if (act === 'close') return deleteHistory(el.dataset.id);
      chrome.tabs.create({ url: el.dataset.id, windowId });
      return endSearch();
    }
    if (el.dataset.kind === 'tab') {
      const tab = tabOf(el);
      if (!tab) return;
      if (act === 'close') closeTab(tab);
      else if (act === 'discard') discardTabs([tab], { withActive: true });
      else if (act === 'unnest') setTabParent(tab.id, null).then(render);
      else if (act === 'mute') chrome.tabs.update(tab.id, { muted: !tab.mutedInfo?.muted });
      else if (e.shiftKey) selectRange(tab);
      // Cmd/Ctrl+点击:加入或移出多选,和顶部标签栏一样用浏览器的高亮(当前标签页总是选中的)
      else if (e.metaKey || e.ctrlKey) {
        anchorId = tab.id;
        chrome.tabs.update(tab.id, { highlighted: !tab.highlighted }).catch(() => {});
      } else {
        anchorId = tab.id;
        chrome.tabs.update(tab.id, { active: true });
        endSearch();
      }
    } else {
      const item = findItem(el.dataset.id)?.item;
      if (!item) return;
      if (act === 'close') closeItemTab(item);
      else if (act === 'discard') discardTabs(tabs.filter((t) => t.id === bind.get(item.id)), { withActive: true });
      else if (act === 'mute') toggleItemMute(item);
      else if (act === 'back') backToItem(item);
      else if (act === 'unpin') removeItem(item.id, false);
      else if (act === 'unfold') moveToFolder(item.id, null);
      else {
        // 开在别的窗口里:先播一下「跳出去」的动效,告诉你它去了另一个窗口
        if (el.classList.contains('elsewhere-item')) markJump(item.id, e);
        openItem(item);
        endSearch();
      }
    }
  });

  // 中键关闭
  root.addEventListener('mousedown', (e) => {
    // 中键不要出滚动图标;Shift+点击不要选中文字
    if ((e.button === 1 || e.shiftKey) && e.target.closest('[data-kind]')) e.preventDefault();
  });
  root.addEventListener('auxclick', (e) => {
    const el = e.button === 1 && e.target.closest('[data-kind]');
    if (!el || el.dataset.kind === 'folder') return;
    if (el.dataset.kind === 'tab') {
      const tab = tabOf(el);
      if (tab) closeTab(tab);
    } else {
      const item = findItem(el.dataset.id)?.item;
      if (item) closeItemTab(item);
    }
  });
}

// 右键菜单:弹出和收起
function bindMenus(scroll) {
  document.addEventListener('contextmenu', (e) => {
    if (e.target.closest('input, dialog')) return;
    e.preventDefault();
    const el = e.target.closest('[data-kind]');
    const dot = e.target.closest('[data-space]');
    // 菜单开着时标出它是给谁的(见 ui.js 的 setMenuTarget)
    if (dot) return setMenuTarget([dot]), spaceMenu(e, dot.dataset.space);
    if (!el) return hideMenu();
    if (el.dataset.kind === 'folder') return setMenuTarget([el]), folderMenu(e, el.dataset.id);
    if (el.dataset.kind === 'tab') {
      const tab = tabOf(el);
      if (!tab) return;
      // 右键的是多选里的一项:菜单作用于选中的全部(见 menus.js 的 tabMenu),选中的几行都标出来
      const many = tab.highlighted && document.querySelectorAll('#tabs .row.selected').length > 1;
      setMenuTarget(many ? [...document.querySelectorAll('#tabs .row.selected')] : [el], el);
      tabMenu(e, tab);
    } else {
      const hit = findItem(el.dataset.id);
      if (hit) setMenuTarget([el]), itemMenu(e, hit);
    }
  });
  // 点在菜单外面就关;打开它的那个按钮除外,由按钮自己切换开关(见 ui.js 的 toggleMenuFrom)
  document.addEventListener('mousedown', (e) => {
    if (!e.target.closest('#menu') && !isMenuOwner(e.target)) hideMenu();
  });
  window.addEventListener('blur', hideMenu);
  scroll.addEventListener('scroll', hideMenu);
  // 列表滚动了:滚上去的内容在顶端渐渐淡掉(样式见 sidepanel.css 的 body.scrolled)
  scroll.addEventListener('scroll', updateScrollFades, { passive: true });
  addEventListener('resize', updateScrollFades);
  // 右键时侧边栏不一定拿到了焦点,之后点网页也就不会触发 blur。所以鼠标离开侧边栏一会儿就收起菜单;
  // 只是划出去又马上回来的,不收
  let leaveTimer;
  document.documentElement.addEventListener('mouseleave', () => (leaveTimer = setTimeout(hideMenu, 400)));
  document.documentElement.addEventListener('mouseenter', () => clearTimeout(leaveTimer));
  document.addEventListener('visibilitychange', () => document.hidden && hideMenu());
}

// 空间圆点、空间菜单按钮、新标签页、清理、Arc 文件选择
function bindControls() {
  $('#spaces').addEventListener('click', (e) => {
    const dot = e.target.closest('[data-space]');
    if (dot) switchSpace(dot.dataset.space);
  });
  // 右上角的三个点:菜单固定贴在按钮下方、右对齐,不跟着鼠标点的位置走(和右下角的设置按钮一样)
  // 菜单开着时再点一次就关上
  $('#space-menu').addEventListener('click', (e) => {
    const anchor = e.currentTarget.getBoundingClientRect();
    toggleMenuFrom('#space-menu', () => {
      spaceMenu(e, state.activeSpaceId);
      const menu = $('#menu');
      menu.dataset.from = 'space';
      menu.style.left = Math.max(4, anchor.right - menu.offsetWidth) + 'px';
      menu.style.top = Math.min(anchor.bottom + 6, Math.max(4, innerHeight - menu.offsetHeight - 4)) + 'px';
    });
  });
  // 点空间名(或旁边的小箭头、折叠时的数量)折叠/展开这个空间的固定标签
  $('#pins-toggle-area').addEventListener('click', () => {
    const space = activeSpace();
    if (space.pinsCollapsed) delete space.pinsCollapsed;
    else space.pinsCollapsed = true;
    save();
    render();
  });
  $('#clear').addEventListener('click', clearTabs);
}

function bindSearch() {
  const search = $('#search');
  search.addEventListener('input', () => {
    setQuery(search.value);
    render();
  });
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitSearch(e.ctrlKey || e.metaKey);
    else if (e.key === 'Escape') {
      search.value = '';
      setQuery('');
      render();
      closeSearch();
    }
  });
  // 不管怎么进到搜索框(包括按 Tab 切进来),都展开;空着点到别处就收起来,有搜索词时留着
  search.addEventListener('focus', () => document.body.classList.add('searching'));
  search.addEventListener('blur', () => search.value || document.body.classList.remove('searching'));
  // 清空按钮:只清掉搜索词,搜索框留着、光标还在里面,接着输入新的(按下时同样不让它失焦)
  $('#search-clear').addEventListener('mousedown', (e) => e.preventDefault());
  $('#search-clear').addEventListener('click', () => {
    search.value = '';
    setQuery('');
    render();
    search.focus();
  });
  // 按下时不让搜索框失焦,否则空搜索框先因失焦收起,紧接着的点击又把它展开
  $('#search-toggle').addEventListener('mousedown', (e) => e.preventDefault());
  $('#search-toggle').addEventListener('click', () => (document.body.classList.contains('searching') && !search.value ? closeSearch() : openSearch()));
}

function bindKeyboard() {
  // Ctrl/Cmd+Z 撤销最近一次操作;在输入框里时留给文字编辑自己的撤销
  // Esc 取消多选:只留当前标签页
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || e.target.closest?.('input, textarea, dialog') || $('#dlg').open) return;
    clearSelection();
  });
  // 点空白的地方也取消多选(行、按钮、输入框、菜单、对话框上的点击不算)
  document.addEventListener('click', (e) => {
    if (!e.target.closest?.('[data-kind], button, input, #menu, dialog')) clearSelection();
  });
  document.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || e.key.toLowerCase() !== 'z') return;
    if (e.target.closest?.('input, textarea, dialog') || $('#dlg').open) return;
    e.preventDefault();
    undo();
  });
}

function bindPage() {
  // 只在收藏夹变宽变窄时重排列数。重排会改变它的高度,如果高度变化也触发,就会在同一帧里反复触发,
  // 浏览器会报「ResizeObserver loop completed with undelivered notifications」;放到下一帧做也是为此
  let favsWidth = 0;
  new ResizeObserver(([entry]) => {
    const width = Math.round(entry.contentRect.width);
    if (width === favsWidth) return;
    favsWidth = width;
    requestAnimationFrame(layoutFavs);
  }).observe($('#favs'));

  // favicon 加载失败时换成默认图标
  document.addEventListener(
    'error',
    (e) => {
      const img = e.target;
      if (img.tagName === 'IMG' && img.src !== FALLBACK_ICON) img.src = FALLBACK_ICON;
    },
    true
  );
}

// 浏览器这边的变化:标签页、后台发来的消息、存储
function bindBrowser() {
  // 只管本窗口的:别的窗口里标签页加载、改标题这些事件很多,每个都让这里整页重画没有必要。
  // 别的窗口里的变化会影响到这里的(比如收藏的标签页在别的窗口关掉了),后台会改存储,下面的 storage.onChanged 会重画
  const mine = (id) => id === windowId && schedule();
  chrome.tabs.onCreated.addListener((tab) => mine(tab.windowId));
  chrome.tabs.onRemoved.addListener((_, info) => mine(info.windowId));
  chrome.tabs.onUpdated.addListener((_, __, tab) => mine(tab.windowId));
  chrome.tabs.onMoved.addListener((_, info) => mine(info.windowId));
  chrome.tabs.onAttached.addListener((_, info) => mine(info.newWindowId));
  chrome.tabs.onDetached.addListener((_, info) => mine(info.oldWindowId));
  chrome.tabs.onHighlighted.addListener((info) => mine(info.windowId));
  // 换编号的事件不带窗口
  chrome.tabs.onReplaced.addListener((added, removed) => (replaceTabId(added, removed), schedule()));
  chrome.tabs.onActivated.addListener((info) => {
    if (info.windowId !== windowId) return;
    // 点进去了:撒上去的落叶也被吹走(后台也会删存储里的,这里先删,免得这次重画还留着)
    tabScattered.delete(info.tabId);
    followSpace(info.tabId);
    schedule();
  });

  // 后台发现新开的标签页和已有的同地址,已经切过去并关掉了新开的
  chrome.runtime.onMessage.addListener((msg) => {
    const d = msg?.[MSG.deduped];
    if (!d || d.windowId !== windowId) return;
    pushUndo(d.active ? t('switchedToExisting') : t('alreadyOpen'), () => chrome.runtime.sendMessage({ [MSG.openDup]: d }));
    // 侧边栏也滚到已有的那个
    if (d.tabId != null) revealTab(d.tabId);
  });
  // 后台把新标签页绑定到了同地址的收藏/固定项:先记上绑定(存储的变化可能还没到),固定项在别的空间就跟过去
  chrome.runtime.onMessage.addListener((msg) => {
    const d = msg?.[MSG.adopted];
    if (!d || d.windowId !== windowId) return;
    bind.set(d.itemId, d.tabId);
    followSpace(d.tabId);
    schedule();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.trail) {
      setTrailCount(changes.trail.newValue);
      refreshTrail();
    }
    if (area === 'local' && changes.leaves) {
      setLeafHours(changes.leaves.newValue);
      refreshLeaves();
    }
    if (area === 'local' && changes.lang) {
      setLangPref(changes.lang.newValue);
      applyStaticText();
      render();
    }
    if (area === 'local' && changes.state) {
      setState(changes.state.newValue);
      normalize();
      schedule();
    } else if (area === 'session') {
      for (const [k, c] of Object.entries(changes)) applySession(k, c.newValue);
      // 后台常常接连写好几次(新开一个标签页就有好几条),合成一次重画
      renderSoon();
    }
  });
}

export function bindEvents() {
  // 「休眠了多久」每分钟更新一次文字,顺便看看有没有该落的叶子
  setInterval(() => (refreshSleptLabels(), refreshTrail(), refreshLeaves()), 60000);
  const scroll = $('#scroll');
  // 收藏夹在滚动区外面(顶部),行上的点击在整个页面上接
  bindRows(document.body);
  bindLeaves($('#tabs'));
  bindMenus(scroll);
  bindControls();
  bindSearch();
  bindKeyboard();
  bindKeys();
  bindPage();
  bindDrag();
  bindBrowser();
}
