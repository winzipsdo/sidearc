// 把状态画到页面上。状态变了就整体重画,没有局部更新。

import { $, faviconFor, h, icon, tabIcon } from './dom.js';
import { favColumns, isAway, isFolder, isUnloaded } from './logic.js';
import { recentMenu } from './menus.js';
import { addSpace } from './spaces.js';
import { activeSpace, bind, dragging, matches, query, refreshTabs, renderHeld, setRenderPending, state, tabAlias, tabs, visibleTabs } from './store.js';

// 开了 Keep Alive(不会被 Chrome 自动回收)的标签页:一把小锁,悬停说明是什么意思
const keepAlive = (tab, cls) => tab?.autoDiscardable === false && h('span', { class: cls, title: 'Keep Alive:不会被自动回收' }, icon('lock'));

export function render() {
  // 拖拽过程中重画会打断拖拽,等松手后再画
  if (dragging || renderHeld) {
    setRenderPending(true);
    return;
  }
  setRenderPending(false);
  const space = activeSpace();
  const tabById = new Map(tabs.map((t) => [t.id, t]));
  document.documentElement.style.setProperty('--accent', space.color);
  $('#space-name').textContent = space.name;
  $('#space-private').hidden = !space.noHistory;

  const itemEl = (item, kind, inFolder) => {
    const open = bind.has(item.id);
    const tab = tabById.get(bind.get(item.id));
    const cls = [kind === 'fav' ? 'tile' : 'row', open && 'open', tab?.active && 'active'].filter(Boolean).join(' ');
    const img = h('img', { class: 'icon', src: tab ? tabIcon(tab) : faviconFor(item.url), alt: '', draggable: false });
    const tip = item.alias ? `${item.alias} · ${item.title}` : item.title;
    // 绑定的标签页正在发声或已静音:收藏在图标右上角显示小喇叭,固定标签在行右侧显示喇叭按钮,点了切换静音
    const muted = tab?.mutedInfo?.muted;
    const sound = (tab?.audible || muted) && h('button', { class: kind === 'fav' ? 'tile-sound' : 'btn', title: muted ? '取消静音' : '静音', data: { act: 'mute' } }, icon(muted ? 'muted' : 'sound'));
    // 开了 Keep Alive:收藏在图标右下角、固定标签在标题右边显示一把小锁
    const keep = keepAlive(tab, kind === 'fav' ? 'tile-keep' : 'keep');
    if (kind === 'fav') return h('div', { class: cls, draggable: true, title: tip, data: { kind, id: item.id } }, img, sound, keep);
    // 开着的固定标签点进了别的页面:显示当前页面,前面标上固定的名字,右边的按钮改为回到固定地址
    if (tab && isAway(item.url, tab.url || tab.pendingUrl)) {
      return h(
        'div',
        { class: cls + ' away', draggable: true, title: `当前:${tab.url}\n固定地址:${item.url}`, style: inFolder ? '--depth:1' : null, data: { kind, id: item.id } },
        img,
        h('span', { class: 'pin-name' }, item.alias || item.title),
        h('span', { class: 'title' }, tab.title || tab.url),
        keep,
        sound,
        h('button', { class: 'btn back', title: '回到固定地址', data: { act: 'back' } }, icon('back'))
      );
    }
    return h(
      'div',
      { class: cls, draggable: true, title: item.url, style: inFolder ? '--depth:1' : null, data: { kind, id: item.id } },
      img,
      item.alias && h('span', { class: 'alias' }, item.alias),
      h('span', { class: 'title' }, item.title),
      keep,
      sound,
      // 开着时「−」关闭标签页、保留固定;没开时换成取消固定
      open
        ? h('button', { class: 'btn x', title: '关闭标签页(保留固定)', data: { act: 'close' } }, icon('minus'))
        : h('button', { class: 'btn x', title: '取消固定', data: { act: 'unpin' } }, icon('unpin'))
    );
  };

  const favs = state.favorites.filter((i) => matches(i.alias, i.title, i.url)).map((i) => itemEl(i, 'fav'));
  $('#favs').replaceChildren(...(favs.length || query ? favs : [h('div', { class: 'hint' }, '把标签页拖到这里加入收藏夹')]));
  layoutFavs();

  const pinTab = (i) => tabById.get(bind.get(i.id));
  const pinMatch = (i) => matches(i.alias, i.title, i.url, pinTab(i)?.title, pinTab(i)?.url);
  const folderEl = (f, showCount) => {
    const openKids = f.items.filter((i) => bind.has(i.id)).length;
    return h(
      'div',
      { class: 'row folder' + (f.open ? ' expanded' : ''), draggable: true, title: f.noHistory ? '此文件夹里的页面不记录浏览历史' : f.name, data: { kind: 'folder', id: f.id } },
      icon(f.open ? 'folderOpen' : 'folder'),
      h('span', { class: 'title' }, f.name),
      f.noHistory && h('span', { class: 'private', title: '不记录浏览历史' }, icon('eyeOff')),
      // 折叠时显示里面有几项,开着几项
      showCount && f.items.length > 0 && h('span', { class: 'count' }, openKids ? `${openKids}/${f.items.length}` : `${f.items.length}`)
    );
  };
  const pins = space.pinned.flatMap((x) => {
    if (!isFolder(x)) return pinMatch(x) ? [itemEl(x, 'pin')] : [];
    // 搜索时:文件夹名匹配就整个显示,否则只显示匹配的项;没有任何匹配就不显示
    const kids = query && !matches(x.name) ? x.items.filter(pinMatch) : x.items;
    if (query && !kids.length) return [];
    if (!x.open && !query) return [folderEl(x, true)];
    return [folderEl(x, false), ...kids.map((i) => itemEl(i, 'pin', true)), !kids.length && h('div', { class: 'folder-empty' }, '空文件夹,把固定标签拖进来')].filter(Boolean);
  });
  $('#pins').replaceChildren(...(pins.length || query ? pins : [h('div', { class: 'hint' }, '把标签页拖到这里固定到此空间')]));

  $('#tabs').replaceChildren(
    ...visibleTabs().map(({ tab: t, depth }) => {
      const muted = t.mutedInfo?.muted;
      const cls = ['row', t.active && 'active', isUnloaded(t) && 'discarded', t.status === 'loading' && 'loading'].filter(Boolean).join(' ');
      return h(
        'div',
        { class: cls, draggable: true, title: t.url, style: depth ? '--depth:1' : null, data: { kind: 'tab', id: t.id } },
        h('img', { class: 'icon', src: tabIcon(t), alt: '', draggable: false }),
        tabAlias.has(t.id) && h('span', { class: 'alias' }, tabAlias.get(t.id)),
        h('span', { class: 'title' }, t.title || t.url || '新标签页'),
        keepAlive(t, 'keep'),
        (t.audible || muted) && h('button', { class: 'btn', title: muted ? '取消静音' : '静音', data: { act: 'mute' } }, icon(muted ? 'muted' : 'sound')),
        h('button', { class: 'btn x', title: '关闭', data: { act: 'close' } }, icon('close'))
      );
    })
  );

  $('#spaces').replaceChildren(
    ...state.spaces.map((s) =>
      h(
        'button',
        { class: 'space-dot' + (s.id === space.id ? ' on' : ''), 'aria-label': s.name, data: { space: s.id, name: s.name } },
        h('i', { style: `color:${s.color}` })
      )
    ),
    h('button', { class: 'space-dot', 'aria-label': '新建空间', data: { name: '新建空间' }, onclick: addSpace }, icon('plus')),
    h('button', { class: 'space-dot recent', 'aria-label': '最近关闭', data: { name: '最近关闭' }, onclick: recentMenu }, icon('recent'))
  );
  saveSnapshot();
}

// 把这次画出来的样子存一份,下次打开侧边栏时 boot.js 先把它显示出来,免得先空一下
const SNAPSHOT_PARTS = ['favs', 'space-name', 'pins', 'tabs', 'spaces'];
let snapshotTimer;
function saveSnapshot() {
  clearTimeout(snapshotTimer);
  snapshotTimer = setTimeout(() => {
    try {
      const html = Object.fromEntries(SNAPSHOT_PARTS.map((id) => [id, document.getElementById(id).innerHTML]));
      const accent = document.documentElement.style.getPropertyValue('--accent');
      localStorage.setItem('snapshot', JSON.stringify({ html, accent, cols: $('#favs').style.getPropertyValue('--cols') }));
    } catch {}
  }, 300);
}

// 收藏夹每行的列数交给 CSS 变量 --cols,磁贴均分每一行
export function layoutFavs() {
  const el = $('#favs');
  el.style.setProperty('--cols', favColumns(el.querySelectorAll('.tile').length, el.clientWidth));
}

// 标签页有变化:稍等一下合并连续的事件,再重新读取并重画
let timer = null;
export function schedule() {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    await refreshTabs();
    render();
  }, 30);
}
