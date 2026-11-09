// 主页的脚本:切换中英文、在线试用和任务清单、滚动淡入、视频的播放按钮、复制命令。

import { mountDemo } from './demo/demo.js?v=5b8fd442';

const root = document.documentElement;
const store = {
  get: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {}
  },
};

// ---------- 语言:中文页和英文页是两个网址(source/pages.js 生成),右上角的按钮是到另一个的链接 ----------
// 记住选择:下次直接打开另一种语言(页面开头的脚本会跳过去)

document.getElementById('lang').addEventListener('click', () => store.set('lang', root.dataset.lang === 'zh' ? 'en' : 'zh'));

// 第一次来、浏览器语言和这个页面不一样:顶部提示一句有另一种语言的版本。只提示不跳转,
// 搜索引擎的爬虫(浏览器语言多半是英文)照样能收录中文页
const browserLang = /^zh\b/i.test(navigator.language) ? 'zh' : 'en';
if (browserLang !== root.dataset.lang && !store.get('lang')) {
  const zh = browserLang === 'zh';
  const bar = document.createElement('div');
  bar.className = 'lang-hint';
  bar.lang = zh ? 'zh-CN' : 'en';
  bar.innerHTML = zh
    ? '这个页面有中文版。<a href="../">查看中文版 ›</a><button type="button" aria-label="关闭">×</button>'
    : 'This page is also available in English. <a href="en/">View in English ›</a><button type="button" aria-label="Close">×</button>';
  bar.querySelector('a').addEventListener('click', () => store.set('lang', browserLang));
  bar.querySelector('button').addEventListener('click', () => {
    store.set('lang', root.dataset.lang);
    bar.remove();
  });
  document.body.prepend(bar);
}

// ---------- 浅色 / 深色:默认跟随系统,点右上角的按钮在两者之间切换,记住选择(页面开头的脚本会先套上) ----------

const dark = matchMedia('(prefers-color-scheme: dark)');
const themeBtn = document.getElementById('theme');
const themeNow = () => root.dataset.theme || (dark.matches ? 'dark' : 'light');
function showTheme() {
  root.dataset.themeNow = themeNow();
  const toDark = themeNow() === 'light';
  const zh = root.dataset.lang === 'zh';
  themeBtn.setAttribute('aria-label', zh ? (toDark ? '切换到深色' : '切换到浅色') : toDark ? 'Switch to dark' : 'Switch to light');
  themeBtn.title = themeBtn.getAttribute('aria-label');
}
themeBtn.addEventListener('click', () => {
  const next = themeNow() === 'dark' ? 'light' : 'dark';
  // 选的和系统一样:不再写死,以后跟着系统走
  if ((next === 'dark') === dark.matches) {
    delete root.dataset.theme;
    store.set('theme', '');
  } else {
    root.dataset.theme = next;
    store.set('theme', next);
  }
  showTheme();
});
dark.addEventListener('change', showTheme);
showTheme();

// 当前版本号(由 source/build.js 从 main 的 manifest.json 写进来)
fetch(new URL('ext/version.json', import.meta.url))
  .then((r) => r.json())
  .then(({ version }) => (document.getElementById('ver').textContent = 'v' + version))
  .catch(() => {});

// ---------- 在线试用的任务清单 ----------

// on:试用里发生了哪些操作就算完成(见 demo/demo.js 的 onAction)
const TASKS = [
  {
    id: 'drag',
    on: ['sidebarDrag', 'stripDrag'],
    zh: ['拖动一个标签页', '在侧边栏里上下拖一行,或者拖顶部标签栏里的标签页:另一边跟着变。'],
    en: ['Drag a tab', 'Drag a row in the sidebar, or a tab in the strip up top: the other side follows.'],
  },
  {
    id: 'space',
    on: ['space', 'groupExpand'],
    zh: ['切换空间', '点顶部标签栏里折叠起来的「工作」分组,或者侧边栏底部的圆点。'],
    en: ['Switch spaces', 'Open the collapsed “Work” group in the tab strip, or click a dot at the bottom of the sidebar.'],
  },
  {
    id: 'child',
    on: ['childTab'],
    zh: ['打开一个子标签', '在网页里点带 ↗ 的链接,新标签页会挂在当前这一页下面。'],
    en: ['Open a child tab', 'Click a link marked ↗ in the page: the new tab lands under the current one.'],
  },
  {
    id: 'pin',
    on: ['pinBack'],
    zh: ['让固定标签回家', '点固定的「规划」,在网页里点「本周笔记」,再点这一行右边的 ↩。'],
    en: ['Send a pinned tab home', 'Click the pinned “Plan”, follow “Weekly notes” in the page, then click ↩ on its row.'],
  },
  {
    id: 'sleep',
    on: ['sleep'],
    zh: ['让标签页休眠', '鼠标移到一个标签页上,点关闭按钮左边的月亮。'],
    en: ['Put a tab to sleep', 'Hover a tab and click the moon left of its close button.'],
  },
  {
    id: 'dedupe',
    on: ['dedupe'],
    zh: ['再开一个已经开着的网站', '点顶部的 + 新建标签页,再点 Gmail 或 YouTube:不会多开一份,而是直接切过去。'],
    en: ['Open a site that’s already open', 'Click + in the tab strip, then pick Gmail or YouTube: instead of a second copy, you jump to the open one.'],
  },
  {
    id: 'undo',
    on: ['undo'],
    zh: ['关掉,再找回来', '关掉一个标签页,点提示条上的「撤销」,或者在侧边栏里按 Ctrl/⌘+Z。'],
    en: ['Close a tab, then get it back', 'Close a tab, then click Undo on the toast, or press Ctrl/⌘+Z in the sidebar.'],
  },
  {
    id: 'leaves',
    on: ['leaves'],
    zh: ['扫掉落叶', 'Hacker News 好几天没看了,上面落了叶子。鼠标在那一行上左右快速来回扫几下。'],
    en: ['Sweep away the leaves', 'Hacker News hasn’t been visited in days and has gathered leaves. Sweep the mouse quickly back and forth over its row.'],
  },
  {
    id: 'keys',
    on: ['keys'],
    zh: ['用键盘选', '点一下侧边栏,按 ↑ ↓ 移动选中框,回车打开。'],
    en: ['Use the keyboard', 'Click the sidebar, move the cursor with ↑ ↓, press Enter to open.'],
  },
];
const CHECK = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 8.5l3 3 6-6.5"/></svg>';
const list = document.getElementById('q-list');
list.innerHTML = TASKS.map(
  (t) =>
    `<li class="q-item" data-id="${t.id}"><span class="q-check">${CHECK}</span>` +
    `<b><span data-l="zh">${t.zh[0]}</span><span data-l="en">${t.en[0]}</span></b>` +
    `<p><span data-l="zh">${t.zh[1]}</span><span data-l="en">${t.en[1]}</span></p></li>`
).join('');

let done = new Set((store.get('demo-done') ?? '').split(',').filter((id) => TASKS.some((t) => t.id === id)));
function showProgress() {
  for (const li of list.children) li.classList.toggle('done', done.has(li.dataset.id));
  document.getElementById('q-count').textContent = `${done.size}/${TASKS.length}`;
  document.getElementById('q-bar').style.width = `${(done.size / TASKS.length) * 100}%`;
  document.getElementById('q-done').hidden = done.size < TASKS.length;
  store.set('demo-done', [...done].join(','));
}
function onAction(action) {
  for (const t of TASKS) {
    if (!t.on.includes(action) || done.has(t.id)) continue;
    done.add(t.id);
    showProgress();
  }
}
showProgress();

const demo = mountDemo(document.getElementById('demo'), { lang: root.dataset.lang, onAction });
document.getElementById('q-reset').addEventListener('click', () => {
  done = new Set();
  showProgress();
  demo.reset();
});

// 功能介绍里的「在上面试试」:滚到试用,并让对应的任务闪一下
for (const btn of document.querySelectorAll('[data-task]')) {
  btn.addEventListener('click', () => {
    goTo(document.querySelector('.try-grid'), { atEnd: true });
    const li = list.querySelector(`[data-id="${btn.dataset.task}"]`);
    // 清单在自己的框里滚动时,把这一条滚到框的中间
    const box = list.getBoundingClientRect();
    const at = li.getBoundingClientRect();
    if (list.scrollHeight > list.clientHeight) list.scrollTo({ top: list.scrollTop + at.top - box.top - (box.height - at.height) / 2, behavior: 'smooth' });
    li.classList.remove('flash');
    void li.offsetWidth;
    li.classList.add('flash');
  });
}

// ---------- 滚动到时淡入:给 <html> 加上 reveal-on 才隐藏(见 style.css),看不到 IntersectionObserver 时什么都不做 ----------

if ('IntersectionObserver' in window) {
  const seen = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('in');
        seen.unobserve(e.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px' }
  );
  // 一开始就在视野里的不做动画,免得首屏闪一下
  for (const el of document.querySelectorAll('.reveal')) {
    const r = el.getBoundingClientRect();
    if (r.top < innerHeight && r.bottom > 0) el.classList.add('in');
    else seen.observe(el);
  }
  root.classList.add('reveal-on');
}

// ---------- 幻灯片式翻页:大屏幕、没开「减少动态效果」时才启用(样式见 style.css 的 .slides) ----------

const slidesOk = matchMedia('(min-width: 1000px) and (min-height: 680px) and (prefers-reduced-motion: no-preference)');
const slides = [...document.querySelectorAll('main > section')];
// 比一屏高的页:sticky 的 top 设成「屏幕高 - 页高」(负数),滚到它的底边才停住,内容一点不漏
const mainEl = document.querySelector('main');
let marks = [];
const pages = new Map(); // 区块 -> { start, end }:在 main 里原本的位置(停住叠在一起时浏览器自己算不对)
function fitSlides() {
  const on = slidesOk.matches;
  root.classList.toggle('slides', on);
  for (const m of marks) m.remove();
  marks = [];
  pages.clear();
  const room = innerHeight - 48;
  let y = 0; // 这一页在 main 里的起点(区块一个接一个,不受 sticky 停住的影响)
  slides.forEach((el, i) => {
    el.classList.toggle('slide', on);
    el.style.zIndex = on ? String(i + 1) : '';
    el.style.top = '';
    if (!on) return;
    const h = el.offsetHeight;
    pages.set(el, { start: y, end: y + Math.max(0, h - room) });
    const stops = [y];
    // 只高出一点的页不多加一站,底下那一点在下一页滑上来时露出来就够了
    if (h > room) el.style.top = `${48 + room - h}px`;
    if (h > room + 120) stops.push(y + h - room);
    for (const top of stops) {
      const m = document.createElement('i');
      m.className = 'snap-mark';
      m.style.top = `${top}px`;
      mainEl.append(m);
      marks.push(m);
    }
    y += h;
  });
  // 最后一站:页脚完整露出来(滚到页面最底下)
  if (on) {
    const end = document.createElement('i');
    end.className = 'snap-mark end';
    end.style.top = `${y + document.querySelector('.foot').offsetHeight - 1}px`;
    mainEl.append(end);
    marks.push(end);
  }
}
// 滚到某个元素所在的那一页:翻页模式下按原本的位置算(atEnd:滚到这一页的底边,比如试用区要看到整个演示窗口),
// 平时就用浏览器自己的 scrollIntoView
function goTo(el, { atEnd = false } = {}) {
  const page = root.classList.contains('slides') && slides.find((s) => s.contains(el));
  if (!page || !pages.has(page)) return el.scrollIntoView({ behavior: 'smooth' });
  const { start, end } = pages.get(page);
  const mainTop = mainEl.getBoundingClientRect().top + scrollY;
  scrollTo({ top: mainTop + (atEnd ? end : start) - 48, behavior: 'smooth' });
}
// 页内链接(导航、「在线试用」「免费安装」按钮等):翻页模式下自己滚,地址栏照样带上 #
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a || !root.classList.contains('slides') || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey) return;
  const target = document.getElementById(a.getAttribute('href').slice(1));
  if (!target) return;
  e.preventDefault();
  history.pushState(null, '', a.getAttribute('href'));
  goTo(target);
});

fitSlides();
slidesOk.addEventListener('change', fitSlides);
// 打开时地址带着 #:等排好再滚过去
if (location.hash && root.classList.contains('slides')) {
  const target = document.getElementById(location.hash.slice(1));
  // 浏览器自己会先平滑地滚向锚点(按停住的位置算,会停错地方):等加载完,关掉平滑滚动直接跳过去,过一会儿再校正一次
  const go = () => {
    fitSlides();
    const { start } = pages.get(slides.find((el) => el.contains(target))) ?? {};
    if (start == null) return;
    root.style.scrollBehavior = 'auto';
    scrollTo({ top: mainEl.getBoundingClientRect().top + scrollY + start - 48, behavior: 'instant' });
    requestAnimationFrame(() => (root.style.scrollBehavior = ''));
  };
  const goTwice = () => {
    go();
    setTimeout(go, 400);
  };
  if (target) document.readyState === 'complete' ? goTwice() : addEventListener('load', goTwice, { once: true });
}
addEventListener('resize', fitSlides);
new ResizeObserver(fitSlides).observe(mainEl);

// ---------- 视频:先显示封面和大播放按钮,点了再带声音播放并换成浏览器自带的控制条 ----------

const video = document.getElementById('intro');
const play = document.getElementById('play');
video.controls = false;
play.hidden = false;
play.addEventListener('click', () => {
  play.hidden = true;
  video.controls = true;
  video.play();
});
video.addEventListener('ended', () => {
  video.controls = false;
  play.hidden = false;
});

// ---------- 复制命令 ----------

for (const btn of document.querySelectorAll('[data-copy]')) {
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(btn.dataset.copy);
    } catch {
      return;
    }
    // 生成的页面里每个按钮只剩一种语言的文字
    const label = btn.querySelector('[data-l]');
    const zh = root.dataset.lang === 'zh';
    label.textContent = zh ? '已复制' : 'Copied';
    setTimeout(() => (label.textContent = zh ? '复制' : 'Copy'), 1500);
  });
}
