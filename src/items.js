// 对收藏夹和固定标签的操作。两者是同一种「项」({ id, title, url, alias? }),只是放的位置不同。

import { addressOf, pinnedItems, toUrl } from './logic.js';
import { render, schedule } from './render.js';
import {
  activeSpace,
  bind,
  findItem,
  itemByTab,
  save,
  setBind,
  setTabAlias,
  setTabParent,
  setTabSpace,
  state,
  tabAlias,
  tabParent,
  tabs,
  takeItem,
  uid,
  unbind,
  windowId,
} from './store.js';
import { createTab, focusTab } from './tabs.js';
import { ask, pushUndo, toast } from './ui.js';

export async function openItem(item) {
  const boundId = bind.get(item.id);
  let tab = boundId != null ? await chrome.tabs.get(boundId).catch(() => null) : null;
  if (!tab) {
    // 没有绑定的标签页:先复用同网址的普通标签页,否则新开
    const byTab = itemByTab();
    tab = tabs.find((t) => t.url === item.url && !byTab.has(t.id)) ?? (await createTab({ url: item.url, windowId }));
    await setBind(item.id, tab.id);
  }
  await focusTab(tab);
  schedule();
}

// 绑定的标签页点进了别的页面:让它回到固定的地址
export async function backToItem(item) {
  const tabId = bind.get(item.id);
  if (tabId == null) return;
  await chrome.tabs.update(tabId, { url: item.url }).catch(() => {});
}

export async function closeItemTab(item) {
  const tabId = bind.get(item.id);
  if (tabId == null) return;
  await unbind(item.id);
  await chrome.tabs.remove(tabId).catch(() => {});
  render();
}

// 标签页被固定项绑定后不再是列表里的父/子标签:自己脱离父级,子标签变成顶级(否则关掉固定项会连带关掉它们)
async function detachTab(tabId) {
  await setTabParent(tabId, null);
  for (const [child, parent] of [...tabParent]) if (parent === tabId) await setTabParent(child, null);
}

export async function itemFromTab(tab) {
  const item = { id: uid(), title: tab.title || tab.url, url: tab.url };
  if (tabAlias.has(tab.id)) item.alias = tabAlias.get(tab.id);
  await detachTab(tab.id);
  await setBind(item.id, tab.id);
  return item;
}

// 把标签页当前所在的页面另存为一个新的收藏/固定项。标签页本身不动:不绑定到新项,原来绑定的固定标签也照旧
export async function savePageAsItem(tab, zone) {
  const list = zone === 'fav' ? state.favorites : activeSpace().pinned;
  const where = zone === 'fav' ? '收藏夹' : '当前空间的固定标签';
  const address = addressOf(tab.url) ?? tab.url;
  const existing = zone === 'fav' ? list : pinnedItems(activeSpace());
  if (existing.some((i) => (addressOf(i.url) ?? i.url) === address)) return toast(`这个页面已经在${where}里了`);
  const item = { id: uid(), title: tab.title || tab.url, url: tab.url };
  list.push(item);
  await save();
  render();
  pushUndo(`已把「${item.title}」加入${where}`, async () => {
    // 保存后状态会被存储同步替换成新对象,所以按 id 找,而不是用上面的 list
    if (!takeItem(item.id)) return;
    await save();
    render();
  });
}

export async function addItemFromTab(tab, zone) {
  const item = await itemFromTab(tab);
  (zone === 'fav' ? state.favorites : activeSpace().pinned).push(item);
  await save();
  render();
}

export async function moveItem(id, zone) {
  const item = takeItem(id);
  if (!item) return;
  (zone === 'fav' ? state.favorites : activeSpace().pinned).push(item);
  await save();
  render();
}

export async function removeItem(id, openIfClosed) {
  const hit = findItem(id);
  if (!hit) return;
  const { item, kind } = hit;
  const spaceId = hit.space?.id;
  const folderId = hit.folder?.id;
  const index = hit.list.indexOf(item);
  takeItem(id);
  let tabId = bind.get(id);
  if (tabId != null) {
    await unbind(id);
    await setTabSpace(tabId, state.activeSpaceId);
    await setTabAlias(tabId, item.alias);
  } else if (openIfClosed) {
    tabId = (await createTab({ url: item.url, windowId, active: false })).id;
  }
  await save();
  render();

  // 可能是误操作:放回原来的位置,标签页还在的话重新绑上
  pushUndo(`已${kind === 'fav' ? '从收藏夹移除' : '取消固定'}「${item.alias || item.title}」`, async () => {
    // 原来在文件夹里就放回文件夹;文件夹已经没了就放到固定区顶层
    const space = state.spaces.find((s) => s.id === spaceId);
    const arr = kind === 'fav' ? state.favorites : (space?.pinned.find((f) => f.id === folderId)?.items ?? space?.pinned);
    if (!arr || findItem(id)) return;
    arr.splice(Math.min(index, arr.length), 0, item);
    const tab = tabId != null && (await chrome.tabs.get(tabId).catch(() => null));
    if (tab) {
      await detachTab(tab.id);
      await setBind(id, tab.id);
    }
    await save();
    render();
  });
}

export async function editItem(id) {
  const item = findItem(id)?.item;
  if (!item) return;
  const out = await ask('编辑', [
    { key: 'alias', label: '别名(可留空)', value: item.alias, optional: true },
    { key: 'title', label: '名称(留空则还原为网页标题)', value: item.title, optional: true },
    { key: 'url', label: '网址', value: item.url },
  ]);
  const target = out && findItem(id)?.item;
  if (!target) return;
  target.url = toUrl(out.url) ?? out.url;
  // 名称留空:还原成网页自己的标题;标签页没开着就拿不到,保留原来的
  target.title = out.title || tabs.find((t) => t.id === bind.get(id))?.title || target.title || target.url;
  if (out.alias) target.alias = out.alias;
  else delete target.alias;
  await save();
  render();
}

// 把项的网址和名称更新成它当前打开着的页面
export async function syncItemToTab(id, tab) {
  const target = findItem(id)?.item;
  if (!target) return;
  Object.assign(target, { url: tab.url, title: tab.title || tab.url });
  await save();
  render();
}
