// 落叶:很久没进去过的标签页,行上慢慢落上叶子,提醒它也许可以关了。
// 离上次离开(或扫干净)满一天落第一片,之后每再过 N 小时多落一片,最多 12 片(N 在设置里选,见 logic.js 的 leafCount)。
// 叶子只铺在行的后半段,不挡图标和标题开头;画在每行一块 canvas 上,不接鼠标,点击照常落到行上。
// 鼠标划过把叶子拨开,停下后落回原处;左右快速来回扫几下就扫干净,从现在重新计时(不打开它);
// 点进去(成了当前标签页)叶子被风吹走;关掉时叶子跟着飘走。打开侧边栏时,已经落着的叶子也从上面飘下来。
// 还藏了一个彩蛋,界面上不提示(见 bindShake)。
// 列表会整体重画,canvas 和每片叶子的状态都记在这里,重画后挪到新的行上,不会重新落一遍。
// 只有在动(飘落、被拨开、飞走)的时候才逐帧画,静止时不占资源

import { LEAF_MAX, leafCount } from './logic.js?v=a65b4ebd';
import { leafHours, setTabScattered, setTabSeen, tabReplacedHooks, tabScattered, tabSeen, tabs } from './store.js?v=a65b4ebd';

const ROW_H = 36;
const GONE_MS = 600; // 飞走的叶子多久淡完
const GLOW_MS = 900; // 扫干净后整行亮一下
// 秋叶的颜色:压低饱和度,免得在界面里太跳
const COLORS = ['#c98a3a', '#b5652f', '#a8743c', '#d2a24a', '#9a5a34', '#8f8a3e'];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

const piles = new Map(); // tabId -> { id, cv, ctx, W, ps: 叶子, n: 一共落过几片, mouse, rect, glow, sweeping }
const flying = new Set(); // 关掉了的标签页:canvas 已经从行里拿出来,叶子飘走后删掉
let raf = 0;
// 打开侧边栏后第一次铺叶子之前:这时已经该有的叶子也飘下来,而不是一下子都在
let opening = true;
const OPEN_DELAY = 350; // 等列表淡入(见 sidepanel.css)得差不多了再落

tabReplacedHooks.push((added, removed) => {
  if (homes.has(removed)) homes.set(added, homes.get(removed)), homes.delete(removed);
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

// 每个标签页的叶子落在哪:tabId -> [{ fx, hy }],第 i 片总是第 i 个位置(扫干净后重新落、重画、休眠换编号都不变)。
// 每片各自随机的话很容易几片叠成一堆、旁边又空着,所以用「最佳候选」:随机挑几个候选位置,
// 选离前面几片最远的那个(按屏幕上的距离算,行宽按 300px),新叶子总落进最空的地方。
// fx:在行宽里的位置(0~1),只在后半段;hy:落定的高度,偏下半行
const homes = new Map();
const CANDIDATES = 16;
function homeOf(tabId, i) {
  let list = homes.get(tabId);
  if (!list) homes.set(tabId, (list = []));
  while (list.length <= i) {
    const r = rng(tabId * 6271 + list.length * 15485863);
    let best = null;
    let bestD = -1;
    for (let c = 0; c < CANDIDATES; c++) {
      const fx = 0.45 + r() * 0.52;
      const hy = ROW_H * (0.3 + r() * 0.42);
      let d = Infinity;
      for (const p of list) d = Math.min(d, Math.hypot((p.fx - fx) * 300, p.hy - hy));
      if (d > bestD) (bestD = d), (best = { fx, hy });
    }
    list.push(best);
  }
  return list[i];
}

function makeLeaf(tabId, i, fall, delay = 0) {
  const r = rng(tabId * 7919 + i * 104729);
  const { fx, hy } = homeOf(tabId, i);
  const rot = r() * Math.PI * 2;
  return {
    i, fx, hy, x: null, y: fall ? -10 : hy, vx: 0, vy: 0, vr: 0, rot, hrot: rot,
    s: 5 + r() * 3.5,
    c: COLORS[Math.floor(r() * COLORS.length)],
    hp: 2 + Math.floor(r() * 2), // 扫几下才飞走
    falling: fall,
    t0: performance.now() + (fall ? delay + r() * (delay ? 700 : 600) : 0),
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

// 挂到行上、量尺寸、画分成三步(见 refreshLeaves):挂上画布会让排版作废,挂一个量一个的话每量一次都要重新排一遍整页
function attach(pile, row) {
  if (!pile.ps.length && !pile.glow) return pile.cv.remove(), false;
  if (pile.cv.parentNode !== row) row.append(pile.cv);
  return true;
}
function measure(pile, row) {
  pile.rect = row.getBoundingClientRect();
  pile.rowW = row.clientWidth;
}
// 画布尺寸跟着行宽:改尺寸也会让排版作废,所以等全部量完再改
function fit(pile) {
  const W = pile.rowW;
  if (W && W !== pile.W) {
    const dpr = devicePixelRatio || 1;
    // 宽度变了(侧边栏刚打开、拖宽拖窄):叶子按比例直接换到新位置,不要从旧位置滑过去
    for (const p of pile.ps) if (p.x != null) p.x = pile.W ? (p.x * W) / pile.W : p.fx * W;
    pile.W = W;
    pile.cv.width = W * dpr;
    pile.cv.height = ROW_H * dpr;
    pile.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}

// 关掉了的标签页:canvas 留在原来的位置(固定定位),叶子飘走
function flyOff(pile) {
  const live = pile.ps.filter((p) => !p.gone);
  const r = pile.rect;
  // 上次重画时这一行就没画出来(比如已经被收藏或固定,或者被搜索滤掉了):叶子不在眼前,悄悄扔掉,
  // 不然会从它很久以前所在的位置凭空飞出一阵
  if (!pile.shown || !live.length || !r || reduceMotion.matches || r.bottom < 0 || r.top > innerHeight) return pile.cv.remove();
  Object.assign(pile.cv.style, { position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: pile.W + 'px', height: ROW_H + 'px', borderRadius: '11px' });
  document.body.append(pile.cv);
  blow(live);
  flying.add(pile);
}

// 每次重画后、每分钟、改了设置时调用:按时间补上新落的叶子,挪到新画出来的行上
export function refreshLeaves() {
  const now = Date.now();
  const rows = new Map([...document.querySelectorAll('#tabs .row[data-kind="tab"]')].map((el) => [+el.dataset.id, el]));
  const shown = [];
  let matched = false;
  for (const tab of tabs) {
    const row = rows.get(tab.id);
    if (row) matched = true;
    let pile = piles.get(tab.id);
    if (!pile && !row) continue;
    // 第一次看到这一行:已经该有的叶子直接铺好;之后新增的才从上面飘下来。刚打开侧边栏时都飘下来
    const fall = (!!pile || opening) && !reduceMotion.matches;
    const delay = !pile && opening ? OPEN_DELAY : 0;
    pile ??= newPile(tab.id);
    const want = leavesOn(tab, now);
    // 少了:点进去了,或者设置改成了更久才落一片。多出来的被风吹走
    if (want < pile.n) {
      blow(pile.ps.filter((p) => p.i >= want && !p.gone));
      pile.n = want;
    }
    while (pile.n < want) pile.ps.push(makeLeaf(tab.id, pile.n++, fall, delay));
    pile.shown = !!row && attach(pile, row);
    if (pile.shown) shown.push([pile, row]);
    else if (!row) pile.cv.remove();
  }
  for (const [pile, row] of shown) measure(pile, row);
  const t = performance.now();
  for (const [pile] of shown) fit(pile), step(pile, t, false);
  const ids = new Set(tabs.map((x) => x.id));
  for (const [id, pile] of piles) {
    if (ids.has(id)) continue;
    piles.delete(id);
    flyOff(pile);
  }
  for (const id of homes.keys()) if (!ids.has(id)) homes.delete(id);
  // 真的标签页画成了行才算打开完(先显示的上次画面不算);设置还没读到时叶子数是 0,也等下一次
  if (matched && leafHours) opening = false;
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
  // 还没量到行宽(侧边栏刚打开、还没排好):先不动,量到后(ResizeObserver 会再调 refreshLeaves)再开始
  if (!W) return false;
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
    setTabScattered(pile.id, 0);
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

// 这个标签页现在落了几片:按时间该落的(当前标签页不落)和摇下来的(见 bindShake),取多的那个,不相加。
// 比如撒到了 4 片,按时间才该落第 1 片时还是 4 片,到该落第 5 片时才多出第 5 片
export function leavesOn(tab, now = Date.now()) {
  if (!leafHours) return 0;
  const byTime = tab.active ? 0 : leafCount(tabSeen.get(tab.id) ?? tab.lastAccessed, now, leafHours);
  return Math.min(LEAF_MAX, Math.max(byTime, tabScattered.get(tab.id) ?? 0));
}
// 能不能再撒:开着落叶、还没落满
const canScatter = (tab) => leafHours > 0 && leavesOn(tab) < LEAF_MAX;

// 撒落叶(彩蛋,长按一行触发,见 bindShake):在现在有几片的基础上随机再落 1 到 6 片,落满为止,新的从上面飘下来。记下撒到了几片。
// 当前标签页也能撒:一直留着,离开后按时间落的追上来之前不会再多,再点回来时才被吹走
async function scatterLeaves(tab) {
  await setTabScattered(tab.id, Math.min(LEAF_MAX, leavesOn(tab) + 1 + Math.floor(Math.random() * 6)));
  refreshLeaves();
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
  bindShake(list);
}

// 彩蛋:在下面列表里某个标签页那一行上按住不动一会儿,像摇了一下树,撒下几片落叶(见 scatterLeaves),只撒按住的这一个,
// 多选着别的也不管。界面上不提示,留给人自己发现。
// 只认左键(或第一根手指)、没按着修饰键、开着落叶、还没落满的;按在行上的按钮上不算。
// 撒下来以后这次松手什么都不做:不切过去、不改多选,按住时再动也不会拖起来。没到时间就松手、动了、拖起来了、
// 弹出右键菜单、滚动、侧边栏失去焦点,都作罢,普通的点击和拖动照旧
const HOLD_MS = 600;
const HOLD_SLOP = 5; // 按住时手抖一点不算动
function bindShake(list) {
  let hold = null; // 正在按住:{ x, y, timer }
  let shook = false; // 这次按住已经撒过了:松手前的点击和拖拽都吞掉
  const cancel = () => {
    if (hold) clearTimeout(hold.timer);
    hold = null;
  };
  // 松手可能没送到这里(在侧边栏外面松手等):下一次在侧边栏里任何地方按下时一定放开,不然别处的点击会被吞掉
  addEventListener('pointerdown', () => (shook = false), true);
  list.addEventListener('pointerdown', (e) => {
    cancel();
    const row = e.target.closest('.row[data-kind="tab"]');
    if (!row || !e.isPrimary || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.target.closest('[data-act]')) return;
    const id = +row.dataset.id;
    const tabNow = () => tabs.find((x) => x.id === id);
    if (!tabNow() || !canScatter(tabNow())) return;
    hold = {
      x: e.clientX,
      y: e.clientY,
      timer: setTimeout(() => {
        hold = null;
        // 按住的这段时间里可能落满了、关了落叶,或者标签页没了
        const tab = tabNow();
        if (!tab || !canScatter(tab)) return;
        shook = true;
        shake(row);
        scatterLeaves(tab);
      }, HOLD_MS),
    };
  });
  addEventListener('pointermove', (e) => hold && Math.hypot(e.clientX - hold.x, e.clientY - hold.y) > HOLD_SLOP && cancel());
  // 松手:这次的 click 紧跟在 pointerup 后面派发,派发完再放开
  const release = () => (cancel(), shook && setTimeout(() => (shook = false)));
  addEventListener('pointerup', release);
  addEventListener('pointercancel', release);
  addEventListener('contextmenu', cancel, true);
  addEventListener('wheel', cancel, { passive: true });
  document.addEventListener('scroll', cancel, { capture: true, passive: true });
  addEventListener('blur', () => (cancel(), (shook = false)));
  // 在捕获阶段先拦下来:不会切到这个标签页、不会改多选,拖拽那边(drag.js)也收不到
  addEventListener(
    'click',
    (e) => {
      if (!shook) return;
      shook = false;
      e.preventDefault();
      e.stopImmediatePropagation();
    },
    true
  );
  addEventListener(
    'dragstart',
    (e) => {
      cancel();
      if (!shook) return;
      e.preventDefault();
      e.stopImmediatePropagation();
    },
    true
  );
}

// 撒下来的那一下:整行轻轻往下一沉再回来,像树枝被摇了一下(样式见 sidepanel.css 的 .row.shaken)
function shake(row) {
  if (reduceMotion.matches) return;
  row.classList.remove('shaken');
  void row.offsetWidth;
  row.classList.add('shaken');
  // 行里别的东西(比如图标)的动画结束也会冒泡上来,只认这一行自己的
  const done = (e) => e.target === row && (row.classList.remove('shaken'), row.removeEventListener('animationend', done));
  row.addEventListener('animationend', done);
}
