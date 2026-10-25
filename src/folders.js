// 固定标签里的文件夹:{ id, folder: true, name, open, noHistory?, items: [项] }。
// 文件夹只放在空间的固定区顶层,里面只放固定项,不再嵌套。

import { t } from './i18n.js';
import { isFolder } from './logic.js';
import { render } from './render.js';
import { closeItemTab, detachTab } from './items.js';
import { activeSpace, bind, findItem, save, setBind, setTabAlias, setTabSpace, state, tabs, takeItem, uid, unbind, windowId } from './store.js';
import { createTab, returnBeforeClose } from './tabs.js';
import { ask, pushUndo, toast } from './ui.js';

export function findFolder(id) {
  for (const space of state.spaces) {
    const folder = space.pinned.find((x) => isFolder(x) && x.id === id);
    if (folder) return { folder, space };
  }
  return null;
}

// 新建文件夹;给了 itemId 就把那个固定项移进去
export async function createFolder(itemId) {
  const out = await ask(t('newFolderTitle'), [{ key: 'name', label: t('name'), value: '' }]);
  if (!out) return;
  const folder = { id: uid(), folder: true, name: out.name, open: true, items: [] };
  const space = activeSpace();
  const hit = itemId && findItem(itemId);
  // 放在被移入的那一项原来的位置,否则放在固定区最后
  const at = hit && hit.list === space.pinned ? space.pinned.indexOf(hit.item) : space.pinned.length;
  const item = itemId && takeItem(itemId);
  if (item) folder.items.push(item);
  space.pinned.splice(at, 0, folder);
  await save();
  render();
}

export async function renameFolder(id) {
  const folder = findFolder(id)?.folder;
  if (!folder) return;
  const out = await ask(t('renameFolderTitle'), [{ key: 'name', label: t('name'), value: folder.name }]);
  const target = out && findFolder(id)?.folder;
  if (!target) return;
  target.name = out.name;
  await save();
  render();
}

export async function toggleFolder(id) {
  const folder = findFolder(id)?.folder;
  if (!folder) return;
  folder.open = !folder.open;
  await save();
  render();
}

// 不记录历史:文件夹里的项打开的标签页,访问记录由 background.js 立刻删掉;开启时顺手清掉已打开页面的记录
export async function toggleFolderNoHistory(id) {
  const folder = findFolder(id)?.folder;
  if (!folder) return;
  folder.noHistory = !folder.noHistory;
  if (!folder.noHistory) delete folder.noHistory;
  await save();
  render();
  if (folder.noHistory) {
    for (const item of folder.items) {
      const tab = tabs.find((t) => t.id === bind.get(item.id));
      if (tab?.url) chrome.history.deleteUrl({ url: tab.url }).catch(() => {});
    }
  }
  toast(t(folder.noHistory ? 'folderNoHistoryOn' : 'folderNoHistoryOff', { name: folder.name }));
}

// 关掉文件夹里所有开着的标签页,固定标签都留着(和单个固定标签的「关闭」一样,点一下就重新打开)。
// 一下关好几个可能是手滑,所以可以撤销:先用浏览器的「最近关闭」恢复(保留前进后退记录),找不到就按固定的地址重新打开,再绑回原来的固定标签
export async function closeFolderTabs(id) {
  const folder = findFolder(id)?.folder;
  if (!folder) return;
  const open = folder.items.filter((i) => bind.has(i.id)).map((i) => ({ item: i, tab: tabs.find((t) => t.id === bind.get(i.id)) }));
  if (!open.length) return;
  await returnBeforeClose(new Set(open.map((x) => bind.get(x.item.id))));
  for (const { item } of open) await closeItemTab(item);
  pushUndo(t('closedTabs', { n: open.length }), async () => {
    const recent = (await chrome.sessions.getRecentlyClosed().catch(() => [])).filter((s) => s.tab);
    for (const { item, tab: was } of open) {
      if (!findItem(item.id) || bind.has(item.id)) continue;
      const url = was?.url || item.url;
      const i = recent.findIndex((r) => r.tab.url === url);
      let tab = i < 0 ? null : (await chrome.sessions.restore(recent.splice(i, 1)[0].tab.sessionId).catch(() => null))?.tab;
      tab ??= await createTab({ url: item.url, windowId, active: false }).catch(() => null);
      if (!tab) continue;
      await detachTab(tab.id);
      await setBind(item.id, tab.id);
    }
    render();
  });
}

// 删除文件夹:连同里面的固定标签一起删。开着的标签页留下,变成这个空间里的普通标签页(和取消固定一样)
export async function deleteFolder(id) {
  const hit = findFolder(id);
  if (!hit) return;
  const { folder, space } = hit;
  const at = space.pinned.indexOf(folder);
  space.pinned.splice(at, 1);
  const opened = [];
  for (const item of folder.items) {
    const tabId = bind.get(item.id);
    if (tabId == null) continue;
    opened.push([item.id, tabId]);
    await unbind(item.id);
    await setTabSpace(tabId, space.id);
    await setTabAlias(tabId, item.alias);
  }
  await save();
  render();
  pushUndo(t('folderDeleted', { name: folder.name }), async () => {
    const s = state.spaces.find((x) => x.id === space.id);
    if (!s || findFolder(id)) return;
    s.pinned.splice(Math.min(at, s.pinned.length), 0, folder);
    // 标签页还开着的话重新绑回原来的固定标签
    for (const [itemId, tabId] of opened) {
      if (!(await chrome.tabs.get(tabId).catch(() => null))) continue;
      await detachTab(tabId);
      await setBind(itemId, tabId);
    }
    await save();
    render();
  });
}

// 把固定项移进文件夹(folderId 为 null 则移出到固定区顶层,放在原文件夹后面)
export async function moveToFolder(itemId, folderId) {
  const hit = findItem(itemId);
  if (!hit || hit.kind !== 'pin') return;
  const space = hit.space;
  if (folderId == null) {
    if (!hit.folder) return;
    const item = takeItem(itemId);
    space.pinned.splice(space.pinned.indexOf(hit.folder) + 1, 0, item);
  } else {
    const folder = space.pinned.find((x) => isFolder(x) && x.id === folderId);
    if (!folder) return;
    folder.items.push(takeItem(itemId));
    folder.open = true;
  }
  await save();
  render();
}
