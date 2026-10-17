// 把页面和浏览器的事件接到各个操作上。拖拽的事件在 drag.js。

import { $, FALLBACK_ICON } from './dom.js';
import { bindDrag } from './drag.js';
import { backToItem, closeItemTab, openItem, removeItem, toggleItemMute } from './items.js';
import { folderMenu, itemMenu, spaceMenu, tabMenu } from './menus.js';
import { toggleFolder } from './folders.js';
import { MSG } from './protocol.js';
import { layoutFavs, render, schedule } from './render.js';
import { switchSpace } from './spaces.js';
import { applySession, bind, findItem, followSpace, normalize, replaceTabId, setQuery, setState, state, tabs, windowId } from './store.js';
import { clearTabs, closeTab, discardTabs, submitSearch } from './tabs.js';
import { hideMenu, pushUndo, undo } from './ui.js';

const tabOf = (el) => tabs.find((t) => t.id === +el.dataset.id);

// 列表里的行和磁贴:点击、中键
function bindRows(scroll) {
  scroll.addEventListener('click', (e) => {
    const el = e.target.closest('[data-kind]');
    if (!el) return;
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (el.dataset.kind === 'folder') return toggleFolder(el.dataset.id);
    if (el.dataset.kind === 'tab') {
      const tab = tabOf(el);
      if (!tab) return;
      if (act === 'close') closeTab(tab);
      else if (act === 'discard') discardTabs([tab]);
      else if (act === 'mute') chrome.tabs.update(tab.id, { muted: !tab.mutedInfo?.muted });
      else chrome.tabs.update(tab.id, { active: true });
    } else {
      const item = findItem(el.dataset.id)?.item;
      if (!item) return;
      if (act === 'close') closeItemTab(item);
      else if (act === 'discard') discardTabs(tabs.filter((t) => t.id === bind.get(item.id)));
      else if (act === 'mute') toggleItemMute(item);
      else if (act === 'back') backToItem(item);
      else if (act === 'unpin') removeItem(item.id, false);
      else openItem(item);
    }
  });

  // 中键关闭
  scroll.addEventListener('mousedown', (e) => {
    if (e.button === 1 && e.target.closest('[data-kind]')) e.preventDefault();
  });
  scroll.addEventListener('auxclick', (e) => {
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
    if (dot) return spaceMenu(e, dot.dataset.space);
    if (!el) return hideMenu();
    if (el.dataset.kind === 'folder') return folderMenu(e, el.dataset.id);
    if (el.dataset.kind === 'tab') {
      const tab = tabOf(el);
      if (tab) tabMenu(e, tab);
    } else {
      const hit = findItem(el.dataset.id);
      if (hit) itemMenu(e, hit);
    }
  });
  document.addEventListener('mousedown', (e) => {
    if (!e.target.closest('#menu')) hideMenu();
  });
  window.addEventListener('blur', hideMenu);
  scroll.addEventListener('scroll', hideMenu);
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
  $('#space-menu').addEventListener('click', (e) => spaceMenu(e, state.activeSpaceId));
  $('#new-tab').addEventListener('click', () => chrome.tabs.create({ windowId }));
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
    }
  });
}

function bindKeyboard() {
  // Ctrl/Cmd+Z 撤销最近一次操作;在输入框里时留给文字编辑自己的撤销
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
  for (const ev of ['onCreated', 'onRemoved', 'onUpdated', 'onMoved', 'onAttached', 'onDetached', 'onReplaced']) {
    chrome.tabs[ev].addListener(schedule);
  }
  chrome.tabs.onReplaced.addListener(replaceTabId);
  chrome.tabs.onActivated.addListener((info) => {
    if (info.windowId === windowId) followSpace(info.tabId);
    schedule();
  });

  // 后台发现新开的标签页和已有的同地址,已经切过去并关掉了新开的
  chrome.runtime.onMessage.addListener((msg) => {
    const d = msg?.[MSG.deduped];
    if (!d || d.windowId !== windowId) return;
    pushUndo(d.active ? '已切到现有标签页' : '标签页已存在', () => chrome.runtime.sendMessage({ [MSG.openDup]: d }));
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
    if (area === 'local' && changes.state) {
      setState(changes.state.newValue);
      normalize();
      schedule();
    } else if (area === 'session') {
      for (const [k, c] of Object.entries(changes)) applySession(k, c.newValue);
      render();
    }
  });
}

export function bindEvents() {
  const scroll = $('#scroll');
  bindRows(scroll);
  bindMenus(scroll);
  bindControls();
  bindSearch();
  bindKeyboard();
  bindPage();
  bindDrag();
  bindBrowser();
}
