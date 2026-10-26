// 后台:让顶部标签栏和侧边栏保持一致。每个空间在每个窗口里对应一个标签页分组,
// 当前空间的分组展开、其他空间的折叠;收藏的标签页不进分组,放在最左边。
// 顺序以侧边栏为准(见 logic.js 的 buildLayout);在顶部标签栏里拖进别的分组 = 移到那个空间。
// 不是空间的分组(用户自己建的、别的扩展建的,比如 Claude 的分组)不归 Sidearc 管:
// 里面的标签页不拆分组、不改折叠,整组放在空间分组的最后面;侧边栏里照常显示在它们原来的空间里。

import { buildLayout, groupColor, pinnedItems } from './logic.js';
import { hasPrefix, KEY, PREFIX } from './protocol.js';

// 新标签页(Chrome 自己的,和一些替换了新标签页的扩展用的地址)
const NEW_TAB = /^(chrome|edge):\/\/(newtab|new-tab-page)|^chrome-search:\/\/local-ntp/i;

// 这之前发生的移动、分组变化是自己引起的,不当作用户操作
let ownUntil = 0;
const own = (ms = 800) => (ownUntil = Date.now() + ms);
const isOwn = () => Date.now() < ownUntil;

// tabId -> 上次同步时它所在的空间。分组和这个不一样、而记录的空间没变 = 用户把它拖进了别的分组
const lastSpace = new Map();

// 连续多次同步都没能排好(比如浏览器不按预期移动),先停一会儿,免得来回挪个不停
let busyRuns = 0;
let pausedUntil = 0;
// 安排一次同步(startGroupSync 里设置)。暂停期间的变化都被跳过了,暂停结束时要靠它再排一次
let resync = () => {};

async function syncWindow(windowId, state, all) {
  const set = {};
  const remove = [];
  const allTabs = await chrome.tabs.query({ windowId });
  const nativePinned = allTabs.filter((t) => t.pinned).length;
  const groups = await chrome.tabGroups.query({ windowId });

  // 分组 -> 空间:记过的;或者和某个空间同名的(浏览器重启后分组 id 会变,标题还在)。
  // 同一个空间有好几个分组(比如重启后新标签页先建了一个,恢复上次的标签页时又冒出一个同名的)也都算它的,
  // 只留第一个,其余分组里的标签页会被挪进第一个,空了的分组浏览器自己会删掉
  const spaceIds = new Set(state.spaces.map((s) => s.id));
  const groupSpace = new Map();
  for (const g of groups) {
    const sid = all[KEY.group(g.id)] ?? state.spaces.find((s) => s.name === g.title)?.id;
    if (spaceIds.has(sid)) {
      groupSpace.set(g.id, sid);
      if (all[KEY.group(g.id)] !== sid) set[KEY.group(g.id)] = sid;
    }
  }
  // 要管的标签页:不是原生固定的,也不在别人的分组里
  const foreign = (t) => t.groupId !== -1 && !groupSpace.has(t.groupId);
  const tabs = allTabs.filter((t) => !t.pinned && !foreign(t));

  // 绑定到收藏/固定项的标签页
  const itemIds = new Set([...state.favorites, ...state.spaces.flatMap(pinnedItems)].map((i) => i.id));
  const bound = new Set(Object.entries(all).filter(([k]) => hasPrefix(k, PREFIX.bind) && itemIds.has(k.slice(2))).map(([, v]) => v));
  for (const t of tabs) {
    const inGroup = groupSpace.get(t.groupId);
    const cur = all[KEY.space(t.id)];
    if (bound.has(t.id)) continue; // 收藏和固定项的标签页跟着项走,拖到哪里都会被放回去
    if (!spaceIds.has(cur)) {
      // 还没有空间(或空间已删除):在某个空间的分组里就归它(比如重启后浏览器恢复的分组),否则归当前空间
      set[KEY.space(t.id)] = inGroup ?? state.activeSpaceId;
    } else if (inGroup && inGroup !== cur && lastSpace.get(t.id) === cur) {
      // 用户在顶部标签栏里把它拖进了别的空间的分组
      set[KEY.space(t.id)] = inGroup;
      remove.push(KEY.parent(t.id));
    }
  }
  Object.assign(all, set);
  for (const k of remove) delete all[k];

  const layout = buildLayout(state, all, tabs);
  const order = layout.flatMap((c) => c.ids);
  const groupOfSpace = new Map();
  for (const [g, s] of groupSpace) if (!groupOfSpace.has(s)) groupOfSpace.set(s, g);
  const byId = new Map(tabs.map((t) => [t.id, t]));
  // 空间的标签页放进空间的分组,哪怕窗口里只有一个空间的标签页(收藏的标签页不进分组)。
  // 只是这个空间还没有分组、而它的标签页全是新标签页时先不建:Chrome 会把每个分组都存到书签栏上,
  // 每次打开浏览器(启动时打开新标签页)、临时开个空窗口都建一个的话,书签栏上的同名分组就越积越多。
  // 打开了真正的网页(或者恢复了上次的标签页)再建
  const isNewTab = (id) => NEW_TAB.test(byId.get(id).url || byId.get(id).pendingUrl || '');
  const wantGroup = (c) => (c.spaceId == null ? -1 : (groupOfSpace.get(c.spaceId) ?? (c.ids.every(isNewTab) ? -1 : undefined)));
  // 排好了 = 要管的标签页按顺序排在前面,别人的分组整组在最后面
  const strip = allTabs.filter((t) => !t.pinned).map((t) => t.id);
  const settled =
    strip.slice(0, order.length).join() === order.join() &&
    layout.every((c) => c.ids.every((id) => byId.get(id).groupId === (wantGroup(c) ?? NaN)));

  if (!settled) {
    own(2000);
    // 先把分组不对的拿出来,再从左到右一块块放好、分好组。别人的分组会被挤到最后面,但不会被拆开
    const wrong = layout.flatMap((c) => c.ids.filter((id) => byId.get(id).groupId !== -1 && byId.get(id).groupId !== wantGroup(c)));
    if (wrong.length) await chrome.tabs.ungroup(wrong).catch(() => {});
    let index = nativePinned;
    for (const c of layout) {
      await chrome.tabs.move(c.ids, { index }).catch(() => {});
      if (wantGroup(c) === -1) {
        await chrome.tabs.ungroup(c.ids).catch(() => {});
      } else {
        const existing = groupOfSpace.get(c.spaceId);
        const alive = existing != null && (await chrome.tabGroups.get(existing).catch(() => null));
        const id = await chrome.tabs
          .group(alive ? { tabIds: c.ids, groupId: existing } : { tabIds: c.ids, createProperties: { windowId } })
          .catch(() => null);
        if (id != null) {
          groupOfSpace.set(c.spaceId, id);
          if (all[KEY.group(id)] !== c.spaceId) set[KEY.group(id)] = c.spaceId;
        }
      }
      index += c.ids.length;
    }
    own();
  }

  // 分组的名字、颜色、折叠状态跟着空间走
  for (const space of state.spaces) {
    const id = groupOfSpace.get(space.id);
    if (id == null) continue;
    const g = await chrome.tabGroups.get(id).catch(() => null);
    if (!g) continue;
    const want = { title: space.name, color: groupColor(space.color), collapsed: space.id !== state.activeSpaceId };
    if (g.title !== want.title || g.color !== want.color || g.collapsed !== want.collapsed) {
      own();
      // 含有当前标签页的分组浏览器不让折叠,等切到别的标签页后下次再折
      await chrome.tabGroups.update(id, want).catch(() => chrome.tabGroups.update(id, { title: want.title, color: want.color }).catch(() => {}));
    }
  }

  if (Object.keys(set).length) await chrome.storage.session.set(set);
  if (remove.length) await chrome.storage.session.remove(remove);
  for (const t of tabs) if (!bound.has(t.id)) lastSpace.set(t.id, all[KEY.space(t.id)]);
  return !settled;
}

async function syncAll() {
  if (Date.now() < pausedUntil) return;
  const [{ state }, all] = await Promise.all([chrome.storage.local.get('state'), chrome.storage.session.get(null)]);
  if (!state?.spaces?.length) return;
  let moved = false;
  for (const w of await chrome.windows.getAll({ windowTypes: ['normal'] })) moved = (await syncWindow(w.id, state, all)) || moved;
  busyRuns = moved ? busyRuns + 1 : 0;
  if (busyRuns >= 5) {
    console.warn('Sidearc: 标签页分组多次没能排好,暂停 10 秒');
    pausedUntil = Date.now() + 10000;
    busyRuns = 0;
    // 比如一下恢复几十个标签页:一个个建出来、休眠时又一个个换编号,很容易连着几次没排好。
    // 暂停期间的变化都跳过了,结束时不再排一次的话,要等下一次标签页变化才会分组
    setTimeout(() => resync(), 10050);
  }
}

// 用户在顶部标签栏里拖动了标签页:拖离父标签页(左边不是父标签或兄弟标签)就不再是子标签
async function userMoved(tabId, { windowId, toIndex }) {
  const parent = (await chrome.storage.session.get(KEY.parent(tabId)))[KEY.parent(tabId)];
  if (parent == null) return;
  // 拖到了最左边(toIndex 为 0):左边没有标签页,当然也就离开了父标签页。index 不能传负数,否则 tabs.query 会报错
  const [left] = toIndex > 0 ? await chrome.tabs.query({ windowId, index: toIndex - 1 }) : [];
  const leftParent = left && (await chrome.storage.session.get(KEY.parent(left.id)))[KEY.parent(left.id)];
  if (left?.id !== parent && leftParent !== parent) await chrome.storage.session.remove(KEY.parent(tabId));
}

// 用户在顶部标签栏里展开了别的空间的分组:切到那个空间
async function userExpanded(group) {
  const { state } = await chrome.storage.local.get('state');
  const sid = (await chrome.storage.session.get(KEY.group(group.id)))[KEY.group(group.id)];
  if (!state || !sid || sid === state.activeSpaceId || !state.spaces.some((s) => s.id === sid)) return;
  state.activeSpaceId = sid;
  await chrome.storage.local.set({ state });
  const [recent] = (await chrome.tabs.query({ groupId: group.id })).sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0));
  if (recent) await chrome.tabs.update(recent.id, { active: true });
}

export function startGroupSync(serial) {
  let timer;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(() => serial(syncAll), 150);
  };
  resync = schedule;
  for (const ev of ['onCreated', 'onRemoved', 'onAttached', 'onDetached', 'onActivated']) chrome.tabs[ev].addListener(schedule);
  // 网址变了也要排:只有新标签页时没建分组,打开了真正的网页就该建了
  chrome.tabs.onUpdated.addListener((_, info) => ('groupId' in info || 'pinned' in info || 'url' in info) && schedule());
  chrome.tabs.onMoved.addListener((tabId, info) => {
    if (!isOwn()) serial(() => userMoved(tabId, info));
    schedule();
  });
  chrome.tabGroups.onUpdated.addListener((group) => {
    if (!isOwn() && !group.collapsed) serial(() => userExpanded(group));
    schedule();
  });
  chrome.tabGroups.onRemoved.addListener((group) => chrome.storage.session.remove(KEY.group(group.id)));
  chrome.storage.onChanged.addListener((changes, area) => {
    // 空间设置、空间归属、绑定、父子关系变了都要重排;分组记录和查重标记的变化不用
    const keys = Object.keys(changes);
    const relevant = [PREFIX.space, PREFIX.bind, PREFIX.parent];
    if ((area === 'local' && changes.state) || (area === 'session' && keys.some((k) => relevant.some((p) => hasPrefix(k, p))))) schedule();
  });
  schedule();
}
