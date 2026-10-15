// 对空间的操作:切换、新建、编辑、删除、开关「不记录历史」。

import { pinnedItems } from './logic.js';
import { KEY } from './protocol.js';
import { render, schedule } from './render.js';
import { applySession, bind, COLORS, itemByTab, normalize, save, state, tabs, tabSpace, uid } from './store.js';
import { ask, toast } from './ui.js';

export async function switchSpace(id) {
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

export async function addSpace() {
  const out = await ask('新建空间', [{ key: 'name', label: '名称', value: '' }], COLORS[state.spaces.length % COLORS.length]);
  if (!out) return;
  const space = { id: uid(), name: out.name, color: out.color, pinned: [] };
  state.spaces.push(space);
  state.activeSpaceId = space.id;
  await save();
  render();
}

export async function editSpace(id) {
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

export async function deleteSpace(id) {
  const space = state.spaces.find((s) => s.id === id);
  if (!space || state.spaces.length < 2) return;
  const ok = await ask(`删除空间「${space.name}」?其中的固定标签也会被移除,已打开的标签页会并入当前空间。`, [], null, '删除');
  if (!ok) return;
  const i = state.spaces.findIndex((s) => s.id === id);
  if (i < 0 || state.spaces.length < 2) return;
  const [gone] = state.spaces.splice(i, 1);
  normalize();
  const keys = pinnedItems(gone).filter((p) => bind.has(p.id)).map((p) => KEY.bind(p.id));
  for (const [tabId, sid] of tabSpace) if (sid === id) keys.push(KEY.space(tabId));
  keys.forEach((k) => applySession(k, undefined));
  await chrome.storage.session.remove(keys);
  await save();
  schedule();
}

// 开关「不记录历史」:实际的清除在 background.js 里,这里只改设置;开启时顺手清掉已打开页面的记录
export async function toggleNoHistory(id) {
  const space = state.spaces.find((s) => s.id === id);
  if (!space) return;
  space.noHistory = !space.noHistory;
  await save();
  render();
  if (space.noHistory) {
    for (const t of tabs) if (tabSpace.get(t.id) === id && t.url) chrome.history.deleteUrl({ url: t.url }).catch(() => {});
  }
  toast(space.noHistory ? `「${space.name}」不再记录浏览历史` : `「${space.name}」恢复记录浏览历史`);
}
