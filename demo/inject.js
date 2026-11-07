// 在线试用:插件的页面(ext/sidepanel.html、ext/background.html)第一个加载这个脚本,
// 从外面的主页拿到模拟的 chrome.* 接口(见 sim.js),插件自己的代码一行不改。
(() => {
  const demo = parent.sidearcDemo;
  const ctx = document.currentScript.dataset.ctx;
  window.chrome = demo.connect(window, ctx);
  if (ctx !== 'panel') return;
  // 真正的侧边栏是单独的页面,scrollIntoView 只滚它自己的列表;这里是 iframe,原生的会连外面的主页一起滚。
  // 换成只滚 iframe 里最近的可滚动容器(算上 scroll-margin / scroll-padding,和原生停的位置一样)
  Element.prototype.scrollIntoView = function (opt) {
    const o = opt && typeof opt === 'object' ? opt : { block: opt === false ? 'end' : 'start' };
    let sc = this.parentElement;
    while (sc && !(/(auto|scroll)/.test(getComputedStyle(sc).overflowY) && sc.scrollHeight > sc.clientHeight)) sc = sc.parentElement;
    if (!sc) return;
    const es = getComputedStyle(this);
    const ss = getComputedStyle(sc);
    const px = (v) => parseFloat(v) || 0;
    const b0 = sc.getBoundingClientRect();
    const r0 = this.getBoundingClientRect();
    const box = { top: b0.top + sc.clientTop + px(ss.scrollPaddingTop), bottom: b0.top + sc.clientTop + sc.clientHeight - px(ss.scrollPaddingBottom) };
    const r = { top: r0.top - px(es.scrollMarginTop), bottom: r0.bottom + px(es.scrollMarginBottom) };
    const b = o.block ?? 'start';
    const d =
      b === 'center' ? (r.top + r.bottom) / 2 - (box.top + box.bottom) / 2
      : b === 'end' ? r.bottom - box.bottom
      : b === 'nearest' ? (r.top < box.top ? r.top - box.top : r.bottom > box.bottom ? r.bottom - box.bottom : 0)
      : r.top - box.top;
    if (d) sc.scrollBy({ top: d, behavior: o.behavior ?? 'auto' });
  };
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
