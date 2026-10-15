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
  // 右键菜单用
  edit: svg('<path d="M10.5 3l2.5 2.5L6 12.5H3.5V10z"/>'),
  link: svg('<path d="M7 9a2.5 2.5 0 003.5 0l2-2a2.5 2.5 0 00-3.5-3.5l-.6.6"/><path d="M9 7a2.5 2.5 0 00-3.5 0l-2 2a2.5 2.5 0 003.5 3.5l.6-.6"/>'),
  copy: svg('<rect x="5.5" y="5.5" width="7.5" height="7.5" rx="1.5"/><path d="M10.5 5.5V4A1.5 1.5 0 009 2.5H4A1.5 1.5 0 002.5 4v5A1.5 1.5 0 004 10.5h1.5"/>'),
  reload: svg('<path d="M13 8a5 5 0 11-1.5-3.5"/><path d="M13 2.5v3h-3"/>'),
  star: svg('<path d="M8 2.5l1.7 3.4 3.8.6-2.7 2.6.6 3.7L8 11l-3.4 1.8.6-3.7-2.7-2.6 3.8-.6z"/>'),
  pin: svg('<path d="M6 2.5h4M7 2.5v3.5L4.5 9h7L9 6V2.5M8 9v4.5"/>'),
  swap: svg('<path d="M3 5.5h9.5L10 3"/><path d="M13 10.5H3.5L6 13"/>'),
  move: svg('<path d="M2.5 8h8"/><path d="M8 5l3 3-3 3"/><path d="M13.5 3v10"/>'),
  trash: svg('<path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5"/>'),
  outdent: svg('<path d="M7.5 4h6M7.5 8h6M7.5 12h6"/><path d="M4.5 6L2.5 8l2 2"/>'),
  ungroup: svg('<rect x="2.5" y="2.5" width="5" height="5" rx="1"/><rect x="8.5" y="8.5" width="5" height="5" rx="1"/>'),
  closeBelow: svg('<path d="M3 3.5h10"/><path d="M5.5 7.5l5 5M10.5 7.5l-5 5"/>'),
  dot: svg('<circle cx="8" cy="8" r="3.5" fill="currentColor" stroke="none"/>'),
  eye: svg('<path d="M2 8s2.2-4 6-4 6 4 6 4-2.2 4-6 4-6-4-6-4z"/><circle cx="8" cy="8" r="1.8"/>'),
  eyeOff: svg('<path d="M2 8s2.2-4 6-4 6 4 6 4-2.2 4-6 4-6-4-6-4z"/><circle cx="8" cy="8" r="1.8"/><path d="M3 13L13 3"/>'),
  folder: svg('<path d="M2.5 4.5a1 1 0 011-1h3l1.5 1.5h4.5a1 1 0 011 1v6a1 1 0 01-1 1h-9a1 1 0 01-1-1z"/>'),
  folderOpen: svg('<path d="M2.5 12V4.5a1 1 0 011-1h3l1.5 1.5h4a1 1 0 011 1v1"/><path d="M2.5 12l1.6-4.3a1 1 0 01.9-.7h8.6l-1.7 5z"/>'),
  folderPlus: svg('<path d="M2.5 4.5a1 1 0 011-1h3l1.5 1.5h4.5a1 1 0 011 1v6a1 1 0 01-1 1h-9a1 1 0 01-1-1z"/><path d="M8 7.3v3.4M6.3 9h3.4"/>'),
  back: svg('<path d="M6 3.5L3 6.5l3 3"/><path d="M3 6.5h6.5a3.5 3.5 0 010 7H8"/>'),
  unpin: svg('<path d="M6 2.5h4M7 2.5v3.5L4.5 9h7L9 6V2.5M8 9v4.5M2.5 2.5l11 11"/>'),
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
