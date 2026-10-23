// 介绍视频的画面和时间线。
// 所有动画都用 Web Animations 建好后暂停,seek(t) 把它们一起定格到第 t 秒,make.js 逐帧调用它截图。
// 插件自己的 CSS 动效(足迹、休眠、键盘选中框、喇叭)靠在时间线上加减 class 触发:seek(t) 先按时间把 class 摆好,
// 再把由此产生的 CSS 动画也定格到对应的进度,所以同样是一帧一帧确定的。
// 地址后加 ?play 可以在浏览器里实时播放预览(CSS 动效那部分不会跟着播)。
// 侧边栏是一个 iframe,直接套用插件的 ext/sidepanel.css;浏览器窗口和网页的样式、内容和在线试用共用(demo/)。

import { BRAND_ICONS } from '../../demo/brand-icons.js';
import { iconFor, page } from '../../demo/web.js';

const DURATION = 62.5;
const POSTER = 15.9; // 封面取这一刻:两边刚同步完
const CLICKS = []; // 点击和按键的时间点,music.js 在这些地方加音效

// ---------- 时间线工具 ----------

const EASE = {
  out: 'cubic-bezier(.22,1,.36,1)',
  inOut: 'cubic-bezier(.65,0,.35,1)',
  in: 'cubic-bezier(.55,0,1,.45)',
  spring: 'cubic-bezier(.34,1.56,.64,1)',
  linear: 'linear',
};
const specs = [];
let anims = [];
let mine = new Set();
// 从第 t 秒起,用 dur 秒把 el 的各个属性按给的关键帧变过去
function tw(el, t, dur, props, ease = EASE.out) {
  for (const [prop, values] of Object.entries(props)) specs.push({ el, t, dur, prop, values, ease });
}
// 第 t 秒起把属性直接设成某个值
function set(el, t, props) {
  for (const [prop, v] of Object.entries(props)) specs.push({ el, t, dur: 0.001, prop, values: [v, v], ease: 'linear', instant: true });
}
// 第 t 秒起给 el 加上(on 为假时去掉)class
const classes = []; // { el, name, t, on }
const initial = new Map(); // el -> 一开始就有的 class
function cls(el, t, name, on = true) {
  if (!initial.has(el)) initial.set(el, new Set(el.classList));
  classes.push({ el, name, t, on });
}
// 按时间先后建动画:同一元素同一属性的第一段在开始前也生效(决定初始状态),之后的每段只在开始后生效、盖住前一段
function build() {
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
function seek(t) {
  for (const a of anims) a.currentTime = t * 1000;
  for (const [el, names] of initial) {
    const want = new Set(names);
    for (const c of classes) {
      if (c.t > t) break;
      if (c.el === el) c.on ? want.add(c.name) : want.delete(c.name);
    }
    const touched = new Set(classes.filter((c) => c.el === el).map((c) => c.name));
    for (const name of touched) el.classList.toggle(name, want.has(name));
  }
  for (const d of [document, doc].filter(Boolean)) {
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

const $ = (s, root = document) => root.querySelector(s);
const frame = () => $('#panel');
let doc; // 侧边栏 iframe 的 document
const q = (s) => $(s, doc);
const st = (id) => $('#s-' + id); // 顶部标签栏里的标签页

// 第 t 秒时元素上某一点在画面里的坐标(ax、ay 是在元素里的相对位置)
function at(t, el, ax = 0.5, ay = 0.5) {
  seek(t);
  const r = el.getBoundingClientRect();
  const o = el.ownerDocument === document ? { left: 0, top: 0 } : frame().getBoundingClientRect();
  return [o.left + r.left + r.width * ax, o.top + r.top + r.height * ay];
}

// ---------- 图标 ----------

const stroke = (d) => `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const SPEAKER = '<path d="M2.5 6.2v3.6h2.3L8 12.5v-9L4.8 6.2z"/>';
const ICON = {
  search: '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/></svg>',
  more: '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><circle cx="3" cy="8" r="1.3"/><circle cx="8" cy="8" r="1.3"/><circle cx="13" cy="8" r="1.3"/></svg>',
  plus: stroke('<path d="M8 3.5v9M3.5 8h9"/>'),
  minus: stroke('<path d="M4 8h8"/>'),
  close: stroke('<path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/>'),
  sound: stroke(SPEAKER + '<path d="M10.5 5.8a3 3 0 010 4.4"/><path d="M12.3 4a5.5 5.5 0 010 8"/>'),
  sleep: stroke('<path d="M13 9.5A5.5 5.5 0 116.5 3a4.3 4.3 0 006.5 6.5z"/>'),
  outdent: stroke('<path d="M7.5 4h6M7.5 8h6M7.5 12h6"/><path d="M4.5 6L2.5 8l2 2"/>'),
  back: stroke('<path d="M6 3.5L3 6.5l3 3"/><path d="M3 6.5h6.5a3.5 3.5 0 010 7H8"/>'),
  folder: stroke('<path d="M2.5 4.5a1 1 0 011-1h3l1.5 1.5h4.5a1 1 0 011 1v6a1 1 0 01-1 1h-9a1 1 0 01-1-1z"/>'),
  recent: stroke('<path d="M2.8 8a5.2 5.2 0 101.6-3.8"/><path d="M2.8 2.8v2.6h2.6"/><path d="M8 5.2V8l2 1.3"/>'),
  sliders: stroke('<path d="M2 3.5h5.9M11.1 3.5H14M2 8h2.4M7.6 8H14M2 12.5h6.4M11.6 12.5H14"/><circle cx="9.5" cy="3.5" r="1.6"/><circle cx="6" cy="8" r="1.6"/><circle cx="10" cy="12.5" r="1.6"/>'),
  newtab: stroke('<path d="M9.5 2.5h4v4"/><path d="M13.5 2.5L8 8"/><path d="M12 9.5v3a1 1 0 01-1 1H3.5a1 1 0 01-1-1V5a1 1 0 011-1h3"/>'),
  copy: stroke('<rect x="5.5" y="5.5" width="7.5" height="7.5" rx="1.5"/><path d="M10.5 5.5V4A1.5 1.5 0 009 2.5H4A1.5 1.5 0 002.5 4v5A1.5 1.5 0 004 10.5h1.5"/>'),
  eyeOff: stroke('<path d="M2 8s2.2-4 6-4 6 4 6 4-2.2 4-6 4-6-4-6-4z"/><circle cx="8" cy="8" r="1.8"/><path d="M3 13L13 3"/>'),
  theme: stroke('<circle cx="8" cy="8" r="5.5"/><path d="M8 2.5v11a5.5 5.5 0 000-11z" fill="currentColor"/>'),
  select: stroke('<rect x="2.5" y="2.5" width="11" height="4" rx="1.2"/><rect x="2.5" y="9.5" width="11" height="4" rx="1.2"/>'),
  shield: stroke('<path d="M8 2l5 2v4c0 3-2.2 5.2-5 6-2.8-.8-5-3-5-6V4z"/><path d="M6 8l1.5 1.5L10.5 6.5"/>'),
  code: stroke('<path d="M5.5 4.5L2 8l3.5 3.5M10.5 4.5L14 8l-3.5 3.5"/>'),
  heart: stroke('<path d="M8 13.5S2.5 10.3 2.5 6.4A2.9 2.9 0 018 4.8a2.9 2.9 0 015.5 1.6c0 3.9-5.5 7.1-5.5 7.1z"/>'),
  play: '<svg viewBox="0 0 16 16" width="22" height="22"><path d="M5 3.5v9l7-4.5z" fill="currentColor"/></svg>',
  pause: stroke('<path d="M5.5 3.5v9M10.5 3.5v9"/>'),
  nav: (d) => `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`,
};
const GITHUB_MARK = `<svg viewBox="0 0 24 24"><path fill="currentColor" d="${BRAND_ICONS.github.path}"/></svg>`;

// ---------- 内容:标签页、空间、网页(网页的标题和图标来自 demo/web.js) ----------

const U = {
  gmail: 'https://mail.google.com/mail/u/0/#inbox',
  github: 'https://github.com/winzipsdo/sidearc',
  youtube: 'https://www.youtube.com/',
  figmaFav: 'https://www.figma.com/files/recent',
  spotify: 'https://open.spotify.com/',
  notion: 'https://www.notion.so/sidearc/project-plan',
  weekly: 'https://www.notion.so/sidearc/weekly-notes',
  trip: 'https://docs.google.com/document/d/tokyo-trip',
  docs: 'https://developer.chrome.com/docs/extensions/reference/api/sidePanel',
  mdn: 'https://developer.mozilla.org/docs/Web/CSS/color_value/color-mix',
  tg: 'https://developer.chrome.com/docs/extensions/reference/api/tabGroups',
  mv3: 'https://developer.chrome.com/docs/extensions/develop/migrate',
  lofi: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
  hn: 'https://news.ycombinator.com/',
  linear: 'https://linear.app/sidearc/my-issues',
  cal: 'https://calendar.google.com/',
  figma: 'https://www.figma.com/design/home-v3',
  pr: 'https://github.com/winzipsdo/sidearc/pulls',
  build: 'https://github.com/winzipsdo/sidearc/actions/runs/128',
  slack: 'https://app.slack.com/client/design',
  anki: 'https://ankiweb.net/decks',
  wiki: 'https://zh.wikipedia.org/wiki/贝叶斯定理',
  b3: 'https://www.youtube.com/watch?v=HZGCoVF3YvM',
  typst: 'https://typst.app/docs/reference/math/',
};
const P = (key) => page(U[key], 'zh');
const TITLE = { tg: 'chrome.tabGroups | API | Chrome for Developers', mv3: '迁移到 Manifest V3 | Chrome for Developers' };
const title = (key) => TITLE[key] ?? P(key).title;
const short = (key) => title(key).split(/ [–|-] /)[0];
const SPACES = [
  { name: '个人', color: '#6b7cff', group: 'blue' },
  { name: '工作', color: '#4fae6e', group: 'green' },
  { name: '学习', color: '#f0913f', group: 'orange' },
];

// 侧边栏里的行,结构和插件的 render.js 一样
const row = (id, key, { kind = 'tab', alias, depth, cls: c = '', sound, open = true, slept } = {}) =>
  `<div class="row ${c}" id="${id}" data-kind="${kind}"${depth ? ' style="--depth:1"' : ''}><img class="icon" src="${iconFor(U[key])}" alt="">` +
  (alias ? `<span class="alias">${alias}</span>` : '') +
  `<span class="title">${title(key)}</span>` +
  (slept ? `<span class="slept">${slept}</span>` : '') +
  (sound ? `<button class="btn playing">${ICON.sound}</button>` : '') +
  (kind === 'tab' && depth ? `<button class="btn x">${ICON.outdent}</button>` : '') +
  (open ? `<button class="btn x v-moon">${ICON.sleep}</button>` : '') +
  `<button class="btn x">${kind === 'tab' ? ICON.close : ICON.minus}</button></div>`;

function panelHtml() {
  const favs = ['gmail', 'github', 'youtube', 'figmaFav', 'spotify'].map((k, i) => `<div class="tile${i === 0 ? ' open' : ''}" id="f-${k}"><img class="icon" src="${iconFor(U[k])}" alt=""></div>`).join('');
  const sets = [
    {
      pins:
        `<div class="row open" id="p-notion" data-kind="pin"><img class="icon" src="${iconFor(U.notion)}" alt=""><span class="alias">规划</span><span class="title">${title('notion')}</span>` +
        `<span class="pin-name">规划</span><span class="title away-title">${title('weekly')}</span><button class="btn x">${ICON.sleep}</button><button class="btn x">${ICON.minus}</button><button class="btn back">${ICON.back}</button></div>` +
        `<div class="row folder" data-kind="folder"><span class="i">${ICON.folder}</span><span class="title">旅行计划</span><span class="count">1/2</span></div>`,
      tabs:
        row('t-docs', 'docs', { alias: '文档', cls: 'active' }) +
        row('t-mdn', 'mdn', { depth: 1 }) +
        row('t-tg', 'tg', { depth: 1 }) +
        row('t-mv3', 'mv3', { depth: 1 }) +
        row('t-lofi', 'lofi', { alias: 'BGM', sound: true }) +
        row('t-hn', 'hn', { slept: '刚刚' }),
    },
    {
      pins: row('', 'linear', { kind: 'pin', cls: 'open' }) + row('', 'cal', { kind: 'pin', open: false }),
      tabs: row('', 'figma', { cls: 'active' }) + row('', 'pr') + row('', 'build', { depth: 1 }) + row('', 'slack'),
    },
    {
      pins: row('', 'anki', { kind: 'pin', cls: 'open', alias: '复习' }),
      tabs: row('', 'wiki', { cls: 'active' }) + row('', 'b3', { depth: 1 }) + row('', 'typst'),
    },
  ];
  const zone = (k) => sets.map((s, i) => `<div class="set" data-s="${i}">${s[k]}</div>`).join('');
  const dots = SPACES.map((s, i) => `<button class="space-dot${i === 0 ? ' on' : ''}"><i style="color:${s.color}"></i></button>`).join('');
  return `<!doctype html><html lang="zh-CN" style="color-scheme:light"><head><meta charset="utf-8">
<link rel="stylesheet" href="../../ext/sidepanel.css">
<style>
@property --accent { syntax: '<color>'; inherits: true; initial-value: #6b7cff; }
body { font-family: Inter, "PingFang SC", "Noto Sans CJK SC", "Microsoft YaHei UI", system-ui, sans-serif; }
#scroll { overflow: hidden; }
#space-name { display: grid; }
#space-name b { grid-area: 1 / 1; font: inherit; }
.set { display: flex; flex-direction: column; gap: 2px; }
.set + .set { display: none; }
/* 展开出现的子标签:高度从 0 长出来时内容不要露出来 */
#t-tg, #t-mv3 { overflow: hidden; }
/* 拖动中浮起来的行:不透明,盖住经过的行,一圈主题色 */
.row { transition: background 0.2s, box-shadow 0.2s; }
.row.v-lift { z-index: 3; background: #fff; box-shadow: 0 0 0 0.5px rgba(0,0,0,.08), 0 6px 14px rgba(0,0,0,.14), 0 14px 30px rgba(0,0,0,.08), inset 0 0 0 1.5px rgba(107,124,255,.95); }
/* 鼠标悬停的样子(视频里没有真的鼠标) */
.row.hover:not(.active) { background: var(--fill); }
.row.hover .x { display: grid; }
/* 固定标签离开后的样子先藏着,到时候再换上 */
#p-notion .pin-name, #p-notion .away-title, #p-notion .back { display: none; }
#t-hn .slept { display: none; }
#toast { left: 12px; right: 12px; }
</style></head><body>
<header>
<label class="search">${ICON.search}<input id="search" placeholder="搜索标签页或输入网址"></label>
<section id="favs" class="zone grid" style="--cols:5">${favs}</section>
<div class="space-head"><span id="space-name">${SPACES.map((s) => `<b>${s.name}</b>`).join('')}</span><button id="search-toggle" class="ghost">${ICON.search}</button><button id="space-menu" class="ghost">${ICON.more}</button></div>
</header>
<main id="scroll">
<section id="pins" class="zone list">${zone('pins')}</section>
<div class="divider"><span></span><button class="ghost">清理</button></div>
<button class="row new"><span class="i">${ICON.plus}</span><span class="title">新标签页</span></button>
<section id="tabs" class="zone list">${zone('tabs')}</section>
</main>
<footer id="spaces">${dots}<button class="space-dot">${ICON.plus}</button><button class="space-dot recent">${ICON.recent}</button><button class="space-dot settings">${ICON.sliders}</button></footer>
<div id="toast"><span>已让 1 个标签页休眠</span><button>撤销</button></div>
</body></html>`;
}

// 顶部标签栏的标签页,结构和在线试用(demo/demo.js)一样
const stab = (id, key, { color, active } = {}) =>
  `<div class="sb-tab${color ? ' grouped' : ''}${active ? ' active' : ''}"${id ? ` id="s-${id}"` : ''}${color ? ` data-color="${color}"` : ''}><img src="${iconFor(U[key] ?? key)}" alt=""><span class="sb-title">${U[key] ? short(key) : key}</span><button class="sb-x">${stroke('<path d="M5 5l6 6M11 5l-6 6"/>')}</button></div>`;
const CROWD = ['gmail', 'github', 'docs', 'lofi', 'notion', 'hn', 'figma', 'mdn', 'linear', 'wiki', 'slack', 'spotify', 'trip', 'typst', 'anki', 'cal', 'pr', 'b3', 'build', 'tg', 'mv3', 'youtube', 'figmaFav', 'weekly'];
function stripHtml() {
  const crowd = CROWD.map((k, i) => stab(i < 6 ? '' : 'c' + i, k, { active: k === 'docs' })).join('');
  const group = (i, ids, on) =>
    `<button class="sb-chip${i ? ' collapsed' : ''}" id="chip${i}" data-color="${SPACES[i].group}">${SPACES[i].name}</button>` +
    `<div class="v-group" id="g${i}">${ids.map((k) => stab(i === 0 ? k : '', k, { color: SPACES[i].group, active: k === on })).join('')}</div>`;
  const sync =
    stab('gmail', 'gmail') +
    group(0, ['notion', 'trip', 'docs', 'mdn', 'tg', 'mv3', 'lofi', 'hn'], 'docs') +
    group(1, ['linear', 'figma', 'pr', 'build', 'slack'], 'figma') +
    group(2, ['anki', 'wiki', 'b3', 'typst'], 'wiki') +
    `<button class="sb-btn sb-new">${ICON.plus}</button>`;
  return `<div class="sb-lights"><i></i><i></i><i></i></div><div class="sb-tabs" id="crowd">${crowd}</div><div class="sb-tabs" id="sync">${sync}</div>`;
}

// 右边的网页:每个会切到的页面一层
const PAGES = ['docs', 'figma', 'wiki', 'notion', 'weekly', 'lofi', 'mdn'];
function pageHtml(key) {
  const p = P(key);
  const links = (p.links ?? []).map((l, i) => `<a class="sb-link" id="l-${key}-${i}">${l.label}${l.newTab ? `<span class="sb-new-badge">${ICON.newtab}</span>` : ''}</a>`).join('');
  const player = p.media ? `<div class="sb-player"><span class="sb-play">${ICON.pause}</span><div class="sb-wave on">${'<i></i>'.repeat(20)}</div></div>` : '';
  return `<div class="pg" id="pg-${key}"><div class="sb-doc" style="--site:${p.site.color}">
    <div class="sb-site"><img src="${p.site.icon}" alt=""><span>${p.site.name}</span></div><h3>${p.title}</h3>
    ${p.text ? `<p class="sb-text">${p.text}</p>` : '<i class="sb-sk" style="width:86%"></i><i class="sb-sk" style="width:70%"></i>'}
    ${player}${links ? `<nav class="sb-links">${links}</nav>` : ''}
    <i class="sb-sk" style="width:92%"></i><i class="sb-sk" style="width:64%"></i><i class="sb-sk block"></i></div></div>`;
}

function windowHtml() {
  return `<div class="sb-window">
    <div class="sb-strip">${stripHtml()}</div>
    <div class="sb-toolbar">
      <button class="sb-btn">${ICON.nav('<path d="M10 3.5L5.5 8l4.5 4.5"/>')}</button>
      <button class="sb-btn">${ICON.nav('<path d="M6 3.5L10.5 8 6 12.5"/>')}</button>
      <button class="sb-btn">${ICON.nav('<path d="M12.8 8a4.8 4.8 0 11-1.4-3.4M12.8 2.8v2.6h-2.6"/>')}</button>
      <div class="sb-omni">${PAGES.map((k) => `<img id="oi-${k}" src="${P(k).icon}" alt=""><span id="ou-${k}">${U[k]}</span>`).join('')}</div>
      <button class="sb-btn sb-ext" id="ext"><img src="../../assets/logo.svg" alt=""></button>
    </div>
    <div class="sb-main">
      <div class="sb-side" id="side"><iframe id="panel" title="Sidearc"></iframe></div>
      <div class="sb-page">${PAGES.map(pageHtml).join('')}</div>
    </div>
  </div>`;
}

// ---------- 常用的几种动作 ----------

const copyIn = (sec, t) => [...sec.children].forEach((el, i) => tw(el, t + i * 0.09, 0.7, { opacity: [0, 1], transform: ['translateY(18px)', 'none'] }));
const copyOut = (sec, t) => [...sec.children].forEach((el, i) => tw(el, t + i * 0.03, 0.35, { opacity: [1, 0], transform: ['none', 'translateY(-12px)'] }, EASE.in));
const rowIn = (el, t) => tw(el, t, 0.45, { height: ['0px', '36px'], marginBottom: ['-2px', '0px'], opacity: [0, 1], translate: ['-10px 0', '0 0'] });
const tabIn = (el, t) => tw(el, t, 0.45, { maxWidth: ['0px', '200px'], paddingLeft: ['0px', '10px'], paddingRight: ['0px', '6px'], opacity: [0, 1] });
// 分组展开时按里面的标签页数分宽度,每个标签页和分组外的一样宽
const group = (el, t, open) => {
  const shut = { maxWidth: '0px', flexGrow: 0 };
  const full = { maxWidth: '900px', flexGrow: el.children.length - (el.id === 'g0' ? 1 : 0) };
  tw(el, t, 0.5, Object.fromEntries(Object.keys(full).map((k) => [k, open ? [shut[k], full[k]] : [full[k], shut[k]]])), EASE.inOut);
};

// 鼠标
const cursor = $('#cursor');
let cur = [1330, 760];
function move(t, dur, to, ease = EASE.inOut) {
  tw(cursor, t, dur, { transform: [`translate(${cur[0]}px,${cur[1]}px)`, `translate(${to[0]}px,${to[1]}px)`] }, ease);
  cur = to;
}
function click(t) {
  CLICKS.push(t);
  tw($('#cursor svg'), t, 0.2, { transform: ['scale(1)', 'scale(.82)', 'scale(1)'] }, EASE.linear);
  tw($('#cursor .ring'), t, 0.5, { opacity: [0, 0.9, 0], transform: ['scale(.2)', 'scale(.7)', 'scale(1.7)'] }, EASE.out);
}

// 当前标签页、当前页面和足迹
let activeRow = null;
let activeTab = null;
let shown = 'docs';
let trail = []; // 最近离开的行,新的在前
function showPage(key, t) {
  if (key === shown) return;
  for (const [a, b, display] of [
    [$('#pg-' + shown), $('#pg-' + key), 'block'],
    [$('#ou-' + shown), $('#ou-' + key), 'inline'],
    [$('#oi-' + shown), $('#oi-' + key), 'inline'],
  ]) {
    set(a, t, { display: 'none' });
    set(b, t, { display });
  }
  shown = key;
}
// 切到某一行(侧边栏)和对应的顶部标签页;离开的那一行留下足迹(最多 3 个)
function activate(rowEl, tabEl, key, t, { footprint = true } = {}) {
  if (activeRow) cls(activeRow, t, 'active', false);
  if (activeTab) cls(activeTab, t, 'active', false);
  if (footprint && activeRow && activeRow !== rowEl) {
    trail = [activeRow, ...trail.filter((x) => x !== activeRow)];
    cls(activeRow, t, 'fp');
    cls(activeRow, t, 'fp-grow');
    for (const old of trail.slice(3)) {
      cls(old, t, 'fp', false);
      cls(old, t, 'fp-grow', false);
    }
    trail = trail.slice(0, 3);
  }
  if (trail.includes(rowEl)) {
    cls(rowEl, t, 'fp', false);
    cls(rowEl, t, 'fp-grow', false);
    trail = trail.filter((x) => x !== rowEl);
  }
  cls(rowEl, t, 'active');
  if (tabEl) cls(tabEl, t, 'active');
  activeRow = rowEl;
  activeTab = tabEl;
  showPage(key, t);
}

// ---------- 时间线 ----------

function scenes() {
  const win = $('#win');
  // 背景的色块缓缓飘动
  tw($('.b1'), 0, DURATION, { transform: ['translate(0px,0px)', 'translate(150px,90px)', 'translate(60px,190px)'] }, EASE.linear);
  tw($('.b2'), 0, DURATION, { transform: ['translate(0px,0px)', 'translate(-130px,-60px)', 'translate(-40px,-160px)'] }, EASE.linear);
  tw($('.b3'), 0, DURATION, { transform: ['translate(0px,0px)', 'translate(-170px,-40px)', 'translate(90px,-120px)'] }, EASE.linear);

  // 0–4 开头
  const intro = $('#intro');
  const [logo, ...lines] = intro.children;
  tw(logo, 0.2, 0.95, { opacity: [0, 1], transform: ['scale(.55) rotate(-10deg)', 'none'] }, EASE.spring);
  lines.forEach((el, i) => tw(el, 0.75 + i * 0.22, 0.75, { opacity: [0, 1], transform: ['translateY(22px)', 'none'] }));
  tw(intro, 3.5, 0.5, { opacity: [1, 0], transform: ['none', 'scale(.96)'] }, EASE.in);

  // 4–9.5 横向标签栏越挤越窄,打开侧边栏后两边一起整理好
  tw(win, 4, 0.85, { opacity: [0, 1], transform: ['translateY(40px) scale(.96)', 'none'] });
  copyIn($('#copy-1'), 4.25);
  [...$('#crowd').children].forEach((el, i) => i >= 6 && tabIn(el, 4.9 + (i - 6) * 0.13));
  tw($('#ext'), 8.05, 0.5, { backgroundColor: ['rgba(0,0,0,0)', 'rgba(0,0,0,.1)', 'rgba(0,0,0,0)'] }, EASE.linear);
  tw($('#crowd'), 8.2, 0.4, { opacity: [1, 0] });
  tw($('#sync'), 8.2, 0.4, { opacity: [0, 1] });
  tw($('#side'), 8.2, 0.85, { width: ['0px', '341px'] }, EASE.inOut);
  tw(frame(), 8.2, 0.85, { transform: ['translateX(-340px)', 'none'] }, EASE.inOut);
  ['#favs', '.space-head', '#pins', '.divider', '.row.new', '#t-docs', '#t-mdn', '#t-lofi', '#t-hn', '#spaces'].forEach((s, i) =>
    tw(q(s), 8.55 + i * 0.05, 0.55, { opacity: [0, 1], translate: ['-12px 0', '0 0'] })
  );
  copyOut($('#copy-1'), 8.9);
  activeRow = q('#t-docs');
  activeTab = st('docs');
  for (const k of PAGES.slice(1)) for (const s of ['#pg-', '#ou-', '#oi-']) set($(s + k), 0, { display: 'none' });

  // 9.5–17 双向同步(拖拽在 pointer() 里,要先量位置)
  copyIn($('#copy-2'), 9.5);
  copyOut($('#copy-2'), 16.6);

  // 17–24.5 空间
  copyIn($('#copy-3'), 17);
  const names = [...q('#space-name').children];
  const sets = { pins: [...q('#pins').children], tabs: [...q('#tabs').children] };
  const dots = [...q('#spaces').querySelectorAll('.space-dot')].slice(0, 3);
  const groups = [0, 1, 2].map((i) => $('#g' + i));
  const chips = [0, 1, 2].map((i) => $('#chip' + i));
  for (const zone of Object.values(sets)) set(zone[0], 0, { transform: 'none' });
  const pageOf = ['docs', 'figma', 'wiki'];
  const switchSpace = (from, to, t) => {
    tw(doc.documentElement, t, 0.5, { '--accent': [SPACES[from].color, SPACES[to].color] }, EASE.inOut);
    tw(names[from], t, 0.25, { opacity: [1, 0], transform: ['none', 'translateY(-6px)'] });
    tw(names[to], t + 0.1, 0.35, { opacity: [0, 1], transform: ['translateY(6px)', 'none'] });
    for (const zone of Object.values(sets)) {
      tw(zone[from], t, 0.15, { opacity: [1, 0] }, EASE.linear);
      set(zone[from], t + 0.15, { display: 'none' });
      set(zone[to], t + 0.15, { display: 'flex' });
      tw(zone[to], t + 0.15, 0.4, { opacity: [0, 1], transform: ['translateY(10px)', 'none'] });
    }
    cls(dots[from], t, 'on', false);
    cls(dots[to], t, 'on');
    cls(chips[from], t, 'collapsed');
    cls(chips[to], t, 'collapsed', false);
    group(groups[from], t, false);
    group(groups[to], t, true);
    showPage(pageOf[to], t);
  };
  switchSpace(0, 1, 18.3);
  switchSpace(1, 2, 20.5);
  switchSpace(2, 0, 22.8);
  copyOut($('#copy-3'), 24);

  // 24.5–31 子标签:网页里点链接(后台打开),新标签页挂在文档下面
  copyIn($('#copy-4'), 24.5);
  const press = (el, t) => tw(el, t, 0.5, { boxShadow: ['0 0 0 0px rgba(26,115,232,0)', '0 0 0 2px rgba(26,115,232,.9)', '0 0 0 0px rgba(26,115,232,0)'] }, EASE.linear);
  press($('#l-docs-0'), 25.7);
  rowIn(q('#t-tg'), 25.85);
  tabIn(st('tg'), 25.9);
  press($('#l-docs-1'), 27);
  rowIn(q('#t-mv3'), 27.15);
  tabIn(st('mv3'), 27.2);
  copyOut($('#copy-4'), 30.4);

  // 31–37.5 固定标签:点 Notion,网页里跳到别的页面,侧边栏这一行显示离开了;点 ↩ 回去
  copyIn($('#copy-5'), 31);
  const notion = q('#p-notion');
  activate(notion, st('notion'), 'notion', 32.3);
  press($('#l-notion-0'), 33.7);
  const away = (t, on) => {
    cls(notion, t, 'away', on);
    for (const s of ['.alias', '.title:not(.away-title)']) set(notion.querySelector(s), t, { display: on ? 'none' : 'inline' });
    for (const s of ['.pin-name', '.away-title']) set(notion.querySelector(s), t, { display: on ? 'inline' : 'none' });
    set(notion.querySelector('.back'), t, { display: on ? 'grid' : 'none' });
    showPage(on ? 'weekly' : 'notion', t);
  };
  away(33.85, true);
  tw(notion.querySelector('.back'), 35.3, 0.4, { backgroundColor: ['rgba(107,124,255,0)', 'rgba(107,124,255,.25)', 'rgba(107,124,255,0)'] }, EASE.linear);
  away(35.45, false);
  copyOut($('#copy-5'), 36.9);

  // 37.5–44 足迹与休眠
  copyIn($('#copy-6'), 37.5);
  activate(q('#t-lofi'), st('lofi'), 'lofi', 38.4);
  const hn = q('#t-hn');
  cls(hn, 39.5, 'hover');
  // 休眠:整行从悬停时的底色退到休眠的样子,图标缩一下、飘起一个 z,行尾出现「刚刚」
  set(hn, 40.3, { '--sleep-bg': 'rgba(20,21,26,.06)', '--sleep-shadow': 'none' });
  cls(hn, 40.3, 'hover', false);
  cls(hn, 40.3, 'discarded');
  cls(hn, 40.3, 'just-slept');
  set(hn.querySelector('.v-moon'), 40.3, { display: 'none' });
  set(hn.querySelector('.slept'), 40.3, { display: 'inline' });
  cls(st('hn'), 40.3, 'asleep');
  const toast = q('#toast');
  tw(toast, 40.45, 0.25, { opacity: [0, 1], transform: ['translateY(8px) scale(.96)', 'none'] });
  tw(toast, 42.6, 0.25, { opacity: [1, 0] });
  copyOut($('#copy-6'), 43.4);

  // 44–48.5 键盘:选中框从当前标签页开始,往下走两格,回车打开
  copyIn($('#copy-7'), 44);
  tw(cursor, 44, 0.3, { opacity: [1, 0] });
  const keyCaps = [...$('#keys').children];
  tw($('#keys'), 44.2, 0.5, { opacity: [0, 1], transform: ['translateY(10px)', 'none'] });
  const kb = (el, t) => {
    cls(el, t, 'kb-focus');
    cls(el, t, 'kb-pop');
  };
  const unkb = (el, t) => {
    cls(el, t, 'kb-focus', false);
    cls(el, t, 'kb-pop', false);
  };
  const tap = (cap, t) => {
    CLICKS.push(t);
    tw(cap, t, 0.25, { transform: ['none', 'translateY(3px)', 'none'], backgroundColor: ['#fff', '#e8eaff', '#fff'] }, EASE.linear);
  };
  kb(q('#t-lofi'), 44.8);
  [45.5, 46.2].forEach((t, i) => {
    tap(keyCaps[0], t);
    unkb(i ? q('#t-hn') : q('#t-lofi'), t);
    kb(i ? q('#t-docs') : q('#t-hn'), t);
  });
  tap(keyCaps[1], 47);
  unkb(q('#t-docs'), 47.15);
  activate(q('#t-docs'), st('docs'), 'docs', 47.1);
  tw($('#keys'), 48, 0.3, { opacity: [1, 0] });
  copyOut($('#copy-7'), 48.1);
  tw(win, 48.4, 0.6, { opacity: [1, 0], transform: ['none', 'translateY(24px) scale(.97)'] }, EASE.in);

  // 48.9–53.6 更多功能
  const more = $('#more');
  tw(more.children[0], 48.9, 0.7, { opacity: [0, 1], transform: ['translateY(18px)', 'none'] });
  tw(more.children[1], 49, 0.7, { opacity: [0, 1], transform: ['translateY(18px)', 'none'] });
  [...$('#cards').children].forEach((el, i) => tw(el, 49.3 + i * 0.1, 0.7, { opacity: [0, 1], transform: ['translateY(26px) scale(.96)', 'none'] }));
  tw(more, 53.3, 0.5, { opacity: [1, 0], transform: ['none', 'scale(.97)'] }, EASE.in);

  // 53.9–56.6 隐私
  const privacy = $('#privacy');
  [...privacy.children].slice(0, 3).forEach((el, i) => tw(el, 53.9 + i * 0.1, 0.7, { opacity: [0, 1], transform: ['translateY(18px)', 'none'] }));
  [...$('#pills').children].forEach((el, i) => tw(el, 54.4 + i * 0.12, 0.6, { opacity: [0, 1], transform: ['translateY(14px) scale(.95)', 'none'] }, EASE.spring));
  tw(privacy, 56.4, 0.5, { opacity: [1, 0], transform: ['none', 'scale(.97)'] }, EASE.in);

  // 57– 结尾:在线试用和仓库地址
  const [olog, ...olines] = $('#outro').children;
  tw(olog, 56.9, 0.95, { opacity: [0, 1], transform: ['scale(.55) rotate(-10deg)', 'none'] }, EASE.spring);
  olines.forEach((el, i) => tw(el, 57.3 + i * 0.18, 0.75, { opacity: [0, 1], transform: ['translateY(18px)', 'none'] }));
}

// 鼠标的路线,以及需要先量位置的动画:拖拽时各行和顶部标签页的位移
function pointer() {
  tw(cursor, 7.2, 0.3, { opacity: [0, 1] });
  move(7.2, 0.8, at(7.9, $('#ext')));
  click(8.05);

  // 9.5–17 拖拽:侧边栏里把 Hacker News 拖到最上面,顶部跟着变;再在顶部把 lofi 拖到前面,侧边栏跟着变
  const ROW = 38;
  const rows = ['t-docs', 't-mdn', 't-tg', 't-mv3', 't-lofi', 't-hn'];
  const tabs = ['notion', 'trip', 'docs', 'mdn', 'tg', 'mv3', 'lofi', 'hn'];
  const rowOrders = [rows, ['t-hn', 't-docs', 't-mdn', 't-tg', 't-mv3', 't-lofi'], ['t-lofi', 't-hn', 't-docs', 't-mdn', 't-tg', 't-mv3']];
  const tabOrders = [tabs, ['notion', 'trip', 'hn', 'docs', 'mdn', 'tg', 'mv3', 'lofi'], ['notion', 'trip', 'lofi', 'hn', 'docs', 'mdn', 'tg', 'mv3']];
  // 子标签 tg、mv3 这时还没出现(高度为 0),不占位置
  const shownRows = (order) => order.filter((id) => !['t-tg', 't-mv3'].includes(id));
  const shownTabs = (order) => order.filter((id) => !['tg', 'mv3'].includes(id));
  seek(9.6);
  const box = Object.fromEntries(shownTabs(tabs).map((id) => [id, st(id).getBoundingClientRect()]));
  const left0 = box[tabs[0]].left;
  const tabX = (order, id) => {
    let x = left0;
    for (const o of shownTabs(order)) {
      if (o === id) return x - box[id].left;
      x += box[o].width + 1;
    }
  };
  const rowY = (order, id) => (shownRows(order).indexOf(id) - shownRows(rows).indexOf(id)) * ROW;
  const reorder = (step, t, dur) => {
    for (const id of shownRows(rows)) {
      const [a, b] = [rowY(rowOrders[step - 1], id), rowY(rowOrders[step], id)];
      if (a !== b) tw(q('#' + id), t, dur, { transform: [`translateY(${a}px)`, `translateY(${b}px)`] }, EASE.inOut);
    }
    for (const id of shownTabs(tabs)) {
      const [a, b] = [tabX(tabOrders[step - 1], id), tabX(tabOrders[step], id)];
      if (a !== b) tw(st(id), t, dur, { transform: [`translateX(${a}px)`, `translateX(${b}px)`] }, EASE.inOut);
    }
  };
  // 用 class 而不是动画来标出正在移动的行和标签页:动画结束后会一直盖住 active 之类的样子
  const glow = (el, t, len) => {
    cls(el, t, 'v-glow');
    cls(el, t + len, 'v-glow', false);
  };
  const lift = (el, t, len) => {
    cls(el, t, 'v-lift');
    cls(el, t + len, 'v-lift', false);
  };

  const hn = q('#t-hn');
  const [hx, hy] = at(10.4, hn, 0.4);
  move(10.5, 0.7, [hx, hy]);
  click(11.3);
  lift(hn, 11.3, 1.4);
  move(11.45, 1, [hx, hy - 3 * ROW]);
  reorder(1, 11.45, 1);
  glow(st('hn'), 11.45, 1.5);

  const [lx, ly] = at(12.9, st('lofi'));
  const lofiX = lx + tabX(tabOrders[1], 'lofi');
  move(13.2, 0.75, [lofiX, ly]);
  click(14.05);
  set(st('lofi'), 14.05, { zIndex: 3 });
  move(14.2, 1, [lofiX + tabX(tabOrders[2], 'lofi') - tabX(tabOrders[1], 'lofi'), ly]);
  reorder(2, 14.2, 1);
  glow(st('lofi'), 14.05, 1.6);
  lift(q('#t-lofi'), 14.2, 1.4);

  // 拖完把顺序「落定」:改成 CSS order、去掉位移,画面不变,之后插入的子标签才能排在对的位置
  const settle = 16.9;
  rowOrders[2].forEach((id, i) => {
    set(q('#' + id), settle, { order: i });
    set(q('#' + id), settle, { transform: 'none' });
  });
  tabOrders[2].forEach((id, i) => {
    set(st(id), settle, { order: i });
    set(st(id), settle, { transform: 'none' });
  });

  // 17–24.5 空间:底部圆点 → 顶部「学习」分组 → 底部圆点
  const dots = [...q('#spaces').querySelectorAll('.space-dot i')];
  move(17.5, 0.75, at(18.2, dots[1]));
  click(18.3);
  move(19.6, 0.85, at(20.4, $('#chip2')));
  click(20.5);
  move(21.9, 0.8, at(22.7, dots[0]));
  click(22.8);

  // 24.5–31 网页里的链接
  move(24.9, 0.75, at(25.6, $('#l-docs-0'), 0.4));
  click(25.7);
  move(26.3, 0.6, at(26.9, $('#l-docs-1'), 0.45));
  click(27);

  // 31–37.5 固定标签
  move(31.5, 0.75, at(32.2, q('#p-notion'), 0.35));
  click(32.3);
  move(32.95, 0.65, at(33.6, $('#l-notion-0'), 0.4));
  click(33.7);
  move(34.5, 0.7, at(35.25, q('#p-notion .back')));
  click(35.3);

  // 37.5–44 足迹与休眠
  move(37.6, 0.7, at(38.3, q('#t-lofi'), 0.35));
  click(38.4);
  move(39.2, 0.7, at(39.95, q('#t-hn .v-moon')));
  click(40.3);
}

// ---------- 搭画面 ----------

async function setup() {
  $('#win').innerHTML = windowHtml();
  const CARDS = [
    ['#6b7cff', ICON.back, '什么都能撤销', 'Ctrl/⌘+Z 一步步撤销', 'Undo everything, step by step'],
    ['#e5687a', ICON.copy, '相同网址只开一份', '已经开着的,直接切过去', 'No duplicate tabs'],
    ['#2f9bd6', ICON.select, '多选一起操作', 'Ctrl/⌘ 多选、Shift 连选', 'Multi-select, drag them together'],
    ['#4fae6e', ICON.recent, '最近关闭', '点一下就恢复', 'Recently closed, one click back'],
    ['#8a63d2', ICON.eyeOff, '不记录历史的空间', '访问过的网址立刻删除', 'No-history spaces and folders'],
    ['#f0913f', ICON.theme, '中文 / English · 深浅色', '跟随浏览器和系统', 'Follows your language and theme'],
  ];
  $('#cards').innerHTML = CARDS.map(
    ([c, icon, t, zh, en]) => `<div class="card" style="--c:${c}"><span class="ic">${icon}</span><div><b>${t}</b><p>${zh}</p><p class="en">${en}</p></div></div>`
  ).join('');
  const PILLS = [
    [ICON.shield, '无网络请求'],
    [ICON.code, '纯 JS/CSS · 无依赖'],
    [ICON.heart, 'MIT 开源'],
  ];
  $('#pills').innerHTML = PILLS.map(([icon, label]) => `<span class="pill">${icon}${label}</span>`).join('');
  $('#go-try').insertAdjacentHTML('afterbegin', ICON.play.replace('width="22" height="22"', ''));
  $('#go-repo').insertAdjacentHTML('afterbegin', GITHUB_MARK);

  frame().srcdoc = panelHtml();
  await new Promise((r) => (frame().onload = r));
  doc = frame().contentDocument;
  const images = [...document.images, ...doc.images];
  await Promise.all([document.fonts.ready, doc.fonts.ready, ...images.map((img) => img.decode().catch(() => {}))]);

  scenes();
  build();
  pointer();
  build();
  seek(0);
}

Object.assign(window, { seek, DURATION, POSTER, CLICKS });
setup().then(
  () => {
    window.sceneReady = true;
    if (location.search.includes('play')) for (const a of anims) a.play();
  },
  (e) => {
    window.sceneError = e;
    throw e;
  }
);
