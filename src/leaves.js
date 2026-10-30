// 落叶:很久没进去过的标签页,行上慢慢落上叶子,提醒它也许可以关了。
// 离上次离开(或扫干净)超过一天后,每再过 N 小时落一片,最多 12 片(N 在设置里选,见 logic.js 的 leafCount)。
// 叶子只铺在行的后半段,不挡图标和标题开头;画在每行一块 canvas 上,不接鼠标,点击照常落到行上。
// 鼠标划过把叶子拨开,停下后落回原处;左右快速来回扫几下就扫干净,从现在重新计时(不打开它);
// 点进去(成了当前标签页)叶子被风吹走;关掉时叶子跟着飘走。
// 列表会整体重画,canvas 和每片叶子的状态都记在这里,重画后挪到新的行上,不会重新落一遍。
// 只有在动(飘落、被拨开、飞走)的时候才逐帧画,静止时不占资源

import { leafCount } from './logic.js';
import { leafHours, setTabSeen, tabReplacedHooks, tabSeen, tabs } from './store.js';

const ROW_H = 36;
const GONE_MS = 600; // 飞走的叶子多久淡完
const GLOW_MS = 900; // 扫干净后整行亮一下
// 秋叶的颜色:压低饱和度,免得在界面里太跳
const COLORS = ['#c98a3a', '#b5652f', '#a8743c', '#d2a24a', '#9a5a34', '#8f8a3e'];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

const piles = new Map(); // tabId -> { id, cv, ctx, W, ps: 叶子, n: 一共落过几片, mouse, rect, glow, sweeping }
const flying = new Set(); // 关掉了的标签页:canvas 已经从行里拿出来,叶子飘走后删掉
let raf = 0;

tabReplacedHooks.push((added, removed) => {
  if (!piles.has(removed)) return;
  piles.set(added, Object.assign(piles.get(removed), { id: added }));
  piles.delete(removed);
});

// 同一个标签页的第 i 片叶子总落在同一个地方:用标签页编号和序号当随机种子
function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeLeaf(tabId, i, fall) {
  const r = rng(tabId * 7919 + i * 104729);
  // fx:在行宽里的位置(0~1),只在后半段;hy:落定的高度,偏下半行
  const fx = 0.45 + r() * 0.52;
  const hy = ROW_H * (0.3 + r() * 0.42);
  const rot = r() * Math.PI * 2;
  return {
    i, fx, hy, x: null, y: fall ? -10 : hy, vx: 0, vy: 0, vr: 0, rot, hrot: rot,
    s: 5 + r() * 3.5,
    c: COLORS[Math.floor(r() * COLORS.length)],
    hp: 2 + Math.floor(r() * 2), // 扫几下才飞走
    falling: fall,
    t0: performance.now() + (fall ? r() * 600 : 0),
    gone: 0,
    cd: 0,
  };
}

function newPile(id) {
  const cv = document.createElement('canvas');
  cv.className = 'leaves';
  const pile = { id, cv, ctx: cv.getContext('2d'), W: 0, ps: [], n: 0, mouse: null, rect: null, glow: 0, sweeping: false };
  piles.set(id, pile);
  return pile;
}

// 叶子被风吹走:往右飘,一边打转
function blow(list) {
  const now = performance.now();
  for (const p of list) {
    p.gone = now;
    p.falling = false;
    p.vx = 2 + Math.random() * 3;
    p.vy = -0.5 - Math.random();
    p.vr = (Math.random() - 0.5) * 0.5;
  }
}

function attach(pile, row) {
  if (!pile.ps.length && !pile.glow) return pile.cv.remove();
  if (pile.cv.parentNode !== row) row.append(pile.cv);
  pile.rect = row.getBoundingClientRect();
  const W = row.clientWidth;
  if (W && W !== pile.W) {
    const dpr = devicePixelRatio || 1;
    pile.W = W;
    pile.cv.width = W * dpr;
    pile.cv.height = ROW_H * dpr;
    pile.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  step(pile, performance.now(), false);
}

// 关掉了的标签页:canvas 留在原来的位置(固定定位),叶子飘走
function flyOff(pile) {
  const live = pile.ps.filter((p) => !p.gone);
  const r = pile.rect;
  if (!live.length || !r || reduceMotion.matches || r.bottom < 0 || r.top > innerHeight) return pile.cv.remove();
  Object.assign(pile.cv.style, { position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: pile.W + 'px', height: ROW_H + 'px', borderRadius: '11px' });
  document.body.append(pile.cv);
  blow(live);
  flying.add(pile);
}

// 每次重画后、每分钟、改了设置时调用:按时间补上新落的叶子,挪到新画出来的行上
export function refreshLeaves() {
  const now = Date.now();
  const rows = new Map([...document.querySelectorAll('#tabs .row[data-kind="tab"]')].map((el) => [+el.dataset.id, el]));
  for (const tab of tabs) {
    const row = rows.get(tab.id);
    let pile = piles.get(tab.id);
    if (!pile && !row) continue;
    // 第一次看到这一行:已经该有的叶子直接铺好;之后新增的才从上面飘下来
    const fall = !!pile && !reduceMotion.matches;
    pile ??= newPile(tab.id);
    const want = tab.active ? 0 : leafCount(tabSeen.get(tab.id) ?? tab.lastAccessed, now, leafHours);
    // 少了:点进去了,或者设置改成了更久才落一片。多出来的被风吹走
    if (want < pile.n) {
      blow(pile.ps.filter((p) => p.i >= want && !p.gone));
      pile.n = want;
    }
    while (pile.n < want) pile.ps.push(makeLeaf(tab.id, pile.n++, fall));
    if (row) attach(pile, row);
    else pile.cv.remove();
  }
  const ids = new Set(tabs.map((x) => x.id));
  for (const [id, pile] of piles) {
    if (ids.has(id)) continue;
    piles.delete(id);
    flyOff(pile);
  }
  wake();
}

function wake() {
  if (!raf) raf = requestAnimationFrame(frame);
}

function frame(now) {
  raf = 0;
  let busy = false;
  for (const pile of piles.values()) {
    if (!pile.cv.isConnected) continue;
    if (step(pile, now, true)) busy = true;
    else if (!pile.ps.length && !pile.glow) pile.cv.remove(); // 叶子都没了:画布也拿掉
  }
  for (const pile of flying) {
    if (step(pile, now, true)) busy = true;
    else {
      pile.cv.remove();
      flying.delete(pile);
    }
  }
  if (busy) wake();
}

// 推进一帧并画出来;返回还在不在动
function step(pile, now, move) {
  const { ctx, W, mouse: m } = pile;
  let busy = false;
  ctx.clearRect(0, 0, W, ROW_H);
  if (pile.glow) {
    const k = 1 - (now - pile.glow) / GLOW_MS;
    if (k > 0) {
      ctx.fillStyle = `rgba(246, 200, 107, ${0.3 * k})`;
      ctx.fillRect(0, 0, W, ROW_H);
      busy = true;
    } else pile.glow = 0;
  }
  for (const p of pile.ps) {
    const hx = p.fx * W;
    p.x ??= hx;
    let alpha = 1;
    if (!move) {
      // 只是挪到新的行上:按现在的样子画一遍
    } else if (p.falling) {
      // 飘落:左右晃着往下,边晃边转
      busy = true;
      if (now < p.t0) continue;
      const t = now - p.t0;
      p.y += 0.45;
      p.x = hx + Math.sin(t / 260) * 6;
      p.rot = p.hrot + Math.sin(t / 300) * 0.9;
      if (p.y >= p.hy) p.falling = false;
    } else if (p.gone) {
      busy = true;
      p.x += p.vx;
      p.y += p.vy + Math.sin(now / 90 + p.fx * 50) * 0.5;
      p.vy += 0.04;
      p.rot += p.vr;
    } else {
      if (m) push(pile, p, m, now);
      // 慢慢落回原处
      p.vx = (p.vx + (hx - p.x) * 0.012) * 0.86;
      p.vy = (p.vy + (p.hy - p.y) * 0.012) * 0.86;
      p.vr = (p.vr + (p.hrot - p.rot) * 0.004) * 0.9;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      if (Math.abs(p.vx) + Math.abs(p.vy) + Math.abs(p.vr) > 0.01 || Math.abs(hx - p.x) + Math.abs(p.hy - p.y) > 0.3) busy = true;
    }
    if (p.gone) alpha = Math.max(0, 1 - (now - p.gone) / GONE_MS);
    if (p.y > -12) drawLeaf(ctx, p, alpha);
  }
  if (m) m.dx = m.dy = 0;
  if (!move) return busy;
  pile.ps = pile.ps.filter((p) => !p.gone || now - p.gone < GONE_MS);
  // 扫干净了:最后一片飞走时整行亮一下,从现在重新计时
  if (pile.sweeping && !pile.ps.some((p) => !p.gone)) {
    pile.sweeping = false;
    pile.n = 0;
    pile.glow = now;
    setTabSeen(pile.id, Date.now());
    busy = true;
  }
  return busy;
}

// 鼠标附近的叶子被拨开:离得越近拨得越远,再顺着鼠标移动的方向带一点。
// 横着划得够快才算「扫」一下(同一片叶子 250ms 内只算一次):叶子被往那边推一段,扫两三下或推出了行外就飞走
function push(pile, p, m, now) {
  const dx = p.x - m.x;
  const dy = p.y - m.y;
  const dist = Math.hypot(dx, dy);
  if (dist >= 26) return;
  const f = (1 - dist / 26) * 1.4;
  p.vx += (dx / (dist || 1)) * f + m.dx * 0.08;
  p.vy += (dy / (dist || 1)) * f + m.dy * 0.08;
  p.vr += (m.dx * 0.01 + (dx > 0 ? 0.03 : -0.03)) * f;
  if (Math.abs(m.dx) <= 3 || now - p.cd < 250) return;
  p.cd = now;
  p.hp--;
  p.fx += (Math.sign(m.dx) * (10 + Math.random() * 14)) / pile.W;
  if (p.hp > 0 && p.fx > 0 && p.fx < 1) return;
  p.gone = now;
  p.vx = Math.sign(m.dx) * (2.5 + Math.random() * 2.5);
  p.vy = -0.6 - Math.random() * 1.2;
  p.vr = (Math.random() - 0.5) * 0.5;
  pile.sweeping = true;
}

function drawLeaf(ctx, p, alpha) {
  const s = p.s;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.moveTo(-s, 0);
  ctx.quadraticCurveTo(-s * 0.1, -s * 1.15, s, 0);
  ctx.quadraticCurveTo(-s * 0.1, s * 1.15, -s, 0);
  ctx.fillStyle = p.c;
  ctx.fill();
  // 叶脉和叶柄
  ctx.strokeStyle = 'rgba(80, 45, 20, 0.45)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(-s * 1.35, 0);
  ctx.lineTo(s * 0.8, 0);
  ctx.stroke();
  ctx.restore();
}

// 鼠标在标签页列表上移动:记下它在哪一行、往哪边动了多少
export function bindLeaves(list) {
  list.addEventListener('mousemove', (e) => {
    const row = e.target.closest('.row[data-kind="tab"]');
    const pile = row && piles.get(+row.dataset.id);
    for (const other of piles.values()) if (other !== pile) other.mouse = null;
    if (!pile?.ps.length) return;
    const r = row.getBoundingClientRect();
    pile.rect = r;
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const m = pile.mouse;
    pile.mouse = { x, y, dx: m ? m.dx + x - m.x : 0, dy: m ? m.dy + y - m.y : 0 };
    wake();
  });
  list.addEventListener('mouseleave', () => {
    for (const pile of piles.values()) pile.mouse = null;
  });
  // 侧边栏宽度变了(拖宽拖窄、出现滚动条):画布跟着重新量,不然叶子会被拉扁
  new ResizeObserver(() => refreshLeaves()).observe(list);
}
