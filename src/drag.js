// 拖拽:标签页排序和嵌套、拖进收藏夹或固定标签、拖到空间圆点上。

import { itemFromTab, removeItem } from './items.js';
import { dropBefore, dropInto } from './logic.js';
import { render, schedule } from './render.js';
import { activeSpace, dragging, listedParent, listedTabs, renderPending, save, setDragging, setTabParent, state, subtreeIds, tabs, takeItem } from './store.js';
import { moveTabToSpace } from './tabs.js';
import { hideMenu } from './ui.js';

function clearMarks() {
  for (const el of document.querySelectorAll('.drop-before, .drop-end, .drop-on, .drop-into')) el.classList.remove('drop-before', 'drop-end', 'drop-on', 'drop-into');
}

function finishDrag() {
  setDragging(null);
  clearMarks();
  document.querySelector('.dragging')?.classList.remove('dragging');
  if (renderPending) render();
}

const rectsOf = (els) => els.map((el) => el.getBoundingClientRect());

// 拖标签页时,指针落在某一行的中间部分 = 要成为它的子标签;上下边缘仍是排序
function nestElement(zone, e) {
  if (dragging.kind !== 'tab' || zone.dataset.zone !== 'tab') return null;
  const els = [...zone.querySelectorAll('[data-kind="tab"]')].filter((el) => el.dataset.id !== dragging.id);
  return els[dropInto(rectsOf(els), e.clientY)] ?? null;
}

// 拖到 zone 里时,应插在哪个元素之前(null = 末尾)
function refElement(zone, e) {
  const els = [...zone.querySelectorAll('[data-kind]')].filter((el) => el.dataset.id !== dragging.id || el.dataset.kind !== dragging.kind);
  return els[dropBefore(rectsOf(els), e.clientX, e.clientY, zone.classList.contains('grid'))] ?? null;
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

// d 是被拖的东西({ kind, id }),zone 是落下的区域(tab / fav / pin)
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

export function bindDrag() {
  document.addEventListener('dragstart', (e) => {
    const el = e.target.closest?.('[data-kind]');
    if (!el) return;
    hideMenu();
    setDragging({ kind: el.dataset.kind, id: el.dataset.id });
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
}
