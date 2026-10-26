// 键盘操作:方向键在收藏、固定标签、新标签页、标签页列表之间移动选中框,回车打开,Delete 关闭,Esc 退出。
// 选中框的样子参考 Switch:蓝青色的粗边框来回呼吸,移到新的项上轻轻一弹;往走不过去的方向按,选中的项朝那边晃一下。
// 鼠标一动就收起选中框;重画后按 kind + id 找回原来的项,找不到(比如刚关掉)就落在同一位置附近的项上。

import { $ } from './dom.js';
import { hideMenu, openSearch } from './ui.js';

let cursor = null; // { kind, id, index }

// 只算看得见的(折叠起来的固定标签不算)
const items = () => [...document.querySelectorAll('#favs .tile, #pins [data-kind], #new-tab, #tabs .row')].filter((el) => el.offsetParent);
const keyOf = (el) => ({ kind: el.dataset.kind ?? el.id, id: el.dataset.id ?? el.id });
const current = () => {
  if (!cursor) return null;
  const list = items();
  return list.find((el) => keyOf(el).kind === cursor.kind && keyOf(el).id === cursor.id) ?? list[Math.min(cursor.index, list.length - 1)] ?? null;
};

function focus(el, pop = true) {
  for (const x of document.querySelectorAll('.kb-focus')) x.classList.remove('kb-focus', 'kb-pop');
  if (!el) return (cursor = null);
  cursor = { ...keyOf(el), index: items().indexOf(el) };
  el.classList.add('kb-focus');
  // 移到新的项上:边框弹一下。重新加一次类名才会重放动画
  if (pop) {
    void el.offsetWidth;
    el.classList.add('kb-pop');
  }
  el.scrollIntoView({ block: 'nearest' });
}

// render.js 每次重画完调用:把选中框放回去,不再弹
export function applyCursor() {
  if (cursor) focus(current(), false);
}

export function hideCursor() {
  focus(null);
}

// 侧边栏没了键盘焦点(焦点去了网页、地址栏或别的窗口),方向键就到不了这里,选中框也收起来。
// blur 不一定每次都有(比如关掉当前标签页后 Chrome 把焦点交给网页),所以选中框在的时候再定时看一眼
setInterval(() => cursor && !document.hasFocus() && hideCursor(), 500);
addEventListener('blur', () => cursor && hideCursor());

// 走不过去:朝按的方向晃一下
function bump(el, dir) {
  // 上一次还没晃完(连续快按)就不重来,免得来回抽动
  if (el.classList.contains('kb-bump-' + dir)) return;
  el.classList.remove('kb-bump-left', 'kb-bump-right', 'kb-bump-up', 'kb-bump-down');
  void el.offsetWidth;
  el.classList.add('kb-bump-' + dir);
  // 只认晃动自己的结束:选中框(::after)上的弹出动画结束时也会在这个元素上报 animationend,
  // 刚移过来就往边上按时两个动画重叠,认错了会把晃动从中间掐掉
  const done = (e) => {
    if (e.target !== el || e.pseudoElement || !e.animationName.startsWith('kb-bump')) return;
    el.classList.remove('kb-bump-' + dir);
    el.removeEventListener('animationend', done);
  };
  el.addEventListener('animationend', done);
}

// 按位置找下一个:上下找最近的一行(收藏网格里优先找正上方或正下方的),左右只在同一行里找
function neighbor(el, dir) {
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  let best = null;
  let bestScore = Infinity;
  for (const x of items()) {
    if (x === el) continue;
    const q = x.getBoundingClientRect();
    const qx = q.left + q.width / 2;
    const qy = q.top + q.height / 2;
    const dx = qx - cx;
    const dy = qy - cy;
    const ok = dir === 'down' ? dy > 2 : dir === 'up' ? dy < -2 : Math.abs(dy) < 2 && (dir === 'right' ? dx > 2 : dx < -2);
    if (!ok) continue;
    const score = dir === 'up' || dir === 'down' ? Math.abs(dy) * 1000 + Math.abs(dx) : Math.abs(dx);
    if (score < bestScore) [best, bestScore] = [x, score];
  }
  return best;
}

// repeat:按住不放时系统连续补发的按键。这时照常移动但不弹;一路按到边上时晃一次,之后按住不再晃
let bumpedThisHold = false;
function move(dir, repeat) {
  if (!repeat) bumpedThisHold = false;
  const el = current();
  // 还没有选中框:从当前页面(正在看的标签页、收藏或固定标签)开始,按上就选它上面的,按下就选它下面的
  if (!el) {
    const start = items().find((x) => x.classList.contains('active')) ?? items()[0];
    if (!start) return;
    return focus(((dir === 'up' || dir === 'down') && neighbor(start, dir)) || start, !repeat);
  }
  // 文件夹:右展开、左收起;已经是那个状态就晃一下
  if (el.dataset.kind === 'folder' && (dir === 'left' || dir === 'right')) {
    if (el.classList.contains('expanded') === (dir === 'right')) return edge(el, dir);
    return el.click();
  }
  const next = neighbor(el, dir);
  if (next) return focus(next, !repeat);
  // 最上面再往上:回到搜索框
  if (dir === 'up') {
    hideCursor();
    return openSearch();
  }
  edge(el, dir);
}

function edge(el, dir) {
  if (bumpedThisHold) return;
  bumpedThisHold = true;
  bump(el, dir);
}

const DIRS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };

export function bindKeys() {
  document.addEventListener('keydown', (e) => {
    if (e.target.closest?.('input, textarea, dialog') || $('#dlg').open) return;
    // 展开搜索:/ 或 ⌘F / Ctrl+F
    if (e.key === '/' || ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'f')) {
      e.preventDefault();
      hideCursor();
      return openSearch();
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const dir = DIRS[e.key];
    if (dir) {
      e.preventDefault();
      hideMenu();
      return move(dir, e.repeat);
    }
    const el = current();
    if (!el) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      el.click();
      // 打开标签页后键盘焦点会进网页,选中框留着也用不了;只有展开收起文件夹时还留在侧边栏
      if (el.dataset.kind !== 'folder') hideCursor();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      // 和行上的关闭按钮一样:标签页关掉;收藏/固定项只关它的标签页,没开着的不动
      e.preventDefault();
      el.querySelector('[data-act="close"]')?.click();
    } else if (e.key === 'Escape') {
      hideCursor();
    } else if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
      // 菜单键:在选中的项上打开右键菜单
      e.preventDefault();
      const r = el.getBoundingClientRect();
      el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + 24, clientY: r.bottom - 4 }));
    }
  });
  // 搜索框里按 ↓:进入列表,从第一项开始(有搜索词时就是第一个结果)
  $('#search').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowDown') return;
    e.preventDefault();
    e.target.blur();
    focus(items()[0]);
  });
  // 用鼠标了:收起选中框。滚动后浏览器会补发一个位置没变的 mousemove,不算
  let last = null;
  document.addEventListener('mousedown', () => cursor && hideCursor(), { passive: true });
  document.addEventListener(
    'mousemove',
    (e) => {
      const moved = last && Math.hypot(e.screenX - last.x, e.screenY - last.y) > 3;
      last = { x: e.screenX, y: e.screenY };
      if (moved && cursor) hideCursor();
    },
    { passive: true }
  );
}
