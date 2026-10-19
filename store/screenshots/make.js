// 重新生成应用商店的截图(1280×800)和小宣传图(440×280),中英文各一套:
//   中文 → store/screenshot-*.jpg、store/promo-small-440x280.jpg
//   英文 → store/en/ 下同名文件
// 侧边栏部分直接套用 sidepanel.css,界面改了重新运行即可:npm run screenshots。
// 侧边栏自带的文字(搜索框、清理、新标签页)取自 src/i18n.js,跟着截图的语言
// 需要本机装有 Chrome(路径可用环境变量 CHROME 指定);macOS 上用自带的 sips 转成高质量 JPEG。

import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BRAND_ICONS } from './brand-icons.js';
import { setLangPref, t as ui } from '../../src/i18n.js';

const ROOT = new URL('../../', import.meta.url).pathname;
const CHROME =
  process.env.CHROME ??
  [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome',
  ].find(existsSync);
if (!CHROME) throw new Error('找不到 Chrome,请用环境变量 CHROME 指定路径');

const OUT = mkdtempSync(join(tmpdir(), 'sidearc-shots-'));
copyFileSync(join(ROOT, 'sidepanel.css'), join(OUT, 'sidepanel.css'));
copyFileSync(join(ROOT, 'icons/128.png'), join(OUT, 'logo.png'));
const css = readFileSync(join(ROOT, 'sidepanel.css'), 'utf8');
// 深色截图:把 CSS 里深色模式的变量直接套上,不依赖系统设置
const darkVars = css.match(/@media \(prefers-color-scheme: dark\) \{\s*(:root \{[\s\S]*?\})\s*\}/)[1];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const svgUrl = (svg) => 'data:image/svg+xml,' + encodeURIComponent(svg);
const badge = (letter, bg) =>
  svgUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="3.5" fill="${bg}"/><text x="8" y="11.6" text-anchor="middle" font-family="Segoe UI,Arial,sans-serif" font-size="10" font-weight="700" fill="#fff">${letter}</text></svg>`
  );
const GLOBE = svgUrl(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.5" fill="none" stroke="#999" stroke-width="1.4"/><path d="M1.5 8h13M8 1.5c-4 4.5-4 8.5 0 13M8 1.5c4 4.5 4 8.5 0 13" fill="none" stroke="#999" stroke-width="1.2"/></svg>'
);
const ICON = {
  M: badge('M', '#ea4335'),
  G: badge('G', '#24292f'),
  Y: badge('Y', '#ff0033'),
  F: badge('F', '#a259ff'),
  N: badge('N', '#111'),
  L: badge('L', '#5e6ad2'),
  C: badge('C', '#4285f4'),
  A: badge('A', '#f0913f'),
  D: badge('M', '#1b1b1b'),
  H: badge('H', '#ff6600'),
  T: badge('T', '#1a73e8'),
  K: badge('K', '#0f9d58'),
  globe: GLOBE,
};
// 流行网站的图标(见 brand-icons.js);深色模式下 GitHub 的黑色图标换成浅色,和真实网站图标一致
const brand = (name, dark) => {
  const { color, path } = BRAND_ICONS[name];
  const fill = dark && name === 'github' ? '#f0f0f3' : color;
  return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="${path}"/></svg>`);
};
// 图标:ICON 里的字母徽标,或者直接给的图片地址
const iconSrc = (icon) => ICON[icon] ?? icon;
const svgIcon = (d) =>
  `<span class="i"><svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${d}</svg></span>`;
const SOUND = svgIcon('<path d="M2.5 6.2v3.6h2.3L8 12.5v-9L4.8 6.2z"/><path d="M10.5 5.8a3 3 0 010 4.4M12.3 4a5.5 5.5 0 010 8"/>');
const PLUS = svgIcon('<path d="M8 3.5v9M3.5 8h9"/>');
const FOLDER_OPEN = svgIcon('<path d="M2.5 12V4.5a1 1 0 011-1h3l1.5 1.5h4a1 1 0 011 1v1"/><path d="M2.5 12l1.6-4.3a1 1 0 01.9-.7h8.6l-1.7 5z"/>');
const SEARCH = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/></svg>';
const MORE = '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><circle cx="3" cy="8" r="1.3"/><circle cx="8" cy="8" r="1.3"/><circle cx="13" cy="8" r="1.3"/></svg>';

// 空间的颜色,以及顶部分组在浅色 / 深色下的颜色(Chrome 的分组配色);名字在下面的文案里
const SPACE_COLORS = [
  { color: '#6b7cff', group: ['#1a73e8', '#8ab4f8'] },
  { color: '#4fae6e', group: ['#1e8e3e', '#81c995'] },
  { color: '#f0913f', group: ['#e8710a', '#fcad70'] },
  { color: '#e5687a', group: ['#d93025', '#f28b82'] },
];

// 两种语言的文案:示例内容(空间名、标签页标题、别名)、左侧介绍、小宣传图的副标题。示例内容都是编的
const TEXT = {
  zh: {
    lang: 'zh',
    dir: 'store',
    font: '"PingFang SC",system-ui,sans-serif',
    spaces: ['个人', '工作', '学习', '生活'],
    notion: ['Notion – 项目规划', '规划'],
    linear: 'Linear – 我的任务',
    calendar: '日历',
    folder: '旅行计划',
    trip: ['东京五日游行程表', '行程'],
    stay: ['京都民宿比价清单', '住宿'],
    docs: '文档',
    tips: '十个让浏览器更顺手的小技巧(附快捷键清单)',
    tipsShort: '十个让浏览器更顺手的小技巧',
    promo: '侧边标签栏 · 子标签 · 空间',
    pages: [
      { title: '把标签页<br>放到侧边', sub: '垂直排列,支持子标签和空间,常用的固定在顶部。', bullets: ['标签页竖着排,标题完整可见', '收藏夹和固定标签,一点即达', '固定标签可以分文件夹', '同一个网址只开一份'] },
      { title: '子标签与别名', sub: '从网页里点开的链接自动归到它下面,再给重要的标签页起个名字。', bullets: ['网页里打开的链接自动成为子标签', '拖拽即可归组或移出', '别名显示在标题前,搜索也能搜到', '关错了,Ctrl/⌘+Z 撤销'] },
      { title: '用空间分开<br>工作与生活', sub: '每个空间有自己的主题色、固定标签和标签页。', bullets: ['顶部标签栏的顺序和侧边栏一致', '按空间分组,其他空间自动折叠', '在顶部拖进别的分组,就是换空间', '重启浏览器后自动恢复'] },
    ],
  },
  en: {
    lang: 'en',
    dir: 'store/en',
    font: 'system-ui,-apple-system,"Segoe UI",sans-serif',
    spaces: ['Personal', 'Work', 'Study', 'Life'],
    notion: ['Notion – Project plan', 'Plan'],
    linear: 'Linear – My issues',
    calendar: 'Calendar',
    folder: 'Trip planning',
    trip: ['Tokyo 5-day itinerary', 'Itinerary'],
    stay: ['Kyoto stays – price comparison', 'Stays'],
    docs: 'Docs',
    tips: '10 small tricks for a smoother browser (with shortcuts)',
    tipsShort: '10 small browser tricks',
    promo: 'Vertical tabs · Child tabs · Spaces',
    pages: [
      { title: 'Your tabs,<br>in the sidebar', sub: 'Vertical tabs with child tabs and spaces, and your favorites pinned on top.', bullets: ['Tabs stacked vertically, full titles', 'Favorites and pinned tabs, one click away', 'Organize pinned tabs in folders', 'One tab per address, no duplicates'] },
      { title: 'Child tabs<br>and aliases', sub: 'Links you open land under the page they came from. Give important tabs your own names.', bullets: ['Links from a page become its child tabs', 'Drag to nest or un-nest', 'Aliases show before the title and are searchable', 'Closed by mistake? Ctrl/⌘+Z'] },
      { title: 'Spaces for<br>work and life', sub: 'Each space has its own color and its own tabs.', bullets: ["Chrome's tab strip follows the sidebar order", 'Grouped by space, other spaces collapsed', 'Drag into another group to switch spaces', 'Restored after a browser restart'] },
    ],
  },
};

const row = (icon, title, { alias, cls = '', child, sound } = {}) =>
  `<div class="row ${cls}"${child ? ' style="--depth:1"' : ''}><img class="icon" src="${iconSrc(icon)}">` +
  (alias ? `<span class="alias">${esc(alias)}</span>` : '') +
  `<span class="title">${esc(title)}</span>` +
  (sound ? `<button class="btn">${SOUND}</button>` : '') +
  '</div>';

// 侧边栏:和真实界面同样的结构和样式。folder 为真时固定标签里放一个展开的文件夹。
function panel(t, active, dark, folder) {
  const color = SPACE_COLORS[active].color;
  // 收藏夹(所有空间共用):用流行网站的图标
  const favs = [['gmail', 'open'], ['github', 'open'], ['youtube', ''], ['figma', ''], ['spotify', '']]
    .map(([k, c]) => `<div class="tile ${c}"><img class="icon" src="${brand(k, dark)}"></div>`)
    .join('');
  const notion = row('N', t.notion[0], { alias: t.notion[1], cls: 'open' });
  const pins = folder
    ? notion +
      `<div class="row folder expanded">${FOLDER_OPEN}<span class="title">${esc(t.folder)}</span></div>` +
      row('T', t.trip[0], { alias: t.trip[1], cls: 'open', child: true }) +
      row('K', t.stay[0], { alias: t.stay[1], child: true })
    : notion + row('L', t.linear, { cls: 'open' }) + row('globe', t.calendar);
  const tabs =
    row('C', 'chrome.sidePanel | API | Chrome for Developers', { alias: t.docs, cls: 'active' }) +
    row('A', t.tips, { child: true }) +
    row('D', 'MDN Web Docs – color-mix()', { child: true }) +
    row(brand('youtube', dark), 'lofi hip hop radio – beats to relax/study to', { alias: 'BGM', sound: true }) +
    row('H', 'Hacker News', { cls: 'discarded' });
  const dots = SPACE_COLORS.map((s, i) => `<button class="space-dot${i === active ? ' on' : ''}"><i style="color:${s.color}"></i></button>`).join('');
  return `<!doctype html><html style="--accent:${color};color-scheme:${dark ? 'dark' : 'light'}"><head><meta charset="utf-8">
<link rel="stylesheet" href="sidepanel.css">${dark ? `<style>${darkVars}</style>` : ''}</head><body>
<header><label class="search">${SEARCH}<input id="search" placeholder="${ui('searchPlaceholder')}"></label></header>
<main id="scroll"><section id="favs" class="zone grid" style="--cols:5">${favs}</section>
<div class="space-head"><span id="space-name">${esc(t.spaces[active])}</span><button class="ghost">${MORE}</button></div>
<section id="pins" class="zone list">${pins}</section>
<div class="divider"><span></span><button class="ghost">${ui('clear')}</button></div>
<button class="row new">${PLUS}<span class="title">${ui('newTab')}</span></button>
<section id="tabs" class="zone list">${tabs}</section></main>
<footer id="spaces">${dots}<button class="space-dot">${PLUS}</button></footer></body></html>`;
}

// 顶部标签栏(示意):收藏的标签页在最左边,然后每个空间一个分组,当前空间展开,其他折叠
function strip(t, active, dark, folder) {
  const tab = (icon, title, cls = '') => `<div class="tab ${cls}"><img src="${iconSrc(icon)}"><span>${esc(title)}</span></div>`;
  let out = tab(brand('gmail', dark), 'Gmail', 'fav') + tab(brand('github', dark), 'GitHub', 'fav');
  SPACE_COLORS.forEach((s, i) => {
    const g = s.group[dark ? 1 : 0];
    const chip = `<div class="chip" style="--g:${g}">${esc(t.spaces[i])}</div>`;
    if (i !== active) return (out += chip);
    out +=
      chip +
      `<div class="group" style="--g:${g}">` +
      tab('N', t.notion[0]) +
      (folder ? tab('T', t.trip[0]) : tab('L', t.linear)) +
      tab('C', 'chrome.sidePanel', 'on') +
      tab('A', t.tipsShort) +
      tab('D', 'MDN Web Docs') +
      tab(brand('youtube', dark), 'lofi hip hop radio') +
      tab('H', 'Hacker News') +
      '</div>';
  });
  return out + '<div class="newtab">+</div>';
}

// 把 OUT 里的一个 HTML 截成 JPEG:先出 PNG 再用 sips 转(画质好);没有 sips(非 macOS)就直接让 Chrome 出 JPEG
function capture(html, file, [w, h]) {
  const png = join(OUT, html.replace(/\.html$/, '.png'));
  const flags = ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', `--window-size=${w},${h}`];
  const shoot = (to) => execFileSync(CHROME, [...flags, `--screenshot=${to}`, 'file://' + join(OUT, html)], { stdio: 'ignore' });
  try {
    shoot(png);
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '90', png, '--out', file], { stdio: 'ignore' });
  } catch {
    shoot(file);
  }
  console.log('已生成', file.slice(ROOT.length));
}

function page(t, { file, active, dark, folder }, { title, sub, bullets }) {
  const n = `${t.dir.replace(/\W/g, '-')}-${file}`;
  writeFileSync(join(OUT, `panel-${n}.html`), panel(t, active, dark, folder));
  const { color } = SPACE_COLORS[active];
  const c = dark
    ? { bg: 'linear-gradient(135deg,#1c1c22,#24212a 60%,#2a2027)', fg: '#f3f3f7', fg2: '#a9a9b5', win: '#232327', bar: '#2b2b30', line: 'rgba(255,255,255,.08)', ph: '#333338', tab: '#3a3a40', tabFg: '#e8e8ee', toolbar: '#2f2f35', lights: '#55555c', chipFg: '#202124', shadow: '.45' }
    : { bg: 'linear-gradient(135deg,#eef0ff,#f4f2fb 55%,#f7eef3)', fg: '#1d1d24', fg2: '#5f6170', win: '#fff', bar: '#f1f1f4', line: 'rgba(0,0,0,.08)', ph: '#ececef', tab: '#fff', tabFg: '#2a2a30', toolbar: '#fff', lights: '#d7d7dc', chipFg: '#fff', shadow: '.16' };
  writeFileSync(
    join(OUT, `shot-${n}.html`),
    `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0} body{width:1280px;height:800px;overflow:hidden;background:${c.bg};font-family:${t.font};color:${c.fg};-webkit-font-smoothing:antialiased}
.copy{position:absolute;left:64px;top:50%;transform:translateY(-50%);width:410px}
.brand{display:flex;align-items:center;gap:12px;font-weight:700;font-size:20px;margin-bottom:28px} .brand img{width:40px;height:40px}
h1{font-size:46px;line-height:1.22;font-weight:800;letter-spacing:.5px} .sub{margin:16px 0 26px;font-size:18px;line-height:1.65;color:${c.fg2}}
ul{list-style:none;padding:0;font-size:17px;line-height:1.5} li{position:relative;padding-left:20px;margin:9px 0}
li::before{content:"";position:absolute;left:0;top:7px;width:10px;height:10px;border-radius:50%;background:${color};box-shadow:0 0 0 3px color-mix(in srgb,${color} 25%,transparent)}
.win{position:absolute;left:516px;top:62px;width:700px;height:676px;border-radius:14px;overflow:hidden;background:${c.win};box-shadow:0 0 0 1px ${c.line},0 30px 70px rgba(0,0,0,${c.shadow})}
.strip{height:40px;background:${c.bar};display:flex;align-items:flex-end;gap:2px;padding:0 10px 0 78px;position:relative}
.lights{position:absolute;left:16px;top:15px;display:flex;gap:8px} .lights i{width:11px;height:11px;border-radius:50%;background:${c.lights}}
.tab{flex:1 1 0;min-width:0;height:32px;display:flex;align-items:center;gap:6px;padding:0 9px;border-radius:9px 9px 0 0;font-size:11.5px;color:${c.fg2};white-space:nowrap;overflow:hidden}
.tab img{width:14px;height:14px;flex:none} .tab span{overflow:hidden;mask-image:linear-gradient(90deg,#000 70%,transparent)}
.tab.on{background:${c.tab};color:${c.tabFg};flex:none;width:132px} .tab.fav{flex:none;width:34px;padding:0 10px} .tab.fav span{display:none}
.group{display:flex;flex:1 1 0;min-width:0;gap:2px;border-bottom:2px solid var(--g);align-self:stretch;align-items:flex-end}
.chip{flex:none;align-self:center;margin:4px 2px 0 6px;padding:2px 9px;border-radius:7px;background:var(--g);color:${c.chipFg};font-size:11.5px;font-weight:600}
.newtab{flex:none;width:28px;height:28px;display:grid;place-items:center;align-self:center;color:${c.fg2};font-size:18px}
.toolbar{height:40px;background:${c.toolbar};display:flex;align-items:center;padding:0 14px;border-bottom:1px solid ${c.line}}
.url{flex:1;height:26px;border-radius:13px;background:${c.bar}}
.body{display:flex;height:596px} iframe{width:340px;height:100%;border:0;border-right:1px solid ${c.line}}
.content{flex:1;padding:34px 28px} .content i{display:block;height:14px;border-radius:7px;background:${c.ph};margin-bottom:14px}
</style></head><body>
<div class="copy"><div class="brand"><img src="logo.png">Sidearc</div><h1>${title}</h1><p class="sub">${esc(sub)}</p><ul>${bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul></div>
<div class="win"><div class="strip"><div class="lights"><i></i><i></i><i></i></div>${strip(t, active, dark, folder)}</div>
<div class="toolbar"><div class="url"></div></div>
<div class="body"><iframe src="panel-${n}.html"></iframe><div class="content">
<i style="width:42%;height:26px;border-radius:8px;margin-bottom:24px"></i><i></i><i style="width:92%"></i><i style="width:80%"></i>
<i style="height:150px;border-radius:14px;margin:24px 0"></i><i></i><i style="width:88%"></i><i style="width:60%"></i></div></div></div>
</body></html>`
  );
  capture(`shot-${n}.html`, join(ROOT, t.dir, `screenshot-${file}.jpg`), [1280, 800]);
}

// 小宣传图(440×280):渐变底,半透明方块里是白色的侧边栏图形,下面是名字和一句副标题
function promo(t) {
  const n = `promo-${t.dir.replace(/\W/g, '-')}.html`;
  writeFileSync(
    join(OUT, n),
    `<!doctype html><html><head><meta charset="utf-8"><style>
*{margin:0;box-sizing:border-box} body{width:440px;height:280px;overflow:hidden;display:flex;flex-direction:column;align-items:center;
background:linear-gradient(135deg,#6b7cff 0%,#a06be0 50%,#e5687a 100%);font-family:${t.font};color:#fff;-webkit-font-smoothing:antialiased}
.mark{margin-top:32px;width:112px;height:112px;border-radius:24px;background:rgba(255,255,255,.18);display:flex;gap:7px;padding:17px 15px}
.mark i{border-radius:6px;background:#fff} .mark i:first-child{width:18px} .mark i:last-child{flex:1;background:rgba(255,255,255,.62)}
h1{margin-top:22px;font-family:system-ui,-apple-system,sans-serif;font-size:40px;font-weight:800;letter-spacing:.5px} p{margin-top:12px;font-size:15px;opacity:.88}
</style></head><body><div class="mark"><i></i><i></i></div><h1>Sidearc</h1><p>${esc(t.promo)}</p></body></html>`
  );
  capture(n, join(ROOT, t.dir, 'promo-small-440x280.jpg'), [440, 280]);
}

const SHOTS = [
  { file: '1-tabs', active: 0, dark: false, folder: true },
  { file: '2-child-tabs', active: 2, dark: false },
  { file: '3-spaces-dark', active: 1, dark: true },
];
for (const t of Object.values(TEXT)) {
  setLangPref(t.lang);
  mkdirSync(join(ROOT, t.dir), { recursive: true });
  SHOTS.forEach((shot, i) => page(t, shot, t.pages[i]));
  promo(t);
}
