// 介绍视频的画面和时间线(时间线工具和落叶在 engine.js,和竖屏短片 short.js 共用)。
// 地址后加 ?play 可以在浏览器里实时播放预览(CSS 动效那部分不会跟着播)。
// 侧边栏是一个 iframe,直接套用插件的 ext/sidepanel.css;浏览器窗口和网页的样式、内容和在线试用共用(demo/)。

import { iconFor } from '../../demo/web.js';
import { GITHUB_MARK, ICON, P, SPACES, U, row, short, stab, stroke, title } from './content.js';
import { EASE, build, cls, leafPile, pile, playAll, seek, set, setFrameDoc, tw } from './engine.js';

const LEAVES_AT = 48.4; // 落叶这一幕开始
const END = LEAVES_AT + 8; // 窗口淡出,后面是功能卡片、隐私和结尾
const DURATION = END + 14.1;
const POSTER = LEAVES_AT + 3.25; // 封面取这一刻:标签页上刚落满叶子,镜头还没推近
const SLEEP_AT = 40.6; // 点月亮让 Hacker News 休眠的时刻
const CLICKS = []; // 点击和按键的时间点,music.js 在这些地方加音效

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

function panelHtml() {
  const favs = ['gmail', 'github', 'youtube', 'figmaFav', 'spotify'].map((k, i) => `<div class="tile${i === 0 ? ' open' : ''}" id="f-${k}"><img class="icon" src="${iconFor(U[k])}" alt=""></div>`).join('');
  const sets = [
    {
      pins:
        `<div class="row open" id="p-notion" data-kind="pin"><img class="icon" src="${iconFor(U.notion)}" alt=""><span class="alias">规划</span><span class="title">${title('notion')}</span>` +
        `<span class="pin-name">规划</span><span class="title away-title">${title('weekly')}</span><button class="btn x">${ICON.sleep}</button><button class="btn x">${ICON.minus}</button><button class="btn back">${ICON.back}</button></div>` +
        `<div class="row folder" data-kind="folder"><span class="i">${ICON.chevron}</span><span class="title">旅行计划</span><span class="count">1/2</span></div>`,
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
/* 1.9 起列表一直给滚动条留位置(scrollbar-gutter: stable),视频里没有滚动条,不留 */
#scroll { overflow: hidden; scrollbar-gutter: auto; }
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
</style></head><body class="shown settled">
<header>
<label class="search">${ICON.search}<input id="search" placeholder="搜索标签页或输入网址"></label>
<section id="favs" class="zone grid" style="--cols:5">${favs}</section>
<div class="space-head"><span id="space-name">${SPACES.map((s) => `<b>${s.name}</b>`).join('')}</span><button id="search-toggle" class="ghost">${ICON.search}</button><button id="space-menu" class="ghost">${ICON.more}</button></div>
</header>
<main id="scroll">
<section id="pins" class="zone list">${zone('pins')}</section>
<div class="divider"><span></span><button class="ghost">清理</button></div>
<section id="tabs" class="zone list">${zone('tabs')}<button id="new-tab" class="row new"><span class="i">${ICON.plus}</span></button></section>
</main>
<footer id="spaces">${dots}<button class="space-dot">${ICON.plus}</button><button class="space-dot recent">${ICON.recent}</button><button class="space-dot settings">${ICON.sliders}</button></footer>
<div id="toast"><span>已让 1 个标签页休眠</span><button>撤销</button></div>
</body></html>`;
}

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
const PAGES = ['docs', 'figma', 'wiki', 'notion', 'weekly', 'lofi', 'mdn', 'tg'];
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
  ['#favs', '.space-head', '#pins', '.divider', '#t-docs', '#t-mdn', '#t-lofi', '#t-hn', '#spaces'].forEach((s, i) =>
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
  cls(hn, 39.3, 'hover');
  // 鼠标按在月亮上:按钮的悬停底色
  const moon = hn.querySelector('.v-moon');
  set(moon, 40.25, { backgroundColor: 'rgba(20,21,26,.12)', color: 'var(--fg)' });
  // 休眠:整行从悬停时的底色退到休眠的样子,图标缩一下、飘起一个 z,行尾出现「刚刚」
  set(hn, SLEEP_AT, { '--sleep-bg': 'rgba(20,21,26,.06)', '--sleep-shadow': 'none' });
  cls(hn, SLEEP_AT, 'hover', false);
  cls(hn, SLEEP_AT, 'discarded');
  cls(hn, SLEEP_AT, 'just-slept');
  set(moon, SLEEP_AT, { display: 'none' });
  set(hn.querySelector('.slept'), SLEEP_AT, { display: 'inline' });
  cls(st('hn'), SLEEP_AT, 'asleep');
  const toast = q('#toast');
  tw(toast, SLEEP_AT + 0.2, 0.25, { opacity: [0, 1], transform: ['translateY(8px) scale(.96)', 'none'] });
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

  // LEAVES_AT 起 8 秒:落叶。「三天后」,很久没进去的标签页落上叶子;扫干净一行,点开另一行叶子被吹走(鼠标在 pointer() 里)
  const L = LEAVES_AT;
  copyIn($('#copy-8'), L);
  const lapse = $('#lapse');
  tw(lapse, L + 0.5, 0.5, { opacity: [0, 1], transform: ['translateY(10px) scale(.94)', 'none'] }, EASE.spring);
  tw(lapse, L + 2.6, 0.4, { opacity: [1, 0] });
  // 三天过去:足迹早就消失了,Hacker News 已经睡了 3 天
  for (const el of trail) {
    cls(el, L + 0.8, 'fp-grow', false);
    cls(el, L + 0.8, 'fp', false);
  }
  trail = [];
  const slept = q('#t-hn .slept');
  const slept3 = slept.cloneNode();
  slept3.textContent = '3 天';
  slept.after(slept3);
  set(slept3, 0, { display: 'none' });
  set(slept, L + 0.8, { display: 'none' });
  set(slept3, L + 0.8, { display: 'inline' });
  // 离开一天后开始落,之后每 12 小时一片:三天是 4 片;Hacker News 更早就没进去过,有 8 片
  [['t-lofi', 4], ['t-hn', 8], ['t-mdn', 4], ['t-tg', 4], ['t-mv3', 4]].forEach(([id, n], i) => leafPile(q('#' + id), L + 0.7 + i * 0.14, n));
  pile(q('#t-tg')).blowAt = L + 6.3;
  activate(q('#t-tg'), st('tg'), 'tg', L + 6.3);
  copyOut($('#copy-8'), L + 7.4);
  tw(win, END, 0.6, { opacity: [1, 0], transform: ['none', 'translateY(24px) scale(.97)'] }, EASE.in);

  // 更多功能
  const more = $('#more');
  tw(more.children[0], END + 0.5, 0.7, { opacity: [0, 1], transform: ['translateY(18px)', 'none'] });
  tw(more.children[1], END + 0.6, 0.7, { opacity: [0, 1], transform: ['translateY(18px)', 'none'] });
  [...$('#cards').children].forEach((el, i) => tw(el, END + 0.9 + i * 0.1, 0.7, { opacity: [0, 1], transform: ['translateY(26px) scale(.96)', 'none'] }));
  tw(more, END + 4.9, 0.5, { opacity: [1, 0], transform: ['none', 'scale(.97)'] }, EASE.in);

  // 隐私
  const privacy = $('#privacy');
  [...privacy.children].slice(0, 3).forEach((el, i) => tw(el, END + 5.5 + i * 0.1, 0.7, { opacity: [0, 1], transform: ['translateY(18px)', 'none'] }));
  [...$('#pills').children].forEach((el, i) => tw(el, END + 6 + i * 0.12, 0.6, { opacity: [0, 1], transform: ['translateY(14px) scale(.95)', 'none'] }, EASE.spring));
  tw(privacy, END + 8, 0.5, { opacity: [1, 0], transform: ['none', 'scale(.97)'] }, EASE.in);

  // 结尾:在线试用和仓库地址
  const [olog, ...olines] = $('#outro').children;
  tw(olog, END + 8.5, 0.95, { opacity: [0, 1], transform: ['scale(.55) rotate(-10deg)', 'none'] }, EASE.spring);
  olines.forEach((el, i) => tw(el, END + 8.9 + i * 0.18, 0.75, { opacity: [0, 1], transform: ['translateY(18px)', 'none'] }));
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
  // 休眠的动效很小:镜头先推近到这一行(窗口以左边缘、这一行为中心放大),点完、播完再拉回来
  const ZOOM = 1.7;
  const win = $('#win');
  build(); // 上面拖拽改了各行的顺序,先建好动画再量位置
  const [mx, my] = at(39.6, q('#t-hn .v-moon'));
  const [, hnY] = at(39.6, q('#t-hn'));
  const left = win.getBoundingClientRect().left;
  set(win, 38.85, { transformOrigin: `0px ${hnY - win.getBoundingClientRect().top}px` });
  tw(win, 38.9, 0.8, { transform: ['none', `scale(${ZOOM})`] }, EASE.inOut);
  tw(win, 42.5, 0.8, { transform: [`scale(${ZOOM})`, 'none'] }, EASE.inOut);
  move(38.9, 0.8, [left + (cur[0] - left) * ZOOM, hnY + (cur[1] - hnY) * ZOOM]);
  move(39.8, 0.6, [left + (mx - left) * ZOOM, hnY + (my - hnY) * ZOOM]);
  click(SLEEP_AT);
  move(41.4, 1.6, [cur[0] - 40, cur[1] + 140]);

  // 落叶:镜头推近到 MDN 和下面两行;鼠标在 MDN 那一行上左右扫,扫干净后点开 chrome.tabGroups 那一行
  const L = LEAVES_AT;
  const LZ = 1.6;
  build();
  const mdn = q('#t-mdn');
  const [, mdnY] = at(L + 2, mdn);
  const [, tgY] = at(L + 2, q('#t-tg'));
  const oy = (mdnY + tgY) / 2;
  set(win, L + 3.25, { transformOrigin: `0px ${oy - win.getBoundingClientRect().top}px` });
  tw(win, L + 3.3, 0.7, { transform: ['none', `scale(${LZ})`] }, EASE.inOut);
  tw(win, L + 6.7, 0.8, { transform: [`scale(${LZ})`, 'none'] }, EASE.inOut);
  const zoomed = ([x, y]) => [left + (x - left) * LZ, oy + (y - oy) * LZ];
  seek(L + 2);
  const r = mdn.getBoundingClientRect();
  const fr = frame().getBoundingClientRect();
  // 扫:在这一行的后半段左右来回,和侧边栏里的落叶共用同一条路线
  const sweep = { t0: L + 4.2, t1: L + 5.8, x: (t) => r.width * (0.62 + 0.36 * Math.sin((2 * Math.PI * (t - L - 4.2)) / 0.5 - Math.PI / 2)), y: () => 19 };
  pile(mdn).sweep = sweep;
  tw(cursor, L + 3.9, 0.3, { opacity: [0, 1] });
  cur = zoomed([fr.left + r.left + sweep.x(sweep.t0), fr.top + r.top + 19]);
  set(cursor, L + 3.9, { transform: `translate(${cur[0]}px,${cur[1]}px)` });
  const N = 60;
  const path = Array.from({ length: N + 1 }, (_, i) => {
    const t = sweep.t0 + ((sweep.t1 - sweep.t0) * i) / N;
    const [x, y] = zoomed([fr.left + r.left + sweep.x(t), fr.top + r.top + sweep.y(t)]);
    return `translate(${x}px,${y}px)`;
  });
  tw(cursor, sweep.t0, sweep.t1 - sweep.t0, { transform: path }, EASE.linear);
  cur = path.at(-1).match(/-?[\d.]+/g).map(Number);
  const tg = q('#t-tg');
  const tr = tg.getBoundingClientRect();
  move(L + 5.85, 0.4, zoomed([fr.left + tr.left + tr.width * 0.4, fr.top + tr.top + tr.height / 2]));
  click(L + 6.3);
  tw(cursor, L + 7.2, 0.3, { opacity: [1, 0] });
}

// ---------- 搭画面 ----------

async function setup() {
  $('#win').innerHTML = windowHtml();
  const CARDS = [
    ['#6b7cff', ICON.back, '什么都能撤销', 'Ctrl/⌘+Z 一步步撤销', 'Undo everything, step by step'],
    ['#e5687a', ICON.copy, '相同网址只开一份', '已经开着的,直接切过去', 'No duplicate tabs'],
    ['#2f9bd6', ICON.select, '多选一起操作', 'Ctrl/⌘ 多选、Shift 连选', 'Multi-select, drag them together'],
    ['#4fae6e', ICON.recent, '恢复上次的标签页', '空间、层级、别名都在', 'Bring back last session, as it was'],
    ['#8a63d2', ICON.folder, '折叠固定标签', '点空间名,只留正在看的', 'Fold pinned tabs away'],
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
  setFrameDoc(doc);
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
    if (location.search.includes('play')) playAll();
  },
  (e) => {
    window.sceneError = e;
    throw e;
  }
);
