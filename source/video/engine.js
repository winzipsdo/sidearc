// 视频画面共用的时间线和落叶:介绍视频(scene.js)和竖屏短片(short.js)都用它。
// 所有动画都用 Web Animations 建好后暂停,seek(t) 把它们一起定格到第 t 秒,make.js 逐帧调用它截图。
// 插件自己的 CSS 动效(足迹、休眠、键盘选中框、喇叭)靠在时间线上加减 class 触发:seek(t) 先按时间把 class 摆好,
// 再把由此产生的 CSS 动画也定格到对应的进度,所以同样是一帧一帧确定的。

export const EASE = {
  out: 'cubic-bezier(.22,1,.36,1)',
  inOut: 'cubic-bezier(.65,0,.35,1)',
  in: 'cubic-bezier(.55,0,1,.45)',
  spring: 'cubic-bezier(.34,1.56,.64,1)',
  linear: 'linear',
};

// ---------- 时间线 ----------

const specs = [];
let anims = [];
let mine = new Set();
let frameDoc = null; // 侧边栏 iframe 的 document:它里面的 CSS 动画也要定格,落叶也画在它里面
export function setFrameDoc(d) {
  frameDoc = d;
}

// 从第 t 秒起,用 dur 秒把 el 的各个属性按给的关键帧变过去
export function tw(el, t, dur, props, ease = EASE.out) {
  for (const [prop, values] of Object.entries(props)) specs.push({ el, t, dur, prop, values, ease });
}
// 第 t 秒起把属性直接设成某个值
export function set(el, t, props) {
  for (const [prop, v] of Object.entries(props)) specs.push({ el, t, dur: 0.001, prop, values: [v, v], ease: 'linear', instant: true });
}
// 第 t 秒起给 el 加上(on 为假时去掉)class
const classes = []; // { el, name, t, on }
const initial = new Map(); // el -> 一开始就有的 class
export function cls(el, t, name, on = true) {
  if (!initial.has(el)) initial.set(el, new Set(el.classList));
  classes.push({ el, name, t, on });
}
// 按时间先后建动画:同一元素同一属性的第一段在开始前也生效(决定初始状态),之后的每段只在开始后生效、盖住前一段
export function build() {
  for (const a of anims) a.cancel();
  anims = [];
  const seen = new Map();
  for (const s of [...specs].sort((a, b) => a.t - b.t)) {
    if (!seen.has(s.el)) seen.set(s.el, new Set());
    const done = seen.get(s.el);
    const first = !done.has(s.prop) && !s.instant;
    done.add(s.prop);
    const a = s.el.animate({ [s.prop]: s.values }, { delay: s.t * 1000, duration: Math.max(1, s.dur * 1000), easing: s.ease, fill: first ? 'both' : 'forwards' });
    a.pause();
    anims.push(a);
  }
  mine = new Set(anims);
  classes.sort((a, b) => a.t - b.t);
}
// 某个元素(或它的祖先)最近一次改 class 的时间:由它引起的 CSS 动画、过渡从这一刻算起
function changedAt(el, t) {
  let best = 0;
  for (const c of classes) {
    if (c.t > t) break;
    if (c.t > best && c.el.contains(el)) best = c.t;
  }
  return best;
}
export function seek(t) {
  for (const a of anims) a.currentTime = t * 1000;
  if (frameDoc) drawLeaves(t);
  for (const [el, names] of initial) {
    const want = new Set(names);
    for (const c of classes) {
      if (c.t > t) break;
      if (c.el === el) c.on ? want.add(c.name) : want.delete(c.name);
    }
    const touched = new Set(classes.filter((c) => c.el === el).map((c) => c.name));
    for (const name of touched) el.classList.toggle(name, want.has(name));
  }
  for (const d of [document, frameDoc].filter(Boolean)) {
    for (const a of d.getAnimations()) {
      if (mine.has(a)) continue;
      const el = a.effect?.target;
      if (!el) continue;
      a.pause();
      try {
        a.currentTime = Math.max(0, (t - changedAt(el, t)) * 1000);
      } catch {}
    }
  }
}
// ?play:在浏览器里实时播放预览(CSS 动效那部分不会跟着播)
export function playAll() {
  for (const a of anims) a.play();
}

// ---------- 落叶:和插件 src/leaves.js 一样的叶子和物理,只是按视频时间一步步算,同一时刻总是同一个样子 ----------

export const LEAF_H = 36;
const LEAF_COLORS = ['#c98a3a', '#b5652f', '#a8743c', '#d2a24a', '#9a5a34', '#8f8a3e'];
const LEAF_DT = 1 / 60; // 插件按每秒 60 帧算的物理,这里也一样
const piles = new Map(); // row -> { row, cv, ctx, W, drops: [{ t, n }], blowAt, sweep, 模拟状态 }
// 画布的分辨率倍数:截图放大倍数 × 镜头推近的倍数,放大后叶子也清楚
let leafRes = 3;
export function setLeafResolution(k) {
  leafRes = k;
}

function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
// 这一行的落叶状态(第一次用时在行里放一块画布)。可以设 blowAt(第几秒被风吹走)和 sweep(鼠标扫过的路线)
export function pile(row) {
  if (!piles.has(row)) {
    const cv = row.ownerDocument.createElement('canvas');
    cv.className = 'leaves';
    row.append(cv);
    piles.set(row, { row, cv, ctx: cv.getContext('2d'), W: 0, drops: [], blowAt: null, sweep: null, simT: Infinity });
  }
  return piles.get(row);
}
// 第 t 秒起往这一行上落 n 片叶子
export function leafPile(row, t, n) {
  pile(row).drops.push({ t, n });
}
function resetPile(p) {
  Object.assign(p, { ps: [], n: 0, simT: Math.min(...p.drops.map((d) => d.t)), done: new Set(), blown: false, glow: 0, sweeping: false, mouse: null, rnd: seeded(p.row.id.length * 7919 + 17), homes: [] });
}
const rowSeed = (p) => [...p.row.id].reduce((h, c) => h * 31 + c.charCodeAt(0), 7);
// 第 i 片叶子落在哪:和 src/leaves.js 的 homeOf 一样用「最佳候选」,挑离前面几片最远的位置,免得叠成一堆
function homeOf(p, i) {
  while (p.homes.length <= i) {
    const r = seeded(rowSeed(p) * 6271 + p.homes.length * 15485863);
    let best = null;
    let bestD = -1;
    for (let c = 0; c < 16; c++) {
      const fx = 0.45 + r() * 0.52;
      const hy = LEAF_H * (0.3 + r() * 0.42);
      let d = Infinity;
      for (const h of p.homes) d = Math.min(d, Math.hypot((h.fx - fx) * 300, h.hy - hy));
      if (d > bestD) (bestD = d), (best = { fx, hy });
    }
    p.homes.push(best);
  }
  return p.homes[i];
}
function makeLeaf(p, i, t0) {
  const r = seeded(rowSeed(p) * 7919 + i * 104729);
  const { fx, hy } = homeOf(p, i);
  const rot = r() * Math.PI * 2;
  return { i, fx, hy, x: null, y: -10, vx: 0, vy: 0, vr: 0, rot, hrot: rot, s: 5 + r() * 3.5, c: LEAF_COLORS[Math.floor(r() * LEAF_COLORS.length)], hp: 2 + Math.floor(r() * 2), falling: true, t0: t0 + r() * 0.6, gone: 0, cd: 0 };
}
// 推进一步(1/60 秒)
function stepPile(p, t) {
  const ms = t * 1000;
  for (const [k, d] of p.drops.entries()) {
    if (p.done.has(k) || t < d.t) continue;
    p.done.add(k);
    for (let i = 0; i < d.n; i++) p.ps.push(makeLeaf(p, p.n++, d.t));
  }
  if (p.blowAt != null && !p.blown && t >= p.blowAt) {
    p.blown = true;
    for (const l of p.ps) if (!l.gone) Object.assign(l, { gone: ms, falling: false, vx: 2 + p.rnd() * 3, vy: -0.5 - p.rnd(), vr: (p.rnd() - 0.5) * 0.5 });
  }
  const sw = p.sweep;
  if (sw && t >= sw.t0 && t <= sw.t1) {
    const x = sw.x(t);
    const y = sw.y(t);
    p.mouse = { x, y, dx: p.mouse ? x - p.mouse.x : 0, dy: p.mouse ? y - p.mouse.y : 0 };
  } else p.mouse = null;
  const W = p.W;
  for (const l of p.ps) {
    const hx = l.fx * W;
    l.x ??= hx;
    if (l.falling) {
      if (t < l.t0) continue;
      const e = ms - l.t0 * 1000;
      l.y += 0.45;
      l.x = hx + Math.sin(e / 260) * 6;
      l.rot = l.hrot + Math.sin(e / 300) * 0.9;
      if (l.y >= l.hy) l.falling = false;
    } else if (l.gone) {
      l.x += l.vx;
      l.y += l.vy + Math.sin(ms / 90 + l.fx * 50) * 0.5;
      l.vy += 0.04;
      l.rot += l.vr;
    } else {
      if (p.mouse) pushLeaf(p, l, p.mouse, ms);
      l.vx = (l.vx + (hx - l.x) * 0.012) * 0.86;
      l.vy = (l.vy + (l.hy - l.y) * 0.012) * 0.86;
      l.vr = (l.vr + (l.hrot - l.rot) * 0.004) * 0.9;
      l.x += l.vx;
      l.y += l.vy;
      l.rot += l.vr;
    }
  }
  p.ps = p.ps.filter((l) => !l.gone || ms - l.gone < 600);
  // 扫干净了:最后一片飞走时整行亮一下
  if (p.sweeping && !p.ps.some((l) => !l.gone)) {
    p.sweeping = false;
    p.glow = ms;
  }
}
function pushLeaf(p, l, m, ms) {
  const dx = l.x - m.x;
  const dy = l.y - m.y;
  const dist = Math.hypot(dx, dy);
  if (dist >= 26) return;
  const f = (1 - dist / 26) * 1.4;
  l.vx += (dx / (dist || 1)) * f + m.dx * 0.08;
  l.vy += (dy / (dist || 1)) * f + m.dy * 0.08;
  l.vr += (m.dx * 0.01 + (dx > 0 ? 0.03 : -0.03)) * f;
  if (Math.abs(m.dx) <= 3 || ms - l.cd < 250) return;
  l.cd = ms;
  l.hp--;
  l.fx += (Math.sign(m.dx) * (10 + p.rnd() * 14)) / p.W;
  if (l.hp > 0 && l.fx > 0 && l.fx < 1) return;
  Object.assign(l, { gone: ms, vx: Math.sign(m.dx) * (2.5 + p.rnd() * 2.5), vy: -0.6 - p.rnd() * 1.2, vr: (p.rnd() - 0.5) * 0.5 });
  p.sweeping = true;
}
function drawLeaves(t) {
  for (const p of piles.values()) {
    const W = p.row.clientWidth;
    if (W && W !== p.W) {
      p.W = W;
      p.cv.width = W * leafRes;
      p.cv.height = LEAF_H * leafRes;
      p.ctx.setTransform(leafRes, 0, 0, leafRes, 0, 0);
      p.simT = Infinity;
    }
    if (!p.drops.length) continue;
    if (t < p.simT) resetPile(p);
    while (p.simT + LEAF_DT <= t) stepPile(p, (p.simT += LEAF_DT));
    const { ctx } = p;
    ctx.clearRect(0, 0, p.W, LEAF_H);
    const ms = t * 1000;
    if (p.glow) {
      const k = 1 - (ms - p.glow) / 900;
      if (k > 0) {
        ctx.fillStyle = `rgba(246, 200, 107, ${0.3 * k})`;
        ctx.fillRect(0, 0, p.W, LEAF_H);
      }
    }
    for (const l of p.ps) {
      if (l.falling && t < l.t0) continue;
      const a = l.gone ? Math.max(0, 1 - (ms - l.gone) / 600) : 1;
      if (l.y > -12) drawLeaf(ctx, l, a);
    }
  }
}
function drawLeaf(ctx, l, alpha) {
  const s = l.s;
  ctx.save();
  ctx.translate(l.x, l.y);
  ctx.rotate(l.rot);
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.moveTo(-s, 0);
  ctx.quadraticCurveTo(-s * 0.1, -s * 1.15, s, 0);
  ctx.quadraticCurveTo(-s * 0.1, s * 1.15, -s, 0);
  ctx.fillStyle = l.c;
  ctx.fill();
  ctx.strokeStyle = 'rgba(80, 45, 20, 0.45)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(-s * 1.35, 0);
  ctx.lineTo(s * 0.8, 0);
  ctx.stroke();
  ctx.restore();
}
