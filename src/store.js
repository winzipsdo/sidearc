// 侧边栏的全部状态,以及只读写状态、不碰界面的函数。
// 其他模块直接读这里导出的变量;需要整体替换的,用下面的 set* 函数。

import { buildTree, matchesQuery, pinnedItems, pinnedLists } from './logic.js';
import { KEY, PREFIX } from './protocol.js';

export const COLORS = ['#6b7cff', '#e5687a', '#f0913f', '#d9a927', '#4fae6e', '#3aa7b8', '#a06be0', '#8a8f98'];
export const uid = () => crypto.randomUUID().slice(0, 8);

// 持久数据(chrome.storage.local)
export const state = { spaces: [], favorites: [], activeSpaceId: null };
// 会话数据(chrome.storage.session),键的格式见 protocol.js
export const tabSpace = new Map();
export const bind = new Map();
export const tabAlias = new Map();
export const tabParent = new Map();
const SESSION_MAPS = { [PREFIX.space]: tabSpace, [PREFIX.bind]: bind, [PREFIX.alias]: tabAlias, [PREFIX.parent]: tabParent };

export const tabs = [];
export let windowId;
export let query = '';
export let dragging = null;
export let renderPending = false;

export const setWindowId = (id) => (windowId = id);
export const setQuery = (text) => (query = text);
export const setDragging = (d) => (dragging = d);
export const setRenderPending = (pending) => (renderPending = pending);
// state 和 tabs 被各处直接引用,所以原地换内容,不换对象
export function setState(next) {
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, next);
}
function setTabs(next) {
  tabs.splice(0, tabs.length, ...next);
}

export const matches = (...texts) => matchesQuery(query, texts);

function defaultState() {
  const id = uid();
  return { spaces: [{ id, name: '个人', color: COLORS[0], pinned: [] }], favorites: [], activeSpaceId: id };
}

export function normalize() {
  if (!state.spaces?.length) setState(defaultState());
  state.favorites ??= [];
  if (!state.spaces.some((s) => s.id === state.activeSpaceId)) state.activeSpaceId = state.spaces[0].id;
}

export const save = () => chrome.storage.local.set({ state });
export const activeSpace = () => state.spaces.find((s) => s.id === state.activeSpaceId) ?? state.spaces[0];

export function applySession(key, value) {
  const map = key[1] === ':' && SESSION_MAPS[key[0]];
  if (!map) return;
  const k = map === bind ? key.slice(2) : +key.slice(2);
  if (value === undefined) map.delete(k);
  else map.set(k, value);
}

export function setTabSpace(tabId, spaceId) {
  tabSpace.set(tabId, spaceId);
  return chrome.storage.session.set({ [KEY.space(tabId)]: spaceId });
}
export function setTabAlias(tabId, alias) {
  if (!alias) {
    tabAlias.delete(tabId);
    return chrome.storage.session.remove(KEY.alias(tabId));
  }
  tabAlias.set(tabId, alias);
  return chrome.storage.session.set({ [KEY.alias(tabId)]: alias });
}
export function setTabParent(tabId, parentId) {
  if (parentId == null) {
    tabParent.delete(tabId);
    return chrome.storage.session.remove(KEY.parent(tabId));
  }
  tabParent.set(tabId, parentId);
  return chrome.storage.session.set({ [KEY.parent(tabId)]: parentId });
}
export function setBind(itemId, tabId) {
  bind.set(itemId, tabId);
  return chrome.storage.session.set({ [KEY.bind(itemId)]: tabId });
}
export function unbind(itemId) {
  bind.delete(itemId);
  return chrome.storage.session.remove(KEY.bind(itemId));
}

// tabId -> 绑定到它的收藏/固定项
export function itemByTab() {
  const m = new Map();
  const add = (item, kind, space) => {
    const t = bind.get(item.id);
    if (t != null) m.set(t, { item, kind, space });
  };
  state.favorites.forEach((i) => add(i, 'fav'));
  state.spaces.forEach((s) => pinnedItems(s).forEach((i) => add(i, 'pin', s)));
  return m;
}

// 找收藏/固定项。固定项还带上它所在的数组 list,在文件夹里时还有 folder
export function findItem(id) {
  let item = state.favorites.find((x) => x.id === id);
  if (item) return { item, kind: 'fav', list: state.favorites };
  for (const space of state.spaces) {
    for (const list of pinnedLists(space)) {
      item = list.find((x) => x.id === id && !x.folder);
      if (item) return { item, kind: 'pin', space, list, folder: list === space.pinned ? null : space.pinned.find((f) => f.items === list) };
    }
  }
  return null;
}

// 从所在的数组里取出(收藏、固定项,或者顶层的文件夹)
export function takeItem(id) {
  for (const arr of [state.favorites, ...state.spaces.flatMap(pinnedLists)]) {
    const i = arr.findIndex((x) => x.id === id);
    if (i >= 0) return arr.splice(i, 1)[0];
  }
  return null;
}

export function listedTabs() {
  const byTab = itemByTab();
  const sid = activeSpace().id;
  return tabs.filter((t) => !byTab.has(t.id) && tabSpace.get(t.id) === sid);
}

// 当前空间的标签页按树形排好:[{ tab, depth }]
export const treeTabs = () => buildTree(listedTabs(), tabParent);

// 实际显示的行:搜索时平铺,只留匹配项
export function visibleTabs() {
  const tree = treeTabs();
  if (!query.trim()) return tree;
  return tree.filter(({ tab }) => matches(tabAlias.get(tab.id), tab.title, tab.url)).map(({ tab }) => ({ tab, depth: 0 }));
}

// 某个标签页在列表里的父标签页(不在当前列表里则视为没有)
export function listedParent(tabId) {
  const p = tabParent.get(tabId);
  return p != null && listedTabs().some((t) => t.id === p) ? p : null;
}

// tabId 及其所有后代,按树形顺序
export function subtreeIds(tabId) {
  const tree = treeTabs();
  const i = tree.findIndex((x) => x.tab.id === tabId);
  if (i < 0) return [tabId];
  const out = [tabId];
  for (let j = i + 1; j < tree.length && tree[j].depth > tree[i].depth; j++) out.push(tree[j].tab.id);
  return out;
}

// 重新读取本窗口的标签页(启动时已经读好的可以直接传进来)
export async function refreshTabs(current) {
  setTabs(current ?? (await chrome.tabs.query({ windowId })));
  // 还没有归属的标签页(新开的、重启后恢复的)归入当前空间。
  // 不跟着 openerTabId 走:Ctrl+T 新建的标签页也带着它(值是当时的前台标签页,可能在别的空间);
  // 网页里点开的链接由后台按来源标签页分好空间,到这里时已经有归属了
  const fresh = {};
  for (const t of tabs) {
    if (!tabSpace.has(t.id)) {
      tabSpace.set(t.id, state.activeSpaceId);
      fresh[KEY.space(t.id)] = state.activeSpaceId;
    }
  }
  // 不用等写完:内存里已经记上了,先让界面画出来
  if (Object.keys(fresh).length) chrome.storage.session.set(fresh);
}

// 激活的标签页属于别的空间时,侧边栏跟过去
export function followSpace(tabId) {
  const hit = itemByTab().get(tabId);
  if (hit?.kind === 'fav') return;
  const sid = hit ? hit.space.id : tabSpace.get(tabId);
  if (sid && sid !== state.activeSpaceId && state.spaces.some((s) => s.id === sid)) {
    state.activeSpaceId = sid;
    save();
  }
}
