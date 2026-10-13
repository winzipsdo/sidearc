// 把状态画到页面上。状态变了就整体重画,没有局部更新。

import { $, faviconFor, h, icon, tabIcon } from './dom.js';
import { favColumns } from './logic.js';
import { addSpace } from './spaces.js';
import { activeSpace, bind, dragging, matches, query, refreshTabs, setRenderPending, state, tabAlias, tabs, visibleTabs } from './store.js';

export function render() {
  // 拖拽过程中重画会打断拖拽,等松手后再画
  if (dragging) {
    setRenderPending(true);
    return;
  }
  setRenderPending(false);
  const space = activeSpace();
  const tabById = new Map(tabs.map((t) => [t.id, t]));
  document.documentElement.style.setProperty('--accent', space.color);
  $('#space-name').textContent = space.name;
  $('#space-private').hidden = !space.noHistory;

  const itemEl = (item, kind) => {
    const open = bind.has(item.id);
    const tab = tabById.get(bind.get(item.id));
    const cls = [kind === 'fav' ? 'tile' : 'row', open && 'open', tab?.active && 'active'].filter(Boolean).join(' ');
    const img = h('img', { class: 'icon', src: tab ? tabIcon(tab) : faviconFor(item.url), alt: '', draggable: false });
    const tip = item.alias ? `${item.alias} · ${item.title}` : item.title;
    if (kind === 'fav') return h('div', { class: cls, draggable: true, title: tip, data: { kind, id: item.id } }, img);
    return h(
      'div',
      { class: cls, draggable: true, title: item.url, data: { kind, id: item.id } },
      img,
      item.alias && h('span', { class: 'alias' }, item.alias),
      h('span', { class: 'title' }, item.title),
      open && h('button', { class: 'btn x', title: '关闭标签页(保留固定)', data: { act: 'close' } }, icon('minus'))
    );
  };

  const favs = state.favorites.filter((i) => matches(i.alias, i.title, i.url)).map((i) => itemEl(i, 'fav'));
  $('#favs').replaceChildren(...(favs.length || query ? favs : [h('div', { class: 'hint' }, '把标签页拖到这里加入收藏夹')]));
  layoutFavs();

  const pins = space.pinned.filter((i) => matches(i.alias, i.title, i.url)).map((i) => itemEl(i, 'pin'));
  $('#pins').replaceChildren(...(pins.length || query ? pins : [h('div', { class: 'hint' }, '把标签页拖到这里固定到此空间')]));

  $('#tabs').replaceChildren(
    ...visibleTabs().map(({ tab: t, depth }) => {
      const muted = t.mutedInfo?.muted;
      const cls = ['row', t.active && 'active', t.discarded && 'discarded', t.status === 'loading' && 'loading'].filter(Boolean).join(' ');
      return h(
        'div',
        { class: cls, draggable: true, title: t.url, style: depth ? '--depth:1' : null, data: { kind: 'tab', id: t.id } },
        h('img', { class: 'icon', src: tabIcon(t), alt: '', draggable: false }),
        tabAlias.has(t.id) && h('span', { class: 'alias' }, tabAlias.get(t.id)),
        h('span', { class: 'title' }, t.title || t.url || '新标签页'),
        (t.audible || muted) && h('button', { class: 'btn', title: muted ? '取消静音' : '静音', data: { act: 'mute' } }, icon(muted ? 'muted' : 'sound')),
        h('button', { class: 'btn x', title: '关闭', data: { act: 'close' } }, icon('close'))
      );
    })
  );

  $('#spaces').replaceChildren(
    ...state.spaces.map((s) =>
      h(
        'button',
        { class: 'space-dot' + (s.id === space.id ? ' on' : ''), title: s.name, data: { space: s.id } },
        h('i', { style: `color:${s.color}` })
      )
    ),
    h('button', { class: 'space-dot', title: '新建空间', onclick: addSpace }, icon('plus'))
  );
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
