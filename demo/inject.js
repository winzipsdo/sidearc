// 在线试用:插件的页面(ext/sidepanel.html、ext/background.html)第一个加载这个脚本,
// 从外面的主页拿到模拟的 chrome.* 接口(见 sim.js),插件自己的代码一行不改。
(() => {
  const demo = parent.sidearcDemo;
  const ctx = document.currentScript.dataset.ctx;
  window.chrome = demo.connect(window, ctx);
  if (ctx !== 'panel') return;
  // 侧边栏打开时会先显示上次存的画面;试用每次都是新的,不用上次的
  try {
    localStorage.removeItem('snapshot');
  } catch {}
  // 网站图标:插件用 Chrome 的 /_favicon/ 地址取图标,这里换成假网站的图标
  const fix = (src) => {
    if (!src || !src.startsWith('chrome-extension://') || !src.includes('/_favicon/')) return src;
    return demo.favicon(new URL(src).searchParams.get('pageUrl') || '');
  };
  const prop = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  Object.defineProperty(HTMLImageElement.prototype, 'src', {
    configurable: true,
    enumerable: true,
    get() {
      return prop.get.call(this);
    },
    set(v) {
      prop.set.call(this, fix(String(v)));
    },
  });
  const fixAll = (root) => {
    for (const img of root.querySelectorAll?.('img[src^="chrome-extension:"]') ?? []) img.setAttribute('src', fix(img.getAttribute('src')));
  };
  new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'attributes') fixAll(r.target.parentNode ?? document);
      else for (const n of r.addedNodes) if (n.nodeType === 1) (n.tagName === 'IMG' ? fixAll(n.parentNode) : fixAll(n));
    }
  }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['src'] });
})();
