// 打开侧边栏时先把上次的样子显示出来(render.js 存的快照),真正的数据读好后会整体重画。
// 这是普通脚本而不是模块,在页面解析到这里时立刻执行,比模块和异步读取都早
try {
  const snap = JSON.parse(localStorage.getItem('snapshot'));
  if (snap) {
    for (const [id, html] of Object.entries(snap.html)) document.getElementById(id).innerHTML = html;
    document.documentElement.style.setProperty('--accent', snap.accent);
    document.getElementById('favs').style.setProperty('--cols', snap.cols);
    if (snap.lang) document.documentElement.lang = snap.lang;
    const text = snap.text || {};
    for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = text[el.dataset.i18n] ?? el.textContent;
    for (const el of document.querySelectorAll('[data-i18n-title]')) el.title = text[el.dataset.i18nTitle] ?? el.title;
    for (const el of document.querySelectorAll('[data-i18n-placeholder]')) el.placeholder = text[el.dataset.i18nPlaceholder] ?? el.placeholder;
  }
} catch {}

// 淡入(样式见 sidepanel.css 的 body.shown):先按透明画一帧,下一帧再显示,过渡才会真的播出来
{
  const show = () => document.body.classList.add('shown');
  requestAnimationFrame(() => requestAnimationFrame(show));
  // 页面在后台(侧边栏还没露出来)时 requestAnimationFrame 不跑,露出来后它自然会接着跑;万一一直不跑,一秒后直接显示
  setTimeout(show, 1000);
}
