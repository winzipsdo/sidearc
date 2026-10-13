// 生成和查找页面元素的小工具。

export const FALLBACK_ICON =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.5" fill="none" stroke="#999" stroke-width="1.4"/><path d="M1.5 8h13M8 1.5c-4 4.5-4 8.5 0 13M8 1.5c4 4.5 4 8.5 0 13" fill="none" stroke="#999" stroke-width="1.2"/></svg>'
  );

const svg = (d) =>
  `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const SPEAKER = '<path d="M2.5 6.2v3.6h2.3L8 12.5v-9L4.8 6.2z"/>';
const ICONS = {
  close: svg('<path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/>'),
  minus: svg('<path d="M4 8h8"/>'),
  plus: svg('<path d="M8 3.5v9M3.5 8h9"/>'),
  sound: svg(SPEAKER + '<path d="M10.5 5.8a3 3 0 010 4.4M12.3 4a5.5 5.5 0 010 8"/>'),
  muted: svg(SPEAKER + '<path d="M10.8 6.3l3 3.4M13.8 6.3l-3 3.4"/>'),
};
export function icon(name) {
  const el = document.createElement('span');
  el.className = 'i';
  el.innerHTML = ICONS[name];
  return el;
}

export const $ = (s) => document.querySelector(s);

export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'data') Object.assign(el.dataset, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k in el) el[k] = v;
    else el.setAttribute(k, v);
  }
  el.append(...kids.flat().filter((k) => k != null && k !== false));
  return el;
}

export function faviconFor(url) {
  return `${chrome.runtime.getURL('/_favicon/')}?pageUrl=${encodeURIComponent(url)}&size=32`;
}

export function tabIcon(tab) {
  const f = tab.favIconUrl;
  if (f && /^(https?|data):/.test(f)) return f;
  return faviconFor(tab.url || tab.pendingUrl || 'about:blank');
}
