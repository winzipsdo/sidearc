// 在线试用里的「网」:每个网址对应一个简单的假网页(标题、图标、几段文字、可以点的链接),
// 以及打开试用时的初始状态(空间、收藏、固定标签、已经开着的标签页)。内容都是编的。

import { BRAND_ICONS } from './brand-icons.js?v=15555cae';

const svgUrl = (svg) => 'data:image/svg+xml,' + encodeURIComponent(svg);
const badge = (letter, bg) =>
  svgUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="3.5" fill="${bg}"/><text x="8" y="11.6" text-anchor="middle" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="10" font-weight="700" fill="#fff">${letter}</text></svg>`
  );
const brand = (name) => {
  const { color, path } = BRAND_ICONS[name];
  return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${color}" d="${path}"/></svg>`);
};
export const GLOBE = svgUrl(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.5" fill="none" stroke="#999" stroke-width="1.4"/><path d="M1.5 8h13M8 1.5c-4 4.5-4 8.5 0 13M8 1.5c4 4.5 4 8.5 0 13" fill="none" stroke="#999" stroke-width="1.2"/></svg>'
);

// 网站:图标和主色(页面顶部那条颜色)
const SITES = {
  'mail.google.com': { name: 'Gmail', icon: brand('gmail'), color: '#ea4335' },
  'github.com': { name: 'GitHub', icon: brand('github'), color: '#24292f' },
  'www.youtube.com': { name: 'YouTube', icon: brand('youtube'), color: '#ff0033' },
  'www.figma.com': { name: 'Figma', icon: brand('figma'), color: '#a259ff' },
  'open.spotify.com': { name: 'Spotify', icon: brand('spotify'), color: '#1db954' },
  'www.notion.so': { name: 'Notion', icon: badge('N', '#111'), color: '#37352f' },
  'docs.google.com': { name: 'Google Docs', icon: badge('D', '#1a73e8'), color: '#1a73e8' },
  'www.airbnb.com': { name: 'Airbnb', icon: badge('A', '#ff385c'), color: '#ff385c' },
  'developer.chrome.com': { name: 'Chrome for Developers', icon: badge('C', '#4285f4'), color: '#4285f4' },
  'developer.mozilla.org': { name: 'MDN', icon: badge('M', '#1b1b1b'), color: '#1b1b1b' },
  'news.ycombinator.com': { name: 'Hacker News', icon: badge('Y', '#ff6600'), color: '#ff6600' },
  'linear.app': { name: 'Linear', icon: badge('L', '#5e6ad2'), color: '#5e6ad2' },
  'calendar.google.com': { name: 'Google Calendar', icon: badge('31', '#1a73e8'), color: '#1a73e8' },
  'app.slack.com': { name: 'Slack', icon: badge('S', '#4a154b'), color: '#4a154b' },
  'ankiweb.net': { name: 'AnkiWeb', icon: badge('A', '#2a6fdb'), color: '#2a6fdb' },
  'zh.wikipedia.org': { name: '维基百科', icon: badge('W', '#3a3a3a'), color: '#3a3a3a' },
  'en.wikipedia.org': { name: 'Wikipedia', icon: badge('W', '#3a3a3a'), color: '#3a3a3a' },
  'typst.app': { name: 'Typst', icon: badge('t', '#239dad'), color: '#239dad' },
  'www.google.com': { name: 'Google', icon: badge('G', '#4285f4'), color: '#4285f4' },
};
const hostOf = (url) => {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
};
// 没登记的网站:用首字母和按网址算出的颜色做图标
function siteOf(url) {
  const host = hostOf(url);
  if (SITES[host]) return SITES[host];
  const name = host.replace(/^www\./, '') || url;
  const hue = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  return { name, icon: badge(name[0]?.toUpperCase() || '?', `hsl(${hue} 55% 45%)`), color: `hsl(${hue} 55% 45%)` };
}
export const iconFor = (url) => (/^https?:/.test(url) ? siteOf(url).icon : GLOBE);

export const NEW_TAB = 'chrome://newtab/';
const L = (zh, en) => ({ zh, en });

// 页面:title 是标签页标题;links 里 newTab 为真的会在新标签页打开(变成当前标签页的子标签),其余在本页跳转
const PAGES = {
  'https://mail.google.com/mail/u/0/#inbox': {
    title: L('收件箱 (3) - Gmail', 'Inbox (3) - Gmail'),
    text: L('三封未读:周会改到周四、机票确认单、开源项目的新 Issue。', 'Three unread: the weekly sync moved to Thursday, a flight confirmation, and a new issue on the open-source project.'),
    links: [
      { label: L('机票确认单 – 东京', 'Flight confirmation – Tokyo'), url: 'https://docs.google.com/document/d/tokyo-trip', newTab: true },
      { label: L('新 Issue:支持更多语言', 'New issue: more languages'), url: 'https://github.com/winzipsdo/sidearc/issues/42', newTab: true },
    ],
  },
  'https://github.com/winzipsdo/sidearc': {
    title: L('winzipsdo/sidearc: Arc 风格的 Chrome 侧边标签栏', 'winzipsdo/sidearc: Arc-style vertical tabs for Chrome'),
    text: L('Arc 风格的 Chrome 侧边标签栏:子标签、空间、固定标签和收藏夹,和顶部标签栏保持同步。', 'Arc-style vertical tabs for Chrome: child tabs, spaces, pinned tabs and favorites, synced with the tab strip.'),
    links: [
      { label: L('Pull requests', 'Pull requests'), url: 'https://github.com/winzipsdo/sidearc/pulls' },
      { label: L('Releases', 'Releases'), url: 'https://github.com/winzipsdo/sidearc/releases', newTab: true },
      { label: L('CHANGELOG.md', 'CHANGELOG.md'), url: 'https://github.com/winzipsdo/sidearc/blob/main/CHANGELOG.md', newTab: true },
    ],
  },
  'https://www.youtube.com/': {
    title: L('YouTube', 'YouTube'),
    links: [{ label: L('lofi hip hop radio – beats to relax/study to', 'lofi hip hop radio – beats to relax/study to'), url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk' }],
  },
  'https://www.youtube.com/watch?v=jfKfPfyJRdk': {
    title: L('lofi hip hop radio – beats to relax/study to', 'lofi hip hop radio – beats to relax/study to'),
    media: true,
    links: [{ label: L('3Blue1Brown – 贝叶斯定理', '3Blue1Brown – Bayes theorem'), url: 'https://www.youtube.com/watch?v=HZGCoVF3YvM', newTab: true }],
  },
  'https://www.figma.com/files/recent': {
    title: L('最近的文件 – Figma', 'Recents – Figma'),
    links: [{ label: L('首页改版 v3', 'Homepage redesign v3'), url: 'https://www.figma.com/design/home-v3', newTab: true }],
  },
  'https://open.spotify.com/': { title: L('Spotify – 网页播放器', 'Spotify – Web Player'), media: true },
  'https://www.notion.so/sidearc/project-plan': {
    title: L('Notion – 项目规划', 'Notion – Project plan'),
    text: L('这是一个固定标签。点下面的链接在本页跳转,侧边栏这一行会显示你现在在哪,右边的 ↩ 一键回到固定的地址。', 'This is a pinned tab. Follow a link below and its row shows where you went; the ↩ on the right takes you back home.'),
    links: [
      { label: L('本周笔记', 'Weekly notes'), url: 'https://www.notion.so/sidearc/weekly-notes' },
      { label: L('发布计划', 'Release plan'), url: 'https://www.notion.so/sidearc/release-plan' },
    ],
  },
  'https://www.notion.so/sidearc/weekly-notes': {
    title: L('Notion – 本周笔记', 'Notion – Weekly notes'),
    text: L('看看侧边栏:固定的「规划」这一行现在显示的是本周笔记,点右边的 ↩ 回到项目规划。', 'Look at the sidebar: the pinned “Plan” row now shows Weekly notes. Click ↩ on the right to go back.'),
    links: [{ label: L('发布计划', 'Release plan'), url: 'https://www.notion.so/sidearc/release-plan' }],
  },
  'https://www.notion.so/sidearc/release-plan': {
    title: L('Notion – 发布计划', 'Notion – Release plan'),
    text: L('固定标签记得它的「家」:跑远了也能一键回去。', 'Pinned tabs remember home: wander off, come back with one click.'),
    links: [{ label: L('本周笔记', 'Weekly notes'), url: 'https://www.notion.so/sidearc/weekly-notes' }],
  },
  'https://docs.google.com/document/d/tokyo-trip': {
    title: L('东京五日游行程表 – Google 文档', 'Tokyo 5-day itinerary – Google Docs'),
    links: [{ label: L('京都民宿比价清单', 'Kyoto stays – wishlist'), url: 'https://www.airbnb.com/wishlists/kyoto', newTab: true }],
  },
  'https://www.airbnb.com/wishlists/kyoto': { title: L('京都民宿比价清单 – Airbnb', 'Kyoto stays – Airbnb') },
  'https://developer.chrome.com/docs/extensions/reference/api/sidePanel': {
    title: L('chrome.sidePanel | API | Chrome for Developers', 'chrome.sidePanel | API | Chrome for Developers'),
    text: L('点带 ↗ 的链接:新标签页会自动挂在这一页下面,成为它的子标签。', 'Click a link marked ↗: the new tab lands under this page as its child.'),
    links: [
      { label: L('chrome.tabGroups API', 'chrome.tabGroups API'), url: 'https://developer.chrome.com/docs/extensions/reference/api/tabGroups', newTab: true },
      { label: L('迁移到 Manifest V3', 'Migrate to Manifest V3'), url: 'https://developer.chrome.com/docs/extensions/develop/migrate', newTab: true },
      { label: L('chrome.tabs API', 'chrome.tabs API'), url: 'https://developer.chrome.com/docs/extensions/reference/api/tabs', newTab: true },
    ],
  },
  'https://developer.mozilla.org/docs/Web/CSS/color_value/color-mix': {
    title: L('color-mix() - CSS | MDN', 'color-mix() - CSS | MDN'),
    text: L('这个标签页是从上面的文档里打开的,所以缩进在它下面。', 'This tab was opened from the docs above, so it sits under them.'),
    links: [{ label: L('oklch()', 'oklch()'), url: 'https://developer.mozilla.org/docs/Web/CSS/color_value/oklch', newTab: true }],
  },
  'https://news.ycombinator.com/': {
    title: L('Hacker News', 'Hacker News'),
    links: [
      { label: L('Show HN: Sidearc – Arc 风格的 Chrome 侧边标签栏', 'Show HN: Sidearc – Arc-style vertical tabs for Chrome'), url: 'https://github.com/winzipsdo/sidearc', newTab: true },
      { label: L('为什么我们总开着 80 个标签页', 'Why we all keep 80 tabs open'), url: 'https://tabs.blog/80-tabs', newTab: true },
      { label: L('浏览器的「节省内存」是怎么工作的', 'How browser memory saver works'), url: 'https://chromium.dev/memory-saver', newTab: true },
    ],
  },
  'https://linear.app/sidearc/my-issues': {
    title: L('我的任务 › Linear', 'My issues › Linear'),
    links: [{ label: L('SID-128 拖拽同步到顶部标签栏', 'SID-128 Sync drags to the tab strip'), url: 'https://linear.app/sidearc/issue/SID-128', newTab: true }],
  },
  'https://calendar.google.com/': { title: L('Google 日历', 'Google Calendar') },
  'https://www.figma.com/design/home-v3': { title: L('首页改版 v3 – Figma', 'Homepage redesign v3 – Figma') },
  'https://github.com/winzipsdo/sidearc/pulls': {
    title: L('Pull requests · winzipsdo/sidearc', 'Pull requests · winzipsdo/sidearc'),
    links: [{ label: L('构建 #128', 'Build #128'), url: 'https://github.com/winzipsdo/sidearc/actions/runs/128', newTab: true }],
  },
  'https://github.com/winzipsdo/sidearc/actions/runs/128': { title: L('构建 #128 · winzipsdo/sidearc', 'Build #128 · winzipsdo/sidearc') },
  'https://app.slack.com/client/design': { title: L('#design – Slack', '#design – Slack') },
  'https://ankiweb.net/decks': { title: L('每日复习 – AnkiWeb', 'Daily review – AnkiWeb') },
  'https://zh.wikipedia.org/wiki/贝叶斯定理': {
    title: L('贝叶斯定理 - 维基百科', 'Bayes’ theorem - Wikipedia'),
    links: [
      { label: L('条件概率', 'Conditional probability'), url: 'https://zh.wikipedia.org/wiki/条件概率', newTab: true },
      { label: L('先验概率', 'Prior probability'), url: 'https://zh.wikipedia.org/wiki/先验概率', newTab: true },
    ],
  },
  'https://en.wikipedia.org/wiki/Bayes%27_theorem': {
    title: L('贝叶斯定理 - 维基百科', 'Bayes’ theorem - Wikipedia'),
    links: [
      { label: L('条件概率', 'Conditional probability'), url: 'https://en.wikipedia.org/wiki/Conditional_probability', newTab: true },
      { label: L('先验概率', 'Prior probability'), url: 'https://en.wikipedia.org/wiki/Prior_probability', newTab: true },
    ],
  },
  'https://www.youtube.com/watch?v=HZGCoVF3YvM': { title: L('贝叶斯定理,以及证据如何改变信念 – 3Blue1Brown', 'Bayes theorem, the geometry of changing beliefs – 3Blue1Brown'), media: true },
  'https://typst.app/docs/reference/math/': { title: L('数学公式 – Typst 文档', 'Math – Typst Documentation') },
};

// 新标签页上的快捷方式。有几个已经开着(或是收藏):点它们能看到「相同网址只开一份」
export const tiles = (lang) => [
  'https://news.ycombinator.com/',
  'https://mail.google.com/mail/u/0/#inbox',
  'https://github.com/winzipsdo/sidearc',
  'https://www.youtube.com/watch?v=jfKfPfyJRdk',
  'https://www.figma.com/files/recent',
  lang === 'zh' ? 'https://zh.wikipedia.org/wiki/贝叶斯定理' : 'https://en.wikipedia.org/wiki/Bayes%27_theorem',
];

// 网址 → 页面(按当前语言)。没写的网址按地址生成一个
export function page(url, lang) {
  const pick = (v) => (v && typeof v === 'object' ? v[lang] : v);
  if (url === NEW_TAB) return { kind: 'newtab', title: lang === 'zh' ? '新标签页' : 'New Tab', icon: undefined };
  if (/^chrome:/.test(url)) return { kind: 'internal', title: url, icon: undefined, text: lang === 'zh' ? '这是 Chrome 自己的页面,在线试用里没有。' : 'This is one of Chrome’s own pages; it isn’t part of the demo.' };
  const site = siteOf(url);
  const p = PAGES[url] ?? PAGES[decodeURI(url)];
  const search = hostOf(url) === 'www.google.com' && new URL(url).searchParams.get('q');
  if (search) {
    return {
      kind: 'page',
      site,
      title: `${search} - Google ${lang === 'zh' ? '搜索' : 'Search'}`,
      icon: site.icon,
      links: [1, 2, 3].map((n) => ({ label: `${search} – ${lang === 'zh' ? '结果' : 'result'} ${n}`, url: `https://${search.replace(/\W+/g, '-').toLowerCase() || 'result'}.example.com/${n}`, newTab: n > 1 })),
    };
  }
  if (p) return { kind: 'page', site, title: pick(p.title), icon: site.icon, text: pick(p.text), media: p.media, links: (p.links ?? []).map((l) => ({ ...l, label: pick(l.label) })) };
  const last = decodeURIComponent(url.replace(/[?#].*$/, '').replace(/\/$/, '').split('/').pop() || site.name).replace(/[-_]+/g, ' ');
  return { kind: 'page', site, title: `${last} – ${site.name}`, icon: site.icon, links: [] };
}

// 打开试用时的样子。三个空间:个人(当前)、工作、学习。
// tabs 里每一项是一个开着的标签页:space 归哪个空间;item 绑定到哪个收藏/固定项;parent 是父标签页;
// slept 是已经休眠了多久(分钟);trail 是多少分钟前离开的(足迹);playing 是正在放声音
export function scenario(lang) {
  const z = lang === 'zh';
  const item = (id, url, alias) => ({ id, url, title: page(url, lang).title, ...(alias && { alias }) });
  const state = {
    favorites: [
      item('f-gmail', 'https://mail.google.com/mail/u/0/#inbox'),
      item('f-github', 'https://github.com/winzipsdo/sidearc'),
      item('f-youtube', 'https://www.youtube.com/'),
      item('f-figma', 'https://www.figma.com/files/recent'),
      item('f-spotify', 'https://open.spotify.com/'),
    ],
    spaces: [
      {
        id: 's-me',
        name: z ? '个人' : 'Personal',
        color: '#6b7cff',
        pinned: [
          item('p-notion', 'https://www.notion.so/sidearc/project-plan', z ? '规划' : 'Plan'),
          {
            id: 'd-trip',
            folder: true,
            name: z ? '旅行计划' : 'Trip planning',
            open: true,
            items: [item('p-trip', 'https://docs.google.com/document/d/tokyo-trip', z ? '行程' : 'Plan'), item('p-stay', 'https://www.airbnb.com/wishlists/kyoto', z ? '住宿' : 'Stays')],
          },
        ],
      },
      {
        id: 's-work',
        name: z ? '工作' : 'Work',
        color: '#4fae6e',
        pinned: [item('p-linear', 'https://linear.app/sidearc/my-issues'), item('p-cal', 'https://calendar.google.com/')],
      },
      { id: 's-study', name: z ? '学习' : 'Study', color: '#f0913f', pinned: [item('p-anki', 'https://ankiweb.net/decks', z ? '复习' : 'Review')] },
    ],
    activeSpaceId: 's-me',
  };
  const wiki = z ? 'https://zh.wikipedia.org/wiki/贝叶斯定理' : 'https://en.wikipedia.org/wiki/Bayes%27_theorem';
  const tabs = [
    { key: 'gmail', url: 'https://mail.google.com/mail/u/0/#inbox', item: 'f-gmail', trail: 6 },
    { key: 'notion', url: 'https://www.notion.so/sidearc/project-plan', item: 'p-notion' },
    { key: 'trip', url: 'https://docs.google.com/document/d/tokyo-trip', item: 'p-trip' },
    { key: 'docs', url: 'https://developer.chrome.com/docs/extensions/reference/api/sidePanel', space: 's-me', alias: z ? '文档' : 'Docs', active: true },
    { key: 'mdn', url: 'https://developer.mozilla.org/docs/Web/CSS/color_value/color-mix', space: 's-me', parent: 'docs', trail: 2 },
    { key: 'lofi', url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk', space: 's-me', alias: 'BGM', playing: true },
    { key: 'hn', url: 'https://news.ycombinator.com/', space: 's-me', slept: 135 },
    { key: 'linear', url: 'https://linear.app/sidearc/my-issues', item: 'p-linear' },
    { key: 'figma', url: 'https://www.figma.com/design/home-v3', space: 's-work' },
    { key: 'pr', url: 'https://github.com/winzipsdo/sidearc/pulls', space: 's-work' },
    { key: 'build', url: 'https://github.com/winzipsdo/sidearc/actions/runs/128', space: 's-work', parent: 'pr' },
    { key: 'slack', url: 'https://app.slack.com/client/design', space: 's-work', slept: 50 },
    { key: 'anki', url: 'https://ankiweb.net/decks', item: 'p-anki' },
    { key: 'wiki', url: wiki, space: 's-study' },
    { key: '3b1b', url: 'https://www.youtube.com/watch?v=HZGCoVF3YvM', space: 's-study', parent: 'wiki' },
    { key: 'typst', url: 'https://typst.app/docs/reference/math/', space: 's-study' },
  ];
  return { state, tabs };
}
