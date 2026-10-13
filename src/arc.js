// 从 Arc 导入。文件格式的解析在 logic.js 的 parseArc 里。

import { parseArc } from './logic.js';
import { schedule } from './render.js';
import { activeSpace, COLORS, normalize, save, setTabAlias, setTabSpace, state, tabs, uid, windowId } from './store.js';
import { createTab } from './tabs.js';
import { pushUndo, toast } from './ui.js';

// 收藏夹并入收藏夹;Arc 的第一个空间并入当前空间,其余按名字并入或新建;未固定的标签页在后台打开。
// 网址已存在的跳过,所以重复导入不会产生重复项
export async function importArc(file) {
  let arc;
  try {
    arc = parseArc(JSON.parse(await file.text()));
  } catch {
    return toast('这不是 Arc 的 StorableSidebar.json');
  }
  const added = new Set();
  const newSpaces = new Set();
  const opened = [];
  const count = { fav: 0, pin: 0, tab: 0 };
  const merge = (arr, list, key) => {
    const have = new Set(arr.map((i) => i.url));
    for (const it of list) {
      if (have.has(it.url)) continue;
      have.add(it.url);
      const item = { id: uid(), ...it };
      arr.push(item);
      added.add(item.id);
      count[key]++;
    }
  };

  merge(state.favorites, arc.favorites, 'fav');
  const openUrls = new Set(tabs.map((t) => t.url));
  for (const [i, s] of arc.spaces.entries()) {
    let space = i === 0 ? activeSpace() : state.spaces.find((x) => x.name === s.name);
    if (!space) {
      space = { id: uid(), name: s.name, color: COLORS[state.spaces.length % COLORS.length], pinned: [] };
      state.spaces.push(space);
      newSpaces.add(space.id);
    }
    merge(space.pinned, s.pinned, 'pin');
    for (const t of s.tabs) {
      if (openUrls.has(t.url) || !/^https?:/i.test(t.url)) continue;
      openUrls.add(t.url);
      const tab = await createTab({ url: t.url, windowId, active: false }).catch(() => null);
      if (!tab) continue;
      opened.push(tab.id);
      await setTabSpace(tab.id, space.id);
      if (t.alias) await setTabAlias(tab.id, t.alias);
      count.tab++;
    }
  }
  await save();
  schedule();

  pushUndo(`已从 Arc 导入 ${count.fav} 个收藏、${count.pin} 个固定标签、${count.tab} 个标签页`, async () => {
    const keep = (i) => !added.has(i.id);
    state.favorites = state.favorites.filter(keep);
    state.spaces.forEach((s) => (s.pinned = s.pinned.filter(keep)));
    state.spaces = state.spaces.filter((s) => !newSpaces.has(s.id) || s.pinned.length);
    normalize();
    await save();
    await chrome.tabs.remove(opened).catch(() => {});
    schedule();
  });
}
