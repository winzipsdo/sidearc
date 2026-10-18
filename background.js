// 后台(service worker):侧边栏没开着时也要做的事。会话存储的键和消息格式见 src/protocol.js

import { addressOf, ANY_SPACE, itemsAt, privateItemIds, tabSpaces } from './src/logic.js';
import { hasPrefix, KEY, MSG, PREFIX } from './src/protocol.js';
import { startGroupSync } from './src/groups.js';

// 点击工具栏图标(或快捷键)直接开关侧边栏
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);

const NEW_TAB = /^[a-z-]+:\/\/(newtab|new-tab-page)/i;
const urlOf = (tab) => tab.url || tab.pendingUrl || '';

// 从某个标签页里打开的新标签页,自动成为它的子标签并留在同一个空间。
// 最多两级:从子标签里打开的,和它并列挂在同一个父标签页下。
// 不看 openerTabId:Ctrl+T 和从其他应用点开的链接也带着它(值是当时的前台标签页),
// 只有页面里的链接或脚本开出的新标签页才会触发这个事件
// 来源是收藏或固定标签的标签页时,新标签页不做任何标签页的子标签:收藏和固定标签不在列表里,
// 挂在它们下面既看不出来,还会把再往下打开的页面挤成同级(最多两级)。
// 来源是收藏的标签页时(收藏所有空间共用)不指定空间,由侧边栏归入当前空间。
// 这类标签页是用户在网页里特意新开的(Ctrl/⌘+点击、中键、在新标签页打开的链接),地址重复也不合并
chrome.webNavigation.onCreatedNavigationTarget.addListener(async ({ sourceTabId: opener, tabId }) => {
  keep(tabId);
  const [{ state }, all] = await Promise.all([chrome.storage.local.get('state'), chrome.storage.session.get(null)]);
  const space = tabSpaces(state, all).get(opener);
  const fromItem = Object.keys(all).some((k) => hasPrefix(k, PREFIX.bind) && all[k] === opener);
  await chrome.storage.session.set({
    ...(!fromItem && { [KEY.parent(tabId)]: all[KEY.parent(opener)] ?? opener }),
    ...(space && space !== ANY_SPACE && { [KEY.space(tabId)]: space }),
  });
});

// 标签页被替换成了新编号(比如休眠后 Chrome 会换一个新 id):把它自己的数据,
// 以及指向它的引用(挂在它下面的子标签、绑定到它的收藏/固定项)都挪到新编号上,
// 否则父子关系、所属空间、别名和固定绑定都会丢
chrome.tabs.onReplaced.addListener((addedId, removedId) =>
  serial(async () => {
    const all = await chrome.storage.session.get(null);
    const set = {};
    const remove = [];
    for (const key of [KEY.space, KEY.alias, KEY.parent, KEY.fresh, KEY.slept]) {
      if (!(key(removedId) in all)) continue;
      set[key(addedId)] = all[key(removedId)];
      remove.push(key(removedId));
    }
    for (const [k, v] of Object.entries(all)) {
      if (v === removedId && (hasPrefix(k, PREFIX.bind) || hasPrefix(k, PREFIX.parent))) set[k] = addedId;
    }
    if (Object.keys(set).length) await chrome.storage.session.set(set);
    if (remove.length) await chrome.storage.session.remove(remove);
  })
);

// 记下标签页是什么时候开始休眠的(手动休眠和 Chrome「节省内存」自动回收都算),醒来后删掉。
// Chrome 本身不记这个时间,侧边栏要靠它显示「休眠了多久」。浏览器重启后恢复出来还没加载的标签页没有这个时间
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if ('discarded' in info) {
    serial(() => (info.discarded ? chrome.storage.session.set({ [KEY.slept(tabId)]: Date.now() }) : chrome.storage.session.remove(KEY.slept(tabId))));
  } else if (info.status === 'loading') {
    // 重启后恢复出来、还没加载的标签页醒来时不会有 discarded 事件,开始加载就算醒了
    serial(() => chrome.storage.session.remove(KEY.slept(tabId)));
  }
});

// 标签页关闭后清掉它的数据,并把它的子标签一并关闭
chrome.tabs.onRemoved.addListener(async (tabId, info) => {
  const all = await chrome.storage.session.get(null);
  // 它自己的数据,加上指向它的:绑定到它的固定项、挂在它下面的子标签
  const own = [KEY.space(tabId), KEY.alias(tabId), KEY.parent(tabId), KEY.fresh(tabId), KEY.slept(tabId)];
  const keys = Object.keys(all).filter((k) => own.includes(k) || ((hasPrefix(k, PREFIX.bind) || hasPrefix(k, PREFIX.parent)) && all[k] === tabId));
  const children = keys.filter((k) => hasPrefix(k, PREFIX.parent) && all[k] === tabId).map((k) => +k.slice(2));
  // 绑定在收藏/固定项上的标签页不在列表里,它的子标签在列表里是单独显示的,看不出和它是一起的:
  // 关掉它时不连带关闭,子标签变成普通标签页
  const bound = keys.some((k) => hasPrefix(k, PREFIX.bind));
  if (keys.length) await chrome.storage.session.remove(keys);
  if (children.length && !bound && !info.isWindowClosing) await chrome.tabs.remove(children).catch(() => {});
});

// ---------- 不记录历史的空间 ----------
// Chrome 不能让普通窗口里的个别标签页进入无痕模式,所以改为事后清除:
// 某个网址刚被记进历史时,如果它正开在「不记录历史」的空间里,就立刻删掉。
// 注意 history.deleteUrl 是按网址删的,会连同这个网址以前的访问记录一起删除。
chrome.history.onVisited.addListener(async (item) => {
  const { state } = await chrome.storage.local.get('state');
  const off = new Set((state?.spaces ?? []).filter((s) => s.noHistory).map((s) => s.id));
  const privateItems = privateItemIds(state);
  if (!off.size && !privateItems.size) return;
  const hits = (await chrome.tabs.query({})).filter((t) => t.url === item.url || t.pendingUrl === item.url);
  if (!hits.length) return;
  const all = await chrome.storage.session.get(null);
  // 不记录历史的文件夹:绑定到其中固定项的标签页,以及从它们打开的子标签页
  const privateTabs = new Set(Object.keys(all).filter((k) => hasPrefix(k, PREFIX.bind) && privateItems.has(k.slice(2))).map((k) => all[k]));
  // 侧边栏没开时新标签页还没分配空间,按当前空间算
  const isPrivate = (t) => off.has(all[KEY.space(t.id)] ?? state.activeSpaceId) || privateTabs.has(t.id) || privateTabs.has(all[KEY.parent(t.id)]);
  if (hits.some(isPrivate)) await chrome.history.deleteUrl({ url: item.url });
});

// ---------- 重启 / 重新加载后恢复 ----------
// 标签页 id 和会话存储在浏览器重启、扩展重新加载后都会清空。
// 所以把每个标签页的数据连同网址、位置存一份快照到 storage.local,
// 启动后再按「id → 网址+位置 → 网址」把恢复出来的标签页和快照对上。

const RESTORE = '_restore'; // 会话存储里的恢复进度:{ boot, tabs: 快照, claimed: { 快照下标: 新 tabId } }
const RESTORE_WINDOW = 20000; // 启动后这段时间内陆续出现的标签页都尝试匹配
let quietUntil = 0;
let queue = Promise.resolve();
const serial = (fn) => (queue = queue.then(fn, fn));

async function restoreStep() {
  let r = (await chrome.storage.session.get(RESTORE))[RESTORE];
  if (r && Date.now() > r.boot + RESTORE_WINDOW) return r;
  if (!r) {
    const { snapshot } = await chrome.storage.local.get('snapshot');
    // time:快照最后保存的时间,约等于上次关浏览器前最后一次使用的时间
    r = { boot: Date.now(), tabs: snapshot?.tabs ?? [], time: snapshot?.time, claimed: {} };
  }

  const taken = new Set(Object.values(r.claimed));
  const set = {};
  const fresh = [];
  for (const tab of await chrome.tabs.query({})) {
    const url = urlOf(tab);
    if (taken.has(tab.id) || !url || NEW_TAB.test(url)) continue;
    let best = -1;
    let score = 0;
    r.tabs.forEach((e, pos) => {
      if (pos in r.claimed || e.u !== url) return;
      const s = e.id === tab.id ? 3 : e.i === tab.index ? 2 : 1;
      if (s > score) [best, score] = [pos, s];
    });
    if (best < 0) continue;
    r.claimed[best] = tab.id;
    fresh.push(best);
    const e = r.tabs[best];
    if (e.s) set[KEY.space(tab.id)] = e.s;
    if (e.a) set[KEY.alias(tab.id)] = e.a;
    for (const item of e.b ?? []) set[KEY.bind(item)] = tab.id;
    // 休眠时间:关浏览器前就在休眠的,接着用原来的时间;关之前还醒着、重启后还没加载的,
    // 从上次关浏览器前最后一次使用时算起
    const asleep = tab.discarded || tab.status === 'unloaded';
    if (asleep && (e.z ?? r.time)) set[KEY.slept(tab.id)] = e.z ?? r.time;
  }
  // 父子关系要等两头都对上
  r.tabs.forEach((e, pos) => {
    const [child, parent] = [r.claimed[pos], r.claimed[e.p]];
    if (child != null && parent != null && (fresh.includes(pos) || fresh.includes(e.p))) set[KEY.parent(child)] = parent;
  });
  set[RESTORE] = r;
  await chrome.storage.session.set(set);
  return r;
}

async function saveSnapshot() {
  if (Date.now() < quietUntil) return;
  const r = await restoreStep();
  // 还在等标签页恢复时不要覆盖旧快照
  if (Date.now() < r.boot + RESTORE_WINDOW && r.tabs.some((_, pos) => !(pos in r.claimed))) return;

  const [tabs, all] = await Promise.all([chrome.tabs.query({}), chrome.storage.session.get(null)]);
  const pos = new Map(tabs.map((t, i) => [t.id, i]));
  const binds = new Map();
  for (const [k, v] of Object.entries(all)) {
    if (hasPrefix(k, PREFIX.bind)) binds.set(v, [...(binds.get(v) ?? []), k.slice(2)]);
  }
  const snapshot = {
    time: Date.now(),
    tabs: tabs.map((t) => ({
      id: t.id,
      i: t.index,
      u: urlOf(t),
      s: all[KEY.space(t.id)],
      a: all[KEY.alias(t.id)],
      p: pos.get(all[KEY.parent(t.id)]),
      b: binds.get(t.id),
      z: all[KEY.slept(t.id)],
    })),
  };
  await chrome.storage.local.set({ snapshot });
}

let timer;
function touch() {
  clearTimeout(timer);
  timer = setTimeout(() => serial(saveSnapshot), 500);
}

serial(restoreStep);
chrome.tabs.onCreated.addListener(() => (serial(restoreStep), touch()));
chrome.tabs.onUpdated.addListener((_, info) => info.url && (serial(restoreStep), touch()));
chrome.tabs.onMoved.addListener(touch);
// 切换标签页也存一次:快照的时间要尽量接近关浏览器前最后一次使用的时间(重启后算休眠时间要用)
chrome.tabs.onActivated.addListener(touch);
chrome.tabs.onAttached.addListener(touch);
chrome.tabs.onDetached.addListener(touch);
chrome.tabs.onRemoved.addListener((_, info) => {
  // 整个窗口(或浏览器)正在关闭:标签页是一个个消失的,这时存快照会把数据越存越少
  if (info.isWindowClosing) quietUntil = Date.now() + 3000;
  else touch();
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'session' && Object.keys(changes).some((k) => k !== RESTORE)) touch();
});

// ---------- 相同地址只开一份 ----------
// 新开的标签页载入网页时,如果本窗口同一个空间里已有同地址的标签页,就切过去并关掉新开的这个;
// 地址和某个还没打开的收藏/本空间固定项相同时,让它成为那个项的标签页。
// 只管新开的标签页(带 fresh 标记),已有标签页里的跳转不干预。

const NEW = KEY.fresh;

// 不查重的标签页。创建事件和「不查重」的请求谁先到不一定,两头都处理
const kept = new Set();
const keep = (tabId) => (kept.add(tabId), serial(() => chrome.storage.session.remove(NEW(tabId))));

chrome.tabs.onCreated.addListener((tab) => serial(() => kept.has(tab.id) || chrome.storage.session.set({ [NEW(tab.id)]: 1 })));

// 页面刚载入时常常自己再改一次地址(登录跳转回来、去掉多余的参数),所以第一次没查到重复的话,
// 这段时间内它自己改地址时再查
const SETTLE = 10000;

// auto:这次地址变化是页面自己引起的(跳转、改写地址),不是用户又去了别处
async function dedupe(nav, auto) {
  const address = addressOf(nav.url);
  // 新标签页之类的内部页面不算,等它真正载入网页时再查
  if (nav.frameId !== 0 || nav.documentLifecycle !== 'active' || !address) return;
  // 标记的值:1 = 还没载入过网页;其他 = 第一次载入网页的时间
  const since = (await chrome.storage.session.get(NEW(nav.tabId)))[NEW(nav.tabId)];
  if (!since) return;
  const first = since === 1;
  // 会话恢复、重新打开关闭的标签页、复制标签页都是 reload 类型,是用户有意要的,不拦
  const stop = first ? nav.transitionType === 'reload' : !auto || Date.now() > since + SETTLE;
  if (stop) return chrome.storage.session.remove(NEW(nav.tabId));
  if (first) await chrome.storage.session.set({ [NEW(nav.tabId)]: Date.now() });
  const tab = await chrome.tabs.get(nav.tabId).catch(() => null);
  if (!tab) return;
  // 空间是隔离的:只和同一个空间里的标签页、固定项比,外加所有空间共用的收藏夹。
  // 还没分到空间的(侧边栏没开着)按当前空间算
  const [{ state }, all] = await Promise.all([chrome.storage.local.get('state'), chrome.storage.session.get(null)]);
  const spaceOf = tabSpaces(state, all);
  const here = spaceOf.get(tab.id) ?? state?.activeSpaceId;
  const others = (await chrome.tabs.query({ windowId: tab.windowId })).filter((t) => {
    const space = spaceOf.get(t.id) ?? state?.activeSpaceId;
    return t.id !== tab.id && (space === here || space === ANY_SPACE);
  });
  let twin = others.find((t) => addressOf(t.url || '') === address);
  if (!twin) {
    // 没有打开着的同地址标签页,再看收藏/固定项
    const items = itemsAt(state, address, here);
    if (!items.length) return;
    const boundTo = (item) => all[KEY.bind(item.id)];
    const free = items.find(({ item }) => boundTo(item) == null);
    // 项已经开着,但那个标签页后来去了别的页面:切过去并打开这个地址
    twin = !free && others.find((t) => items.some(({ item }) => boundTo(item) === t.id));
    if (twin) await chrome.tabs.update(twin.id, { url: nav.url });
    else if (free) return adopt(tab, free.item);
    else return; // 项开在别的窗口里
  }
  await chrome.storage.session.remove(NEW(nav.tabId));
  // 后台打开的不抢焦点,只关掉重复的
  if (tab.active) await chrome.tabs.update(twin.id, { active: true });
  await chrome.tabs.remove(tab.id).catch(() => {});
  chrome.runtime.sendMessage({ [MSG.deduped]: { url: nav.url, windowId: tab.windowId, active: tab.active } }).catch(() => {});
}

// 收藏/固定项还没打开:让新标签页直接成为它的标签页,显示在收藏夹或固定标签里,而不是列表里多出一个
async function adopt(tab, item) {
  await chrome.storage.session.remove([NEW(tab.id), KEY.parent(tab.id)]);
  await chrome.storage.session.set({ [KEY.bind(item.id)]: tab.id });
  chrome.runtime.sendMessage({ [MSG.adopted]: { windowId: tab.windowId, tabId: tab.id, itemId: item.id } }).catch(() => {});
}

const REDIRECTS = ['client_redirect', 'server_redirect'];
chrome.webNavigation.onCommitted.addListener((nav) => serial(() => dedupe(nav, nav.transitionQualifiers.some((q) => REDIRECTS.includes(q)))));
// 页面用 history API 改写了自己的地址
chrome.webNavigation.onHistoryStateUpdated.addListener((nav) => serial(() => dedupe(nav, true)));

// 侧边栏的请求:keepTab 不查重这个标签页;openDup 撤销了查重,照原样再开一份
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.[MSG.keepTab] != null) keep(msg[MSG.keepTab]);
  if (msg?.[MSG.openDup]) {
    const { url, windowId, active } = msg[MSG.openDup];
    chrome.tabs.create({ url, windowId, active }).then((tab) => keep(tab.id));
  }
});

// ---------- 空间 ↔ 标签页分组 ----------
startGroupSync(serial);
