// 打开侧边栏时先把上次的样子显示出来(render.js 存的快照),真正的数据读好后会整体重画。
// 这是普通脚本而不是模块,在页面解析到这里时立刻执行,比模块和异步读取都早
try {
  const snap = JSON.parse(localStorage.getItem('snapshot'));
  if (snap) {
    for (const [id, html] of Object.entries(snap.html)) document.getElementById(id).innerHTML = html;
    document.documentElement.style.setProperty('--accent', snap.accent);
    document.getElementById('favs').style.setProperty('--cols', snap.cols);
  }
} catch {}
