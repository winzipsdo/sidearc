// 竖屏短片(抖音这类平台)的画面和时间线:约 17 秒,一屏一句大字,跟着 music-short.js 的节拍(每分钟 120 拍,一拍 0.5 秒)切。
// 故事线:标签栏挤爆了 → 按 Alt+S 一键竖起来 → 三天后好久没看的标签页落满叶子 → 扫一扫 / 直接关 → GitHub 搜 Sidearc。
// 时间线工具和落叶和介绍视频共用(engine.js),侧边栏的行、标签页的内容也共用(content.js)。地址后加 ?play 可以实时预览。

import { iconFor } from '../../demo/web.js';
import { GITHUB_MARK, ICON, P, U, row, stab } from './content.js';
import { EASE, build, cls, leafPile, pile, playAll, seek, set, setFrameDoc, setLeafResolution, tw } from './engine.js';

// 关键时刻都落在拍子上
const PRESS = 3; // 按下 Alt+S,音乐在这一拍进鼓
const LAPSE = 6; // 「三天后」
const ZOOM = 8; // 镜头再推近一些,看清叶子
const Z1 = 1.28; // 侧边栏出来后先放大到占满画面宽度(网页那边不重要)
const Z2 = 1.55;
const SWEEP = [9, 11]; // 鼠标来回扫 Hacker News
const CLOSE = 12; // 关掉落满叶子的 Slack
const OUT = 14; // 窗口退场,鼓停
const DURATION = 17.5;
const CLICKS = [];
const CUES = { drop: PRESS, ticks: [], leaves: [], sweeps: [], pops: [CLOSE], clicks: CLICKS, end: OUT }; // 给 music-short.js 的音效时间点

const $ = (s, root = document) => root.querySelector(s);
const frame = () => $('#panel');
let doc;
const q = (s) => $(s, doc);
const st = (id) => $('#s-' + id);
// 第 t 秒时元素上某一点在画面里的坐标(ax、ay 是在元素里的相对位置)
// 侧边栏 iframe 里的元素:按 iframe 在画面里被放大了多少倍换算(窗口推近时整个 iframe 跟着放大)
function at(t, el, ax = 0.5, ay = 0.5) {
  seek(t);
  const r = el.getBoundingClientRect();
  if (el.ownerDocument === document) return [r.left + r.width * ax, r.top + r.height * ay];
  const f = frame().getBoundingClientRect();
  const z = f.width / frame().offsetWidth;
  return [f.left + (r.left + r.width * ax) * z, f.top + (r.top + r.height * ay) * z];
}

// ---------- 画面 ----------

const ROWS = [
  ['t-docs', 'docs', { alias: '文档', cls: 'active' }],
  ['t-mdn', 'mdn', { depth: 1 }],
  ['t-lofi', 'lofi', { alias: 'BGM', sound: true }],
  ['t-hn', 'hn', {}],
  ['t-figma', 'figma', {}],
  ['t-slack', 'slack', {}],
  ['t-wiki', 'wiki', {}],
];
function panelHtml() {
  const favs = ['gmail', 'github', 'youtube', 'figmaFav', 'spotify'].map((k, i) => `<div class="tile${i === 0 ? ' open' : ''}"><img class="icon" src="${iconFor(U[k])}" alt=""></div>`).join('');
  const dots = ['#6b7cff', '#4fae6e', '#f0913f'].map((c, i) => `<button class="space-dot${i === 0 ? ' on' : ''}"><i style="color:${c}"></i></button>`).join('');
  return `<!doctype html><html lang="zh-CN" style="color-scheme:light"><head><meta charset="utf-8">
<link rel="stylesheet" href="../../ext/sidepanel.css">
<style>
@property --accent { syntax: '<color>'; inherits: true; initial-value: #6b7cff; }
body { font-family: Inter, "PingFang SC", "Noto Sans CJK SC", "Microsoft YaHei UI", system-ui, sans-serif; }
#scroll { overflow: hidden; scrollbar-gutter: auto; }
.row { transition: background 0.2s, box-shadow 0.2s; }
.row.hover:not(.active) { background: var(--fill); }
.row.hover .x { display: grid; }
.row .btn.x.press { background: var(--fill-hover); }
</style></head><body class="shown settled">
<header>
<label class="search">${ICON.search}<input placeholder="搜索标签页或输入网址"></label>
<section id="favs" class="zone grid" style="--cols:5">${favs}</section>
<div class="space-head"><span id="space-name"><b>个人</b></span><button class="ghost">${ICON.search}</button><button class="ghost">${ICON.more}</button></div>
</header>
<main id="scroll">
<section id="tabs" class="zone list">${ROWS.map(([id, key, o]) => row(id, key, o)).join('')}<button id="new-tab" class="row new"><span class="i">${ICON.plus}</span></button></section>
</main>
<footer id="spaces">${dots}<button class="space-dot">${ICON.plus}</button><button class="space-dot recent">${ICON.recent}</button><button class="space-dot settings">${ICON.sliders}</button></footer>
</body></html>`;
}

// 顶部标签栏:先是挤成一排的 40 个,按 Alt+S 后整理成「个人」分组(展开)和另外两个空间(折叠)
const CROWD = ['gmail', 'github', 'docs', 'lofi', 'notion', 'hn', 'figma', 'mdn', 'linear', 'wiki', 'slack', 'spotify', 'trip', 'typst', 'anki', 'cal', 'pr', 'b3', 'build', 'tg', 'mv3', 'youtube', 'figmaFav', 'weekly'];
const CROWD_N = 40;
const CROWD_FROM = 7; // 一开始就有几个
function stripHtml() {
  const crowd = Array.from({ length: CROWD_N }, (_, i) => stab('c' + i, CROWD[(i * 7) % CROWD.length], { active: i === 2 })).join('');
  const mine = ROWS.map(([, key]) => stab('', key, { color: 'blue', active: key === 'docs' })).join('');
  const sync =
    `<button class="sb-chip" data-color="blue">个人</button><div class="v-group">${mine}</div>` +
    `<button class="sb-chip collapsed" data-color="green">工作</button><button class="sb-chip collapsed" data-color="orange">学习</button>` +
    `<button class="sb-btn sb-new">${ICON.plus}</button>`;
  return `<div class="sb-lights"><i></i><i></i><i></i></div><div class="sb-tabs" id="crowd">${crowd}</div><div class="sb-tabs" id="sync">${sync}</div>`;
}
function windowHtml() {
  const p = P('docs');
  return `<div class="sb-window">
    <div class="sb-strip">${stripHtml()}</div>
    <div class="sb-toolbar">
      <button class="sb-btn">${ICON.nav('<path d="M10 3.5L5.5 8l4.5 4.5"/>')}</button>
      <button class="sb-btn">${ICON.nav('<path d="M12.8 8a4.8 4.8 0 11-1.4-3.4M12.8 2.8v2.6h-2.6"/>')}</button>
      <div class="sb-omni"><img src="${p.icon}" alt=""><span>${U.docs}</span></div>
      <button class="sb-btn sb-ext" id="ext"><img src="../../assets/logo.svg" alt=""></button>
    </div>
    <div class="sb-main">
      <div class="sb-side" id="side"><iframe id="panel" title="Sidearc"></iframe></div>
      <div class="sb-page"><div class="sb-doc" style="--site:${p.site.color}">
        <div class="sb-site"><img src="${p.site.icon}" alt=""><span>${p.site.name}</span></div><h3>${p.title}</h3>
        <i class="sb-sk" style="width:86%"></i><i class="sb-sk" style="width:70%"></i><i class="sb-sk" style="width:92%"></i><i class="sb-sk" style="width:64%"></i><i class="sb-sk block"></i>
      </div></div>
    </div>
  </div>`;
}

// ---------- 常用的几种动作 ----------

// 大字幕:一行一行弹出来,退场时一起淡出往上走
const capIn = (el, t) => [...el.children].forEach((p, i) => tw(p, t + i * 0.12, 0.45, { opacity: [0, 1], transform: ['translateY(16px) scale(.86)', 'none'] }, EASE.spring));
const capOut = (el, t) => tw(el, t, 0.22, { opacity: [1, 0], transform: ['none', 'translateY(-14px)'] }, EASE.in);
const tabIn = (el, t) => tw(el, t, 0.22, { maxWidth: ['0px', '200px'], paddingLeft: ['0px', '10px'], paddingRight: ['0px', '6px'], opacity: [0, 1] });

const cursor = $('#cursor');
let cur = [470, 900];
function move(t, dur, to, ease = EASE.inOut) {
  tw(cursor, t, dur, { transform: [`translate(${cur[0]}px,${cur[1]}px)`, `translate(${to[0]}px,${to[1]}px)`] }, ease);
  cur = to;
}
function click(t) {
  CLICKS.push(t);
  tw($('#cursor svg'), t, 0.2, { transform: ['scale(1)', 'scale(.82)', 'scale(1)'] }, EASE.linear);
  tw($('#cursor .ring'), t, 0.5, { opacity: [0, 0.9, 0], transform: ['scale(.2)', 'scale(.7)', 'scale(1.7)'] }, EASE.out);
}

// ---------- 时间线 ----------

function scenes() {
  const win = $('#win');
  tw($('.b1'), 0, DURATION, { transform: ['translate(0px,0px)', 'translate(120px,140px)', 'translate(40px,260px)'] }, EASE.linear);
  tw($('.b2'), 0, DURATION, { transform: ['translate(0px,0px)', 'translate(-110px,-90px)', 'translate(-30px,-220px)'] }, EASE.linear);
  tw($('.b3'), 0, DURATION, { transform: ['translate(0px,0px)', 'translate(-80px,60px)', 'translate(60px,-80px)'] }, EASE.linear);
  for (const id of ['#cap-1', '#cap-2', '#cap-3', '#cap-4', '#cap-5', '#cap-6']) for (const p of $(id).children) set(p, 0, { opacity: 0 });
  set($('#outro'), 0, { opacity: 0 });

  // 0–3 挤爆的标签栏:一开始就有几个,之后一个接一个冒出来,越挤越窄
  tw(win, 0, 0.4, { opacity: [0.5, 1], transform: ['translateY(18px) scale(.97)', 'none'] });
  capIn($('#cap-1'), 0.1);
  [...$('#crowd').children].forEach((el, i) => {
    if (i < CROWD_FROM) return;
    const t = 0.15 + (i - CROWD_FROM) * 0.068;
    tabIn(el, t);
    CUES.ticks.push(t);
  });
  set($('#sync'), 0, { opacity: 0 });
  capOut($('#cap-1'), 2.45);
  // 按键:弹出来,PRESS 这一拍按下去
  const keys = $('#keys');
  tw(keys, 2.55, 0.35, { opacity: [0, 1], transform: ['translateY(18px) scale(.8)', 'none'] }, EASE.spring);
  for (const k of keys.querySelectorAll('kbd')) tw(k, PRESS - 0.05, 0.25, { transform: ['none', 'translateY(5px)', 'none'], boxShadow: ['0 0 0 1px rgba(0,0,0,.08), 0 6px 0 rgba(0,0,0,.14), 0 18px 40px rgba(40,30,100,.22)', '0 0 0 1px rgba(0,0,0,.08), 0 1px 0 rgba(0,0,0,.14), 0 8px 20px rgba(40,30,100,.18)', '0 0 0 1px rgba(0,0,0,.08), 0 6px 0 rgba(0,0,0,.14), 0 18px 40px rgba(40,30,100,.22)'] }, EASE.linear);
  CLICKS.push(PRESS - 0.03);
  tw(keys, PRESS + 0.25, 0.3, { opacity: [1, 0], transform: ['none', 'scale(1.15)'] }, EASE.in);

  // PRESS:侧边栏滑出来,标签栏整理好,侧边栏里的行依次出现
  tw(win, PRESS, 0.35, { transform: ['none', 'scale(1.025)', 'none'] }, EASE.out);
  tw($('#crowd'), PRESS, 0.2, { opacity: [1, 0] });
  tw($('#sync'), PRESS + 0.05, 0.3, { opacity: [0, 1] });
  tw($('#side'), PRESS, 0.5, { width: ['0px', '321px'] }, EASE.out);
  tw(frame(), PRESS, 0.5, { transform: ['translateX(-320px)', 'none'] }, EASE.out);
  ['header', ...ROWS.map(([id]) => '#' + id), '#spaces'].forEach((s, i) => tw(q(s), PRESS + 0.2 + i * 0.045, 0.4, { opacity: [0, 1], translate: ['-14px 0', '0 0'] }));
  capIn($('#cap-2'), PRESS + 0.15);
  // 镜头:以窗口左上角为中心放大,窗口只往右下长,不挡上面的字
  set(win, 0, { transformOrigin: '2px 0px' });
  tw(win, PRESS + 0.55, 0.6, { transform: ['none', `scale(${Z1})`] }, EASE.inOut);
  tw(win, ZOOM, 0.6, { transform: [`scale(${Z1})`, `scale(${Z2})`] }, EASE.inOut);
  capOut($('#cap-2'), 5.55);

  // LAPSE:三天后,好久没看的标签页落满叶子(离开一天后开始落,之后每 12 小时一片)
  const lapse = $('#lapse');
  tw(lapse, LAPSE - 0.1, 0.4, { opacity: [0, 1], transform: ['translateY(14px) scale(.85)', 'none'] }, EASE.spring);
  tw(lapse, LAPSE + 1.3, 0.3, { opacity: [1, 0] });
  [['t-hn', 8], ['t-slack', 6], ['t-figma', 5], ['t-wiki', 4], ['t-mdn', 3]].forEach(([id, n], i) => {
    const t = LAPSE + 0.2 + i * 0.16;
    leafPile(q('#' + id), t, n);
    for (let k = 0; k < Math.min(n, 3); k++) CUES.leaves.push(t + 0.35 + k * 0.18);
  });
  capIn($('#cap-3'), LAPSE + 0.3);
  capOut($('#cap-3'), ZOOM + 0.2);

  capIn($('#cap-4'), ZOOM + 0.45);
  capOut($('#cap-4'), SWEEP[1] + 0.1);
  capIn($('#cap-5'), SWEEP[1] + 0.35);
  capOut($('#cap-5'), CLOSE + 0.7);
  capIn($('#cap-6'), CLOSE + 0.95);
  capOut($('#cap-6'), OUT - 0.05);

  // 关掉 Slack:叶子被吹走,这一行收起来
  const slack = q('#t-slack');
  pile(slack).blowAt = CLOSE;
  set(slack, CLOSE + 0.12, { overflow: 'hidden' });
  tw(slack, CLOSE + 0.12, 0.36, { height: ['36px', '0px'], marginBottom: ['0px', '-2px'], opacity: [1, 0], translate: ['0 0', '-18px 0'] }, EASE.inOut);

  // 结尾
  tw(win, OUT, 0.45, { opacity: [1, 0] }, EASE.in);
  set($('#outro'), OUT, { opacity: 1 });
  const [logo, ...lines] = $('#outro').children;
  tw(logo, OUT + 0.3, 0.8, { opacity: [0, 1], transform: ['scale(.5) rotate(-12deg)', 'none'] }, EASE.spring);
  lines.forEach((el, i) => tw(el, OUT + 0.6 + i * 0.16, 0.6, { opacity: [0, 1], transform: ['translateY(20px)', 'none'] }, EASE.out));
  tw($('#gh'), OUT + 1.9, 0.5, { transform: ['none', 'scale(1.06)', 'none'] }, EASE.inOut);
}

// 鼠标的路线和需要先量位置的动画(镜头推近)
function pointer() {
  // 开头:在挤成一排的标签栏上左右找,找不到
  tw(cursor, 0.45, 0.25, { opacity: [0, 1] });
  set(cursor, 0, { transform: `translate(${cur[0]}px,${cur[1]}px)` });
  move(0.45, 0.5, at(0.9, st('c4'), 0.5, 0.6));
  move(1.0, 0.45, at(1.4, st('c22'), 0.5, 0.6));
  move(1.5, 0.4, at(1.9, st('c12'), 0.5, 0.6));
  move(1.95, 0.4, at(2.3, st('c31'), 0.5, 0.6));
  tw(cursor, 2.4, 0.2, { opacity: [1, 0] });

  // 侧边栏出来后,鼠标顺着列表往下滑,经过的行亮一下
  build();
  const rows = ROWS.map(([id]) => q('#' + id));
  const [sx, sy] = at(4, rows[0], 0.55);
  cur = [sx, sy + 40];
  set(cursor, 3.9, { transform: `translate(${cur[0]}px,${cur[1]}px)` });
  tw(cursor, 3.85, 0.25, { opacity: [0, 1] });
  rows.slice(1).forEach((r, i) => {
    const t = 4.05 + i * 0.25;
    move(t, 0.22, at(t + 0.2, r, 0.55));
    cls(r, t + 0.12, 'hover');
    cls(r, t + 0.37, 'hover', false);
  });
  tw(cursor, 5.6, 0.25, { opacity: [1, 0] });

  // 扫:在 Hacker News 这一行的后半段左右来回,每半拍一下(这时镜头不动,按这时的放大倍数换算到画面上)
  build();
  const hn = q('#t-hn');
  const slack = q('#t-slack');
  const [t0, t1] = SWEEP;
  seek(t0);
  const r = hn.getBoundingClientRect();
  const fr = frame().getBoundingClientRect();
  const z = fr.width / frame().offsetWidth;
  const sweep = { t0, t1, x: (t) => r.width * (0.6 + 0.37 * Math.sin((2 * Math.PI * (t - t0)) / 0.5 - Math.PI / 2)), y: () => 19 };
  pile(hn).sweep = sweep;
  for (let t = t0; t < t1 - 0.01; t += 0.25) CUES.sweeps.push(t);
  const screen = (t) => [fr.left + (r.left + sweep.x(t)) * z, fr.top + (r.top + sweep.y(t)) * z];
  cur = [screen(t0)[0], screen(t0)[1] + 80];
  set(cursor, ZOOM + 0.5, { transform: `translate(${cur[0]}px,${cur[1]}px)` });
  tw(cursor, ZOOM + 0.5, 0.25, { opacity: [0, 1] });
  move(ZOOM + 0.6, 0.35, screen(t0));
  const N = 80;
  const path = Array.from({ length: N + 1 }, (_, i) => {
    const [x, y] = screen(t0 + ((t1 - t0) * i) / N);
    return `translate(${x}px,${y}px)`;
  });
  tw(cursor, t0, t1 - t0, { transform: path }, EASE.linear);
  cur = screen(t1);

  // 关:移到 Slack 那一行,关闭按钮出来,点
  cls(slack, CLOSE - 0.55, 'hover');
  build();
  const x = [...slack.querySelectorAll('.btn.x')].at(-1);
  const [bx, by] = at(CLOSE - 0.3, x);
  move(SWEEP[1] + 0.2, 0.55, [bx, by]);
  cls(x, CLOSE - 0.05, 'press');
  click(CLOSE);
  move(CLOSE + 0.3, 0.6, [cur[0] + 40, cur[1] + 120]);
  tw(cursor, CLOSE + 0.9, 0.3, { opacity: [1, 0] });
}

// ---------- 搭画面 ----------

async function setup() {
  $('#win').innerHTML = windowHtml();
  $('#gh').insertAdjacentHTML('afterbegin', GITHUB_MARK);
  // 截图放大 2 倍,镜头再推近 1.5 倍:叶子按 3 倍以上的分辨率画
  setLeafResolution(4);
  frame().srcdoc = panelHtml();
  await new Promise((r) => (frame().onload = r));
  doc = frame().contentDocument;
  setFrameDoc(doc);
  const images = [...document.images, ...doc.images];
  await Promise.all([document.fonts.ready, doc.fonts.ready, ...images.map((img) => img.decode().catch(() => {}))]);

  scenes();
  build();
  pointer();
  build();
  CUES.leaves.sort((a, b) => a - b);
  seek(0);
}

Object.assign(window, { seek, DURATION, CLICKS, CUES });
setup().then(
  () => {
    window.sceneReady = true;
    if (location.search.includes('play')) playAll();
  },
  (e) => {
    window.sceneError = e;
    throw e;
  }
);
