// 三种右键菜单的内容:标签页、收藏/固定项、空间。

import { addItemFromTab, backToItem, closeItemTab, editItem, moveItem, removeItem, savePageAsItem, syncItemToTab } from './items.js';
import { isAway, isFolder } from './logic.js';
import { createFolder, deleteFolder, findFolder, moveToFolder, renameFolder, toggleFolderNoHistory } from './folders.js';
import { render } from './render.js';
import { addSpace, deleteSpace, editSpace, toggleNoHistory } from './spaces.js';
import { activeSpace, bind, listedParent, listedTabs, setTabParent, state, tabAlias, tabParent, tabs, visibleTabs } from './store.js';
import { closeTab, closeWithUndo, editTabAlias, moveTabToSpace } from './tabs.js';
import { copyText, showMenu } from './ui.js';

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
    { icon: 'reload', label: '重新加载', run: () => chrome.tabs.reload(tab.id) },
    { icon: tab.mutedInfo?.muted ? 'sound' : 'muted', label: tab.mutedInfo?.muted ? '取消静音' : '静音', run: () => chrome.tabs.update(tab.id, { muted: !tab.mutedInfo?.muted }) },
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
  showMenu(e, [
    { icon: 'edit', label: '重命名…', run: () => renameFolder(id) },
    { icon: folder.noHistory ? 'eye' : 'eyeOff', label: folder.noHistory ? '关闭「不记录历史」' : '开启「不记录历史」', run: () => toggleFolderNoHistory(id) },
    '-',
    { icon: 'trash', label: '删除文件夹(保留里面的固定标签)', danger: true, run: () => deleteFolder(id) },
  ]);
}

export function spaceMenu(e, id) {
  const space = state.spaces.find((s) => s.id === id);
  showMenu(e, [
    { icon: 'edit', label: '编辑空间…', run: () => editSpace(id) },
    { icon: 'plus', label: '新建空间…', run: addSpace },
    id === activeSpace().id && { icon: 'folderPlus', label: '新建文件夹…', run: () => createFolder() },
    { icon: space?.noHistory ? 'eye' : 'eyeOff', label: space?.noHistory ? '关闭「不记录历史」' : '开启「不记录历史」', run: () => toggleNoHistory(id) },
    state.spaces.length > 1 && '-',
    state.spaces.length > 1 && { icon: 'trash', label: '删除空间', danger: true, run: () => deleteSpace(id) },
  ]);
}
