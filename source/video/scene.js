// 介绍视频的画面和时间线。
// 所有动画都用 Web Animations 建好后暂停,seek(t) 把它们一起定格到第 t 秒,make.js 逐帧调用它截图。
// 地址后加 ?play 可以在浏览器里实时播放预览。
// 侧边栏是一个 iframe,直接套用扩展自己的 sidepanel.css,和真实界面一样;示例内容都是编的。

import { BRAND_ICONS } from '../../store/screenshots/brand-icons.js';

const DURATION = 54.5;
const POSTER = 34.3; // 封面取这一刻
const CLICKS = []; // 点击的时间点,music.js 在这些地方加点击音效

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
// 从第 t 秒起,用 dur 秒把 el 的各个属性按给的关键帧变过去
function tw(el, t, dur, props, ease = EASE.out) {
  for (const [prop, values] of Object.entries(props)) specs.push({ el, t, dur, prop, values, ease });
}
// 第 t 秒起把属性直接设成某个值
function set(el, t, props) {
  for (const [prop, v] of Object.entries(props)) specs.push({ el, t, dur: 0.001, prop, values: [v, v], ease: 'linear', instant: true });
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
}
function seek(t) {
  for (const a of anims) a.currentTime = t * 1000;
}

const $ = (s, root = document) => root.querySelector(s);
const frame = $('#panel');
let doc; // 侧边栏 iframe 的 document
const q = (s) => $(s, doc);
const st = (id) => $('#s-' + id); // 顶部标签栏里的标签页

// 第 t 秒时元素上某一点在画面里的坐标(ax、ay 是在元素里的相对位置)
function at(t, el, ax = 0.5, ay = 0.5) {
  seek(t);
  const r = el.getBoundingClientRect();
  const o = el.ownerDocument === document ? { left: 0, top: 0 } : frame.getBoundingClientRect();
  return [o.left + r.left + r.width * ax, o.top + r.top + r.height * ay];
}

// ---------- 图标 ----------

const svgUrl = (svg) => 'data:image/svg+xml,' + encodeURIComponent(svg);
const badge = (letter, bg) =>
  svgUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="3.5" fill="${bg}"/><text x="8" y="11.6" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="10" font-weight="700" fill="#fff">${letter}</text></svg>`
  );
const brand = (name) => {
  const { color, path } = BRAND_ICONS[name];
  return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${color}" d="${path}"/></svg>`);
};
const IMG = {
  gmail: brand('gmail'),
  github: brand('github'),
  youtube: brand('youtube'),
  figma: brand('figma'),
  spotify: brand('spotify'),
  notion: badge('N', '#111'),
  trip: badge('T', '#1a73e8'),
  stay: badge('K', '#0f9d58'),
  chrome: badge('C', '#4285f4'),
  tips: badge('A', '#f0913f'),
  mdn: badge('M', '#1b1b1b'),
  hn: badge('H', '#ff6600'),
  linear: badge('L', '#5e6ad2'),
  actions: badge('A', '#2088ff'),
  slack: badge('S', '#4a154b'),
  anki: badge('A', '#2a6fdb'),
  wiki: badge('W', '#3a3a3a'),
  typst: badge('T', '#239dad'),
  globe: svgUrl(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.5" fill="none" stroke="#999" stroke-width="1.4"/><path d="M1.5 8h13M8 1.5c-4 4.5-4 8.5 0 13M8 1.5c4 4.5 4 8.5 0 13" fill="none" stroke="#999" stroke-width="1.2"/></svg>'
  ),
};
// 线条图标,和 src/dom.js 里的一样
const stroke = (d) => `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ICON = {
  search: '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/></svg>',
  more: '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><circle cx="3" cy="8" r="1.3"/><circle cx="8" cy="8" r="1.3"/><circle cx="13" cy="8" r="1.3"/></svg>',
  plus: stroke('<path d="M8 3.5v9M3.5 8h9"/>'),
  sound: stroke('<path d="M2.5 6.2v3.6h2.3L8 12.5v-9L4.8 6.2z"/><path d="M10.5 5.8a3 3 0 010 4.4M12.3 4a5.5 5.5 0 010 8"/>'),
  folder: stroke('<path d="M2.5 4.5a1 1 0 011-1h3l1.5 1.5h4.5a1 1 0 011 1v6a1 1 0 01-1 1h-9a1 1 0 01-1-1z"/>'),
  folderOpen: stroke('<path d="M2.5 12V4.5a1 1 0 011-1h3l1.5 1.5h4a1 1 0 011 1v1"/><path d="M2.5 12l1.6-4.3a1 1 0 01.9-.7h8.6l-1.7 5z"/>'),
  recent: stroke('<path d="M2.8 8a5.2 5.2 0 101.6-3.8"/><path d="M2.8 2.8v2.6h2.6"/><path d="M8 5.2V8l2 1.3"/>'),
  edit: stroke('<path d="M10.5 3l2.5 2.5L6 12.5H3.5V10z"/>'),
  pin: stroke('<path d="M6 2.5h4M7 2.5v3.5L4.5 9h7L9 6V2.5M8 9v4.5"/>'),
  star: stroke('<path d="M8 2.5l1.7 3.4 3.8.6-2.7 2.6.6 3.7L8 11l-3.4 1.8.6-3.7-2.7-2.6 3.8-.6z"/>'),
  link: stroke('<path d="M7 9a2.5 2.5 0 003.5 0l2-2a2.5 2.5 0 00-3.5-3.5l-.6.6"/><path d="M9 7a2.5 2.5 0 00-3.5 0l-2 2a2.5 2.5 0 003.5 3.5l.6-.6"/>'),
  sleep: stroke('<path d="M13 9.5A5.5 5.5 0 116.5 3a4.3 4.3 0 006.5 6.5z"/>'),
  lock: stroke('<rect x="3.5" y="7" width="9" height="6.5" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 015 0v2"/>'),
  dot: stroke('<circle cx="8" cy="8" r="3.5" fill="currentColor" stroke="none"/>'),
  close: stroke('<path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/>'),
  back: stroke('<path d="M6 3.5L3 6.5l3 3"/><path d="M3 6.5h6.5a3.5 3.5 0 010 7H8"/>'),
  copy: stroke('<rect x="5.5" y="5.5" width="7.5" height="7.5" rx="1.5"/><path d="M10.5 5.5V4A1.5 1.5 0 009 2.5H4A1.5 1.5 0 002.5 4v5A1.5 1.5 0 004 10.5h1.5"/>'),
  eyeOff: stroke('<path d="M2 8s2.2-4 6-4 6 4 6 4-2.2 4-6 4-6-4-6-4z"/><circle cx="8" cy="8" r="1.8"/><path d="M3 13L13 3"/>'),
  theme: stroke('<circle cx="8" cy="8" r="5.5"/><path d="M8 2.5v11a5.5 5.5 0 000-11z" fill="currentColor"/>'),
  shield: stroke('<path d="M8 2l5 2v4c0 3-2.2 5.2-5 6-2.8-.8-5-3-5-6V4z"/><path d="M6 8l1.5 1.5L10.5 6.5"/>'),
  code: stroke('<path d="M5.5 4.5L2 8l3.5 3.5M10.5 4.5L14 8l-3.5 3.5"/>'),
  heart: stroke('<path d="M8 13.5S2.5 10.3 2.5 6.4A2.9 2.9 0 018 4.8a2.9 2.9 0 015.5 1.6c0 3.9-5.5 7.1-5.5 7.1z"/>'),
};
const GITHUB_MARK = `<svg viewBox="0 0 24 24"><path fill="currentColor" d="${BRAND_ICONS.github.path}"/></svg>`;

// ---------- 侧边栏和顶部标签栏 ----------

const SPACES = [
  { name: '个人', color: '#6b7cff', group: '#1a73e8' },
  { name: '工作', color: '#4fae6e', group: '#1e8e3e' },
  { name: '学习', color: '#f0913f', group: '#e8710a' },
  { name: '生活', color: '#e5687a', group: '#d93025' },
];

const row = (id, img, title, { alias, cls = '', depth, sound } = {}) =>
  `<div class="row ${cls}" id="${id}"${depth ? ` style="--depth:${depth}"` : ''}><img class="icon" src="${img}" alt="">` +
  (alias ? `<span class="alias">${alias}</span>` : '') +
  `<span class="title">${title}</span>` +
  (sound ? `<button class="btn">${ICON.sound}</button>` : '') +
  '</div>';

// 每个空间的固定标签和标签页
const SETS = [
  {
    pins:
      row('p-notion', IMG.notion, 'Notion – 项目规划', { alias: '规划', cls: 'open' }) +
      `<div class="row folder" id="f-trip"><span class="i ic-closed">${ICON.folder}</span><span class="i ic-open">${ICON.folderOpen}</span><span class="title">旅行计划</span><span class="count">1/2</span></div>` +
      row('p-trip', IMG.trip, '东京五日游行程表', { alias: '行程', cls: 'open', depth: 1 }) +
      row('p-stay', IMG.stay, '京都民宿比价清单', { alias: '住宿', depth: 1 }),
    tabs:
      row('t-chrome', IMG.chrome, 'chrome.sidePanel | API | Chrome for Developers', { alias: '文档', cls: 'active' }) +
      row('t-tips', IMG.tips, '十个让浏览器更顺手的小技巧(附快捷键清单)', { depth: 1 }) +
      row('t-mdn', IMG.mdn, 'MDN Web Docs – color-mix()', { depth: 1 }) +
      row('t-lofi', IMG.youtube, 'lofi hip hop radio – beats to relax/study to', { alias: 'BGM', sound: true }) +
      row('t-hn', IMG.hn, 'Hacker News'),
  },
  {
    pins: row('', IMG.linear, 'Linear – 我的任务', { cls: 'open' }) + row('', IMG.globe, '日历'),
    tabs:
      row('', IMG.figma, 'Figma – 首页改版 v3', { cls: 'active' }) +
      row('', IMG.github, 'Pull requests · winzipsdo/sidearc') +
      row('', IMG.actions, 'Actions – 构建 #128 通过', { depth: 1 }) +
      row('', IMG.slack, 'Slack – #design'),
  },
  {
    pins: row('', IMG.anki, 'Anki – 每日复习', { alias: '复习', cls: 'open' }),
    tabs:
      row('', IMG.wiki, 'Wikipedia – 贝叶斯定理', { cls: 'active' }) +
      row('', IMG.youtube, '3Blue1Brown – 贝叶斯定理,以及证据如何改变信念', { depth: 1 }) +
      row('', IMG.typst, 'Typst 文档 – 数学公式') +
      row('', IMG.spotify, 'Spotify – 专注歌单', { alias: 'BGM', sound: true }),
  },
];

const menuItem = (id, icon, label, color) =>
  `<button${id ? ` id="${id}"` : ''}><span class="i"${color ? ` style="color:${color}"` : ''}>${icon}</span><span class="label">${label}</span></button>`;

function panelHtml() {
  const favs = ['gmail', 'github', 'youtube', 'figma', 'spotify'].map((k, i) => `<div class="tile${i === 0 ? ' open' : ''}"><img class="icon" src="${IMG[k]}" alt=""></div>`).join('');
  const sets = (zone) => SETS.map((s, i) => `<div class="set" data-s="${i}">${s[zone]}</div>`).join('');
  const dots = SPACES.map((s, i) => `<button class="space-dot${i === 0 ? ' on' : ''}"><i style="color:${s.color}"></i></button>`).join('');
  return `<!doctype html><html lang="zh-CN" style="color-scheme:light"><head><meta charset="utf-8">
<link rel="stylesheet" href="../../sidepanel.css">
<style>
@property --accent { syntax: '<color>'; inherits: true; initial-value: #6b7cff; }
body { font-family: Inter, "PingFang SC", "Noto Sans CJK SC", "Microsoft YaHei UI", system-ui, sans-serif; }
#scroll { overflow: hidden; }
#favs { height: 36px; }
#space-name { display: grid; }
#space-name b { grid-area: 1 / 1; font: inherit; }
.set { display: flex; flex-direction: column; gap: 2px; }
.set + .set { display: none; }
.row { overflow: hidden; }
#f-trip .ic-open { display: none; }
#menu { transform-origin: 0 0; }
</style></head><body>
<header><label class="search">${ICON.search}<input id="search" placeholder="搜索标签页或输入网址"></label></header>
<main id="scroll">
<section id="favs" class="zone grid" style="--cols:5">${favs}</section>
<div class="space-head"><span id="space-name">${SPACES.slice(0, 3).map((s) => `<b>${s.name}</b>`).join('')}</span><button class="ghost">${ICON.more}</button></div>
<section id="pins" class="zone list">${sets('pins')}</section>
<div class="divider"><span></span><button class="ghost">清理</button></div>
<button class="row new"><span class="i">${ICON.plus}</span><span class="title">新标签页</span></button>
<section id="tabs" class="zone list">${sets('tabs')}</section>
</main>
<footer id="spaces"><button class="space-dot recent">${ICON.recent}</button>${dots}<button class="space-dot">${ICON.plus}</button></footer>
<div id="menu">
${menuItem('m-alias', ICON.edit, '设置别名…')}<hr>
${menuItem('', ICON.pin, '固定到当前空间')}${menuItem('', ICON.star, '添加到收藏夹')}<hr>
${menuItem('', ICON.link, '复制链接地址')}${menuItem('', ICON.sleep, '休眠')}${menuItem('', ICON.lock, '保持唤醒')}<hr>
${menuItem('', ICON.dot, '移到空间「工作」', SPACES[1].color)}<hr>
${menuItem('', ICON.close, '关闭')}
</div>
</body></html>`;
}

const stab = (id, img, title, cls = '') => `<div class="tab ${cls}"${id ? ` id="s-${id}"` : ''}><img src="${img}" alt=""><span>${title}</span></div>`;

// 第一幕:越开越多、越挤越窄的横向标签栏
const CROWD = [
  [IMG.gmail, '收件箱 (3) – Gmail'], [IMG.github, 'winzipsdo/sidearc'], [IMG.chrome, 'chrome.sidePanel'], [IMG.youtube, 'lofi hip hop radio'],
  [IMG.notion, 'Notion – 项目规划'], [IMG.hn, 'Hacker News'], [IMG.figma, 'Figma – 首页改版'], [IMG.mdn, 'MDN – color-mix()'],
  [IMG.linear, 'Linear – 我的任务'], [IMG.wiki, 'Wikipedia'], [IMG.tips, '十个小技巧'], [IMG.slack, 'Slack'], [IMG.spotify, 'Spotify'],
  [IMG.trip, '东京行程'], [IMG.stay, '京都民宿'], [IMG.typst, 'Typst 文档'], [IMG.anki, 'Anki'], [IMG.globe, '日历'], [IMG.github, 'Pull requests'],
  [IMG.youtube, '3Blue1Brown'], [IMG.actions, 'Actions'], [IMG.chrome, 'Chrome 发布说明'], [IMG.notion, '周报'], [IMG.hn, 'Show HN'], [IMG.figma, '设计规范'], [IMG.mdn, 'CSS Nesting'],
];

function stripHtml() {
  const groups = [
    stab('notion', IMG.notion, 'Notion – 项目规划') + stab('trip', IMG.trip, '东京五日游行程表') + stab('stay', IMG.stay, '京都民宿比价清单') +
      stab('chrome', IMG.chrome, 'chrome.sidePanel', 'on') + stab('tips', IMG.tips, '十个小技巧') + stab('mdn', IMG.mdn, 'MDN Web Docs') +
      stab('lofi', IMG.youtube, 'lofi hip hop radio') + stab('hn', IMG.hn, 'Hacker News'),
    stab('', IMG.linear, 'Linear') + stab('', IMG.figma, 'Figma – 首页改版 v3', 'on') + stab('', IMG.github, 'Pull requests') + stab('', IMG.actions, 'Actions') + stab('', IMG.slack, 'Slack'),
    stab('', IMG.anki, 'Anki') + stab('', IMG.wiki, 'Wikipedia – 贝叶斯定理', 'on') + stab('', IMG.youtube, '3Blue1Brown') + stab('', IMG.typst, 'Typst 文档') + stab('', IMG.spotify, 'Spotify'),
    '',
  ];
  return (
    stab('gmail', IMG.gmail, 'Gmail', 'fav') +
    SPACES.map((s, i) => `<div class="chip" style="--g:${s.group}">${s.name}</div>` + (groups[i] ? `<div class="group" id="g${i}" style="--g:${s.group}">${groups[i]}</div>` : '')).join('') +
    '<div class="newtab">+</div>'
  );
}

// ---------- 常用的几种动作 ----------

const SHADOW = '0 0 0 0.5px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.08), 0 3px 8px rgba(0,0,0,.05)';
const NO_SHADOW = '0 0 0 0px rgba(0,0,0,0), 0 0 0 0px rgba(0,0,0,0), 0 0 0 0px rgba(0,0,0,0)';
const LIFT = '0 0 0 0.5px rgba(0,0,0,.08), 0 6px 14px rgba(0,0,0,.14), 0 14px 30px rgba(0,0,0,.08)';
const CARD = 'rgba(255,255,255,.92)';
const CLEAR = 'rgba(255,255,255,0)';

const copyIn = (sec, t) =>
  [...sec.children].forEach((el, i) => tw(el, t + i * 0.09, 0.7, { opacity: [0, 1], transform: ['translateY(18px)', 'none'] }));
const copyOut = (sec, t) =>
  [...sec.children].forEach((el, i) => tw(el, t + i * 0.03, 0.35, { opacity: [1, 0], transform: ['none', 'translateY(-12px)'] }, EASE.in));

// 侧边栏里的行:展开出现、成为当前标签页
const rowIn = (el, t) => tw(el, t, 0.45, { height: ['0px', '36px'], marginBottom: ['-2px', '0px'], opacity: [0, 1], translate: ['-10px 0', '0 0'] });
const activate = (el, t) => tw(el, t, 0.22, { backgroundColor: [CLEAR, CARD], boxShadow: [NO_SHADOW, SHADOW] });
const deactivate = (el, t) => tw(el, t, 0.22, { backgroundColor: [CARD, CLEAR], boxShadow: [SHADOW, NO_SHADOW] });
const aliasIn = (el, t) =>
  tw(el, t, 0.5, { maxWidth: ['0px', '80px'], paddingLeft: ['0px', '7px'], paddingRight: ['0px', '7px'], marginRight: ['-10px', '-3px'], opacity: [0, 1] }, EASE.spring);

// 顶部标签栏:标签页出现、成为当前标签页、分组折叠展开
const tabIn = (el, t) => tw(el, t, 0.45, { maxWidth: ['0px', '220px'], paddingLeft: ['0px', '8px'], paddingRight: ['0px', '8px'], opacity: [0, 1] });
const tabOn = (el, t) => tw(el, t, 0.3, { flexBasis: ['0px', '120px'], flexGrow: [1, 0], backgroundColor: [CLEAR, '#fff'], color: ['#5f6170', '#2a2a30'] });
const tabOff = (el, t) => tw(el, t, 0.3, { flexBasis: ['120px', '0px'], flexGrow: [0, 1], backgroundColor: ['#fff', CLEAR], color: ['#2a2a30', '#5f6170'] });
const GROUP_OPEN = { maxWidth: '800px', flexGrow: 1, borderBottomWidth: '2px' };
const GROUP_SHUT = { maxWidth: '0px', flexGrow: 0, borderBottomWidth: '0px' };
const group = (el, t, open) =>
  tw(el, t, 0.55, Object.fromEntries(Object.keys(GROUP_OPEN).map((k) => [k, open ? [GROUP_SHUT[k], GROUP_OPEN[k]] : [GROUP_OPEN[k], GROUP_SHUT[k]]])), EASE.inOut);

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

// ---------- 时间线 ----------

function scenes() {
  // 背景的色块缓缓飘动
  tw($('.b1'), 0, DURATION, { transform: ['translate(0px,0px)', 'translate(150px,90px)', 'translate(60px,190px)'] }, EASE.linear);
  tw($('.b2'), 0, DURATION, { transform: ['translate(0px,0px)', 'translate(-130px,-60px)', 'translate(-40px,-160px)'] }, EASE.linear);
  tw($('.b3'), 0, DURATION, { transform: ['translate(0px,0px)', 'translate(-170px,-40px)', 'translate(90px,-120px)'] }, EASE.linear);

  // 0–4.2 开头:标志和名字
  const intro = $('#intro');
  const [logo, ...lines] = intro.children;
  tw(logo, 0.2, 0.95, { opacity: [0, 1], transform: ['scale(.55) rotate(-10deg)', 'none'] }, EASE.spring);
  lines.forEach((el, i) => tw(el, 0.75 + i * 0.22, 0.75, { opacity: [0, 1], transform: ['translateY(22px)', 'none'] }));
  tw(intro, 3.6, 0.55, { opacity: [1, 0], transform: ['none', 'scale(.96)'] }, EASE.in);

  // 4.2–9 横向标签栏越挤越窄
  const win = $('#win');
  tw(win, 4.2, 0.85, { opacity: [0, 1], transform: ['translateY(40px) scale(.96)', 'none'] });
  copyIn($('#copy-b'), 4.45);
  [...$('#strip-crowd').children].forEach((el, i) => i >= 6 && tabIn(el, 5.2 + (i - 6) * 0.14));
  copyOut($('#copy-b'), 8.5);

  // 9–15 打开侧边栏,标签页竖着排
  tw($('#ext'), 8.95, 0.5, { backgroundColor: ['rgba(0,0,0,0)', 'rgba(0,0,0,.08)', 'rgba(0,0,0,0)'] }, EASE.linear);
  tw($('#strip-crowd'), 9.05, 0.4, { opacity: [1, 0] });
  tw($('#strip-sync'), 9.05, 0.4, { opacity: [0, 1] });
  tw($('#side'), 9.1, 0.85, { width: ['0px', '301px'] }, EASE.inOut);
  tw(frame, 9.1, 0.85, { transform: ['translateX(-300px)', 'none'] }, EASE.inOut);
  ['header', '.space-head', '.divider', '.row.new', '#t-chrome', '#t-lofi', '#t-hn', '#spaces'].forEach((s, i) =>
    tw(q(s), 9.5 + i * 0.06, 0.55, { opacity: [0, 1], translate: ['-12px 0', '0 0'] })
  );
  copyIn($('#copy-c'), 9.4);
  activate(q('#t-lofi'), 11.7);
  deactivate(q('#t-chrome'), 11.7);
  tabOn(st('lofi'), 11.7);
  tabOff(st('chrome'), 11.7);
  activate(q('#t-chrome'), 13.3);
  deactivate(q('#t-lofi'), 13.3);
  tabOn(st('chrome'), 13.3);
  tabOff(st('lofi'), 13.3);
  copyOut($('#copy-c'), 14.6);

  // 15–21.8 子标签与别名
  copyIn($('#copy-d'), 15);
  const flash = (el, t) => tw(el, t, 0.5, { backgroundColor: ['rgba(26,115,232,.28)', 'rgba(26,115,232,.65)', 'rgba(26,115,232,.28)'] }, EASE.linear);
  flash($('#link1'), 16.3);
  rowIn(q('#t-tips'), 16.45);
  tabIn(st('tips'), 16.5);
  flash($('#link2'), 17.3);
  rowIn(q('#t-mdn'), 17.45);
  tabIn(st('mdn'), 17.5);
  const menu = q('#menu');
  tw(menu, 18.95, 0.16, { opacity: [0, 1], transform: ['scale(.96)', 'none'] });
  tw(q('#m-alias'), 19.62, 0.08, { backgroundColor: [CLEAR, SPACES[0].color], color: [getComputedStyle(q('#m-alias')).color, '#fff'] }, EASE.linear);
  tw(q('#m-alias .i'), 19.62, 0.08, { color: [getComputedStyle(q('#m-alias .i')).color, '#fff'] }, EASE.linear);
  tw(menu, 19.95, 0.12, { opacity: [1, 0] }, EASE.linear);
  set(menu, 20.1, { visibility: 'hidden' });
  aliasIn(q('#t-chrome .alias'), 20.05);
  aliasIn(q('#t-lofi .alias'), 20.75);
  copyOut($('#copy-d'), 21.6);

  // 22–28 收藏夹与固定标签
  copyIn($('#copy-e'), 22);
  tw(q('#favs'), 22.35, 0.5, { height: ['0px', '36px'] }, EASE.inOut);
  [...q('#favs').children].forEach((el, i) => tw(el, 22.5 + i * 0.08, 0.6, { opacity: [0, 1], transform: ['scale(.4)', 'none'] }, EASE.spring));
  tw(st('gmail'), 22.8, 0.45, { width: ['0px', '32px'], paddingLeft: ['0px', '9px'], paddingRight: ['0px', '9px'], opacity: [0, 1] });
  rowIn(q('#p-notion'), 23.4);
  tabIn(st('notion'), 23.45);
  rowIn(q('#f-trip'), 23.6);
  tabIn(st('trip'), 23.65);
  // 点开文件夹
  set(q('#f-trip .ic-closed'), 25.1, { display: 'none' });
  set(q('#f-trip .ic-open'), 25.1, { display: 'grid' });
  tw(q('#f-trip .count'), 25.1, 0.2, { opacity: [1, 0] });
  rowIn(q('#p-trip'), 25.2);
  rowIn(q('#p-stay'), 25.32);
  // 点没打开的固定标签:打开并切过去
  const stay = q('#p-stay');
  tw(stay.querySelector('.title'), 26.6, 0.3, { color: [getComputedStyle(stay.querySelector('.title')).color, getComputedStyle(q('#p-notion .title')).color] });
  tw(stay.querySelector('.icon'), 26.6, 0.3, { opacity: [0.6, 1], filter: ['saturate(.6)', 'saturate(1)'] });
  tw(stay.querySelector('.alias'), 26.6, 0.3, { opacity: [0.65, 1] });
  activate(stay, 26.6);
  deactivate(q('#t-chrome'), 26.6);
  tabIn(st('stay'), 26.65);
  tabOn(st('stay'), 26.65);
  tabOff(st('chrome'), 26.65);
  copyOut($('#copy-e'), 27.8);

  // 28.2–34.8 空间
  copyIn($('#copy-f'), 28.2);
  const names = [...q('#space-name').children];
  const sets = { pins: [...q('#pins').children], tabs: [...q('#tabs').children] };
  const dots = [...q('#spaces').querySelectorAll('.space-dot i')].slice(0, 3);
  const ringOn = (c) => `0 0 0 2px rgba(240,240,248,1), 0 0 0 3.5px ${c}`;
  const RING_OFF = '0 0 0 0px rgba(240,240,248,0), 0 0 0 0px rgba(240,240,248,0)';
  const groups = [0, 1, 2].map((i) => $('#g' + i));
  // 第一个空间的列表一开始就在原位;不先定下来的话,最后切回来时的滑入动画会提前生效
  for (const zone of Object.values(sets)) set(zone[0], 0, { transform: 'none' });
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
    tw(dots[from], t, 0.25, { opacity: [1, 0.45], transform: ['scale(1.2)', 'none'], boxShadow: [ringOn(SPACES[from].color), RING_OFF] });
    tw(dots[to], t, 0.25, { opacity: [0.45, 1], transform: ['none', 'scale(1.2)'], boxShadow: [RING_OFF, ringOn(SPACES[to].color)] });
    group(groups[from], t, false);
    group(groups[to], t, true);
  };
  switchSpace(0, 1, 29.4);
  switchSpace(1, 2, 31.5);
  switchSpace(2, 0, 33.6);
  copyOut($('#copy-f'), 34.6);

  // 35–41 拖拽同步(鼠标和位移在 drags() 里,要先量好位置)
  copyIn($('#copy-g'), 35);
  copyOut($('#copy-g'), 40.6);
  tw(win, 40.9, 0.6, { opacity: [1, 0], transform: ['none', 'translateY(24px) scale(.97)'] }, EASE.in);

  // 41.3–46.7 更多功能
  const more = $('#more');
  tw(more.children[0], 41.3, 0.7, { opacity: [0, 1], transform: ['translateY(18px)', 'none'] });
  tw(more.children[1], 41.4, 0.7, { opacity: [0, 1], transform: ['translateY(18px)', 'none'] });
  [...$('#cards').children].forEach((el, i) => tw(el, 41.7 + i * 0.1, 0.7, { opacity: [0, 1], transform: ['translateY(26px) scale(.96)', 'none'] }));
  tw(more, 46.2, 0.5, { opacity: [1, 0], transform: ['none', 'scale(.97)'] }, EASE.in);

  // 46.8–49.6 隐私
  const privacy = $('#privacy');
  [...privacy.children].slice(0, 3).forEach((el, i) => tw(el, 46.8 + i * 0.1, 0.7, { opacity: [0, 1], transform: ['translateY(18px)', 'none'] }));
  [...$('#pills').children].forEach((el, i) => tw(el, 47.3 + i * 0.12, 0.6, { opacity: [0, 1], transform: ['translateY(14px) scale(.95)', 'none'] }, EASE.spring));
  tw(privacy, 49.3, 0.5, { opacity: [1, 0], transform: ['none', 'scale(.97)'] }, EASE.in);

  // 49.8– 结尾
  const [olog, ...olines] = $('#outro').children;
  tw(olog, 49.8, 0.95, { opacity: [0, 1], transform: ['scale(.55) rotate(-10deg)', 'none'] }, EASE.spring);
  olines.forEach((el, i) => tw(el, 50.2 + i * 0.18, 0.75, { opacity: [0, 1], transform: ['translateY(18px)', 'none'] }));
}

// 鼠标的路线,以及需要先量位置的动画:右键菜单的位置、拖拽时各行和顶部标签页的位移
function pointer() {
  const P = at;
  tw(cursor, 8.1, 0.3, { opacity: [0, 1] });
  move(8.1, 0.8, P(8.9, $('#ext')));
  click(9);
  move(10.7, 0.85, P(11.55, q('#t-lofi'), 0.35));
  click(11.7);
  move(12.5, 0.7, P(13.2, q('#t-chrome'), 0.35));
  click(13.3);

  move(15.4, 0.75, P(16.2, $('#link1'), 0.45));
  click(16.3);
  move(16.7, 0.5, P(17.2, $('#link2'), 0.6));
  click(17.3);
  move(18, 0.8, P(18.8, q('#t-chrome'), 0.32));
  click(18.9);
  // 右键菜单出现在鼠标右下方
  const fr = frame.getBoundingClientRect();
  const menu = q('#menu');
  menu.style.left = `${cur[0] - fr.left + 2}px`;
  menu.style.top = `${cur[1] - fr.top + 4}px`;
  move(19.2, 0.4, P(19.6, q('#m-alias'), 0.3));
  click(19.9);

  move(24.4, 0.65, P(25, q('#f-trip'), 0.35));
  click(25.1);
  move(26, 0.5, P(26.5, q('#p-stay'), 0.45));
  click(26.6);

  const dots = [...q('#spaces').querySelectorAll('.space-dot i')];
  move(28.6, 0.75, P(29.3, dots[1]));
  click(29.4);
  move(30.9, 0.5, P(31.4, dots[2]));
  click(31.5);
  move(32.9, 0.6, P(33.5, dots[0]));
  click(33.6);

  // 拖拽:侧边栏里把 Hacker News 拖到最上面,顶部跟着变;再在顶部把 lofi 拖到前面,侧边栏跟着变
  const ROW = 38;
  const rows = ['t-chrome', 't-tips', 't-mdn', 't-lofi', 't-hn'];
  const tabs = ['notion', 'trip', 'stay', 'chrome', 'tips', 'mdn', 'lofi', 'hn'];
  const rowOrders = [rows, ['t-hn', 't-chrome', 't-tips', 't-mdn', 't-lofi'], ['t-lofi', 't-hn', 't-chrome', 't-tips', 't-mdn']];
  const tabOrders = [tabs, ['notion', 'trip', 'stay', 'hn', 'chrome', 'tips', 'mdn', 'lofi'], ['notion', 'trip', 'stay', 'lofi', 'hn', 'chrome', 'tips', 'mdn']];
  seek(35);
  const box = Object.fromEntries(tabs.map((id) => [id, st(id).getBoundingClientRect()]));
  const left0 = box[tabs[0]].left;
  const tabX = (order, id) => {
    let x = left0;
    for (const o of order) {
      if (o === id) return x - box[id].left;
      x += box[o].width + 2;
    }
  };
  const rowY = (order, id) => (order.indexOf(id) - rows.indexOf(id)) * ROW;
  const reorder = (step, t, dur) => {
    for (const id of rows) {
      const [a, b] = [rowY(rowOrders[step - 1], id), rowY(rowOrders[step], id)];
      if (a !== b) tw(q('#' + id), t, dur, { transform: [`translateY(${a}px)`, `translateY(${b}px)`] }, EASE.inOut);
    }
    for (const id of tabs) {
      const [a, b] = [tabX(tabOrders[step - 1], id), tabX(tabOrders[step], id)];
      if (a !== b) tw(st(id), t, dur, { transform: [`translateX(${a}px)`, `translateX(${b}px)`] }, EASE.inOut);
    }
  };
  const glow = (el, t, len) => {
    tw(el, t, 0.25, { boxShadow: ['inset 0 0 0 0px rgba(107,124,255,0)', 'inset 0 0 0 1.5px rgba(107,124,255,.95)'], backgroundColor: [CLEAR, 'rgba(107,124,255,.16)'] });
    tw(el, t + len, 0.4, { boxShadow: ['inset 0 0 0 1.5px rgba(107,124,255,.95)', 'inset 0 0 0 0px rgba(107,124,255,0)'], backgroundColor: ['rgba(107,124,255,.16)', CLEAR] });
  };
  // 侧边栏里正在移动的行:浮起来、不透明,盖住它经过的行,并用一圈主题色标出来
  const LIFTED = `${LIFT}, inset 0 0 0 1.5px rgba(107,124,255,.95)`;
  const lift = (el, t, len) => {
    set(el, t, { zIndex: 3 });
    tw(el, t, 0.2, { backgroundColor: [CLEAR, '#fff'], boxShadow: [NO_SHADOW, LIFTED] });
    tw(el, t + len, 0.3, { backgroundColor: ['#fff', CLEAR], boxShadow: [LIFTED, NO_SHADOW] });
    set(el, t + len + 0.3, { zIndex: 'auto' });
  };

  const hn = q('#t-hn');
  const [hx, hy] = P(35.9, hn, 0.4);
  move(35.3, 0.7, [hx, hy]);
  click(36.1);
  lift(hn, 36.1, 1.3);
  move(36.25, 1, [hx, hy - 4 * ROW]);
  reorder(1, 36.25, 1);
  glow(st('hn'), 36.25, 1.4);

  const [lx, ly] = P(37.6, st('lofi'));
  const lofiX = lx + tabX(tabOrders[1], 'lofi');
  move(37.8, 0.7, [lofiX, ly]);
  click(38.6);
  set(st('lofi'), 38.6, { zIndex: 3 });
  move(38.75, 1, [lofiX + tabX(tabOrders[2], 'lofi') - tabX(tabOrders[1], 'lofi'), ly]);
  reorder(2, 38.75, 1);
  glow(st('lofi'), 38.6, 1.5);
  lift(q('#t-lofi'), 38.75, 1.3);

  tw(cursor, 40.6, 0.3, { opacity: [1, 0] });
}

// ---------- 搭画面 ----------

async function setup() {
  $('#strip-crowd').innerHTML = CROWD.map(([img, title], i) => stab('', img, title, i === 2 ? 'on' : '')).join('');
  $('#strip-sync').innerHTML = stripHtml();
  const CARDS = [
    ['#6b7cff', ICON.back, '撤销,一步一步来', 'Ctrl/⌘+Z 连续撤销', 'Undo, step by step'],
    ['#4fae6e', ICON.recent, '最近关闭', '点一下就恢复', 'Recently closed tabs'],
    ['#f0913f', ICON.sleep, '休眠 · 保持唤醒', '后台标签页不再占内存', 'Sleep tabs, keep some awake'],
    ['#e5687a', ICON.copy, '相同网址只开一份', '已经开着的,直接切过去', 'No duplicate tabs'],
    ['#8a63d2', ICON.eyeOff, '不记录历史的空间', '访问过的网址立刻删除', 'No-history spaces and folders'],
    ['#2f9bd6', ICON.theme, '浅色 / 深色模式', '跟随系统设置', 'Light and dark, like your system'],
  ];
  $('#cards').innerHTML = CARDS.map(
    ([c, icon, title, zh, en]) => `<div class="card" style="--c:${c}"><span class="ic">${icon}</span><div><b>${title}</b><p>${zh}</p><p class="en">${en}</p></div></div>`
  ).join('');
  const PILLS = [
    [ICON.shield, '无网络请求'],
    [ICON.code, '纯 JS/CSS · 无依赖'],
    [ICON.heart, 'MIT 开源'],
  ];
  $('#pills').innerHTML = PILLS.map(([icon, label]) => `<span class="pill">${icon}${label}</span>`).join('');
  $('#repo').insertAdjacentHTML('afterbegin', GITHUB_MARK);

  frame.srcdoc = panelHtml();
  await new Promise((r) => (frame.onload = r));
  doc = frame.contentDocument;
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
