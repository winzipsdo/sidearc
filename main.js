// 主页的脚本:切换中英文、在线试用和任务清单、视频的播放按钮、复制命令。

import { mountDemo } from './demo/demo.js?v=90c85fde';

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

// ---------- 语言:页面开头的脚本已经选好,这里只管切换,并记住选择 ----------

const TITLES = { zh: 'Sidearc · Chrome 侧边标签栏', en: 'Sidearc · Arc-style vertical tabs for Chrome' };
function setLang(lang) {
  root.dataset.lang = lang;
  root.lang = lang === 'zh' ? 'zh-CN' : 'en';
  document.title = TITLES[lang];
}
setLang(root.dataset.lang);
document.getElementById('lang').addEventListener('click', () => {
  const lang = root.dataset.lang === 'zh' ? 'en' : 'zh';
  setLang(lang);
  store.set('lang', lang);
  // 试用里的插件界面和网页也换成这个语言(重新开始)
  demo.reset(lang);
});

// 当前版本号(由 source/build.js 从 main 的 manifest.json 写进来)
fetch('ext/version.json')
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
    zh: ['再开一个已经开着的网站', '点顶部的 + 新建标签页,再点 Hacker News 或 Gmail:不会多开一份,而是直接切过去。'],
    en: ['Open a site that’s already open', 'Click + in the tab strip, then pick Hacker News or Gmail: instead of a second copy, you jump to the open one.'],
  },
  {
    id: 'undo',
    on: ['undo'],
    zh: ['关掉,再找回来', '关掉一个标签页,点提示条上的「撤销」,或者在侧边栏里按 Ctrl/⌘+Z。'],
    en: ['Close a tab, then get it back', 'Close a tab, then click Undo on the toast, or press Ctrl/⌘+Z in the sidebar.'],
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
    document.getElementById('try').scrollIntoView({ behavior: 'smooth' });
    const li = list.querySelector(`[data-id="${btn.dataset.task}"]`);
    li.classList.remove('flash');
    void li.offsetWidth;
    li.classList.add('flash');
  });
}

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
    const zh = btn.querySelector('[data-l="zh"]');
    const en = btn.querySelector('[data-l="en"]');
    [zh.textContent, en.textContent] = ['已复制', 'Copied'];
    setTimeout(() => ([zh.textContent, en.textContent] = ['复制', 'Copy']), 1500);
  });
}
