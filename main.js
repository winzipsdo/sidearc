// 主页的三件小事:切换中英文、视频的播放按钮、复制命令。

// 语言:页面开头的脚本已经选好,这里只管切换,并记住选择
const TITLES = { zh: 'Sidearc · Chrome 侧边标签栏', en: 'Sidearc · Arc-style vertical tabs for Chrome' };
function setLang(lang) {
  const root = document.documentElement;
  root.dataset.lang = lang;
  root.lang = lang === 'zh' ? 'zh-CN' : 'en';
  document.title = TITLES[lang];
}
setLang(document.documentElement.dataset.lang);
document.getElementById('lang').addEventListener('click', () => {
  const lang = document.documentElement.dataset.lang === 'zh' ? 'en' : 'zh';
  setLang(lang);
  try {
    localStorage.setItem('lang', lang);
  } catch {}
});

// 视频:先显示封面和大播放按钮,点了再带声音播放并换成浏览器自带的控制条
const video = document.getElementById('video');
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

// 复制命令
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
