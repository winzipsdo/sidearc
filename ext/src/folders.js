// 固定标签里的文件夹:{ id, folder: true, name, open, noHistory?, items: [项] }。
// 文件夹只放在空间的固定区顶层,里面只放固定项,不再嵌套。

import { t } from './i18n.js';
import { isFolder } from './logic.js';
import { render } from './render.js';
import { activeSpace, bind, findItem, save, state, tabs, takeItem, uid } from './store.js';
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

// 删除文件夹:里面的固定标签留下,放回文件夹原来的位置
export async function deleteFolder(id) {
  const hit = findFolder(id);
  if (!hit) return;
  const { folder, space } = hit;
  const at = space.pinned.indexOf(folder);
  space.pinned.splice(at, 1, ...folder.items);
  await save();
  render();
  pushUndo(t('folderDeleted', { name: folder.name }), async () => {
    const s = state.spaces.find((x) => x.id === space.id);
    if (!s || findFolder(id)) return;
    const ids = new Set(folder.items.map((i) => i.id));
    const items = folder.items.map((i) => s.pinned.find((x) => x.id === i.id)).filter(Boolean);
    s.pinned = s.pinned.filter((x) => !ids.has(x.id));
    s.pinned.splice(Math.min(at, s.pinned.length), 0, { ...folder, items });
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
