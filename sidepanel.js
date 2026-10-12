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
// 会话数据(chrome.storage.session):t:<tabId> -> spaceId,b:<itemId> -> tabId
const tabSpace = new Map();
const bind = new Map();

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
  const map = key.startsWith('t:') ? tabSpace : key.startsWith('b:') ? bind : null;
  if (!map) return;
  const k = key.startsWith('t:') ? +key.slice(2) : key.slice(2);
  if (value === undefined) map.delete(k);
  else map.set(k, value);
}

function setTabSpace(tabId, spaceId) {
  tabSpace.set(tabId, spaceId);
  return chrome.storage.session.set({ [`t:${tabId}`]: spaceId });
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

// ---------- 标签页同步 ----------

async function refreshTabs() {
  tabs = await chrome.tabs.query({ windowId });
  // 还没有归属的标签页(新开的、重启后恢复的)归入当前空间
  const fresh = {};
  for (const t of tabs) {
    if (!tabSpace.has(t.id)) {
      tabSpace.set(t.id, state.activeSpaceId);
      fresh[`t:${t.id}`] = state.activeSpaceId;
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
    if (kind === 'fav') return h('div', { class: cls, draggable: true, title: item.title, data: { kind, id: item.id } }, img);
    return h(
      'div',
      { class: cls, draggable: true, title: item.url, data: { kind, id: item.id } },
      img,
      h('span', { class: 'title' }, item.title),
      open && h('button', { class: 'btn x', title: '关闭标签页(保留固定)', data: { act: 'close' } }, icon('minus'))
    );
  };

  const favs = state.favorites.filter((i) => matches(i.title, i.url)).map((i) => itemEl(i, 'fav'));
  $('#favs').replaceChildren(...(favs.length || query ? favs : [h('div', { class: 'hint' }, '把标签页拖到这里加入收藏夹')]));

  const pins = space.pinned.filter((i) => matches(i.title, i.url)).map((i) => itemEl(i, 'pin'));
  $('#pins').replaceChildren(...(pins.length || query ? pins : [h('div', { class: 'hint' }, '把标签页拖到这里固定到此空间')]));

  $('#tabs').replaceChildren(
    ...listedTabs()
      .filter((t) => matches(t.title, t.url))
      .map((t) => {
        const muted = t.mutedInfo?.muted;
        const cls = ['row', t.active && 'active', t.discarded && 'discarded', t.status === 'loading' && 'loading'].filter(Boolean).join(' ');
        return h(
          'div',
          { class: cls, draggable: true, title: t.url, data: { kind: 'tab', id: t.id } },
          h('img', { class: 'icon', src: tabIcon(t), alt: '', draggable: false }),
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

async function addItemFromTab(tab, zone) {
  const item = { id: uid(), title: tab.title || tab.url, url: tab.url };
  await setBind(item.id, tab.id);
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
  const item = takeItem(id);
  if (!item) return;
  const tabId = bind.get(id);
  if (tabId != null) {
    await unbind(id);
    await setTabSpace(tabId, state.activeSpaceId);
  } else if (openIfClosed) {
    chrome.tabs.create({ url: item.url, windowId, active: false });
  }
  await save();
  render();
}

async function editItem(id) {
  const item = findItem(id)?.item;
  if (!item) return;
  const out = await ask('编辑', [
    { key: 'title', label: '名称', value: item.title },
    { key: 'url', label: '网址', value: item.url },
  ]);
  const target = out && findItem(id)?.item;
  if (!target) return;
  target.title = out.title;
  target.url = toUrl(out.url) ?? out.url;
  await save();
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
  const ids = listedTabs().filter((t) => !t.active).map((t) => t.id);
  if (ids.length) chrome.tabs.remove(ids);
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

// ---------- 右键菜单 / 对话框 ----------

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
  const others = listedTabs().filter((t) => t.id !== tab.id).map((t) => t.id);
  showMenu(e, [
    { label: '固定到当前空间', run: () => addItemFromTab(tab, 'pin') },
    { label: '添加到收藏夹', run: () => addItemFromTab(tab, 'fav') },
    '-',
    { label: '复制标签页', run: () => chrome.tabs.duplicate(tab.id) },
    { label: '重新加载', run: () => chrome.tabs.reload(tab.id) },
    { label: tab.mutedInfo?.muted ? '取消静音' : '静音', run: () => chrome.tabs.update(tab.id, { muted: !tab.mutedInfo?.muted }) },
    state.spaces.length > 1 && '-',
    ...state.spaces
      .filter((s) => s.id !== state.activeSpaceId)
      .map((s) => ({ label: `移到空间「${s.name}」`, run: () => setTabSpace(tab.id, s.id).then(render) })),
    '-',
    { label: '关闭', run: () => chrome.tabs.remove(tab.id) },
    others.length && { label: '关闭其他标签页', danger: true, run: () => chrome.tabs.remove(others) },
  ]);
}

function itemMenu(e, { item, kind }) {
  const tab = tabs.find((t) => t.id === bind.get(item.id));
  showMenu(e, [
    { label: '编辑…', run: () => editItem(item.id) },
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
        fields.map((f) => h('label', {}, f.label, (inputs[f.key] = h('input', { type: 'text', value: f.value ?? '', required: true })))),
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
  for (const el of document.querySelectorAll('.drop-before, .drop-end, .drop-on')) el.classList.remove('drop-before', 'drop-end', 'drop-on');
}

function finishDrag() {
  dragging = null;
  clearMarks();
  document.querySelector('.dragging')?.classList.remove('dragging');
  if (renderPending) render();
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

async function reorderTab(tabId, refId, lastId) {
  const index = (id) => tabs.find((t) => t.id === id)?.index;
  const from = index(tabId);
  let to;
  if (refId != null) {
    const b = index(refId);
    to = from < b ? b - 1 : b;
  } else if (lastId != null) {
    const l = index(lastId);
    to = from < l ? l : l + 1;
  }
  if (from == null || to == null || Number.isNaN(to) || to === from) return;
  await chrome.tabs.move(tabId, { index: to }).catch(() => {});
}

async function performDrop(d, zone, refId, lastId) {
  if (zone === 'tab') {
    if (d.kind === 'tab') return reorderTab(+d.id, refId && +refId, lastId && +lastId);
    return removeItem(d.id, true);
  }
  let item;
  if (d.kind === 'tab') {
    const tab = tabs.find((t) => t.id === +d.id);
    if (!tab) return;
    item = { id: uid(), title: tab.title || tab.url, url: tab.url };
    await setBind(item.id, tab.id);
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
      if (act === 'close') chrome.tabs.remove(tab.id);
      else if (act === 'mute') chrome.tabs.update(tab.id, { muted: !tab.mutedInfo?.muted });
      else chrome.tabs.update(tab.id, { active: true });
    } else {
      const item = findItem(id)?.item;
      if (!item) return;
      if (act === 'close') closeItemTab(item);
      else openItem(item);
    }
  });

  // 中键关闭
  scroll.addEventListener('mousedown', (e) => {
    if (e.button === 1 && e.target.closest('[data-kind]')) e.preventDefault();
  });
  scroll.addEventListener('auxclick', (e) => {
    const el = e.button === 1 && e.target.closest('[data-kind]');
    if (!el) return;
    if (el.dataset.kind === 'tab') chrome.tabs.remove(+el.dataset.id);
    else {
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
    const ref = refElement(target, e);
    if (ref) ref.classList.add('drop-before');
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
      if (d.kind === 'tab') {
        await setTabSpace(+d.id, target.dataset.space);
        render();
      }
      return;
    }
    const zone = target.dataset.zone;
    const refId = refElement(target, e)?.dataset.id;
    const lastId = [...target.querySelectorAll('[data-kind="tab"]')].filter((el) => el.dataset.id !== d.id).at(-1)?.dataset.id;
    finishDrag();
    await performDrop(d, zone, refId, lastId);
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
