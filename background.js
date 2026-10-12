// 点击工具栏图标(或快捷键)直接开关侧边栏
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);

// 会话存储里的键:t:<tabId> 空间归属,a:<tabId> 别名,c:<tabId> 父标签页,b:<itemId> 固定项绑定的 tabId

const NEW_TAB = /^[a-z-]+:\/\/(newtab|new-tab-page)/i;
const urlOf = (tab) => tab.url || tab.pendingUrl || '';

// 从某个标签页里打开的新标签页,自动成为它的子标签并留在同一个空间。
// 最多两级:从子标签里打开的,和它并列挂在同一个父标签页下。
// Ctrl+T 的新标签页也带 openerTabId,按网址排除掉
chrome.tabs.onCreated.addListener(async (tab) => {
  // 其他扩展用 API 开的标签页,事件触发时来源还没填上,重新取一次
  const opener = tab.openerTabId ?? (await chrome.tabs.get(tab.id).catch(() => null))?.openerTabId;
  if (opener == null || NEW_TAB.test(urlOf(tab))) return;
  const got = await chrome.storage.session.get([`t:${opener}`, `c:${opener}`]);
  const space = got[`t:${opener}`];
  await chrome.storage.session.set({ [`c:${tab.id}`]: got[`c:${opener}`] ?? opener, ...(space && { [`t:${tab.id}`]: space }) });
});

// 标签页关闭后清掉它的数据,并把它的子标签一并关闭
chrome.tabs.onRemoved.addListener(async (tabId, info) => {
  const all = await chrome.storage.session.get(null);
  const keys = Object.keys(all).filter(
    (k) => k === `t:${tabId}` || k === `a:${tabId}` || k === `c:${tabId}` || (/^[bc]:/.test(k) && all[k] === tabId)
  );
  const children = keys.filter((k) => k.startsWith('c:') && all[k] === tabId).map((k) => +k.slice(2));
  if (keys.length) await chrome.storage.session.remove(keys);
  if (children.length && !info.isWindowClosing) await chrome.tabs.remove(children).catch(() => {});
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
    if (e.s) set[`t:${tab.id}`] = e.s;
    if (e.a) set[`a:${tab.id}`] = e.a;
    for (const item of e.b ?? []) set[`b:${item}`] = tab.id;
  }
  // 父子关系要等两头都对上
  r.tabs.forEach((e, pos) => {
    const [child, parent] = [r.claimed[pos], r.claimed[e.p]];
    if (child != null && parent != null && (fresh.includes(pos) || fresh.includes(e.p))) set[`c:${child}`] = parent;
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
    if (k.startsWith('b:')) binds.set(v, [...(binds.get(v) ?? []), k.slice(2)]);
  }
  const snapshot = {
    tabs: tabs.map((t) => ({ id: t.id, i: t.index, u: urlOf(t), s: all[`t:${t.id}`], a: all[`a:${t.id}`], p: pos.get(all[`c:${t.id}`]), b: binds.get(t.id) })),
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
