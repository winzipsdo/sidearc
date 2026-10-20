// 键盘操作:方向键在收藏、固定标签、新标签页、标签页列表之间移动选中框,回车打开,Delete 关闭,Esc 退出。
// 选中框的样子参考 Switch:蓝青色的粗边框来回呼吸,移到新的项上轻轻一弹;往走不过去的方向按,选中的项朝那边晃一下。
// 鼠标一动就收起选中框;重画后按 kind + id 找回原来的项,找不到(比如刚关掉)就落在同一位置附近的项上。

import { $ } from './dom.js';
import { hideMenu } from './ui.js';

let cursor = null; // { kind, id, index }

const items = () => [...document.querySelectorAll('#favs .tile, #pins [data-kind], #new-tab, #tabs .row')];
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

// 走不过去:朝按的方向晃一下
function bump(el, dir) {
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

function move(dir) {
  const el = current();
  // 还没有选中框:从当前页面(正在看的标签页、收藏或固定标签)开始,按上就选它上面的,按下就选它下面的
  if (!el) {
    const start = items().find((x) => x.classList.contains('active')) ?? items()[0];
    if (!start) return;
    return focus(((dir === 'up' || dir === 'down') && neighbor(start, dir)) || start);
  }
  // 文件夹:右展开、左收起;已经是那个状态就晃一下
  if (el.dataset.kind === 'folder' && (dir === 'left' || dir === 'right')) {
    if (el.classList.contains('expanded') === (dir === 'right')) return bump(el, dir);
    return el.click();
  }
  const next = neighbor(el, dir);
  if (next) return focus(next);
  // 最上面再往上:回到搜索框
  if (dir === 'up') {
    hideCursor();
    return $('#search').focus();
  }
  bump(el, dir);
}

const DIRS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };

export function bindKeys() {
  document.addEventListener('keydown', (e) => {
    if (e.target.closest?.('input, textarea, dialog') || $('#dlg').open || e.metaKey || e.ctrlKey || e.altKey) return;
    const dir = DIRS[e.key];
    if (dir) {
      e.preventDefault();
      hideMenu();
      return move(dir);
    }
    const el = current();
    if (!el) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      el.click();
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
