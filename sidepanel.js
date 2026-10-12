const COLORS = ['#6b7cff', '#e5687a', '#f0913f', '#d9a927', '#4fae6e', '#3aa7b8', '#a06be0', '#8a8f98'];
const FALLBACK_ICON =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.5" fill="none" stroke="#999" stroke-width="1.4"/><path d="M1.5 8h13M8 1.5c-4 4.5-4 8.5 0 13M8 1.5c4 4.5 4 8.5 0 13" fill="none" stroke="#999" stroke-width="1.2"/></svg>'
  );

const svg = (d) =>
  `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const SPEAKER = '<path d="M2.5 6.2v3.6h2.3L8 12.5v-9L4.8 6.2z"/>';
const ICONS = {
  close: svg('<path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/>'),
  minus: svg('<path d="M4 8h8"/>'),
  plus: svg('<path d="M8 3.5v9M3.5 8h9"/>'),
  sound: svg(SPEAKER + '<path d="M10.5 5.8a3 3 0 010 4.4M12.3 4a5.5 5.5 0 010 8"/>'),
  muted: svg(SPEAKER + '<path d="M10.8 6.3l3 3.4M13.8 6.3l-3 3.4"/>'),
};
function icon(name) {
  const el = document.createElement('span');
  el.className = 'i';
  el.innerHTML = ICONS[name];
  return el;
}

const $ = (s) => document.querySelector(s);
const uid = () => crypto.randomUUID().slice(0, 8);

// 持久数据(chrome.storage.local)
let state = { spaces: [], favorites: [], activeSpaceId: null };
// 会话数据(chrome.storage.session):t:<tabId> -> spaceId,b:<itemId> -> tabId,a:<tabId> -> 别名,c:<tabId> -> 父标签页 tabId
const tabSpace = new Map();
const bind = new Map();
const tabAlias = new Map();
const tabParent = new Map();
const SESSION_MAPS = { t: tabSpace, b: bind, a: tabAlias, c: tabParent };

let tabs = [];
let windowId;
let query = '';
let dragging = null;
let renderPending = false;

// ---------- 工具 ----------

function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'data') Object.assign(el.dataset, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k in el) el[k] = v;
    else el.setAttribute(k, v);
  }
  el.append(...kids.flat().filter((k) => k != null && k !== false));
  return el;
}

function faviconFor(url) {
  return `${chrome.runtime.getURL('/_favicon/')}?pageUrl=${encodeURIComponent(url)}&size=32`;
}

function tabIcon(tab) {
  const f = tab.favIconUrl;
  if (f && /^(https?|data):/.test(f)) return f;
  return faviconFor(tab.url || tab.pendingUrl || 'about:blank');
}

function matches(...texts) {
  const q = query.trim().toLowerCase();
  return !q || texts.some((t) => (t || '').toLowerCase().includes(q));
}

function toUrl(text) {
  if (/\s/.test(text)) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text) || /^(about|chrome):/i.test(text)) return text;
  if (/^(localhost|[\w-]+(\.[\w-]+)+)(:\d+)?([/?#].*)?$/i.test(text)) return 'https://' + text;
  return null;
}

// ---------- 状态 ----------

function defaultState() {
  const id = uid();
  return { spaces: [{ id, name: '个人', color: COLORS[0], pinned: [] }], favorites: [], activeSpaceId: id };
}

function normalize() {
  if (!state?.spaces?.length) state = defaultState();
  state.favorites ??= [];
  if (!state.spaces.some((s) => s.id === state.activeSpaceId)) state.activeSpaceId = state.spaces[0].id;
}

const save = () => chrome.storage.local.set({ state });
const activeSpace = () => state.spaces.find((s) => s.id === state.activeSpaceId) ?? state.spaces[0];

function applySession(key, value) {
  const map = key[1] === ':' && SESSION_MAPS[key[0]];
  if (!map) return;
  const k = map === bind ? key.slice(2) : +key.slice(2);
  if (value === undefined) map.delete(k);
  else map.set(k, value);
}

function setTabSpace(tabId, spaceId) {
  tabSpace.set(tabId, spaceId);
  return chrome.storage.session.set({ [`t:${tabId}`]: spaceId });
}
function setTabAlias(tabId, alias) {
  if (!alias) {
    tabAlias.delete(tabId);
    return chrome.storage.session.remove(`a:${tabId}`);
  }
  tabAlias.set(tabId, alias);
  return chrome.storage.session.set({ [`a:${tabId}`]: alias });
}
function setTabParent(tabId, parentId) {
  if (parentId == null) {
    tabParent.delete(tabId);
    return chrome.storage.session.remove(`c:${tabId}`);
  }
  tabParent.set(tabId, parentId);
  return chrome.storage.session.set({ [`c:${tabId}`]: parentId });
}
function setBind(itemId, tabId) {
  bind.set(itemId, tabId);
  return chrome.storage.session.set({ [`b:${itemId}`]: tabId });
}
function unbind(itemId) {
  bind.delete(itemId);
  return chrome.storage.session.remove(`b:${itemId}`);
}

// tabId -> 绑定到它的收藏/固定项
function itemByTab() {
  const m = new Map();
  const add = (item, kind, space) => {
    const t = bind.get(item.id);
    if (t != null) m.set(t, { item, kind, space });
  };
  state.favorites.forEach((i) => add(i, 'fav'));
  state.spaces.forEach((s) => s.pinned.forEach((i) => add(i, 'pin', s)));
  return m;
}

function findItem(id) {
  let item = state.favorites.find((x) => x.id === id);
  if (item) return { item, kind: 'fav' };
  for (const space of state.spaces) {
    item = space.pinned.find((x) => x.id === id);
    if (item) return { item, kind: 'pin', space };
  }
  return null;
}

function takeItem(id) {
  for (const arr of [state.favorites, ...state.spaces.map((s) => s.pinned)]) {
    const i = arr.findIndex((x) => x.id === id);
    if (i >= 0) return arr.splice(i, 1)[0];
  }
  return null;
}

function listedTabs() {
  const byTab = itemByTab();
  const sid = activeSpace().id;
  return tabs.filter((t) => !byTab.has(t.id) && tabSpace.get(t.id) === sid);
}

// 当前空间的标签页按树形排好:[{ tab, depth }],最多两级(depth 0 / 1)。父标签页不在列表里的子标签按顶级显示
function treeTabs() {
  const listed = listedTabs();
  const ids = new Set(listed.map((t) => t.id));
  const kids = new Map();
  const roots = [];
  for (const t of listed) {
    const p = tabParent.get(t.id);
    if (p == null || p === t.id || !ids.has(p)) roots.push(t);
    else if (kids.has(p)) kids.get(p).push(t);
    else kids.set(p, [t]);
  }
  const out = [];
  const seen = new Set();
  const walk = (t, depth) => {
    if (seen.has(t.id)) return;
    seen.add(t.id);
    out.push({ tab: t, depth });
    for (const k of kids.get(t.id) ?? []) walk(k, 1);
  };
  roots.forEach((t) => walk(t, 0));
  // 父子关系万一成环,剩下的按顶级兜底
  listed.forEach((t) => walk(t, 0));
  return out;
}

// 实际显示的行:搜索时平铺,只留匹配项
function visibleTabs() {
  const tree = treeTabs();
  if (!query.trim()) return tree;
  return tree.filter(({ tab }) => matches(tabAlias.get(tab.id), tab.title, tab.url)).map(({ tab }) => ({ tab, depth: 0 }));
}

// 某个标签页在列表里的父标签页(不在当前列表里则视为没有)
function listedParent(tabId) {
  const p = tabParent.get(tabId);
  return p != null && listedTabs().some((t) => t.id === p) ? p : null;
}

// tabId 及其所有后代,按树形顺序
function subtreeIds(tabId) {
  const tree = treeTabs();
  const i = tree.findIndex((x) => x.tab.id === tabId);
  if (i < 0) return [tabId];
  const out = [tabId];
  for (let j = i + 1; j < tree.length && tree[j].depth > tree[i].depth; j++) out.push(tree[j].tab.id);
  return out;
}

// ---------- 标签页同步 ----------

async function refreshTabs() {
  tabs = await chrome.tabs.query({ windowId });
  // 还没有归属的标签页(新开的、重启后恢复的)归入当前空间
  const fresh = {};
  for (const t of tabs) {
    if (!tabSpace.has(t.id)) {
      // 从别的标签页打开的,跟着来源标签页走
      const sid = tabSpace.get(t.openerTabId) ?? state.activeSpaceId;
      tabSpace.set(t.id, sid);
      fresh[`t:${t.id}`] = sid;
    }
  }
  if (Object.keys(fresh).length) await chrome.storage.session.set(fresh);
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    await refreshTabs();
    render();
  }, 30);
}

// 激活的标签页属于别的空间时,侧边栏跟过去
function followSpace(tabId) {
  const hit = itemByTab().get(tabId);
  if (hit?.kind === 'fav') return;
  const sid = hit ? hit.space.id : tabSpace.get(tabId);
  if (sid && sid !== state.activeSpaceId && state.spaces.some((s) => s.id === sid)) {
    state.activeSpaceId = sid;
    save();
  }
}

// ---------- 渲染 ----------

function render() {
  if (dragging) {
    renderPending = true;
    return;
  }
  renderPending = false;
  const space = activeSpace();
  const tabById = new Map(tabs.map((t) => [t.id, t]));
  document.documentElement.style.setProperty('--accent', space.color);
  $('#space-name').textContent = space.name;

  const itemEl = (item, kind) => {
    const open = bind.has(item.id);
    const tab = tabById.get(bind.get(item.id));
    const cls = [kind === 'fav' ? 'tile' : 'row', open && 'open', tab?.active && 'active'].filter(Boolean).join(' ');
    const img = h('img', { class: 'icon', src: tab ? tabIcon(tab) : faviconFor(item.url), alt: '', draggable: false });
    const tip = item.alias ? `${item.alias} · ${item.title}` : item.title;
    if (kind === 'fav') return h('div', { class: cls, draggable: true, title: tip, data: { kind, id: item.id } }, img);
    return h(
      'div',
      { class: cls, draggable: true, title: item.url, data: { kind, id: item.id } },
      img,
      item.alias && h('span', { class: 'alias' }, item.alias),
      h('span', { class: 'title' }, item.title),
      open && h('button', { class: 'btn x', title: '关闭标签页(保留固定)', data: { act: 'close' } }, icon('minus'))
    );
  };

  const favs = state.favorites.filter((i) => matches(i.alias, i.title, i.url)).map((i) => itemEl(i, 'fav'));
  $('#favs').replaceChildren(...(favs.length || query ? favs : [h('div', { class: 'hint' }, '把标签页拖到这里加入收藏夹')]));

  const pins = space.pinned.filter((i) => matches(i.alias, i.title, i.url)).map((i) => itemEl(i, 'pin'));
  $('#pins').replaceChildren(...(pins.length || query ? pins : [h('div', { class: 'hint' }, '把标签页拖到这里固定到此空间')]));

  $('#tabs').replaceChildren(
    ...visibleTabs().map(({ tab: t, depth }) => {
      const muted = t.mutedInfo?.muted;
      const cls = ['row', t.active && 'active', t.discarded && 'discarded', t.status === 'loading' && 'loading'].filter(Boolean).join(' ');
      return h(
        'div',
        { class: cls, draggable: true, title: t.url, style: depth ? '--depth:1' : null, data: { kind: 'tab', id: t.id } },
        h('img', { class: 'icon', src: tabIcon(t), alt: '', draggable: false }),
        tabAlias.has(t.id) && h('span', { class: 'alias' }, tabAlias.get(t.id)),
        h('span', { class: 'title' }, t.title || t.url || '新标签页'),
        (t.audible || muted) && h('button', { class: 'btn', title: muted ? '取消静音' : '静音', data: { act: 'mute' } }, icon(muted ? 'muted' : 'sound')),
        h('button', { class: 'btn x', title: '关闭', data: { act: 'close' } }, icon('close'))
      );
    })
  );

  $('#spaces').replaceChildren(
    ...state.spaces.map((s) =>
      h(
        'button',
        { class: 'space-dot' + (s.id === space.id ? ' on' : ''), title: s.name, data: { space: s.id } },
        h('i', { style: `color:${s.color}` })
      )
    ),
    h('button', { class: 'space-dot', title: '新建空间', onclick: addSpace }, icon('plus'))
  );
}

// ---------- 操作 ----------

async function focusTab(tab) {
  await chrome.tabs.update(tab.id, { active: true });
  if (tab.windowId !== windowId) await chrome.windows.update(tab.windowId, { focused: true });
}

async function openItem(item) {
  const boundId = bind.get(item.id);
  let tab = boundId != null ? await chrome.tabs.get(boundId).catch(() => null) : null;
  if (!tab) {
    // 没有绑定的标签页:先复用同网址的普通标签页,否则新开
    const byTab = itemByTab();
    tab = tabs.find((t) => t.url === item.url && !byTab.has(t.id)) ?? (await chrome.tabs.create({ url: item.url, windowId }));
    await setBind(item.id, tab.id);
  }
  await focusTab(tab);
  schedule();
}

async function closeItemTab(item) {
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

async function itemFromTab(tab) {
  const item = { id: uid(), title: tab.title || tab.url, url: tab.url };
  if (tabAlias.has(tab.id)) item.alias = tabAlias.get(tab.id);
  await detachTab(tab.id);
  await setBind(item.id, tab.id);
  return item;
}

async function addItemFromTab(tab, zone) {
  const item = await itemFromTab(tab);
  (zone === 'fav' ? state.favorites : activeSpace().pinned).push(item);
  await save();
  render();
}

async function moveItem(id, zone) {
  const item = takeItem(id);
  if (!item) return;
  (zone === 'fav' ? state.favorites : activeSpace().pinned).push(item);
  await save();
  render();
}

async function removeItem(id, openIfClosed) {
  const hit = findItem(id);
  if (!hit) return;
  const { item, kind } = hit;
  const spaceId = hit.space?.id;
  const index = (kind === 'fav' ? state.favorites : hit.space.pinned).indexOf(item);
  takeItem(id);
  let tabId = bind.get(id);
  if (tabId != null) {
    await unbind(id);
    await setTabSpace(tabId, state.activeSpaceId);
    await setTabAlias(tabId, item.alias);
  } else if (openIfClosed) {
    tabId = (await chrome.tabs.create({ url: item.url, windowId, active: false })).id;
  }
  await save();
  render();

  // 可能是误操作:放回原来的位置,标签页还在的话重新绑上
  pushUndo(`已${kind === 'fav' ? '从收藏夹移除' : '取消固定'}「${item.alias || item.title}」`, async () => {
    const arr = kind === 'fav' ? state.favorites : state.spaces.find((s) => s.id === spaceId)?.pinned;
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

async function editItem(id) {
  const item = findItem(id)?.item;
  if (!item) return;
  const out = await ask('编辑', [
    { key: 'alias', label: '别名(可留空)', value: item.alias, optional: true },
    { key: 'title', label: '名称', value: item.title },
    { key: 'url', label: '网址', value: item.url },
  ]);
  const target = out && findItem(id)?.item;
  if (!target) return;
  target.title = out.title;
  target.url = toUrl(out.url) ?? out.url;
  if (out.alias) target.alias = out.alias;
  else delete target.alias;
  await save();
  render();
}

async function editTabAlias(tabId) {
  const out = await ask('设置别名', [{ key: 'alias', label: '别名(留空则清除)', value: tabAlias.get(tabId), optional: true }]);
  if (!out) return;
  await setTabAlias(tabId, out.alias);
  render();
}

// 连同子标签一起移到另一个空间,并脱离原来的父标签页
async function moveTabToSpace(tabId, spaceId) {
  const ids = subtreeIds(tabId);
  ids.forEach((id) => tabSpace.set(id, spaceId));
  await chrome.storage.session.set(Object.fromEntries(ids.map((id) => [`t:${id}`, spaceId])));
  await setTabParent(tabId, null);
  render();
}

async function switchSpace(id) {
  if (id === state.activeSpaceId) return;
  state.activeSpaceId = id;
  await save();
  render();
  // 切到该空间里最近用过的标签页
  const byTab = itemByTab();
  const best = tabs
    .filter((t) => {
      const hit = byTab.get(t.id);
      return hit ? hit.space?.id === id : tabSpace.get(t.id) === id;
    })
    .sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0))[0];
  if (best && !best.active) chrome.tabs.update(best.id, { active: true });
}

async function addSpace() {
  const out = await ask('新建空间', [{ key: 'name', label: '名称', value: '' }], COLORS[state.spaces.length % COLORS.length]);
  if (!out) return;
  const space = { id: uid(), name: out.name, color: out.color, pinned: [] };
  state.spaces.push(space);
  state.activeSpaceId = space.id;
  await save();
  render();
}

async function editSpace(id) {
  const space = state.spaces.find((s) => s.id === id);
  if (!space) return;
  const out = await ask('编辑空间', [{ key: 'name', label: '名称', value: space.name }], space.color);
  const target = out && state.spaces.find((s) => s.id === id);
  if (!target) return;
  target.name = out.name;
  target.color = out.color;
  await save();
  render();
}

async function deleteSpace(id) {
  const space = state.spaces.find((s) => s.id === id);
  if (!space || state.spaces.length < 2) return;
  const ok = await ask(`删除空间「${space.name}」?其中的固定标签也会被移除,已打开的标签页会并入当前空间。`, [], null, '删除');
  if (!ok) return;
  const i = state.spaces.findIndex((s) => s.id === id);
  if (i < 0 || state.spaces.length < 2) return;
  const [gone] = state.spaces.splice(i, 1);
  normalize();
  const keys = gone.pinned.filter((p) => bind.has(p.id)).map((p) => `b:${p.id}`);
  for (const [tabId, sid] of tabSpace) if (sid === id) keys.push(`t:${tabId}`);
  keys.forEach((k) => applySession(k, undefined));
  await chrome.storage.session.remove(keys);
  await save();
  schedule();
}

function clearTabs() {
  const doomed = listedTabs().filter((t) => !t.active);
  closeWithUndo(doomed, `已清理 ${doomed.length} 个标签页`);
}

// 关闭一个标签页;它的子标签会跟着关,所以一起记下来以便撤销
function closeTab(tab) {
  const kids = listedTabs().filter((t) => tabParent.get(t.id) === tab.id);
  const name = `「${tabAlias.get(tab.id) || tab.title || tab.url}」`;
  return closeWithUndo([tab, ...kids], kids.length ? `已关闭${name}及 ${kids.length} 个子标签` : `已关闭${name}`);
}

// 关闭一批标签页,并在提示条里提供撤销
async function closeWithUndo(doomed, text) {
  if (!doomed.length) return;
  const ids = new Set(doomed.map((t) => t.id));
  const spaceId = state.activeSpaceId;
  const saved = doomed
    .map((t) => ({ id: t.id, url: t.url, index: t.index, active: t.active, alias: tabAlias.get(t.id), parent: tabParent.get(t.id) }))
    .sort((a, b) => a.index - b.index);
  // 留下来的标签页如果挂在要关的父标签下,先脱离,免得被连带关闭
  const orphans = tabs.filter((t) => !ids.has(t.id) && ids.has(tabParent.get(t.id))).map((t) => ({ id: t.id, parent: tabParent.get(t.id) }));
  for (const o of orphans) await setTabParent(o.id, null);
  await chrome.tabs.remove([...ids]).catch(() => {});
  pushUndo(text, () => reopenTabs(saved, orphans, spaceId));
}

// 撤销关闭:优先用浏览器的「最近关闭」恢复(保留历史记录和页面状态),找不到的按网址重新打开
async function reopenTabs(saved, orphans, spaceId) {
  const [current] = await chrome.tabs.query({ active: true, windowId });
  const recent = (await chrome.sessions.getRecentlyClosed().catch(() => [])).filter((s) => s.tab);
  const idMap = new Map();
  let focus = current?.id;
  for (const s of saved) {
    const i = recent.findIndex((r) => r.tab.url === s.url);
    let tab = i < 0 ? null : (await chrome.sessions.restore(recent.splice(i, 1)[0].tab.sessionId).catch(() => null))?.tab;
    tab ??= await chrome.tabs.create({ url: s.url, windowId, index: s.index, active: false }).catch(() => null);
    if (!tab) continue;
    idMap.set(s.id, tab.id);
    if (s.active) focus = tab.id;
  }
  // 放回原来的位置(从前往后依次归位)
  for (const s of saved) {
    if (idMap.has(s.id)) await chrome.tabs.move(idMap.get(s.id), { index: s.index }).catch(() => {});
  }
  // 空间、别名、父子关系接回去
  const set = {};
  for (const s of saved) {
    const id = idMap.get(s.id);
    if (id == null) continue;
    set[`t:${id}`] = spaceId;
    if (s.alias) set[`a:${id}`] = s.alias;
    const parent = idMap.get(s.parent) ?? (tabs.some((t) => t.id === s.parent) ? s.parent : null);
    if (parent != null) set[`c:${id}`] = parent;
  }
  for (const o of orphans) if (idMap.has(o.parent)) set[`c:${o.id}`] = idMap.get(o.parent);
  await chrome.storage.session.set(set);
  if (focus != null) await chrome.tabs.update(focus, { active: true }).catch(() => {});
  schedule();
}

async function submitSearch(force) {
  const q = query.trim();
  if (!q) return;
  const first = !force && ($('#tabs [data-kind]') || $('#pins [data-kind]') || $('#favs [data-kind]'));
  if (first) first.click();
  else if (toUrl(q)) await chrome.tabs.create({ url: toUrl(q), windowId });
  else await chrome.search.query({ text: q, disposition: 'NEW_TAB' });
  $('#search').value = query = '';
  render();
}

// ---------- 提示条 / 右键菜单 / 对话框 ----------

let toastTimer;
// 底部提示条;给了 action 就带一个按钮(比如「撤销」)
function toast(text, action, run) {
  const el = $('#toast');
  el.replaceChildren(h('span', {}, text), action && h('button', { onclick: () => ((el.hidden = true), run()) }, action));
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), action ? 8000 : 2000);
}

// 可撤销的操作都进这个栈:提示条上的「撤销」和 Ctrl/Cmd+Z 走同一条路,后做的先撤
const undoStack = [];
function pushUndo(text, run) {
  const entry = { run };
  undoStack.push(entry);
  if (undoStack.length > 30) undoStack.shift();
  toast(text, '撤销', () => undo(entry));
}
async function undo(entry = undoStack.at(-1)) {
  if (!entry) return toast('没有可撤销的操作');
  undoStack.splice(undoStack.indexOf(entry), 1);
  await entry.run();
  toast('已撤销');
}

async function copyText(text, done) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // 面板没拿到焦点时 Clipboard API 会拒绝,退回老办法
    const ta = h('textarea', { value: text, style: 'position:fixed;opacity:0' });
    document.body.append(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  toast(done);
}

function hideMenu() {
  $('#menu').hidden = true;
}

function showMenu(e, items) {
  e.preventDefault();
  const menu = $('#menu');
  menu.replaceChildren(
    ...items
      .filter(Boolean)
      .map((it) => (it === '-' ? h('hr') : h('button', { class: it.danger && 'danger', onclick: () => (hideMenu(), it.run()) }, it.label)))
  );
  menu.hidden = false;
  const r = menu.getBoundingClientRect();
  menu.style.left = Math.max(4, Math.min(e.clientX, innerWidth - r.width - 4)) + 'px';
  menu.style.top = Math.max(4, Math.min(e.clientY, innerHeight - r.height - 4)) + 'px';
}

function tabMenu(e, tab) {
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

function itemMenu(e, { item, kind }) {
  const tab = tabs.find((t) => t.id === bind.get(item.id));
  showMenu(e, [
    { label: '编辑别名、名称和网址…', run: () => editItem(item.id) },
    { label: '复制链接地址', run: () => copyText(tab?.url || item.url, '已复制链接地址') },
    tab && {
      label: '将网址更新为当前页面',
      run: async () => {
        const target = findItem(item.id)?.item;
        if (!target) return;
        Object.assign(target, { url: tab.url, title: tab.title || tab.url });
        await save();
        render();
      },
    },
    bind.has(item.id) && { label: '关闭标签页(保留固定)', run: () => closeItemTab(item) },
    kind === 'fav'
      ? { label: '移到当前空间的固定标签', run: () => moveItem(item.id, 'pin') }
      : { label: '移到收藏夹', run: () => moveItem(item.id, 'fav') },
    '-',
    { label: kind === 'fav' ? '从收藏夹移除' : '取消固定', danger: true, run: () => removeItem(item.id, false) },
  ]);
}

function spaceMenu(e, id) {
  showMenu(e, [
    { label: '编辑空间…', run: () => editSpace(id) },
    { label: '新建空间…', run: addSpace },
    state.spaces.length > 1 && '-',
    state.spaces.length > 1 && { label: '删除空间', danger: true, run: () => deleteSpace(id) },
  ]);
}

// fields: [{key,label,value}];color 非空时显示颜色选择。取消返回 null
function ask(title, fields, color, okLabel = '保存') {
  return new Promise((resolve) => {
    const dlg = $('#dlg');
    const inputs = {};
    let picked = color;
    const swatches =
      color &&
      h(
        'div',
        { class: 'swatches' },
        COLORS.map((c) =>
          h('button', {
            type: 'button',
            class: 'swatch' + (c === color ? ' on' : ''),
            style: `background:${c};color:${c}`,
            onclick: (e) => {
              picked = c;
              for (const s of e.currentTarget.parentNode.children) s.classList.toggle('on', s === e.currentTarget);
            },
          })
        )
      );
    dlg.replaceChildren(
      h(
        'form',
        { method: 'dialog' },
        h('h3', {}, title),
        fields.map((f) => h('label', {}, f.label, (inputs[f.key] = h('input', { type: 'text', value: f.value ?? '', required: !f.optional })))),
        swatches,
        h(
          'div',
          { class: 'btns' },
          h('button', { type: 'button', onclick: () => dlg.close('cancel') }, '取消'),
          h('button', { value: 'ok', class: 'primary' }, okLabel)
        )
      )
    );
    dlg.returnValue = '';
    dlg.addEventListener(
      'close',
      () => {
        if (dlg.returnValue !== 'ok') return resolve(null);
        const out = { color: picked };
        for (const [k, input] of Object.entries(inputs)) out[k] = input.value.trim();
        resolve(out);
      },
      { once: true }
    );
    dlg.showModal();
    Object.values(inputs)[0]?.select();
  });
}

// ---------- 拖拽 ----------

function clearMarks() {
  for (const el of document.querySelectorAll('.drop-before, .drop-end, .drop-on, .drop-into')) el.classList.remove('drop-before', 'drop-end', 'drop-on', 'drop-into');
}

function finishDrag() {
  dragging = null;
  clearMarks();
  document.querySelector('.dragging')?.classList.remove('dragging');
  if (renderPending) render();
}

// 拖标签页时,指针落在某一行的中间部分 = 要成为它的子标签;上下边缘仍是排序
function nestElement(zone, e) {
  if (dragging.kind !== 'tab' || zone.dataset.zone !== 'tab') return null;
  return (
    [...zone.querySelectorAll('[data-kind="tab"]')].find((el) => {
      const r = el.getBoundingClientRect();
      return el.dataset.id !== dragging.id && e.clientY > r.top + r.height * 0.28 && e.clientY < r.bottom - r.height * 0.28;
    }) ?? null
  );
}

// 拖到 zone 里时,应插在哪个元素之前(null = 末尾)
function refElement(zone, e) {
  const els = [...zone.querySelectorAll('[data-kind]')].filter((el) => el.dataset.id !== dragging.id || el.dataset.kind !== dragging.kind);
  const grid = zone.classList.contains('grid');
  return (
    els.find((el) => {
      const r = el.getBoundingClientRect();
      if (grid) return e.clientY < r.top || (e.clientY <= r.bottom && e.clientX < r.left + r.width / 2);
      return e.clientY < r.top + r.height / 2;
    }) ?? null
  );
}

// 在浏览器的标签栏里把 ids 挪成紧挨着的一串:第一个放到 where 指定的位置,其余依次跟在后面
async function moveGroup(ids, where) {
  const index = async (id) => (await chrome.tabs.get(id)).index;
  const move = (id, to, from) => (to === from ? null : chrome.tabs.move(id, { index: to }).catch(() => {}));
  const from = await index(ids[0]);
  if (where.before != null) {
    const r = await index(where.before);
    await move(ids[0], from < r ? r - 1 : r, from);
  } else if (where.after != null) {
    const a = await index(where.after);
    await move(ids[0], from < a ? a : a + 1, from);
  }
  let prev = ids[0];
  for (const id of ids.slice(1)) {
    const [p, f] = [await index(prev), await index(id)];
    await move(id, f < p ? p : p + 1, f);
    prev = id;
  }
  schedule();
}

// 把标签页(连同子标签)拖到 refId 之前:和 refId 同级;refId 为空则放到末尾并成为顶级
async function dropTab(tabId, refId) {
  const moving = subtreeIds(tabId);
  if (refId != null && moving.includes(refId)) return;
  const rest = listedTabs().filter((t) => !moving.includes(t.id));
  const parent = refId != null ? listedParent(refId) : null;
  // 最多两级:带着子标签拖进别人名下时,子标签一起并为同级
  for (const id of parent == null ? [tabId] : moving) await setTabParent(id, parent);
  const last = rest.reduce((a, b) => (a && a.index > b.index ? a : b), null);
  await moveGroup(moving, refId != null ? { before: refId } : { after: last?.id });
}

// 把标签页拖到另一个标签页上:成为它的子标签,排在它现有子标签的最后。
// 最多两级:目标本身是子标签时,挂到目标的父标签下;自己带着的子标签一起并为同级
async function nestTab(tabId, targetId) {
  const parent = listedParent(targetId) ?? targetId;
  const moving = subtreeIds(tabId);
  if (moving.includes(parent)) return;
  const after = subtreeIds(parent).filter((id) => !moving.includes(id)).at(-1);
  for (const id of moving) await setTabParent(id, parent);
  await moveGroup(moving, { after });
}

async function performDrop(d, zone, refId, intoId) {
  if (zone === 'tab') {
    if (d.kind === 'tab') return intoId != null ? nestTab(+d.id, +intoId) : dropTab(+d.id, refId == null ? null : +refId);
    return removeItem(d.id, true);
  }
  let item;
  if (d.kind === 'tab') {
    const tab = tabs.find((t) => t.id === +d.id);
    if (!tab) return;
    item = await itemFromTab(tab);
  } else {
    item = takeItem(d.id);
  }
  if (!item) return;
  const arr = zone === 'fav' ? state.favorites : activeSpace().pinned;
  const i = refId ? arr.findIndex((x) => x.id === refId) : -1;
  arr.splice(i < 0 ? arr.length : i, 0, item);
  await save();
  render();
}

// ---------- 事件 ----------

function bindEvents() {
  const scroll = $('#scroll');

  scroll.addEventListener('click', (e) => {
    const el = e.target.closest('[data-kind]');
    if (!el) return;
    const act = e.target.closest('[data-act]')?.dataset.act;
    const { kind, id } = el.dataset;
    if (kind === 'tab') {
      const tab = tabs.find((t) => t.id === +id);
      if (!tab) return;
      if (act === 'close') closeTab(tab);
      else if (act === 'mute') chrome.tabs.update(tab.id, { muted: !tab.mutedInfo?.muted });
      else chrome.tabs.update(tab.id, { active: true });
    } else {
      const item = findItem(id)?.item;
      if (!item) return;
      if (act === 'close') closeItemTab(item);
      else openItem(item);
    }
  });

  // 双击设置别名
  scroll.addEventListener('dblclick', (e) => {
    const el = !e.target.closest('[data-act]') && e.target.closest('[data-kind]');
    if (!el) return;
    if (el.dataset.kind === 'tab') editTabAlias(+el.dataset.id);
    else editItem(el.dataset.id);
  });

  // 中键关闭
  scroll.addEventListener('mousedown', (e) => {
    if (e.button === 1 && e.target.closest('[data-kind]')) e.preventDefault();
  });
  scroll.addEventListener('auxclick', (e) => {
    const el = e.button === 1 && e.target.closest('[data-kind]');
    if (!el) return;
    if (el.dataset.kind === 'tab') {
      const tab = tabs.find((t) => t.id === +el.dataset.id);
      if (tab) closeTab(tab);
    } else {
      const item = findItem(el.dataset.id)?.item;
      if (item) closeItemTab(item);
    }
  });

  document.addEventListener('contextmenu', (e) => {
    if (e.target.closest('input, dialog')) return;
    e.preventDefault();
    const el = e.target.closest('[data-kind]');
    const dot = e.target.closest('[data-space]');
    if (dot) return spaceMenu(e, dot.dataset.space);
    if (!el) return hideMenu();
    if (el.dataset.kind === 'tab') {
      const tab = tabs.find((t) => t.id === +el.dataset.id);
      if (tab) tabMenu(e, tab);
    } else {
      const hit = findItem(el.dataset.id);
      if (hit) itemMenu(e, hit);
    }
  });
  document.addEventListener('mousedown', (e) => {
    if (!e.target.closest('#menu')) hideMenu();
  });
  window.addEventListener('blur', hideMenu);
  scroll.addEventListener('scroll', hideMenu);

  $('#spaces').addEventListener('click', (e) => {
    const dot = e.target.closest('[data-space]');
    if (dot) switchSpace(dot.dataset.space);
  });
  $('#space-menu').addEventListener('click', (e) => spaceMenu(e, state.activeSpaceId));
  $('#new-tab').addEventListener('click', () => chrome.tabs.create({ windowId }));
  $('#clear').addEventListener('click', clearTabs);

  const search = $('#search');
  search.addEventListener('input', () => {
    query = search.value;
    render();
  });
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitSearch(e.ctrlKey || e.metaKey);
    else if (e.key === 'Escape') {
      search.value = query = '';
      render();
    }
  });

  // Ctrl/Cmd+Z 撤销最近一次操作;在输入框里时留给文字编辑自己的撤销
  document.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || e.key.toLowerCase() !== 'z') return;
    if (e.target.closest?.('input, textarea, dialog') || $('#dlg').open) return;
    e.preventDefault();
    undo();
  });

  // favicon 加载失败时换成默认图标
  document.addEventListener(
    'error',
    (e) => {
      const img = e.target;
      if (img.tagName === 'IMG' && img.src !== FALLBACK_ICON) img.src = FALLBACK_ICON;
    },
    true
  );

  document.addEventListener('dragstart', (e) => {
    const el = e.target.closest?.('[data-kind]');
    if (!el) return;
    hideMenu();
    dragging = { kind: el.dataset.kind, id: el.dataset.id };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', el.title || '');
    requestAnimationFrame(() => el.classList.add('dragging'));
  });
  document.addEventListener('dragover', (e) => {
    if (!dragging) return;
    clearMarks();
    const target = e.target.closest?.('.zone, [data-space]');
    if (!target) return;
    if (target.dataset.space) {
      if (dragging.kind !== 'tab') return;
      e.preventDefault();
      target.classList.add('drop-on');
      return;
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const into = nestElement(target, e);
    const ref = !into && refElement(target, e);
    if (into) into.classList.add('drop-into');
    else if (ref) ref.classList.add('drop-before');
    else target.classList.add('drop-end');
  });
  document.addEventListener('drop', async (e) => {
    if (!dragging) return;
    const target = e.target.closest?.('.zone, [data-space]');
    if (!target) return;
    e.preventDefault();
    const d = dragging;
    if (target.dataset.space) {
      finishDrag();
      if (d.kind === 'tab') await moveTabToSpace(+d.id, target.dataset.space);
      return;
    }
    const zone = target.dataset.zone;
    const intoId = nestElement(target, e)?.dataset.id;
    const refId = refElement(target, e)?.dataset.id;
    finishDrag();
    await performDrop(d, zone, refId, intoId);
  });
  document.addEventListener('dragend', finishDrag);

  for (const ev of ['onCreated', 'onRemoved', 'onUpdated', 'onMoved', 'onAttached', 'onDetached', 'onReplaced']) {
    chrome.tabs[ev].addListener(schedule);
  }
  chrome.tabs.onActivated.addListener((info) => {
    if (info.windowId === windowId) followSpace(info.tabId);
    schedule();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.state) {
      state = changes.state.newValue;
      normalize();
      schedule();
    } else if (area === 'session') {
      for (const [k, c] of Object.entries(changes)) applySession(k, c.newValue);
      render();
    }
  });
}

async function init() {
  windowId = (await chrome.windows.getCurrent()).id;
  const stored = await chrome.storage.local.get('state');
  state = stored.state;
  normalize();
  if (!stored.state) await save();
  for (const [k, v] of Object.entries(await chrome.storage.session.get(null))) applySession(k, v);
  bindEvents();
  await refreshTabs();
  render();
}

init();
