// 拖拽:标签页排序和嵌套、拖进收藏夹或固定标签、拖到空间圆点上。

import { itemFromTab, removeItem } from './items.js';
import { dropBefore, dropInto, isFolder } from './logic.js';
import { render, schedule } from './render.js';
import { activeSpace, dragging, findItem, listedParent, listedTabs, renderPending, save, setDragging, setTabParent, state, subtreeIds, tabs, takeItem } from './store.js';
import { moveTabToSpace } from './tabs.js';
import { hideMenu } from './ui.js';

function clearMarks() {
  for (const el of document.querySelectorAll('.drop-before, .drop-after, .drop-end, .drop-on, .drop-into'))
    el.classList.remove('drop-before', 'drop-after', 'drop-top', 'drop-end', 'drop-on', 'drop-into');
}

function finishDrag() {
  setDragging(null);
  clearMarks();
  document.querySelector('.dragging')?.classList.remove('dragging');
  if (renderPending) render();
}

const rectsOf = (els) => els.map((el) => el.getBoundingClientRect());
const isDragged = (el) => el?.dataset.id === dragging.id && el.dataset.kind === dragging.kind;

// 指针还在被拖的那一项自己身上:原地不动。
// 否则它会被当成不存在,落点算到下一项去,拖文件夹最后一项时就会掉到文件夹外面
function overSelf(zone, e) {
  const self = [...zone.querySelectorAll('[data-kind]')].find(isDragged);
  if (!self) return false;
  const r = self.getBoundingClientRect();
  return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
}

// 拖标签页时,指针落在某一行的中间部分 = 要成为它的子标签;上下边缘仍是排序
function nestElement(zone, e) {
  // 固定区:拖到文件夹那一行的中间 = 放进文件夹
  if (zone.dataset.zone === 'pin' && dragging.kind !== 'folder') {
    const folders = [...zone.querySelectorAll('[data-kind="folder"]')];
    return folders[dropInto(rectsOf(folders), e.clientY)] ?? null;
  }
  if (dragging.kind !== 'tab' || zone.dataset.zone !== 'tab') return null;
  const els = [...zone.querySelectorAll('[data-kind="tab"]')].filter((el) => el.dataset.id !== dragging.id);
  return els[dropInto(rectsOf(els), e.clientY)] ?? null;
}

// 展开的文件夹里,最后一项的下半部分 = 放到这个文件夹的末尾。
// 这个位置和「文件夹后面」在界面上是同一处,不单独判断的话就只能落到文件夹外面。
// 返回 { folder: 文件夹那一行, last: 最后一项 },不是这种情况返回 null
function folderEnd(zone, e) {
  if (zone.dataset.zone !== 'pin' || dragging.kind === 'folder') return null;
  const inFolder = (el) => el && (el.style.getPropertyValue('--depth') || el.classList.contains('folder-empty'));
  // 被拖的那一项不算:拖的正是最后一项时,它上面那一项才是「最后一项」
  const next = (el) => {
    let n = el.nextElementSibling;
    while (n && isDragged(n)) n = n.nextElementSibling;
    return n;
  };
  let folder = null;
  for (const el of zone.children) {
    if (el.dataset.kind === 'folder') folder = el.classList.contains('expanded') ? el : null;
    if (!folder || isDragged(el) || !inFolder(el) || inFolder(next(el))) continue;
    // 空文件夹的提示整行都算,有内容时只算最后一项的下半部分
    const r = el.getBoundingClientRect();
    const top = el.classList.contains('folder-empty') ? r.top : r.top + r.height / 2;
    if (e.clientY >= top && e.clientY <= r.bottom + 2) return { folder, last: el };
  }
  return null;
}

// 拖到 zone 里时,应插在哪个元素之前(null = 末尾)
function refElement(zone, e) {
  let els = [...zone.querySelectorAll('[data-kind]')].filter((el) => el.dataset.id !== dragging.id || el.dataset.kind !== dragging.kind);
  // 文件夹只能在顶层排序:不拿文件夹里的项当参照
  if (dragging.kind === 'folder') els = els.filter((el) => !el.style.getPropertyValue('--depth'));
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
  // 文件夹只能在固定区里挪位置
  if (d.kind === 'folder') {
    if (zone !== 'pin' || refId === d.id) return;
    const pinned = activeSpace().pinned;
    const folder = pinned.find((x) => x.id === d.id);
    if (!folder) return;
    // 参照是文件夹里的项时,放到那个文件夹前面
    const ref = refId && (pinned.find((x) => x.id === refId) ?? findItem(refId)?.folder);
    pinned.splice(pinned.indexOf(folder), 1);
    const i = ref ? pinned.indexOf(ref) : -1;
    pinned.splice(i < 0 ? pinned.length : i, 0, folder);
    await save();
    return render();
  }
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
  let arr = zone === 'fav' ? state.favorites : activeSpace().pinned;
  if (zone === 'pin') {
    const pinned = activeSpace().pinned;
    const into = intoId && pinned.find((x) => isFolder(x) && x.id === intoId);
    if (into) {
      // 拖到文件夹上:放进去,排在最后
      into.items.push(item);
      into.open = true;
      await save();
      return render();
    }
    // 参照是文件夹里的项:放进那个文件夹,排在它前面
    arr = (refId && pinned.find((f) => isFolder(f) && f.items.some((x) => x.id === refId))?.items) || pinned;
  }
  const i = refId ? arr.findIndex((x) => x.id === refId) : -1;
  arr.splice(i < 0 ? arr.length : i, 0, item);
  await save();
  render();
}

// 落点所在的区域。拖固定项时,固定区下面的分隔线(「清理」那一行)也算固定区的末尾:
// 文件夹排在最后时,它下面没有别的位置能表示「放到文件夹外面」。
// 从下面列表拖上来的标签页不算,免得拖过分隔线就被意外固定
const dropTarget = (e) =>
  e.target.closest?.('.zone, [data-space]') ??
  (dragging.kind !== 'tab' && e.target.closest?.('.divider') ? document.getElementById('pins') : null);

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
    const target = dropTarget(e);
    if (!target) return;
    if (target.dataset.space) {
      if (dragging.kind !== 'tab') return;
      e.preventDefault();
      target.classList.add('drop-on');
      return;
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (overSelf(target, e)) return;
    const end = folderEnd(target, e);
    if (end) return end.last.classList.add(end.last.dataset.kind ? 'drop-after' : 'drop-into');
    const into = nestElement(target, e);
    const ref = !into && refElement(target, e);
    if (into) into.classList.add('drop-into');
    else if (ref) ref.classList.add('drop-before');
    else {
      // 放到列表末尾:在最后一行下面画顶层的插入线;区域是空的(或是收藏夹网格)才高亮整个区域
      const last = target.classList.contains('list') && [...target.children].filter((el) => el.matches('.row, .folder-empty')).at(-1);
      if (last) last.classList.add('drop-after', 'drop-top');
      else target.classList.add('drop-end');
    }
  });
  document.addEventListener('drop', async (e) => {
    if (!dragging) return;
    const target = dropTarget(e);
    if (!target) return;
    e.preventDefault();
    const d = dragging;
    if (target.dataset.space) {
      finishDrag();
      if (d.kind === 'tab') await moveTabToSpace(+d.id, target.dataset.space);
      return;
    }
    if (overSelf(target, e)) return finishDrag();
    const zone = target.dataset.zone;
    const intoId = (folderEnd(target, e)?.folder ?? nestElement(target, e))?.dataset.id;
    const refId = refElement(target, e)?.dataset.id;
    finishDrag();
    await performDrop(d, zone, refId, intoId);
  });
  document.addEventListener('dragend', finishDrag);
}
