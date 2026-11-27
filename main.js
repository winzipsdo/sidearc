// 主页的脚本:语言和深浅色、在线试用和任务清单、功能片段滚到时才播放、复制命令、开头横线上的落叶。

import { mountDemo } from './demo/demo.js?v=5eb56535';

const root = document.documentElement;
const zh = root.dataset.lang === 'zh';
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
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

// ---------- 语言:中文页和英文页是两个网址(source/pages.js 生成),右上角的链接指向另一个 ----------
// 记住选择:下次直接打开那种语言(页面开头的脚本会跳过去)

document.getElementById('lang').addEventListener('click', () => store.set('lang', zh ? 'en' : 'zh'));

// 第一次来、浏览器语言和这个页面不一样:顶上提示一句有另一种语言的版本。只提示不跳转,
// 搜索引擎的爬虫(浏览器语言多半是英文)照样能收录中文页
const browserLang = /^zh\b/i.test(navigator.language) ? 'zh' : 'en';
if (browserLang !== root.dataset.lang && !store.get('lang')) {
  const bar = document.createElement('div');
  bar.className = 'lang-hint';
  bar.lang = browserLang === 'zh' ? 'zh-CN' : 'en';
  bar.innerHTML =
    browserLang === 'zh'
      ? '<span>这个页面有中文版。<a href="../">看中文版</a></span><button type="button" aria-label="关闭">×</button>'
      : '<span>This page is also available in English. <a href="en/">View in English</a></span><button type="button" aria-label="Close">×</button>';
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

// ---------- 在线试用的任务清单 ----------

// on:试用里发生了哪些操作就算完成(见 demo/demo.js 的 onAction)
const TASKS = [
  {
    id: 'drag',
    on: ['sidebarDrag', 'stripDrag'],
    zh: ['拖动一个标签页', '在侧边栏里上下拖一行，或者拖顶部标签栏里的标签页：另一边跟着变。'],
    en: ['Drag a tab', 'Drag a row in the sidebar, or a tab in the strip up top: the other side follows.'],
  },
  {
    id: 'space',
    on: ['space', 'groupExpand'],
    zh: ['切换空间', '点顶部标签栏里折叠起来的「工作」分组，或者侧边栏底部的圆点。'],
    en: ['Switch spaces', 'Open the collapsed "Work" group in the tab strip, or click a dot at the bottom of the sidebar.'],
  },
  {
    id: 'child',
    on: ['childTab'],
    zh: ['打开一个子标签', '在网页里点带 ↗ 的链接，新标签页会挂在当前这一页下面。'],
    en: ['Open a child tab', 'Click a link marked ↗ in the page: the new tab lands under the current one.'],
  },
  {
    id: 'pin',
    on: ['pinBack'],
    zh: ['让固定标签回家', '点固定的「规划」，在网页里点「本周笔记」，再点这一行右边的 ↩。'],
    en: ['Send a pinned tab home', 'Click the pinned "Plan", follow "Weekly notes" in the page, then click ↩ on its row.'],
  },
  {
    id: 'sleep',
    on: ['sleep'],
    zh: ['让标签页休眠', '鼠标移到一个标签页上，点关闭按钮左边的月亮。'],
    en: ['Put a tab to sleep', 'Hover a tab and click the moon left of its close button.'],
  },
  {
    id: 'dedupe',
    on: ['dedupe'],
    zh: ['再开一个已经开着的网站', '点顶部的 + 新建标签页，再点 Gmail 或 YouTube：不会多开一份，而是直接切过去。'],
    en: ['Open a site that is already open', 'Click + in the tab strip, then pick Gmail or YouTube: instead of a second copy, you jump to the open one.'],
  },
  {
    id: 'undo',
    on: ['undo'],
    zh: ['关掉，再找回来', '关掉一个标签页，点提示条上的「撤销」，或者在侧边栏里按 Ctrl/⌘+Z。'],
    en: ['Close a tab, then get it back', 'Close a tab, then click Undo on the toast, or press Ctrl/⌘+Z in the sidebar.'],
  },
  {
    id: 'leaves',
    on: ['leaves'],
    zh: ['扫掉落叶', 'Hacker News 好几天没看了，上面落了叶子。鼠标在那一行上左右快速来回扫几下。'],
    en: ['Sweep away the leaves', 'Hacker News has not been visited in days and has gathered leaves. Sweep the mouse quickly back and forth over its row.'],
  },
  {
    id: 'keys',
    on: ['keys'],
    zh: ['用键盘选', '点一下侧边栏，按 ↑ ↓ 移动选中框，回车打开。'],
    en: ['Use the keyboard', 'Click the sidebar, move the cursor with ↑ ↓, press Enter to open.'],
  },
];
const CHECK = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 8.5l3 3 6-6.5"/></svg>';
const list = document.getElementById('q-list');
list.innerHTML = TASKS.map((t) => {
  const [title, hint] = zh ? t.zh : t.en;
  return `<li class="q-item" data-id="${t.id}"><span class="q-check">${CHECK}</span><b>${title}</b><p>${hint}</p></li>`;
}).join('');

let done = new Set((store.get('demo-done') ?? '').split(',').filter((id) => TASKS.some((t) => t.id === id)));
function showProgress() {
  for (const li of list.children) li.classList.toggle('done', done.has(li.dataset.id));
  document.getElementById('q-count').textContent = `${done.size}/${TASKS.length}`;
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

// 功能介绍里的「在上面试试」:滚回试用,让对应的那一条任务亮一下
for (const btn of document.querySelectorAll('[data-task]')) {
  btn.addEventListener('click', () => {
    document.getElementById('demo').scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
    const li = list.querySelector(`[data-id="${btn.dataset.task}"]`);
    li.classList.remove('flash');
    void li.offsetWidth;
    li.classList.add('flash');
  });
}

// ---------- 功能演示的片段:滚到时才加载、播放,滚走就停;系统开了「减少动态效果」时不自动播,显示播放控件 ----------

const clips = [...document.querySelectorAll('video.clip')];
if (calm || !('IntersectionObserver' in window)) {
  for (const v of clips) {
    v.controls = true;
    v.preload = 'metadata';
  }
} else {
  const watch = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) e.target.play().catch(() => {});
        else e.target.pause();
      }
    },
    { threshold: 0.25 }
  );
  for (const v of clips) watch.observe(v);
}

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
    label.textContent = zh ? '已复制' : 'Copied';
    setTimeout(() => (label.textContent = zh ? '复制' : 'Copy'), 1500);
  });
}

// ---------- 开头那条横线上落着几片叶子:鼠标扫过哪片,哪片就被吹走。不提示,留给人自己发现 ----------

// 位置(占横线宽度的百分比)、转多少度、哪种颜色:疏密不匀,像真的落下来的
const LEAVES = [
  [57, -24, 0],
  [63.5, 38, 1],
  [66, -62, 2],
  [74, 14, 0],
  [81.5, -40, 1],
  [84, 66, 0],
  [93, -12, 2],
];
const LEAF_COLORS = [
  ['#b0703c', '#8a4f26'],
  ['#c98a3a', '#9a6424'],
  ['#8d7a3e', '#6a5a2a'],
];
const fallen = document.getElementById('fallen');
LEAVES.forEach(([x, r, c], i) => {
  const [fill, vein] = LEAF_COLORS[c];
  const leaf = document.createElement('i');
  leaf.className = 'leaf';
  leaf.style.cssText = `left:${x}%;--r:${r}deg;--y:${3 + (i % 3)}px;--d:${0.5 + i * 0.13}s`;
  leaf.innerHTML = `<svg viewBox="0 0 22 22"><path d="M11 21C5.5 17 4 11.5 5.6 6.8 6.8 3.4 9.2 1.6 11 1c1.8.6 4.2 2.4 5.4 5.8C18 11.500 16.500 17 11 21z" fill="${fill}"/><path d="M11 20.500V4.500M11 9.500l-2.600-2.200M11 9.500l2.600-2.200M11 13.500l-3.200-2.600M11 13.500l3.200-2.600" stroke="${vein}" stroke-width=".7" stroke-linecap="round" fill="none"/></svg>`;
  // 往鼠标来的反方向吹走
  leaf.addEventListener('pointerenter', (e) => {
    const dir = e.movementX < 0 ? -1 : 1;
    leaf.style.setProperty('--gx', `${dir * (50 + Math.random() * 70)}px`);
    leaf.style.setProperty('--gy', `${-(40 + Math.random() * 60)}px`);
    leaf.style.setProperty('--gr', `${dir * (160 + Math.random() * 200)}deg`);
    leaf.classList.add('gone');
    // 飞走后从页面里拿掉:它虽然透明了,位置还在,飞出屏幕右边时会把页面撑宽,手机上就能横着滑
    setTimeout(() => leaf.remove(), 1400);
  });
  fallen.append(leaf);
});
