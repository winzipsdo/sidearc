// 对收藏夹和固定标签的操作。两者是同一种「项」({ id, title, url, alias? }),只是放的位置不同。

import { t } from './i18n.js?v=7f47949b';
import { addressOf, isAway, isFolder, pinnedItems, toUrl } from './logic.js?v=7f47949b';
import { MSG } from './protocol.js?v=7f47949b';
import { render, schedule } from './render.js?v=7f47949b';
import {
  activeSpace,
  bind,
  findItem,
  itemByTab,
  refreshTabs,
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
} from './store.js?v=7f47949b';
import { createTab, focusTab, returnBeforeClose } from './tabs.js?v=7f47949b';
import { ask, pushUndo, toast } from './ui.js?v=7f47949b';

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
  // 解绑到关掉之间不重画:不然它会先作为普通标签页在下面的列表里闪一下(连同积着的落叶),再被关掉
  setRenderHeld(true);
  try {
    await unbind(item.id);
    await returnBeforeClose(new Set([tabId]));
    await chrome.tabs.remove(tabId).catch(() => {});
  } finally {
    setRenderHeld(false);
  }
  // 重画前重新读一遍标签页:手里的列表还是关之前读的,里面还有它,已经解绑了,会被当成普通标签页画出来一下(带着落叶)
  await refreshTabs();
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

// 一项(或固定区顶层的一个文件夹)现在放在哪:收藏夹,或者哪个空间的固定区、哪个文件夹里,以及第几个。撤销挪动时按它放回去
function placeOf(id) {
  const fav = state.favorites.findIndex((x) => x.id === id);
  if (fav >= 0) return { id, fav: true, index: fav };
  for (const space of state.spaces) {
    const top = space.pinned.findIndex((x) => x.id === id);
    if (top >= 0) return { id, spaceId: space.id, folderId: null, index: top };
    for (const f of space.pinned.filter(isFolder)) {
      const i = f.items.findIndex((x) => x.id === id);
      if (i >= 0) return { id, spaceId: space.id, folderId: f.id, index: i };
    }
  }
  return null;
}
export const placesOf = (ids) => ids.map(placeOf).filter(Boolean);

// 按 placesOf 记下的位置放回去:先全部取出来,再按原来的位置从前往后插,同一个数组里的几项也能各回各位。
// 原来的文件夹没了就放到那个空间的固定区顶层;空间也没了的不动。gone 是已经不在任何地方的项(撤销取消固定时):id -> 项
export function putBack(places, gone = new Map()) {
  const dest = (p, obj) => {
    if (p.fav) return state.favorites;
    const space = state.spaces.find((s) => s.id === p.spaceId);
    return space && ((p.folderId && !isFolder(obj) && space.pinned.find((f) => f.id === p.folderId)?.items) || space.pinned);
  };
  const moving = places
    .map((p) => {
      const obj = findItem(p.id)?.item ?? findFolder(p.id) ?? gone.get(p.id);
      return obj && dest(p, obj) && { p, obj: takeItem(p.id) ?? gone.get(p.id) };
    })
    .filter((x) => x?.obj);
  for (const { p, obj } of moving.sort((a, b) => a.p.index - b.p.index)) {
    const arr = dest(p, obj);
    arr.splice(Math.min(p.index, arr.length), 0, obj);
  }
}
const findFolder = (id) => state.spaces.flatMap((s) => s.pinned).find((x) => isFolder(x) && x.id === id);

// 挪动项或文件夹(只改它们在哪个数组、第几个),可以撤销。change 做实际的挪动,做完存盘重画;撤销时放回原处
export async function moveWithUndo(ids, text, change) {
  const places = placesOf(ids);
  if ((await change()) === false) return;
  await save();
  render();
  pushUndo(text, async () => {
    putBack(places);
    await save();
    render();
  });
}

// 挪动 ids 这几项时提示条上的话:一项写名字,多项写个数
export function movedText(ids) {
  if (ids.length > 1) return t('movedN', { n: ids.length });
  const x = findItem(ids[0])?.item ?? findFolder(ids[0]);
  return t('movedItem', { title: x?.alias || x?.title || x?.name || '' });
}

// 把固定标签移到另一个空间的固定区,放在最后,可以撤销。开着的标签页跟着一起过去(它属于固定标签所在的空间)
export async function moveItemsToSpace(ids, spaceId) {
  const target = state.spaces.find((s) => s.id === spaceId);
  const hits = ids.map(findItem).filter((hit) => hit?.kind === 'pin' && hit.space.id !== spaceId);
  if (!target || !hits.length) return;
  const places = placesOf(hits.map((hit) => hit.item.id));
  const from = new Map(hits.map((hit) => [hit.item.id, hit.space.id]));
  for (const { item } of hits) {
    target.pinned.push(takeItem(item.id));
    // 会话里记的空间也改过去,免得以后取消固定时标签页回到原来的空间
    const tabId = bind.get(item.id);
    if (tabId != null) await setTabSpace(tabId, spaceId);
  }
  await save();
  render();
  const [{ item }] = hits;
  const text = hits.length > 1 ? t('movedNToSpace', { n: hits.length, name: target.name }) : t('movedToSpace', { title: item.alias || item.title, name: target.name });
  pushUndo(text, async () => {
    // 放回原来的空间和位置(原来在文件夹里就放回文件夹;文件夹没了就放顶层)
    putBack(places);
    for (const [id, sid] of from) {
      const tabId = bind.get(id);
      if (tabId != null && findItem(id)?.space?.id === sid) await setTabSpace(tabId, sid);
    }
    await save();
    render();
  });
}
export const moveItemToSpace = (id, spaceId) => moveItemsToSpace([id], spaceId);

// 收藏和固定标签之间挪(放在最后)
export async function moveItems(ids, zone) {
  const list = zone === 'fav' ? state.favorites : activeSpace().pinned;
  for (const id of ids) {
    const item = takeItem(id);
    if (item) list.push(item);
  }
  await save();
  render();
}
export const moveItem = (id, zone) => moveItems([id], zone);

// 把项取下来,不留撤销:开着的标签页解绑,回到 spaceId 空间(默认当前空间)的列表里,带上别名;
// openIfClosed:没开着的也打开(拖到列表里时)。返回 [{ item, kind, tabId }]
export async function detachItems(ids, openIfClosed, spaceId = state.activeSpaceId) {
  const gone = [];
  for (const id of ids) {
    const hit = findItem(id);
    if (!hit) continue;
    takeItem(id);
    let tabId = bind.get(id);
    if (tabId != null) {
      await unbind(id);
      await setTabSpace(tabId, spaceId);
      await setTabAlias(tabId, hit.item.alias);
    } else if (openIfClosed) {
      tabId = (await createTab({ url: hit.item.url, windowId, active: false })).id;
    }
    gone.push({ item: hit.item, kind: hit.kind, tabId });
  }
  await save();
  render();
  return gone;
}

// 取消固定 / 从收藏夹移除,可以撤销
export async function removeItems(ids, openIfClosed) {
  const places = placesOf(ids);
  const gone = await detachItems(ids, openIfClosed);
  if (!gone.length) return;
  const [{ item, kind }] = gone;
  const text = gone.length > 1 ? t('unpinnedN', { n: gone.length }) : t(kind === 'fav' ? 'removedFromFavs' : 'unpinned', { title: item.alias || item.title });
  // 可能是误操作:放回原来的位置,标签页还在的话重新绑上
  pushUndo(text, async () => {
    putBack(places, new Map(gone.map((g) => [g.item.id, g.item])));
    for (const { item, tabId } of gone) {
      const tab = tabId != null && (await chrome.tabs.get(tabId).catch(() => null));
      if (tab && findItem(item.id)) {
        await detachTab(tab.id);
        await setBind(item.id, tab.id);
      }
    }
    await save();
    render();
  });
}
export const removeItem = (id, openIfClosed) => removeItems([id], openIfClosed);

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
