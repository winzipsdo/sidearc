// 对标签页的操作:打开、关闭、撤销关闭、别名、移到别的空间、搜索栏回车。

import { $ } from './dom.js';
import { canDiscard, toUrl } from './logic.js';
import { KEY, MSG } from './protocol.js';
import { render, schedule } from './render.js';
import { listedTabs, query, replaceTabId, setQuery, setRenderHeld, setTabAlias, setTabParent, state, subtreeIds, tabAlias, tabParent, tabs, tabSpace, windowId } from './store.js';
import { ask, pushUndo, toast } from './ui.js';

// 休眠:让 Chrome 回收这些标签页(页面从内存里卸掉,标签还在,点回去会重新加载)。当前标签页不能回收,会跳过
export async function discardTabs(list) {
  let n = 0;
  // 回收时 Chrome 会给标签页换编号:换完、把关系挪到新编号上之前先不重画,否则列表会跳一下
  setRenderHeld(true);
  try {
    for (const tab of list.filter(canDiscard)) {
      const done = await chrome.tabs.discard(tab.id).catch(() => null);
      if (!done) continue;
      n++;
      if (done.id !== tab.id) replaceTabId(done.id, tab.id);
    }
  } finally {
    setRenderHeld(false);
  }
  toast(n ? `已让 ${n} 个标签页休眠` : '没有可以休眠的标签页');
  schedule();
}

// 开关自动回收:关掉后 Chrome 的「节省内存」不会回收这个标签页(适合音乐、聊天等要在后台一直运行的页面)。
// 这是 Chrome 记在标签页上的设置,浏览器重启后会恢复成允许
export async function toggleAutoDiscard(tab) {
  const keep = tab.autoDiscardable !== false;
  await chrome.tabs.update(tab.id, { autoDiscardable: !keep }).catch(() => {});
  toast(keep ? '已开启保持唤醒,这个标签页不会被自动休眠' : '已取消保持唤醒,这个标签页恢复自动休眠');
  schedule();
}

// 扩展自己要开的标签页(固定项、撤销、导入):告诉后台不要按相同地址查重
export async function createTab(props) {
  const tab = await chrome.tabs.create(props);
  await chrome.runtime.sendMessage({ [MSG.keepTab]: tab.id }).catch(() => {});
  return tab;
}

export async function focusTab(tab) {
  await chrome.tabs.update(tab.id, { active: true });
  if (tab.windowId !== windowId) await chrome.windows.update(tab.windowId, { focused: true });
}

export async function editTabAlias(tabId) {
  const out = await ask('设置别名', [{ key: 'alias', label: '别名(留空则清除)', value: tabAlias.get(tabId), optional: true }]);
  if (!out) return;
  await setTabAlias(tabId, out.alias);
  render();
}

// 连同子标签一起移到另一个空间,并脱离原来的父标签页
export async function moveTabToSpace(tabId, spaceId) {
  const ids = subtreeIds(tabId);
  ids.forEach((id) => tabSpace.set(id, spaceId));
  await chrome.storage.session.set(Object.fromEntries(ids.map((id) => [KEY.space(id), spaceId])));
  await setTabParent(tabId, null);
  render();
}

export function clearTabs() {
  const doomed = listedTabs().filter((t) => !t.active);
  closeWithUndo(doomed, `已清理 ${doomed.length} 个标签页`);
}

// 关闭一个标签页;它的子标签会跟着关,所以一起记下来以便撤销
export function closeTab(tab) {
  const kids = listedTabs().filter((t) => tabParent.get(t.id) === tab.id);
  const name = `「${tabAlias.get(tab.id) || tab.title || tab.url}」`;
  return closeWithUndo([tab, ...kids], kids.length ? `已关闭${name}及 ${kids.length} 个子标签` : `已关闭${name}`);
}

// 关闭一批标签页,并在提示条里提供撤销
export async function closeWithUndo(doomed, text) {
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
    tab ??= await createTab({ url: s.url, windowId, index: s.index, active: false }).catch(() => null);
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
    set[KEY.space(id)] = spaceId;
    if (s.alias) set[KEY.alias(id)] = s.alias;
    const parent = idMap.get(s.parent) ?? (tabs.some((t) => t.id === s.parent) ? s.parent : null);
    if (parent != null) set[KEY.parent(id)] = parent;
  }
  for (const o of orphans) if (idMap.has(o.parent)) set[KEY.parent(o.id)] = idMap.get(o.parent);
  await chrome.storage.session.set(set);
  if (focus != null) await chrome.tabs.update(focus, { active: true }).catch(() => {});
  schedule();
}

// 搜索栏回车:跳到第一个匹配项;没有匹配(或 force)时打开网址或搜索
export async function submitSearch(force) {
  const q = query.trim();
  if (!q) return;
  const first = !force && ($('#tabs [data-kind]') || $('#pins [data-kind]') || $('#favs [data-kind]'));
  if (first) first.click();
  else if (toUrl(q)) await chrome.tabs.create({ url: toUrl(q), windowId });
  else await chrome.search.query({ text: q, disposition: 'NEW_TAB' });
  $('#search').value = '';
  setQuery('');
  render();
}
