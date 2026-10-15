// 不碰浏览器和页面的纯逻辑,可以直接用 node --test 测。

import { hasPrefix, PREFIX } from './protocol.js';

// 搜索栏里输入的文字如果是网址,补全成能打开的地址;否则返回 null(当作搜索词)
export function toUrl(text) {
  if (/\s/.test(text)) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text) || /^(about|chrome):/i.test(text)) return text;
  if (/^(localhost|[\w-]+(\.[\w-]+)+)(:\d+)?([/?#].*)?$/i.test(text)) return 'https://' + text;
  return null;
}

// 相同地址查重时比较用的地址:忽略 # 锚点;#/ 和 #! 开头的是单页应用的路由,保留。不是网页则返回 null
export function addressOf(url) {
  if (!/^https?:/i.test(url)) return null;
  const i = url.indexOf('#');
  return i < 0 || /^#[/!]/.test(url.slice(i)) ? url : url.slice(0, i);
}

// 地址相同的收藏/固定项:收藏夹所有空间共用,固定项只看 spaceId 这个空间。返回 [{ item, spaceId? }],收藏在前
export function itemsAt(state, address, spaceId) {
  const pinned = state?.spaces?.find((s) => s.id === spaceId)?.pinned ?? [];
  return [...(state?.favorites ?? []).map((item) => ({ item })), ...pinned.map((item) => ({ item, spaceId }))].filter(
    ({ item }) => addressOf(item.url) === address
  );
}

// 每个标签页属于哪个空间:tabId -> 空间 id,所有空间共用的(绑定到收藏的)是 ANY_SPACE。
// 绑定到固定项的属于固定项所在的空间,其余看会话存储里记的空间;都没有的不在结果里
export const ANY_SPACE = '*';
export function tabSpaces(state, session) {
  const itemSpace = new Map();
  for (const item of state?.favorites ?? []) itemSpace.set(item.id, ANY_SPACE);
  for (const s of state?.spaces ?? []) for (const item of s.pinned) itemSpace.set(item.id, s.id);
  const out = new Map();
  for (const [k, v] of Object.entries(session)) if (hasPrefix(k, PREFIX.space)) out.set(+k.slice(2), v);
  for (const [k, v] of Object.entries(session)) if (hasPrefix(k, PREFIX.bind) && itemSpace.has(k.slice(2))) out.set(v, itemSpace.get(k.slice(2)));
  return out;
}

// 搜索词为空,或者任意一段文字包含它(不分大小写)
export function matchesQuery(query, texts) {
  const q = query.trim().toLowerCase();
  return !q || texts.some((t) => (t || '').toLowerCase().includes(q));
}

// 收藏夹每行放几个:先算一行最多放几个,再把磁贴平均摊到各行,避免右侧留白
export function favColumns(count, width, { min = 54, gap = 7 } = {}) {
  const max = Math.max(1, Math.floor((width + gap) / (min + gap)));
  const rows = Math.ceil(count / max);
  return rows ? Math.ceil(count / rows) : 1;
}

// 把标签页按树形排好:[{ tab, depth }],最多两级(depth 0 / 1)。父标签页不在列表里的子标签按顶级显示。
// listed 是要显示的标签页(带 id),parentOf 是 tabId -> 父 tabId 的 Map
export function buildTree(listed, parentOf) {
  const ids = new Set(listed.map((t) => t.id));
  const kids = new Map();
  const roots = [];
  for (const t of listed) {
    const p = parentOf.get(t.id);
    if (p == null || p === t.id || !ids.has(p)) roots.push(t);
    else if (kids.has(p)) kids.get(p).push(t);
    else kids.set(p, [t]);
  }
  const out = [];
  const seen = new Set();
  const walk = (t, depth) => {
    if (seen.has(t.id)) return;
    seen.add(t.id);
    out.push({ tab: t, depth });
    for (const k of kids.get(t.id) ?? []) walk(k, 1);
  };
  roots.forEach((t) => walk(t, 0));
  // 父子关系万一成环,剩下的按顶级兜底
  listed.forEach((t) => walk(t, 0));
  return out;
}

// 拖拽落点:应插在第几个元素之前(-1 = 末尾)。rects 是各元素的位置({ top, bottom, left, width, height }),
// 列表按上下半区判断,网格(收藏夹)按行和左右半区判断
export function dropBefore(rects, x, y, grid) {
  return rects.findIndex((r) => (grid ? y < r.top || (y <= r.bottom && x < r.left + r.width / 2) : y < r.top + r.height / 2));
}

// 拖拽落点:指针落在第几行的中间部分(-1 = 没有)。落在中间 = 要成为它的子标签,上下边缘仍是排序
export function dropInto(rects, y) {
  return rects.findIndex((r) => y > r.top + r.height * 0.28 && y < r.bottom - r.height * 0.28);
}

// 解析 Arc 的 StorableSidebar.json → { favorites: [项], spaces: [{ name, pinned: [项], tabs: [项] }] }
// 项为 { title, url, alias? };Arc 里手动改过的名字当作别名,文件夹展开成平铺
export function parseArc(json) {
  const containers = json?.sidebar?.containers ?? [];
  const usable = (c) => Array.isArray(c?.items) && Array.isArray(c?.spaces);
  // Windows 版里窗口数据排在 { global } 标记后面;找不到就取内容最多的那个
  const marked = containers[containers.findIndex((c) => c?.global) + 1];
  const c = usable(marked) ? marked : containers.filter(usable).sort((a, b) => b.items.length - a.items.length)[0];
  if (!c) throw new Error('not an Arc sidebar file');

  // items / spaces 数组里对象和 id 字符串交替出现,只要对象
  const items = new Map(c.items.filter((x) => x && typeof x === 'object').map((x) => [x.id, x]));
  const leaves = (id) => {
    const it = items.get(id);
    const tab = it?.data?.tab;
    if (!tab) return (it?.childrenIds ?? []).flatMap(leaves);
    if (!tab.savedURL) return [];
    const title = tab.savedTitle || tab.savedURL;
    return [{ title, url: tab.savedURL, ...(it.title && it.title !== title && { alias: it.title }) }];
  };
  const favorites = (c.topAppsContainerIDs ?? []).filter((x) => typeof x === 'string').flatMap(leaves);
  const spaces = c.spaces
    .filter((x) => x && typeof x === 'object')
    .map((s) => {
      // containerIDs 形如 ['pinned', <id>, 'unpinned', <id>]
      const ids = s.containerIDs ?? [];
      const of = (key) => (ids.includes(key) ? leaves(ids[ids.indexOf(key) + 1]) : []);
      return { name: s.title || 'Arc', pinned: of('pinned'), tabs: of('unpinned') };
    });
  return { favorites, spaces };
}

// 空间颜色 -> 最接近的 Chrome 标签页分组颜色(分组只支持这几种)
const GROUP_COLORS = {
  grey: '#8a8f98',
  blue: '#6b7cff',
  red: '#e5687a',
  yellow: '#d9a927',
  green: '#4fae6e',
  pink: '#e86fb8',
  purple: '#a06be0',
  cyan: '#3aa7b8',
  orange: '#f0913f',
};
export function groupColor(hex) {
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r, g, b] = /^#[0-9a-f]{6}$/i.test(hex ?? '') ? rgb(hex) : rgb(GROUP_COLORS.grey);
  let best = 'grey';
  let bestDist = Infinity;
  for (const [name, h] of Object.entries(GROUP_COLORS)) {
    const [r2, g2, b2] = rgb(h);
    const d = (r - r2) ** 2 + (g - g2) ** 2 + (b - b2) ** 2;
    if (d < bestDist) [best, bestDist] = [name, d];
  }
  return best;
}

// 顶部标签栏应有的样子:[{ spaceId, ids }],从左到右。spaceId 为 null 的一块是收藏(不进分组)。
// 顺序和侧边栏一致:收藏;然后每个空间按空间顺序,先固定标签,再列表(子标签紧跟父标签)。
// tabs 是本窗口未被浏览器原生固定的标签页(按 index 排好);不属于任何现有空间的归入当前空间
export function buildLayout(state, session, tabs) {
  const spaceIds = new Set((state?.spaces ?? []).map((s) => s.id));
  const spaceOf = tabSpaces(state, session);
  const ids = new Set(tabs.map((t) => t.id));
  const boundTab = (item) => {
    const id = session[`${PREFIX.bind}:${item.id}`];
    return ids.has(id) ? id : null;
  };
  const used = new Set();
  const take = (id) => (id == null || used.has(id) ? [] : (used.add(id), [id]));
  const parents = new Map();
  for (const [k, v] of Object.entries(session)) if (hasPrefix(k, PREFIX.parent)) parents.set(+k.slice(2), v);

  const chunks = [{ spaceId: null, ids: (state?.favorites ?? []).flatMap((item) => take(boundTab(item))) }];
  const pinned = new Set((state?.spaces ?? []).flatMap((s) => s.pinned.map(boundTab)).filter((id) => id != null));
  const home = (t) => {
    const s = spaceOf.get(t.id);
    return spaceIds.has(s) ? s : state?.activeSpaceId;
  };
  for (const space of state?.spaces ?? []) {
    const listed = tabs.filter((t) => !used.has(t.id) && !pinned.has(t.id) && home(t) === space.id);
    chunks.push({
      spaceId: space.id,
      ids: [...space.pinned.flatMap((item) => take(boundTab(item))), ...buildTree(listed, parents).flatMap(({ tab }) => take(tab.id))],
    });
  }
  return chunks.filter((c) => c.ids.length);
}
