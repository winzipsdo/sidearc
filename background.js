// 后台(service worker):侧边栏没开着时也要做的事。会话存储的键和消息格式见 src/protocol.js

import { addressOf, itemsAt } from './src/logic.js';
import { hasPrefix, KEY, MSG, PREFIX } from './src/protocol.js';

// 点击工具栏图标(或快捷键)直接开关侧边栏
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);

const NEW_TAB = /^[a-z-]+:\/\/(newtab|new-tab-page)/i;
const urlOf = (tab) => tab.url || tab.pendingUrl || '';

// 从某个标签页里打开的新标签页,自动成为它的子标签并留在同一个空间。
// 最多两级:从子标签里打开的,和它并列挂在同一个父标签页下。
// 不看 openerTabId:Ctrl+T 和从其他应用点开的链接也带着它(值是当时的前台标签页),
// 只有页面里的链接或脚本开出的新标签页才会触发这个事件
chrome.webNavigation.onCreatedNavigationTarget.addListener(async ({ sourceTabId: opener, tabId }) => {
  const got = await chrome.storage.session.get([KEY.space(opener), KEY.parent(opener)]);
  const space = got[KEY.space(opener)];
  await chrome.storage.session.set({ [KEY.parent(tabId)]: got[KEY.parent(opener)] ?? opener, ...(space && { [KEY.space(tabId)]: space }) });
});

// 标签页关闭后清掉它的数据,并把它的子标签一并关闭
chrome.tabs.onRemoved.addListener(async (tabId, info) => {
  const all = await chrome.storage.session.get(null);
  // 它自己的数据,加上指向它的:绑定到它的固定项、挂在它下面的子标签
  const own = [KEY.space(tabId), KEY.alias(tabId), KEY.parent(tabId), KEY.fresh(tabId)];
  const keys = Object.keys(all).filter((k) => own.includes(k) || ((hasPrefix(k, PREFIX.bind) || hasPrefix(k, PREFIX.parent)) && all[k] === tabId));
  const children = keys.filter((k) => hasPrefix(k, PREFIX.parent) && all[k] === tabId).map((k) => +k.slice(2));
  if (keys.length) await chrome.storage.session.remove(keys);
  if (children.length && !info.isWindowClosing) await chrome.tabs.remove(children).catch(() => {});
});

// ---------- 不记录历史的空间 ----------
// Chrome 不能让普通窗口里的个别标签页进入无痕模式,所以改为事后清除:
// 某个网址刚被记进历史时,如果它正开在「不记录历史」的空间里,就立刻删掉。
// 注意 history.deleteUrl 是按网址删的,会连同这个网址以前的访问记录一起删除。
chrome.history.onVisited.addListener(async (item) => {
  const { state } = await chrome.storage.local.get('state');
  const off = new Set((state?.spaces ?? []).filter((s) => s.noHistory).map((s) => s.id));
  if (!off.size) return;
  const hits = (await chrome.tabs.query({})).filter((t) => t.url === item.url || t.pendingUrl === item.url);
  if (!hits.length) return;
  const space = await chrome.storage.session.get(hits.map((t) => KEY.space(t.id)));
  // 侧边栏没开时新标签页还没分配空间,按当前空间算
  if (hits.some((t) => off.has(space[KEY.space(t.id)] ?? state.activeSpaceId))) await chrome.history.deleteUrl({ url: item.url });
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
  r ??= { boot: Date.now(), tabs: (await chrome.storage.local.get('snapshot')).snapshot?.tabs ?? [], claimed: {} };

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
    tabs: tabs.map((t) => ({ id: t.id, i: t.index, u: urlOf(t), s: all[KEY.space(t.id)], a: all[KEY.alias(t.id)], p: pos.get(all[KEY.parent(t.id)]), b: binds.get(t.id) })),
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
// 新开的标签页载入网页时,如果本窗口已有同地址的标签页,就切过去并关掉新开的这个;
// 地址和某个还没打开的收藏/固定项相同时,让它成为那个项的标签页。
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
  const others = (await chrome.tabs.query({ windowId: tab.windowId })).filter((t) => t.id !== tab.id);
  let twin = others.find((t) => addressOf(t.url || '') === address);
  if (!twin) {
    // 没有打开着的同地址标签页,再看收藏/固定项
    const { state } = await chrome.storage.local.get('state');
    const items = itemsAt(state, address);
    if (!items.length) return;
    const all = await chrome.storage.session.get(items.map(({ item }) => KEY.bind(item.id)));
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
