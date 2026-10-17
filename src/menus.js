// 三种右键菜单的内容:标签页、收藏/固定项、空间。

import { addItemFromTab, backToItem, closeItemTab, editItem, moveItem, removeItem, savePageAsItem, syncItemToTab } from './items.js';
import { canDiscard, isAway, isFolder, pinnedItems } from './logic.js';
import { createFolder, deleteFolder, findFolder, moveToFolder, renameFolder, toggleFolderNoHistory } from './folders.js';
import { render } from './render.js';
import { addSpace, deleteSpace, editSpace, toggleNoHistory } from './spaces.js';
import { activeSpace, bind, itemByTab, listedParent, listedTabs, setTabParent, state, tabAlias, tabParent, tabs, tabSpace, visibleTabs, windowId } from './store.js';
import { closeTab, closeWithUndo, discardTabs, editTabAlias, moveTabToSpace, toggleAutoDiscard } from './tabs.js';
import { $, faviconFor } from './dom.js';
import { copyText, showMenu } from './ui.js';

// 内存相关的两项:休眠(手动让 Chrome 回收),以及保持唤醒(不许 Chrome 自动回收)。tab 为空(项没开着)时不显示
function memoryItems(tab) {
  if (!tab) return [];
  const keep = tab.autoDiscardable === false;
  return [
    canDiscard(tab) && { icon: 'sleep', label: '休眠', run: () => discardTabs([tab]) },
    { icon: keep ? 'unlock' : 'lock', label: keep ? '取消保持唤醒' : '保持唤醒', run: () => toggleAutoDiscard(tab) },
  ];
}

export function tabMenu(e, tab) {
  // 只算列表里看得见的:搜索过滤掉的标签页不会被关掉
  const visible = visibleTabs().map((x) => x.tab);
  const below = visible.slice(visible.findIndex((t) => t.id === tab.id) + 1);
  const children = listedTabs().filter((t) => tabParent.get(t.id) === tab.id).map((t) => t.id);
  showMenu(e, [
    { icon: 'edit', label: tabAlias.has(tab.id) ? '修改别名…' : '设置别名…', run: () => editTabAlias(tab.id) },
    '-',
    listedParent(tab.id) != null && { icon: 'outdent', label: '移出为顶级标签页', run: () => setTabParent(tab.id, null).then(render) },
    children.length > 0 && {
      icon: 'ungroup',
      label: '解除所有子标签',
      run: async () => {
        for (const id of children) await setTabParent(id, null);
        render();
      },
    },
    { icon: 'pin', label: '固定到当前空间', run: () => addItemFromTab(tab, 'pin') },
    { icon: 'star', label: '添加到收藏夹', run: () => addItemFromTab(tab, 'fav') },
    '-',
    { icon: 'link', label: '复制链接地址', run: () => copyText(tab.url, '已复制链接地址') },
    { icon: 'copy', label: '复制标签页', run: () => chrome.tabs.duplicate(tab.id) },
    // 只在正在发声或已经静音时显示,和行上的喇叭按钮一致
    (tab.audible || tab.mutedInfo?.muted) && { icon: tab.mutedInfo?.muted ? 'sound' : 'muted', label: tab.mutedInfo?.muted ? '取消静音' : '静音', run: () => chrome.tabs.update(tab.id, { muted: !tab.mutedInfo?.muted }) },
    ...memoryItems(tab),
    state.spaces.length > 1 && '-',
    ...state.spaces
      .filter((s) => s.id !== state.activeSpaceId)
      .map((s) => ({ icon: 'dot', color: s.color, label: `移到空间「${s.name}」`, run: () => moveTabToSpace(tab.id, s.id) })),
    '-',
    { icon: 'close', label: '关闭', run: () => closeTab(tab) },
    below.length > 0 && { icon: 'closeBelow', label: '关闭下方所有标签页', danger: true, run: () => closeWithUndo(below, `已关闭 ${below.length} 个标签页`) },
  ]);
}

export function itemMenu(e, { item, kind, space, folder }) {
  // 固定项:可以移进本空间的文件夹,或移出文件夹
  const folders = kind === 'pin' ? space.pinned.filter((x) => isFolder(x) && x !== folder) : [];
  const tab = tabs.find((t) => t.id === bind.get(item.id));
  // 标签页点进了别的页面
  const away = tab && isAway(item.url, tab.url);
  const what = kind === 'fav' ? '收藏' : '固定';
  showMenu(e, [
    { icon: 'edit', label: '编辑别名…', run: () => editItem(item.id) },
    { icon: 'link', label: '复制链接地址', run: () => copyText(tab?.url || item.url, '已复制链接地址') },
    away && { icon: 'back', label: `回到${what}地址`, run: () => backToItem(item) },
    // 对当前页面的操作:另存一份,或者拿它替换原来的地址;标签页本身不动
    away && '-',
    away && { header: '当前页面' },
    away && { icon: 'star', label: '加入收藏夹', run: () => savePageAsItem(tab, 'fav') },
    away && { icon: 'pin', label: '固定到当前空间', run: () => savePageAsItem(tab, 'pin') },
    away && { icon: 'swap', label: `替换原来的${what}地址`, run: () => syncItemToTab(item.id, tab) },
    '-',
    bind.has(item.id) && { icon: 'minus', label: `关闭标签页(保留${what})`, run: () => closeItemTab(item) },
    ...memoryItems(tab),
    kind === 'fav'
      ? { icon: 'move', label: '移到当前空间的固定标签', run: () => moveItem(item.id, 'pin') }
      : { icon: 'move', label: '移到收藏夹', run: () => moveItem(item.id, 'fav') },
    kind === 'pin' && '-',
    ...folders.map((f) => ({ icon: 'folder', label: `移到「${f.name}」`, run: () => moveToFolder(item.id, f.id) })),
    folder && { icon: 'outdent', label: '移出文件夹', run: () => moveToFolder(item.id, null) },
    kind === 'pin' && { icon: 'folderPlus', label: '新建文件夹并移入…', run: () => createFolder(item.id) },
    '-',
    { icon: kind === 'fav' ? 'trash' : 'unpin', label: kind === 'fav' ? '从收藏夹移除' : '取消固定', danger: true, run: () => removeItem(item.id, false) },
  ]);
}

export function folderMenu(e, id) {
  const folder = findFolder(id)?.folder;
  if (!folder) return;
  const folderTabs = folder.items.map((i) => tabs.find((t) => t.id === bind.get(i.id))).filter(Boolean);
  showMenu(e, [
    { icon: 'edit', label: '重命名…', run: () => renameFolder(id) },
    folderTabs.some(canDiscard) && { icon: 'sleep', label: '休眠文件夹里的标签页', run: () => discardTabs(folderTabs) },
    { icon: folder.noHistory ? 'eye' : 'eyeOff', label: folder.noHistory ? '关闭「不记录历史」' : '开启「不记录历史」', run: () => toggleFolderNoHistory(id) },
    '-',
    { icon: 'trash', label: '删除文件夹(保留里面的固定标签)', danger: true, run: () => deleteFolder(id) },
  ]);
}

export function spaceMenu(e, id) {
  const space = state.spaces.find((s) => s.id === id);
  // 这个空间的标签页:列表里属于它的,加上它的固定标签开着的(收藏所有空间共用,不算)
  const byTab = itemByTab();
  const pinnedTabIds = new Set(space ? pinnedItems(space).map((i) => bind.get(i.id)) : []);
  const spaceTabs = tabs.filter((t) => pinnedTabIds.has(t.id) || (!byTab.has(t.id) && tabSpace.get(t.id) === id));
  showMenu(e, [
    { icon: 'edit', label: '编辑空间…', run: () => editSpace(id) },
    { icon: 'plus', label: '新建空间…', run: addSpace },
    spaceTabs.some(canDiscard) && { icon: 'sleep', label: '休眠这个空间的标签页', run: () => discardTabs(spaceTabs) },
    id === activeSpace().id && { icon: 'folderPlus', label: '新建文件夹…', run: () => createFolder() },
    { icon: space?.noHistory ? 'eye' : 'eyeOff', label: space?.noHistory ? '关闭「不记录历史」' : '开启「不记录历史」', run: () => toggleNoHistory(id) },
    state.spaces.length > 1 && '-',
    state.spaces.length > 1 && { icon: 'trash', label: '删除空间', danger: true, run: () => deleteSpace(id) },
  ]);
}

// 「多久以前」:Chrome 记的关闭时间是秒
function ago(seconds) {
  const min = Math.floor((Date.now() / 1000 - seconds) / 60);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  if (min < 60 * 24) return `${Math.floor(min / 60)} 小时前`;
  return `${Math.floor(min / 60 / 24)} 天前`;
}

// 最近关闭的标签页:用 Chrome 自己的记录(只有本次启动以来的),不分空间;整个窗口的关闭记录跳过。
// 点一下用 Chrome 的方式恢复(保留前进后退记录),恢复出来的标签页归入当前空间
export async function recentMenu(e) {
  // 列表贴着按钮上方、左对齐弹出,不盖住底部这一行(按钮的位置要在等待之前记下)
  const anchor = e.currentTarget.getBoundingClientRect();
  const pos = { clientX: anchor.left, clientY: anchor.top, preventDefault() {} };
  const closed = (await chrome.sessions.getRecentlyClosed({ maxResults: 25 }).catch(() => [])).filter((s) => s.tab).slice(0, 10);
  showMenu(pos, [
    { header: closed.length ? '最近关闭' : '没有最近关闭的标签页' },
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
      label: '打开完整历史记录',
      note: /Mac/i.test(navigator.platform) ? '⌘Y' : 'Ctrl+H',
      run: () => chrome.tabs.create({ url: 'chrome://history', windowId }),
    },
  ]);
  // 用 offsetWidth/Height:弹出动画还在缩放时,getBoundingClientRect 量到的尺寸偏小
  const menu = $('#menu');
  menu.style.left = Math.max(4, Math.min(anchor.left, innerWidth - menu.offsetWidth - 4)) + 'px';
  menu.style.top = Math.max(4, anchor.top - menu.offsetHeight - 6) + 'px';
}
