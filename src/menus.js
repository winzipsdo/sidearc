// 三种右键菜单的内容:标签页、收藏/固定项、空间。

import { addItemFromTab, backToItem, closeItemTab, editItem, moveItem, moveItemToSpace, removeItem, savePageAsItem, syncItemToTab } from './items.js';
import { canDiscard, durationParts, isAway, isUnloaded, pinnedItems } from './logic.js';
import { createFolder, deleteFolder, findFolder, moveToFolder, renameFolder, toggleFolderNoHistory } from './folders.js';
import { render } from './render.js';
import { addSpace, deleteSpace, editSpace, switchSpace, toggleNoHistory } from './spaces.js';
import { activeSpace, bind, itemByTab, listedParent, listedTabs, setTabParent, state, tabAlias, tabParent, tabSpace, tabs, trailOn, visibleTabs, windowId } from './store.js';
import { closeTab, closeWithUndo, discardTabs, editTabAlias, moveTabToSpace, toggleAutoDiscard } from './tabs.js';
import { $, faviconFor } from './dom.js';
import { formatDuration, LANGS, langPref, setLangPref, t } from './i18n.js';
import { copyText, showMenu } from './ui.js';

// 内存相关的两项:休眠(手动让 Chrome 回收),以及保持唤醒(不许 Chrome 自动回收)。tab 为空(项没开着)时不显示
function memoryItems(tab) {
  if (!tab) return [];
  const keep = tab.autoDiscardable === false;
  return [
    // 不能休眠时置灰,鼠标提示里说明原因
    {
      icon: 'sleep',
      label: t('sleep'),
      disabled: !canDiscard(tab),
      title: tab.active ? t('sleepCurrentTip') : isUnloaded(tab) ? t('alreadyAsleepTip') : null,
      run: () => discardTabs([tab]),
    },
    { icon: keep ? 'unlock' : 'lock', label: keep ? t('stopKeepAwake') : t('keepAwake'), run: () => toggleAutoDiscard(tab) },
  ];
}

// 多选时右键其中一个:对选中的这一批标签页操作(关闭可以撤销)
function selectionMenu(e, list) {
  const n = list.length;
  showMenu(e, [
    { header: t('nTabs', { n }) },
    { icon: 'sleep', label: t('sleep'), disabled: !list.some(canDiscard), run: () => discardTabs(list) },
    '-',
    ...state.spaces
      .filter((s) => s.id !== state.activeSpaceId)
      .map((s) => ({
        icon: 'dot',
        color: s.color,
        label: t('moveToSpace', { name: s.name }),
        run: async () => {
          for (const x of list) await moveTabToSpace(x.id, s.id);
          await switchSpace(s.id, list[0].id);
        },
      })),
    '-',
    { icon: 'close', label: t('close'), run: () => closeWithUndo(list, t('closedTabs', { n })) },
  ]);
}

export function tabMenu(e, tab) {
  const selected = visibleTabs()
    .map((x) => x.tab)
    .filter((x) => x.highlighted);
  if (selected.length > 1 && tab.highlighted) return selectionMenu(e, selected);
  // 只算列表里看得见的:搜索过滤掉的标签页不会被关掉
  const visible = visibleTabs().map((x) => x.tab);
  const below = visible.slice(visible.findIndex((t) => t.id === tab.id) + 1);
  const children = listedTabs().filter((t) => tabParent.get(t.id) === tab.id).map((t) => t.id);
  showMenu(e, [
    { icon: 'edit', label: tabAlias.has(tab.id) ? t('editAlias') : t('setAlias'), run: () => editTabAlias(tab.id) },
    '-',
    { icon: 'pin', label: t('pinTab'), title: t('pinTabTip'), run: () => addItemFromTab(tab, 'pin') },
    { icon: 'star', label: t('addToFavs'), run: () => addItemFromTab(tab, 'fav') },
    '-',
    { icon: 'link', label: t('copyLink'), run: () => copyText(tab.url, t('copied')) },
    { icon: 'copy', label: t('duplicateTab'), run: () => chrome.tabs.duplicate(tab.id) },
    // 只在正在发声或已经静音时显示,和行上的喇叭按钮一致
    (tab.audible || tab.mutedInfo?.muted) && { icon: tab.mutedInfo?.muted ? 'sound' : 'muted', label: tab.mutedInfo?.muted ? t('unmute') : t('mute'), run: () => chrome.tabs.update(tab.id, { muted: !tab.mutedInfo?.muted }) },
    ...memoryItems(tab),
    // 移动:子标签层级,以及移到别的空间
    '-',
    listedParent(tab.id) != null && { icon: 'outdent', label: t('unnest'), run: () => setTabParent(tab.id, null).then(render) },
    children.length > 0 && {
      icon: 'ungroup',
      label: t('releaseChildren'),
      run: async () => {
        for (const id of children) await setTabParent(id, null);
        render();
      },
    },
    ...state.spaces
      .filter((s) => s.id !== state.activeSpaceId)
      .map((s) => ({ icon: 'dot', color: s.color, label: t('moveToSpace', { name: s.name }), run: () => moveTabToSpace(tab.id, s.id).then(() => switchSpace(s.id, tab.id)) })),
    '-',
    { icon: 'close', label: t('close'), run: () => closeTab(tab) },
    below.length > 0 && { icon: 'closeBelow', label: t('closeBelow'), danger: true, run: () => closeWithUndo(below, t('closedTabs', { n: below.length })) },
  ]);
}

export function itemMenu(e, { item, kind, space, folder }) {
  const tab = tabs.find((t) => t.id === bind.get(item.id));
  // 标签页点进了别的页面
  const away = tab && isAway(item.url, tab.url);
  showMenu(e, [
    { icon: 'edit', label: t('editItemAlias'), run: () => editItem(item.id) },
    { icon: 'link', label: t('copyLink'), run: () => copyText(tab?.url || item.url, t('copied')) },
    away && { icon: 'back', label: kind === 'fav' ? t('backToFav') : t('backToPin'), run: () => backToItem(item) },
    // 对当前页面的操作:另存一份,或者拿它替换原来的地址;标签页本身不动
    away && '-',
    away && { header: t('currentPage') },
    away && { icon: 'star', label: t('saveToFavs'), run: () => savePageAsItem(tab, 'fav') },
    away && { icon: 'pin', label: t('pinTab'), title: t('pinTabTip'), run: () => savePageAsItem(tab, 'pin') },
    away && { icon: 'swap', label: kind === 'fav' ? t('replaceFavUrl') : t('replacePinUrl'), run: () => syncItemToTab(item.id, tab) },
    '-',
    bind.has(item.id) && { icon: 'minus', label: t('close'), run: () => closeItemTab(item) },
    ...memoryItems(tab),
    // 移动:收藏和固定标签之间、文件夹进出、移到别的空间
    '-',
    kind === 'fav'
      ? { icon: 'move', label: t('moveToPins'), title: t('moveToPinsTip'), run: () => moveItem(item.id, 'pin') }
      : { icon: 'move', label: t('moveToFavs'), run: () => moveItem(item.id, 'fav') },
    folder && { icon: 'outdent', label: t('moveOutOfFolder'), run: () => moveToFolder(item.id, null) },
    ...(kind === 'pin'
      ? state.spaces.filter((s) => s.id !== space.id).map((s) => ({ icon: 'dot', color: s.color, label: t('moveToSpace', { name: s.name }), run: () => moveItemToSpace(item.id, s.id).then(() => switchSpace(s.id, bind.get(item.id))) }))
      : []),
    // 字比较多,放在这一组最后
    kind === 'pin' && { icon: 'folderPlus', label: t('newFolderWithItem'), run: () => createFolder(item.id) },
    '-',
    { icon: kind === 'fav' ? 'trash' : 'unpin', label: kind === 'fav' ? t('removeFromFavs') : t('unpin'), danger: true, run: () => removeItem(item.id, false) },
  ]);
}

export function folderMenu(e, id) {
  const folder = findFolder(id)?.folder;
  if (!folder) return;
  const folderTabs = folder.items.map((i) => tabs.find((t) => t.id === bind.get(i.id))).filter(Boolean);
  showMenu(e, [
    { icon: 'edit', label: t('rename'), run: () => renameFolder(id) },
    { icon: folder.noHistory ? 'eye' : 'eyeOff', label: folder.noHistory ? t('turnOffNoHistory') : t('turnOnNoHistory'), run: () => toggleFolderNoHistory(id) },
    { icon: 'sleep', label: t('sleepFolder'), disabled: !folderTabs.some(canDiscard), title: folderTabs.some(canDiscard) ? null : t('nothingToSleep'), run: () => discardTabs(folderTabs) },
    '-',
    { icon: 'trash', label: t('deleteFolder'), danger: true, run: () => deleteFolder(id) },
  ]);
}

export function spaceMenu(e, id) {
  const space = state.spaces.find((s) => s.id === id);
  // 这个空间的标签页:列表里属于它的,加上它的固定标签开着的(收藏所有空间共用,不算)
  const byTab = itemByTab();
  const pinnedTabIds = new Set(space ? pinnedItems(space).map((i) => bind.get(i.id)) : []);
  const spaceTabs = tabs.filter((t) => pinnedTabIds.has(t.id) || (!byTab.has(t.id) && tabSpace.get(t.id) === id));
  showMenu(e, [
    { icon: 'edit', label: t('editSpace'), run: () => editSpace(id) },
    { icon: 'plus', label: t('newSpaceMenu'), run: addSpace },
    id === activeSpace().id && { icon: 'folderPlus', label: t('newFolderMenu'), run: () => createFolder() },
    { icon: space?.noHistory ? 'eye' : 'eyeOff', label: space?.noHistory ? t('turnOffNoHistory') : t('turnOnNoHistory'), run: () => toggleNoHistory(id) },
    { icon: 'sleep', label: t('sleepSpace'), disabled: !spaceTabs.some(canDiscard), title: spaceTabs.some(canDiscard) ? null : t('nothingToSleep'), run: () => discardTabs(spaceTabs) },
    state.spaces.length > 1 && '-',
    state.spaces.length > 1 && { icon: 'trash', label: t('deleteSpace'), danger: true, run: () => deleteSpace(id) },
  ]);
}

// 右下角的设置按钮:界面语言和足迹开关。语言存到 chrome.storage.local,所有窗口的侧边栏收到变化后一起换(见 events.js)
export function settingsMenu(e) {
  // 贴着按钮上方、右对齐弹出,不盖住底部这一行
  const anchor = e.currentTarget.getBoundingClientRect();
  const pick = (value, label) => ({ icon: langPref() === value ? 'check' : null, label, run: () => chrome.storage.local.set({ lang: value }) });
  showMenu(e, [
    { header: t('language') },
    pick('auto', t('langAuto')),
    pick('zh', LANGS.zh),
    pick('en', LANGS.en),
    '-',
    // 开关:打开时前面打勾
    { icon: trailOn ? 'check' : null, label: t('footprints'), title: t('footprintsTip'), run: () => chrome.storage.local.set({ trail: !trailOn }) },
  ]);
  const menu = $('#menu');
  menu.dataset.from = 'settings';
  menu.style.left = Math.max(4, anchor.right - menu.offsetWidth) + 'px';
  menu.style.top = Math.max(4, anchor.top - menu.offsetHeight - 6) + 'px';
}

// 「多久以前」:Chrome 记的关闭时间是秒
function ago(seconds) {
  return t('ago', { duration: formatDuration(durationParts(Date.now() - seconds * 1000)) });
}

// 最近关闭的标签页:用 Chrome 自己的记录(只有本次启动以来的),不分空间;整个窗口的关闭记录跳过。
// 点一下用 Chrome 的方式恢复(保留前进后退记录),恢复出来的标签页归入当前空间
export async function recentMenu(e) {
  // 列表贴着按钮上方、左对齐弹出,不盖住底部这一行(按钮的位置要在等待之前记下)
  const anchor = e.currentTarget.getBoundingClientRect();
  const pos = { clientX: anchor.left, clientY: anchor.top, preventDefault() {} };
  const closed = (await chrome.sessions.getRecentlyClosed({ maxResults: 25 }).catch(() => [])).filter((s) => s.tab).slice(0, 10);
  showMenu(pos, [
    { header: closed.length ? t('recentlyClosed') : t('noRecentlyClosed') },
    ...closed.map(({ tab, lastModified }) => ({
      img: tab.favIconUrl && /^(https?|data):/.test(tab.favIconUrl) ? tab.favIconUrl : faviconFor(tab.url || 'about:blank'),
      label: tab.title || tab.url,
      title: tab.url,
      note: ago(lastModified),
      run: () => chrome.sessions.restore(tab.sessionId).catch(() => {}),
    })),
    '-',
    // 完整的浏览历史:Chrome 自己的历史记录页,右边标上它的快捷键
    {
      icon: 'external',
      link: true,
      label: t('openHistory'),
      note: /Mac/i.test(navigator.platform) ? '⌘Y' : 'Ctrl+H',
      run: () => chrome.tabs.create({ url: 'chrome://history', windowId }),
    },
  ]);
  // 用 offsetWidth/Height:弹出动画还在缩放时,getBoundingClientRect 量到的尺寸偏小
  const menu = $('#menu');
  menu.style.left = Math.max(4, Math.min(anchor.left, innerWidth - menu.offsetWidth - 4)) + 'px';
  menu.style.top = Math.max(4, anchor.top - menu.offsetHeight - 6) + 'px';
}
