// 三种右键菜单的内容:标签页、收藏/固定项、空间。

import { $ } from './dom.js';
import { addItemFromTab, backToItem, closeItemTab, editItem, moveItem, removeItem, syncItemToTab } from './items.js';
import { isAway } from './logic.js';
import { render } from './render.js';
import { addSpace, deleteSpace, editSpace, toggleNoHistory } from './spaces.js';
import { bind, listedParent, listedTabs, setTabParent, state, tabAlias, tabParent, tabs, visibleTabs } from './store.js';
import { closeTab, closeWithUndo, editTabAlias, moveTabToSpace } from './tabs.js';
import { copyText, showMenu } from './ui.js';

export function tabMenu(e, tab) {
  // 只算列表里看得见的:搜索过滤掉的标签页不会被关掉
  const visible = visibleTabs().map((x) => x.tab);
  const below = visible.slice(visible.findIndex((t) => t.id === tab.id) + 1);
  const children = listedTabs().filter((t) => tabParent.get(t.id) === tab.id).map((t) => t.id);
  showMenu(e, [
    { label: tabAlias.has(tab.id) ? '修改别名…' : '设置别名…', run: () => editTabAlias(tab.id) },
    '-',
    listedParent(tab.id) != null && { label: '移出为顶级标签页', run: () => setTabParent(tab.id, null).then(render) },
    children.length && {
      label: '解除所有子标签',
      run: async () => {
        for (const id of children) await setTabParent(id, null);
        render();
      },
    },
    { label: '固定到当前空间', run: () => addItemFromTab(tab, 'pin') },
    { label: '添加到收藏夹', run: () => addItemFromTab(tab, 'fav') },
    '-',
    { label: '复制链接地址', run: () => copyText(tab.url, '已复制链接地址') },
    { label: '复制标签页', run: () => chrome.tabs.duplicate(tab.id) },
    { label: '重新加载', run: () => chrome.tabs.reload(tab.id) },
    { label: tab.mutedInfo?.muted ? '取消静音' : '静音', run: () => chrome.tabs.update(tab.id, { muted: !tab.mutedInfo?.muted }) },
    state.spaces.length > 1 && '-',
    ...state.spaces
      .filter((s) => s.id !== state.activeSpaceId)
      .map((s) => ({ label: `移到空间「${s.name}」`, run: () => moveTabToSpace(tab.id, s.id) })),
    '-',
    { label: '关闭', run: () => closeTab(tab) },
    below.length && { label: '关闭下方所有标签页', danger: true, run: () => closeWithUndo(below, `已关闭 ${below.length} 个标签页`) },
  ]);
}

export function itemMenu(e, { item, kind }) {
  const tab = tabs.find((t) => t.id === bind.get(item.id));
  showMenu(e, [
    { label: '编辑别名…', run: () => editItem(item.id) },
    { label: '复制链接地址', run: () => copyText(tab?.url || item.url, '已复制链接地址') },
    tab && isAway(item.url, tab.url) && { label: '回到固定地址', run: () => backToItem(item) },
    tab && { label: '将网址更新为当前页面', run: () => syncItemToTab(item.id, tab) },
    bind.has(item.id) && { label: '关闭标签页(保留固定)', run: () => closeItemTab(item) },
    kind === 'fav'
      ? { label: '移到当前空间的固定标签', run: () => moveItem(item.id, 'pin') }
      : { label: '移到收藏夹', run: () => moveItem(item.id, 'fav') },
    '-',
    { label: kind === 'fav' ? '从收藏夹移除' : '取消固定', danger: true, run: () => removeItem(item.id, false) },
  ]);
}

export function spaceMenu(e, id) {
  const space = state.spaces.find((s) => s.id === id);
  showMenu(e, [
    { label: '编辑空间…', run: () => editSpace(id) },
    { label: '新建空间…', run: addSpace },
    { label: space?.noHistory ? '关闭「不记录历史」' : '开启「不记录历史」', run: () => toggleNoHistory(id) },
    { label: '从 Arc 导入…', run: () => $('#arc-file').click() },
    state.spaces.length > 1 && '-',
    state.spaces.length > 1 && { label: '删除空间', danger: true, run: () => deleteSpace(id) },
  ]);
}
