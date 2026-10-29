// 对收藏夹和固定标签的操作。两者是同一种「项」({ id, title, url, alias? }),只是放的位置不同。

import { t } from './i18n.js';
import { addressOf, isAway, pinnedItems, toUrl } from './logic.js';
import { MSG } from './protocol.js';
import { render, schedule } from './render.js';
import {
  activeSpace,
  bind,
  findItem,
  itemByTab,
  save,
  setBind,
  setRenderHeld,
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
import { createTab, focusTab, returnBeforeClose } from './tabs.js';
import { ask, pushUndo, toast } from './ui.js';

// 复制一个收藏/固定标签:副本放在它正下方(在文件夹里就还在这个文件夹里)。
// 原来开着的,副本也用 Chrome 的复制打开(连前进后退记录)并绑上;没开的副本也先不开。
// 原来的点进了别的页面(有返回按钮):副本就以当前页面为地址和名称,不带返回状态,别名也不带(那是原来地址的)
export async function duplicateItem(id) {
  const hit = findItem(id);
  if (!hit) return;
  const { item, list } = hit;
  const tab = tabs.find((t) => t.id === bind.get(id));
  const away = tab && isAway(item.url, tab.url);
  const copy = away ? { id: uid(), title: tab.title || tab.url, url: tab.url } : { id: uid(), title: item.title, url: item.url };
  if (!away && item.alias) copy.alias = item.alias;
  if (!away && item.named) copy.named = true;
  list.splice(list.indexOf(item) + 1, 0, copy);
  await save();
  const tabId = bind.get(id);
  if (tabId != null) {
    // 复制出来的标签页在绑上之前不重画,免得先出现在下面的标签页列表里再跳上来
    setRenderHeld(true);
    try {
      const tab = await chrome.tabs.duplicate(tabId).catch(() => null);
      if (tab) {
        await chrome.runtime.sendMessage({ [MSG.keepTab]: tab.id }).catch(() => {});
        await detachTab(tab.id);
        await setBind(copy.id, tab.id);
      }
    } finally {
      setRenderHeld(false);
    }
  }
  render();
}

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

// 收藏/固定项绑定的标签页:切换静音
export async function toggleItemMute(item) {
  const tab = tabs.find((t) => t.id === bind.get(item.id));
  if (tab) await chrome.tabs.update(tab.id, { muted: !tab.mutedInfo?.muted }).catch(() => {});
}

export async function closeItemTab(item) {
  const tabId = bind.get(item.id);
  if (tabId == null) return;
  // 先解绑再关,后台就认不出它是固定项的标签页了:它的子标签要在这里先放开,免得被连带关闭
  for (const [child, parent] of [...tabParent]) if (parent === tabId) await setTabParent(child, null);
  await unbind(item.id);
  await returnBeforeClose(new Set([tabId]));
  await chrome.tabs.remove(tabId).catch(() => {});
  render();
}

// 标签页被固定项绑定后不再是列表里的父/子标签:自己脱离父级,子标签变成顶级(否则关掉固定项会连带关掉它们)
export async function detachTab(tabId) {
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
  const where = zone === 'fav' ? t('whereFavs') : t('wherePins');
  const address = addressOf(tab.url) ?? tab.url;
  const existing = zone === 'fav' ? list : pinnedItems(activeSpace());
  if (existing.some((i) => (addressOf(i.url) ?? i.url) === address)) return toast(t('alreadySaved', { where }));
  const item = { id: uid(), title: tab.title || tab.url, url: tab.url };
  list.push(item);
  await save();
  render();
  pushUndo(t('saved', { title: item.title, where }), async () => {
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

// 把固定标签移到另一个空间的固定区,放在最后。开着的标签页跟着一起过去(它属于固定标签所在的空间)
export async function moveItemToSpace(id, spaceId) {
  const hit = findItem(id);
  const target = state.spaces.find((s) => s.id === spaceId);
  if (!hit || hit.kind !== 'pin' || !target) return;
  const from = { spaceId: hit.space.id, folderId: hit.folder?.id, index: hit.list.indexOf(hit.item) };
  const item = takeItem(id);
  target.pinned.push(item);
  // 会话里记的空间也改过去,免得以后取消固定时标签页回到原来的空间
  const tabId = bind.get(id);
  if (tabId != null) await setTabSpace(tabId, spaceId);
  await save();
  render();
  pushUndo(t('movedToSpace', { title: item.alias || item.title, name: target.name }), async () => {
    // 放回原来的空间和位置(原来在文件夹里就放回文件夹;文件夹没了就放顶层)
    const space = state.spaces.find((s) => s.id === from.spaceId);
    const arr = space?.pinned.find((f) => f.id === from.folderId)?.items ?? space?.pinned;
    const back = arr && takeItem(id);
    if (!back) return;
    arr.splice(Math.min(from.index, arr.length), 0, back);
    if (tabId != null) await setTabSpace(tabId, from.spaceId);
    await save();
    render();
  });
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
  pushUndo(t(kind === 'fav' ? 'removedFromFavs' : 'unpinned', { title: item.alias || item.title }), async () => {
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
  const out = await ask(t('editItemTitle'), [
    { key: 'alias', label: t('alias'), value: item.alias, placeholder: t('optionalHint'), optional: true },
    // 名称留空会还原成网页标题:标签页开着就直接拿那个标题当提示字
    { key: 'title', label: t('name'), value: item.title, placeholder: tabs.find((t) => t.id === bind.get(id))?.title || t('titleHint'), optional: true },
    { key: 'url', label: t('url'), value: item.url },
  ]);
  const target = out && findItem(id)?.item;
  if (!target) return;
  target.url = toUrl(out.url) ?? out.url;
  // 名称留空:还原成网页自己的标题(标签页没开着就拿不到,保留原来的),之后跟着网页标题走;
  // 改成了别的名称:记下 named,不再跟着网页标题变(见 store.js 的 syncItemTitles)
  if (!out.title) delete target.named;
  else if (out.title !== target.title) target.named = true;
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
  delete target.named; // 用的是网页自己的标题,之后接着跟网页标题走
  await save();
  render();
}
