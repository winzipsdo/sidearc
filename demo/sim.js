// 在线试用的「浏览器」:一个只在内存里的 Chrome 窗口,实现插件用到的 chrome.* 接口。
// 插件真正的侧边栏和后台各自跑在一个 iframe 里,通过 connect() 拿到自己的 chrome 对象(见 inject.js),
// 和在真的 Chrome 里一样:各自注册事件、读写同一份存储、互相发消息。
// 事件的先后顺序尽量照着 Chrome 来,事件和返回值都是拷贝,插件改了也不会影响这里的数据。

import { NEW_TAB, page } from './web.js?v=8a7c6255';

const WIN = 1;
const LOAD_MS = 300; // 网页「加载」多久
const clone = (v) => (v === undefined ? v : structuredClone(v));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const PUBLIC = ['id', 'index', 'windowId', 'active', 'highlighted', 'pinned', 'groupId', 'url', 'pendingUrl', 'title', 'favIconUrl', 'status', 'discarded', 'autoDiscardable', 'audible', 'mutedInfo', 'lastAccessed', 'openerTabId', 'incognito', 'selected'];
const pub = (t) => Object.fromEntries(PUBLIC.filter((k) => t[k] !== undefined).map((k) => [k, clone(t[k])]));

export class Browser {
  constructor(lang, hooks = {}) {
    this.lang = lang;
    this.hooks = hooks; // change():界面要重画;call(ctx, name, args):插件调用了哪个接口(用来判断试用任务)
    this.tabs = [];
    this.groups = new Map();
    this.store = { local: {}, session: {} };
    this.closed = []; // 最近关闭,新的在前
    this.contexts = new Set();
    this.nextTab = 1;
    this.nextGroup = 1;
    this.nextSession = 1;
    this.history = new Map(); // tabId -> { list, pos } 前进后退
  }

  // ---------- 事件 ----------

  // 每个插件页面(侧边栏、后台)各自一份监听;事件异步送到,参数各给一份拷贝
  emit(key, ...args) {
    for (const ctx of this.contexts) {
      for (const fn of ctx.on.get(key) ?? []) {
        try {
          ctx.win.setTimeout(() => fn(...clone(args)), 0);
        } catch {}
      }
    }
    this.changed();
  }
  changed() {
    if (this.pending) return;
    this.pending = true;
    queueMicrotask(() => {
      this.pending = false;
      this.hooks.change?.();
    });
  }

  // ---------- 标签页 ----------

  tab(id) {
    const t = this.tabs.find((x) => x.id === id);
    if (!t) throw new Error(`No tab with id: ${id}.`);
    return t;
  }
  get active() {
    return this.tabs.find((t) => t.active);
  }
  reindex() {
    this.tabs.forEach((t, i) => (t.index = i));
  }
  newTab(props) {
    const t = {
      id: this.nextTab++,
      index: 0,
      windowId: WIN,
      active: false,
      highlighted: false,
      pinned: false,
      groupId: -1,
      url: '',
      title: '',
      status: 'loading',
      discarded: false,
      autoDiscardable: true,
      audible: false,
      mutedInfo: { muted: false },
      lastAccessed: Date.now(),
      incognito: false,
      selected: false,
      ...props,
    };
    this.history.set(t.id, { list: [], pos: -1 });
    return t;
  }

  // 新开一个标签页。source:从哪个标签页的网页里打开的(会有 onCreatedNavigationTarget);transition:导航的类型
  create({ url, active = true, index, openerTabId } = {}, { source, transition = 'link' } = {}) {
    const t = this.newTab({ pendingUrl: url || NEW_TAB, openerTabId });
    let at = index ?? this.tabs.length;
    if (index == null && source != null) {
      // 从网页里打开的新标签页放在来源标签页(和它之前打开的)右边,和 Chrome 一样
      const src = this.tab(source);
      at = src.index + 1;
      while (this.tabs[at]?.openerTabId === source) at++;
      t.groupId = src.groupId;
    }
    this.tabs.splice(Math.max(0, Math.min(at, this.tabs.length)), 0, t);
    this.reindex();
    this.emit('tabs.onCreated', pub(t));
    if (source != null) this.emit('webNavigation.onCreatedNavigationTarget', { sourceTabId: source, sourceFrameId: 0, tabId: t.id, url: url || NEW_TAB, timeStamp: Date.now() });
    if (active) this.activate(t);
    this.navigate(t, url || NEW_TAB, transition);
    return t;
  }

  activate(t) {
    const prev = this.active;
    if (prev === t) return;
    if (prev) Object.assign(prev, { active: false, highlighted: false, selected: false });
    for (const x of this.tabs) x.highlighted = false;
    Object.assign(t, { active: true, highlighted: true, selected: true, lastAccessed: Date.now() });
    // 切到折叠分组里的标签页时,Chrome 会把分组展开
    const g = this.groups.get(t.groupId);
    if (g?.collapsed) {
      g.collapsed = false;
      this.emit('tabGroups.onUpdated', clone(g));
    }
    this.emit('tabs.onActivated', { tabId: t.id, windowId: WIN });
    this.emit('tabs.onHighlighted', { tabIds: [t.id], windowId: WIN });
    if (t.discarded || t.status === 'unloaded') this.wake(t);
  }

  // 休眠的标签页被切到:重新加载(编号不变)
  wake(t) {
    t.discarded = false;
    t.status = 'loading';
    this.emit('tabs.onUpdated', t.id, { discarded: false }, pub(t));
    this.emit('tabs.onUpdated', t.id, { status: 'loading' }, pub(t));
    setTimeout(() => this.loaded(t, t.url), LOAD_MS);
  }

  navigate(t, url, transition = 'link', qualifiers = []) {
    const h = this.history.get(t.id);
    if (!qualifiers.includes('forward_back')) {
      h.list.splice(h.pos + 1, Infinity, url);
      h.pos = h.list.length - 1;
    }
    Object.assign(t, { url, status: 'loading', audible: false, title: url === NEW_TAB ? page(url, this.lang).title : url.replace(/^https?:\/\//, '') });
    delete t.pendingUrl;
    delete t.favIconUrl;
    this.emit('tabs.onUpdated', t.id, { status: 'loading', url }, pub(t));
    this.emit('webNavigation.onCommitted', {
      tabId: t.id,
      url,
      frameId: 0,
      parentFrameId: -1,
      documentLifecycle: 'active',
      frameType: 'outermost_frame',
      transitionType: transition,
      transitionQualifiers: qualifiers,
      timeStamp: Date.now(),
    });
    if (/^https?:/.test(url)) this.emit('history.onVisited', { id: String(Date.now()), url, title: page(url, this.lang).title, lastVisitTime: Date.now(), visitCount: 1, typedCount: 0 });
    setTimeout(() => this.loaded(t, url, true), LOAD_MS);
  }

  loaded(t, url, autoplay) {
    if (!this.tabs.includes(t) || t.url !== url || t.discarded) return;
    const p = page(url, this.lang);
    Object.assign(t, { title: p.title, favIconUrl: p.icon, status: 'complete' });
    this.emit('tabs.onUpdated', t.id, { title: p.title, favIconUrl: p.icon }, pub(t));
    this.emit('tabs.onUpdated', t.id, { status: 'complete' }, pub(t));
    if (p.media && (autoplay || t.playing)) this.setAudible(t, true);
  }

  setAudible(t, on) {
    t.playing = on;
    if (t.audible === on) return;
    t.audible = on;
    this.emit('tabs.onUpdated', t.id, { audible: on }, pub(t));
  }

  remove(ids) {
    const list = [ids].flat().map((id) => this.tab(id));
    for (const t of list) {
      if (!this.tabs.includes(t)) continue;
      const wasActive = t.active;
      if (t.url !== NEW_TAB) {
        this.closed.unshift({ lastModified: Math.floor(Date.now() / 1000), tab: { sessionId: String(this.nextSession++), windowId: WIN, index: t.index, url: t.url, title: t.title, favIconUrl: t.favIconUrl } });
        this.closed.length = Math.min(this.closed.length, 25);
      }
      const at = t.index;
      this.tabs.splice(at, 1);
      this.reindex();
      this.history.delete(t.id);
      this.dropEmptyGroup(t.groupId);
      this.emit('tabs.onRemoved', t.id, { windowId: WIN, isWindowClosing: false });
      if (wasActive) {
        // 关掉当前标签页:切到右边的(在折叠分组里的跳过),没有就切到左边的
        const visible = (x) => !this.groups.get(x.groupId)?.collapsed;
        const next = this.tabs.slice(at).find(visible) ?? this.tabs.slice(0, at).reverse().find(visible) ?? this.tabs[at] ?? this.tabs[at - 1];
        if (next) this.activate(next);
      }
    }
    // 窗口里不能一个标签页都没有(真的 Chrome 会关掉窗口)
    if (!this.tabs.length) this.create({});
  }

  move(ids, index) {
    const list = [ids].flat().map((id) => this.tab(id));
    const from = new Map(list.map((t) => [t, t.index]));
    for (const t of list) this.tabs.splice(this.tabs.indexOf(t), 1);
    const at = index < 0 || index > this.tabs.length ? this.tabs.length : index;
    this.tabs.splice(at, 0, ...list);
    this.reindex();
    for (const t of list) if (t.index !== from.get(t)) this.emit('tabs.onMoved', t.id, { windowId: WIN, fromIndex: from.get(t), toIndex: t.index });
    return list;
  }

  setGroup(t, groupId) {
    if (t.groupId === groupId) return;
    const old = t.groupId;
    t.groupId = groupId;
    this.emit('tabs.onUpdated', t.id, { groupId }, pub(t));
    this.dropEmptyGroup(old);
  }
  dropEmptyGroup(id) {
    const g = this.groups.get(id);
    if (!g || this.tabs.some((t) => t.groupId === id)) return;
    this.groups.delete(id);
    this.emit('tabGroups.onRemoved', clone(g));
  }

  // 休眠:Chrome 会给标签页换一个新编号
  discard(id) {
    const t = this.tab(id);
    if (t.active) throw new Error('Cannot discard the active tab.');
    const n = { ...t, id: this.nextTab++, discarded: true, status: 'unloaded', audible: false };
    this.tabs[this.tabs.indexOf(t)] = n;
    this.history.set(n.id, this.history.get(t.id));
    this.history.delete(t.id);
    this.emit('tabs.onReplaced', n.id, t.id);
    this.emit('tabs.onUpdated', n.id, { discarded: true }, pub(n));
    return n;
  }

  restore(sessionId) {
    const i = sessionId == null ? 0 : this.closed.findIndex((c) => c.tab.sessionId === sessionId);
    if (i < 0 || !this.closed[i]) throw new Error('No session to restore.');
    const [entry] = this.closed.splice(i, 1);
    const t = this.create({ url: entry.tab.url, index: Math.min(entry.tab.index, this.tabs.length) }, { transition: 'reload' });
    return { lastModified: entry.lastModified, tab: pub(t) };
  }

  // ---------- 存储 ----------

  storageGet(area, keys) {
    const s = this.store[area];
    if (keys == null) return clone(s);
    if (typeof keys === 'string') keys = [keys];
    if (Array.isArray(keys)) return Object.fromEntries(keys.filter((k) => k in s).map((k) => [k, clone(s[k])]));
    return Object.fromEntries(Object.entries(keys).map(([k, d]) => [k, k in s ? clone(s[k]) : d]));
  }
  storageSet(area, items) {
    const s = this.store[area];
    const changes = {};
    for (const [k, v] of Object.entries(items)) {
      if (v === undefined || same(s[k], v)) continue;
      changes[k] = { ...(k in s && { oldValue: s[k] }), newValue: clone(v) };
      s[k] = clone(v);
    }
    if (Object.keys(changes).length) this.emit('storage.onChanged', changes, area);
  }
  storageRemove(area, keys) {
    const s = this.store[area];
    const changes = {};
    for (const k of [keys].flat()) {
      if (!(k in s)) continue;
      changes[k] = { oldValue: s[k] };
      delete s[k];
    }
    if (Object.keys(changes).length) this.emit('storage.onChanged', changes, area);
  }

  // ---------- 给插件页面的 chrome 对象 ----------

  connect(win, name) {
    const ctx = { win, name, on: new Map() };
    this.contexts.add(ctx);
    win.addEventListener('pagehide', () => this.contexts.delete(ctx));
    const b = this;
    const ev = (key) => ({
      addListener: (fn) => ctx.on.set(key, [...(ctx.on.get(key) ?? []), fn]),
      removeListener: (fn) => ctx.on.set(key, (ctx.on.get(key) ?? []).filter((x) => x !== fn)),
      hasListener: (fn) => !!ctx.on.get(key)?.includes(fn),
    });
    const events = (ns, names) => Object.fromEntries(names.map((n) => [n, ev(`${ns}.${n}`)]));
    // 接口都是异步的;出错时 reject,和 Chrome 一样
    const fn = (name, body) => async (...args) => {
      b.hooks.call?.(name, ctx.name, args);
      return clone(body(...args));
    };
    const area = (a) => ({
      get: fn(`storage.${a}.get`, (keys) => b.storageGet(a, keys)),
      set: fn(`storage.${a}.set`, (items) => b.storageSet(a, items)),
      remove: fn(`storage.${a}.remove`, (keys) => b.storageRemove(a, keys)),
      clear: fn(`storage.${a}.clear`, () => b.storageRemove(a, Object.keys(b.store[a]))),
    });
    const winId = (id) => (id === -2 || id == null ? WIN : id);
    const sendMessage = async (msg) => {
      b.hooks.call?.('runtime.sendMessage', ctx.name, [msg]);
      const others = [...b.contexts].filter((c) => c !== ctx && c.on.get('runtime.onMessage')?.length);
      if (!others.length) throw new Error('Could not establish connection. Receiving end does not exist.');
      for (const c of others) for (const l of c.on.get('runtime.onMessage')) c.win.setTimeout(() => l(clone(msg), { id: 'sidearc-demo' }, () => {}), 0);
    };
    const query = (q = {}) =>
      b.tabs
        .filter(
          (t) =>
            (q.windowId == null || winId(q.windowId) === WIN) &&
            (q.active == null || t.active === q.active) &&
            (q.highlighted == null || t.highlighted === q.highlighted) &&
            (q.index == null || t.index === q.index) &&
            (q.groupId == null || t.groupId === q.groupId) &&
            (q.pinned == null || t.pinned === q.pinned) &&
            (q.audible == null || t.audible === q.audible) &&
            (q.discarded == null || t.discarded === q.discarded) &&
            (q.url == null || [q.url].flat().includes(t.url))
        )
        .map(pub);
    const window = { id: WIN, focused: true, type: 'normal', state: 'normal', incognito: false, alwaysOnTop: false };
    return {
      runtime: {
        id: 'sidearc-demo',
        getURL: (p) => 'chrome-extension://sidearc-demo/' + String(p).replace(/^\//, ''),
        sendMessage,
        ...events('runtime', ['onMessage', 'onInstalled', 'onStartup']),
      },
      i18n: { getUILanguage: () => (b.lang === 'zh' ? 'zh-CN' : 'en-US'), getMessage: () => '' },
      storage: { local: area('local'), session: area('session'), onChanged: ev('storage.onChanged') },
      tabs: {
        TAB_ID_NONE: -1,
        query: fn('tabs.query', query),
        get: fn('tabs.get', (id) => pub(b.tab(id))),
        create: fn('tabs.create', (p = {}) => pub(b.create(p))),
        update: fn('tabs.update', (id, p = {}) => {
          if (typeof id === 'object') [id, p] = [b.active.id, id];
          const t = b.tab(id);
          if ('muted' in p) {
            t.mutedInfo = p.muted ? { muted: true, reason: 'extension', extensionId: 'sidearc-demo' } : { muted: false };
            b.emit('tabs.onUpdated', t.id, { mutedInfo: t.mutedInfo }, pub(t));
          }
          if ('autoDiscardable' in p && t.autoDiscardable !== p.autoDiscardable) {
            t.autoDiscardable = p.autoDiscardable;
            b.emit('tabs.onUpdated', t.id, { autoDiscardable: t.autoDiscardable }, pub(t));
          }
          if ('highlighted' in p) {
            t.highlighted = !!p.highlighted || t.active;
            b.emit('tabs.onHighlighted', { windowId: WIN, tabIds: b.tabs.filter((x) => x.highlighted).map((x) => x.id) });
          }
          if (p.url) b.navigate(t, p.url, 'link');
          if (p.active) b.activate(t);
          return pub(t);
        }),
        remove: fn('tabs.remove', (ids) => void b.remove(ids)),
        move: fn('tabs.move', (ids, { index }) => {
          const moved = b.move(ids, index).map(pub);
          return Array.isArray(ids) ? moved : moved[0];
        }),
        discard: fn('tabs.discard', (id) => pub(b.discard(id))),
        reload: fn('tabs.reload', (id) => {
          const t = id == null ? b.active : b.tab(id);
          b.navigate(t, t.url, 'reload');
        }),
        duplicate: fn('tabs.duplicate', (id) => {
          const t = b.tab(id);
          return pub(b.create({ url: t.url, index: t.index + 1 }, { transition: 'reload' }));
        }),
        highlight: fn('tabs.highlight', ({ tabs: indices }) => {
          const list = [indices].flat().map((i) => b.tabs[i]).filter(Boolean);
          if (list[0]) b.activate(list[0]);
          for (const t of b.tabs) t.highlighted = t.active || list.includes(t);
          b.emit('tabs.onHighlighted', { windowId: WIN, tabIds: list.map((t) => t.id) });
          return window;
        }),
        group: fn('tabs.group', ({ tabIds, groupId, createProperties }) => {
          let g = groupId != null ? b.groups.get(groupId) : null;
          if (groupId != null && !g) throw new Error(`No group with id: ${groupId}.`);
          if (!g) {
            g = { id: b.nextGroup++, windowId: WIN, title: '', color: 'grey', collapsed: false };
            b.groups.set(g.id, g);
            b.emit('tabGroups.onCreated', clone(g));
          }
          for (const id of [tabIds].flat()) b.setGroup(b.tab(id), g.id);
          return g.id;
        }),
        ungroup: fn('tabs.ungroup', (ids) => {
          for (const id of [ids].flat()) b.setGroup(b.tab(id), -1);
        }),
        ...events('tabs', ['onCreated', 'onUpdated', 'onRemoved', 'onActivated', 'onMoved', 'onReplaced', 'onAttached', 'onDetached', 'onHighlighted']),
      },
      tabGroups: {
        TAB_GROUP_ID_NONE: -1,
        query: fn('tabGroups.query', () => [...b.groups.values()]),
        get: fn('tabGroups.get', (id) => {
          const g = b.groups.get(id);
          if (!g) throw new Error(`No group with id: ${id}.`);
          return g;
        }),
        update: fn('tabGroups.update', (id, p) => b.updateGroup(id, p)),
        ...events('tabGroups', ['onCreated', 'onUpdated', 'onRemoved', 'onMoved']),
      },
      windows: {
        WINDOW_ID_CURRENT: -2,
        WINDOW_ID_NONE: -1,
        getCurrent: fn('windows.getCurrent', () => window),
        get: fn('windows.get', () => window),
        getAll: fn('windows.getAll', () => [window]),
        update: fn('windows.update', () => window),
        ...events('windows', ['onFocusChanged', 'onCreated', 'onRemoved']),
      },
      sessions: {
        MAX_SESSION_RESULTS: 25,
        getRecentlyClosed: fn('sessions.getRecentlyClosed', ({ maxResults = 25 } = {}) => b.closed.slice(0, maxResults)),
        restore: fn('sessions.restore', (sessionId) => b.restore(sessionId)),
      },
      webNavigation: events('webNavigation', ['onCreatedNavigationTarget', 'onCommitted', 'onHistoryStateUpdated', 'onCompleted', 'onBeforeNavigate']),
      history: { deleteUrl: fn('history.deleteUrl', () => {}), ...events('history', ['onVisited']) },
      search: { query: fn('search.query', ({ text }) => void b.create({ url: `https://www.google.com/search?q=${encodeURIComponent(text)}` }, { transition: 'generated' })) },
      sidePanel: { setPanelBehavior: fn('sidePanel.setPanelBehavior', () => {}), open: fn('sidePanel.open', () => {}) },
    };
  }

  updateGroup(id, p) {
    const g = this.groups.get(id);
    if (!g) throw new Error(`No group with id: ${id}.`);
    // 含有当前标签页的分组不能折叠(Chrome 的接口也不让)
    if (p.collapsed && this.active?.groupId === id) throw new Error('Cannot collapse a group that contains the active tab.');
    const next = { ...g, ...Object.fromEntries(['title', 'color', 'collapsed'].filter((k) => k in p).map((k) => [k, p[k]])) };
    if (same(next, g)) return g;
    Object.assign(g, next);
    this.emit('tabGroups.onUpdated', clone(g));
    return g;
  }

  // ---------- 用户在「浏览器」界面上的操作(顶部标签栏、地址栏、网页) ----------

  // 在顶部标签栏里拖动标签页:放到同一个分组的两个标签页中间就进这个分组,和 Chrome 一样
  userMove(id, to) {
    const t = this.tab(id);
    const rest = this.tabs.filter((x) => x !== t);
    const [left, right] = [rest[to - 1], rest[to]];
    const L = left?.groupId ?? -1;
    const R = right?.groupId ?? -1;
    const group = L === R ? L : [L, R].includes(t.groupId) ? t.groupId : -1;
    this.move(id, to);
    this.setGroup(t, group);
  }

  // 点分组的名字:折叠或展开。折叠当前标签页所在的分组时,Chrome 会先切到分组外的标签页
  userToggleGroup(id) {
    const g = this.groups.get(id);
    if (!g) return;
    if (!g.collapsed && this.active?.groupId === id) {
      const outside = this.tabs.filter((t) => t.groupId !== id && !this.groups.get(t.groupId)?.collapsed);
      const at = this.active.index;
      const next = outside.find((t) => t.index > at) ?? outside.reverse().find((t) => t.index < at);
      if (!next) return;
      this.activate(next);
    }
    this.updateGroup(id, { collapsed: !g.collapsed });
  }

  // 网页里的链接:newTab 在新标签页打开(background 为真时在后台打开,比如 Ctrl/⌘+点击),否则本页跳转
  userOpen(url, { newTab, background } = {}) {
    const from = this.active;
    if (newTab || background) this.create({ url, active: !background, openerTabId: from.id }, { source: from.id });
    else this.navigate(from, url, 'link');
  }

  userBack(step) {
    const t = this.active;
    const h = this.history.get(t.id);
    const url = h.list[h.pos + step];
    if (!url) return;
    h.pos += step;
    this.navigate(t, url, 'link', ['forward_back']);
  }
}
