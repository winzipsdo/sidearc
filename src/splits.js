// 分屏(Chrome 的 Split View)的两个标签页在标签栏里怎么挪。侧边栏(拖动排序)和后台(标签页分组同步)都用。
// Chrome 只要对分屏里的标签页调用 tabs.move(一个或两个一起都一样),分屏就被拆开;
// 两个一起放进或拿出分组(tabs.group / tabs.ungroup)、挪它旁边的标签页都不会。
// 所以一对分屏要换位置时不动它们,而是把挡在中间的标签页一个个挪到另一边

import { SPLIT_NONE } from './logic.js';

const inSplit = (tab) => tab?.splitViewId > SPLIT_NONE;

// 把 ids 分成一起挪的单位:普通标签页一个一组,分屏的两个一组(按标签栏里的左右)。
// partners 见 logic.js 的 splitPartners;只列了分屏里的一个时,另一个也算进来
export function moveUnits(ids, partners, indexOf) {
  const used = new Set();
  const units = [];
  for (const id of ids) {
    if (used.has(id)) continue;
    const p = partners.get(id);
    const unit = p != null && !used.has(p) ? [id, p].sort((a, b) => indexOf(a) - indexOf(b)) : [id];
    unit.forEach((x) => used.add(x));
    units.push(unit);
  }
  return units;
}

// 把一个单位挪到 to(挪完后它第一个标签页的位置,和 tabs.move 的 index 一样)。
// 分屏的一对:左右的标签页一个个挪到它另一边,直到它到了 to;挡着的是另一对分屏或原生固定的标签页时挪不动,返回 false
export async function moveUnit(unit, to) {
  if (unit.length === 1) return chrome.tabs.move(unit[0], { index: to }).then(() => true, () => false);
  for (let guard = 0; guard < 500; guard++) {
    const pair = await Promise.all(unit.map((id) => chrome.tabs.get(id).catch(() => null)));
    // 已经不在一起分屏了(被关掉、被拆开):按普通标签页挪
    if (!pair.every(inSplit) || pair[0].splitViewId !== pair[1].splitViewId) {
      for (const [i, t] of pair.entries()) if (t) await chrome.tabs.move(t.id, { index: to + i }).catch(() => {});
      return true;
    }
    const at = Math.min(pair[0].index, pair[1].index);
    if (at === to) return true;
    const left = to < at;
    const [next] = await chrome.tabs.query({ windowId: pair[0].windowId, index: left ? at - 1 : at + 2 });
    if (!next || inSplit(next) || next.pinned) return false;
    // 左边那个挪到这一对的右边(这一对往左一格),或者右边那个挪到左边
    await chrome.tabs.move(next.id, { index: left ? at + 1 : at }).catch(() => {});
  }
  return false;
}
