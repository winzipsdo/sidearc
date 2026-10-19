// 把状态画到页面上。状态变了就整体重画,没有局部更新。

import { $, faviconFor, h, icon, tabIcon } from './dom.js';
import { canDiscard, favColumns, isAway, isFolder, isUnloaded, sleptFor } from './logic.js';
import { currentLang, formatDuration, t } from './i18n.js';
import { recentMenu, settingsMenu } from './menus.js';
import { addSpace } from './spaces.js';
import { activeSpace, bind, dragging, matches, query, refreshTabs, renderHeld, setRenderPending, state, tabAlias, tabs, tabSlept, visibleTabs } from './store.js';

// 开了保持唤醒(不会被 Chrome 自动回收)的标签页:一把小锁,悬停说明是什么意思
const keepAlive = (tab, cls) => tab?.autoDiscardable === false && h('span', { class: cls, title: t('keepAwakeTip') }, icon('lock'));

// 行右侧的「休眠」按钮,和关闭按钮一样只在鼠标移上去时出现
const freeButton = () => h('button', { class: 'btn x', title: t('sleep'), data: { act: 'discard' } }, icon('sleep'));

// 标签页列表里休眠的标签页:行尾显示休眠了多久(收藏和固定标签不显示),鼠标提示里写完整的时间。重启后还没加载的没有记录,只提示「还没加载」
const sleptAt = (tab) => (isUnloaded(tab) ? tabSlept.get(tab.id) : undefined);
const sleptLabel = (tab) => {
  const since = sleptAt(tab);
  return since != null && h('span', { class: 'slept', data: { since } }, formatDuration(sleptFor(since)));
};
function sleptTip(tab) {
  if (!isUnloaded(tab)) return '';
  const since = sleptAt(tab);
  if (since == null) return '\n' + t('notLoadedTip');
  const at = new Date(since).toLocaleString(currentLang() === 'zh' ? 'zh-CN' : 'en', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  return '\n' + t('sleptTip', { duration: formatDuration(sleptFor(since)), at });
}

// 只更新行尾「休眠了多久」的文字,不整体重画(标签页很多时整体重画要几十毫秒)
export function refreshSleptLabels() {
  for (const el of document.querySelectorAll('.slept')) el.textContent = formatDuration(sleptFor(+el.dataset.since));
}

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
    const sound = (tab?.audible || muted) && h('button', { class: (kind === 'fav' ? 'tile-sound' : 'btn') + (tab.audible && !muted ? ' playing' : ''), title: muted ? t('unmute') : t('mute'), data: { act: 'mute' } }, icon(muted ? 'muted' : 'sound'));
    // 开了保持唤醒:收藏在图标右下角、固定标签在标题右边显示一把小锁
    const keep = keepAlive(tab, kind === 'fav' ? 'tile-keep' : 'keep');
    // 休眠:鼠标移上去时出现在关闭按钮左边;当前标签页和已经不在内存里的不显示
    const free = canDiscard(tab) && freeButton();
    if (kind === 'fav') {
      // 开着的收藏:鼠标移上去时右上角出现小关闭按钮(只关标签页,收藏还在);它会盖住发声的小喇叭
      const close = open && h('button', { class: 'tile-close', title: t('close'), data: { act: 'close' } }, icon('close'));
      return h('div', { class: cls, draggable: true, title: tip, data: { kind, id: item.id } }, img, sound, keep, close);
    }
    // 开着的固定标签点进了别的页面:显示当前页面,前面标上固定的名字,右边的按钮改为回到固定地址
    if (tab && isAway(item.url, tab.url || tab.pendingUrl)) {
      return h(
        'div',
        { class: cls + ' away', draggable: true, title: t('awayTip', { current: tab.url, pinned: item.url }), style: inFolder ? '--depth:1' : null, data: { kind, id: item.id } },
        img,
        h('span', { class: 'pin-name' }, item.alias || item.title),
        h('span', { class: 'title' }, tab.title || tab.url),
        keep,
        sound,
        free,
        h('button', { class: 'btn back', title: t('backToPinned'), data: { act: 'back' } }, icon('back'))
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
      free,
      // 开着时「−」关闭标签页、保留固定;没开时换成取消固定
      open
        ? h('button', { class: 'btn x', title: t('close'), data: { act: 'close' } }, icon('minus'))
        : h('button', { class: 'btn x', title: t('unpin'), data: { act: 'unpin' } }, icon('unpin'))
    );
  };

  const favs = state.favorites.filter((i) => matches(i.alias, i.title, i.url)).map((i) => itemEl(i, 'fav'));
  $('#favs').replaceChildren(...(favs.length || query ? favs : [h('div', { class: 'hint' }, t('favsHint'))]));
  layoutFavs();

  const pinTab = (i) => tabById.get(bind.get(i.id));
  const pinMatch = (i) => matches(i.alias, i.title, i.url, pinTab(i)?.title, pinTab(i)?.url);
  const folderEl = (f, showCount) => {
    const openKids = f.items.filter((i) => bind.has(i.id)).length;
    return h(
      'div',
      { class: 'row folder' + (f.open ? ' expanded' : ''), draggable: true, title: f.noHistory ? t('folderNoHistoryTip') : f.name, data: { kind: 'folder', id: f.id } },
      icon(f.open ? 'folderOpen' : 'folder'),
      h('span', { class: 'title' }, f.name),
      f.noHistory && h('span', { class: 'private', title: t('noHistoryIconTip') }, icon('eyeOff')),
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
    return [folderEl(x, false), ...kids.map((i) => itemEl(i, 'pin', true)), !kids.length && h('div', { class: 'folder-empty' }, t('folderEmpty'))].filter(Boolean);
  });
  $('#pins').replaceChildren(...(pins.length || query ? pins : [h('div', { class: 'hint' }, t('pinsHint'))]));

  $('#tabs').replaceChildren(
    ...visibleTabs().map(({ tab, depth }) => {
      const muted = tab.mutedInfo?.muted;
      const cls = ['row', tab.active && 'active', isUnloaded(tab) && 'discarded', tab.status === 'loading' && 'loading'].filter(Boolean).join(' ');
      return h(
        'div',
        { class: cls, draggable: true, title: tab.url + sleptTip(tab), style: depth ? '--depth:1' : null, data: { kind: 'tab', id: tab.id } },
        h('img', { class: 'icon', src: tabIcon(tab), alt: '', draggable: false }),
        tabAlias.has(tab.id) && h('span', { class: 'alias' }, tabAlias.get(tab.id)),
        h('span', { class: 'title' }, tab.title || tab.url || t('newTab')),
        sleptLabel(tab),
        keepAlive(tab, 'keep'),
        (tab.audible || muted) && h('button', { class: 'btn' + (tab.audible && !muted ? ' playing' : ''), title: muted ? t('unmute') : t('mute'), data: { act: 'mute' } }, icon(muted ? 'muted' : 'sound')),
        // 子标签多一个「移出为顶级标签页」;按钮顺序:移出、休眠、关闭,都只在鼠标移上去时出现
        depth > 0 && h('button', { class: 'btn x', title: t('unnest'), data: { act: 'unnest' } }, icon('outdent')),
        canDiscard(tab) && freeButton(),
        h('button', { class: 'btn x', title: t('close'), data: { act: 'close' } }, icon('close'))
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
    h('button', { class: 'space-dot', 'aria-label': t('newSpace'), data: { name: t('newSpace') }, onclick: addSpace }, icon('plus')),
    h('button', { class: 'space-dot recent', 'aria-label': t('recentlyClosed'), data: { name: t('recentlyClosed') }, onclick: recentMenu }, icon('recent')),
    h('button', { class: 'space-dot settings', 'aria-label': t('settings'), data: { name: t('settings') }, onclick: settingsMenu }, icon('sliders'))
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
      // 页面里写死的文字也存一份当前语言的,免得用英文时先闪一下中文
      const text = {};
      for (const el of document.querySelectorAll('[data-i18n],[data-i18n-title],[data-i18n-placeholder]'))
        for (const k of [el.dataset.i18n, el.dataset.i18nTitle, el.dataset.i18nPlaceholder]) if (k) text[k] = t(k);
      localStorage.setItem('snapshot', JSON.stringify({ html, accent, cols: $('#favs').style.getPropertyValue('--cols'), lang: document.documentElement.lang, text }));
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
