// 视频画面共用的内容:图标、标签页的网址和标题、侧边栏的行、顶部标签栏的标签页。
// 介绍视频(scene.js)和竖屏短片(short.js)都用;网页的标题和图标来自在线试用的 demo/web.js,结构和插件的 render.js 一样。

import { BRAND_ICONS } from '../../demo/brand-icons.js';
import { iconFor, page } from '../../demo/web.js';

// ---------- 图标 ----------

export const stroke = (d) => `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
export const SPEAKER = '<path d="M2.5 6.2v3.6h2.3L8 12.5v-9L4.8 6.2z"/>';
export const ICON = {
  search: '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/></svg>',
  more: '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><circle cx="3" cy="8" r="1.3"/><circle cx="8" cy="8" r="1.3"/><circle cx="13" cy="8" r="1.3"/></svg>',
  plus: stroke('<path d="M8 3.5v9M3.5 8h9"/>'),
  minus: stroke('<path d="M4 8h8"/>'),
  close: stroke('<path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/>'),
  sound: stroke(SPEAKER + '<path d="M10.5 5.8a3 3 0 010 4.4"/><path d="M12.3 4a5.5 5.5 0 010 8"/>'),
  sleep: stroke('<path d="M13 9.5A5.5 5.5 0 116.5 3a4.3 4.3 0 006.5 6.5z"/>'),
  outdent: stroke('<path d="M7.5 4h6M7.5 8h6M7.5 12h6"/><path d="M4.5 6L2.5 8l2 2"/>'),
  back: stroke('<path d="M6 3.5L3 6.5l3 3"/><path d="M3 6.5h6.5a3.5 3.5 0 010 7H8"/>'),
  chevron: stroke('<path class="chev" d="M6 3.8l4.2 4.2L6 12.2"/>'),
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
export const GITHUB_MARK = `<svg viewBox="0 0 24 24"><path fill="currentColor" d="${BRAND_ICONS.github.path}"/></svg>`;

// ---------- 内容:标签页、空间、网页(网页的标题和图标来自 demo/web.js) ----------

export const U = {
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
export const P = (key) => page(U[key], 'zh');
export const TITLE = { tg: 'chrome.tabGroups | API | Chrome for Developers', mv3: '迁移到 Manifest V3 | Chrome for Developers' };
export const title = (key) => TITLE[key] ?? P(key).title;
export const short = (key) => title(key).split(/ [–|-] /)[0];
export const SPACES = [
  { name: '个人', color: '#6b7cff', group: 'blue' },
  { name: '工作', color: '#4fae6e', group: 'green' },
  { name: '学习', color: '#f0913f', group: 'orange' },
];

// 侧边栏里的行,结构和插件的 render.js 一样
export const row = (id, key, { kind = 'tab', alias, depth, cls: c = '', sound, open = true, slept } = {}) =>
  `<div class="row ${c}" id="${id}" data-kind="${kind}"${depth ? ' style="--depth:1"' : ''}><img class="icon" src="${iconFor(U[key])}" alt="">` +
  (alias ? `<span class="alias">${alias}</span>` : '') +
  `<span class="title">${title(key)}</span>` +
  (slept ? `<span class="slept">${slept}</span>` : '') +
  (sound ? `<button class="btn playing">${ICON.sound}</button>` : '') +
  (kind === 'tab' && depth ? `<button class="btn x">${ICON.outdent}</button>` : '') +
  (open ? `<button class="btn x v-moon">${ICON.sleep}</button>` : '') +
  `<button class="btn x">${kind === 'tab' ? ICON.close : ICON.minus}</button></div>`;

// 顶部标签栏的标签页,结构和在线试用(demo/demo.js)一样
export const stab = (id, key, { color, active } = {}) =>
  `<div class="sb-tab${color ? ' grouped' : ''}${active ? ' active' : ''}"${id ? ` id="s-${id}"` : ''}${color ? ` data-color="${color}"` : ''}><img src="${iconFor(U[key] ?? key)}" alt=""><span class="sb-title">${U[key] ? short(key) : key}</span><button class="sb-x">${stroke('<path d="M5 5l6 6M11 5l-6 6"/>')}</button></div>`;
