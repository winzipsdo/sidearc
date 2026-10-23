// 把状态画到页面上。状态变了就整体重画,没有局部更新。

import { $, faviconFor, h, icon, tabIcon } from './dom.js';
import { favColumns, isAway, isFolder, isUnloaded, sleptFor, TRAIL_TTL, trailLeft } from './logic.js';
import { currentLang, formatDuration, t } from './i18n.js';
import { applyCursor } from './keys.js';
import { recentMenu, settingsMenu } from './menus.js';
import { addSpace } from './spaces.js';
import { activeSpace, bind, dragging, matches, pressing, query, refreshTabs, renderHeld, setRenderPending, state, tabAlias, tabReplacedHooks, tabSlept, tabs, trail, trailOn, visibleTabs } from './store.js';

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

// 足迹:最近离开的几个标签页左边(收藏是底部)画一道主题色的线,每个各自倒计时 10 分钟,
// 线从两头往中间缩短、同时变淡,到 0 消失。缩短是一段 10 分钟的 CSS 动画(fp-life),
// 用负的 animation-delay(--fp-age)从「已经离开多久」接着播,所以重画后也连贯,不用定时去改。
// 另外两段短动效:新出现的从中间长出来(fp-grow),切回去或被挤掉的从当前长度缩短淡出(fp-out)。
// 切标签页时列表会连着重画好几次,这两段从哪儿开始记在这里,重画后接着播,不会从头来或被掐断
const trailShown = new Map(); // tabId -> { at, start }:at 离开的时间,start 开始长出来的时间
const trailOut = new Map(); // tabId -> { left, start }:正在缩短淡出的,left 是开始缩时还剩多少
let trailTimer;
const GROW_MS = 450;
// 标签页换了编号(休眠时 Chrome 会换):足迹的动画进度跟过去,不然会当成新足迹重新长一遍
tabReplacedHooks.push((added, removed) => {
  for (const map of [trailShown, trailOut]) {
    if (map.has(removed)) map.set(added, map.get(removed));
    map.delete(removed);
  }
});
const OUT_MS = 300;
const trailEls = (itemOf, tabId) => {
  const item = itemOf.get(tabId);
  return document.querySelectorAll(item ? `[data-kind="pin"][data-id="${item}"], [data-kind="fav"][data-id="${item}"]` : `[data-kind="tab"][data-id="${tabId}"]`);
};
// 休眠动效:点下去那一刻起,这一行从当时的样子(悬停的底色,或者当前标签页的白卡片和阴影)
// 慢慢过渡到休眠的样子;图标缩一下再变淡、标题变暗,旁边飘起一个「z」。
// 中间会切走、换编号、连着重画好几次,开始时间和起始样子记在这里,重画后用负的 animation-delay 接着播
const sleepAnim = new Map(); // tabId -> { start, bg, shadow }
const SLEEP_MS = 900;
export function markSlept(tabId) {
  const el = trailEls(new Map([...bind].map(([itemId, id]) => [id, itemId])), tabId)[0];
  const cs = el && getComputedStyle(el);
  sleepAnim.set(tabId, { start: Date.now(), bg: cs?.backgroundColor ?? 'transparent', shadow: cs?.boxShadow ?? 'none' });
  refreshSleepAnim();
  // 播完把类名去掉(之后没有重画的话也要去)
  setTimeout(refreshSleepAnim, SLEEP_MS + 50);
}
tabReplacedHooks.push((added, removed) => {
  if (sleepAnim.has(removed)) sleepAnim.set(added, sleepAnim.get(removed));
  sleepAnim.delete(removed);
});
function refreshSleepAnim() {
  for (const el of document.querySelectorAll('.just-slept')) el.classList.remove('just-slept');
  const now = Date.now();
  const itemOf = new Map([...bind].map(([itemId, tabId]) => [tabId, itemId]));
  for (const [id, a] of sleepAnim) {
    if (now - a.start >= SLEEP_MS) {
      sleepAnim.delete(id);
      continue;
    }
    for (const el of trailEls(itemOf, id)) {
      el.classList.add('just-slept');
      el.style.setProperty('--sleep-delay', `${a.start - now}ms`);
      el.style.setProperty('--sleep-bg', a.bg);
      el.style.setProperty('--sleep-shadow', a.shadow);
    }
  }
}

export function refreshTrail() {
  for (const el of document.querySelectorAll('.fp, .fp-out')) el.classList.remove('fp', 'fp-grow', 'fp-out');
  const now = Date.now();
  const byId = new Map(tabs.map((t) => [t.id, t]));
  const itemOf = new Map([...bind].map(([itemId, tabId]) => [tabId, itemId]));
  const next = new Map();
  if (trailOn) for (const x of trail) if (byId.has(x.id) && !byId.get(x.id).active && now - x.at < TRAIL_TTL) next.set(x.id, x.at);
  for (const [id, at] of next) {
    let s = trailShown.get(id);
    if (!s || s.at !== at) s = { at, start: trailOut.has(id) ? -Infinity : now };
    trailShown.set(id, s);
    trailOut.delete(id);
    for (const el of trailEls(itemOf, id)) {
      el.classList.add('fp');
      if (now - s.start < GROW_MS) el.classList.add('fp-grow');
      el.style.setProperty('--fp-age', `${at - now}ms`);
      el.style.setProperty('--fp-delay', `${Math.max(s.start, now - GROW_MS) - now}ms`);
    }
  }
  for (const [id, s] of trailShown) {
    if (next.has(id)) continue;
    trailShown.delete(id);
    trailOut.set(id, { left: trailLeft(s.at, now), start: now });
  }
  // 到点了就淡出,不等每分钟那次刷新
  clearTimeout(trailTimer);
  const due = Math.min(...[...trailShown.values()].map((x) => x.at + TRAIL_TTL));
  if (due < Infinity) trailTimer = setTimeout(refreshTrail, due - now + 50);
  for (const [id, x] of trailOut) {
    if (now - x.start >= OUT_MS) {
      trailOut.delete(id);
      continue;
    }
    for (const el of trailEls(itemOf, id)) {
      el.classList.add('fp-out');
      el.style.setProperty('--fp-left', x.left.toFixed(3));
      el.style.setProperty('--fp-delay', `${x.start - now}ms`);
    }
  }
}

// 只更新行尾「休眠了多久」的文字,不整体重画(标签页很多时整体重画要几十毫秒)
export function refreshSleptLabels() {
  for (const el of document.querySelectorAll('.slept')) el.textContent = formatDuration(sleptFor(+el.dataset.since));
}

export function render() {
  // 拖拽过程中、鼠标按着的时候重画会打断拖拽或吞掉点击,等松手后再画
  if (dragging || renderHeld || pressing) {
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
    const free = tab && !isUnloaded(tab) && freeButton();
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

  // 选中了不止一个(多选)时,当前标签页也标成选中:它本来就在多选里
  const multi = tabs.filter((x) => x.highlighted).length > 1;
  $('#tabs').replaceChildren(
    ...visibleTabs().map(({ tab, depth }) => {
      const muted = tab.mutedInfo?.muted;
      const cls = ['row', tab.active && 'active', multi && tab.highlighted && 'selected', isUnloaded(tab) && 'discarded', tab.status === 'loading' && 'loading'].filter(Boolean).join(' ');
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
        !isUnloaded(tab) && freeButton(),
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
  refreshTrail();
  refreshSleepAnim();
  applyCursor();
  saveSnapshot();
}

// 把这次画出来的样子存一份,下次打开侧边栏时 boot.js 先把它显示出来,免得先空一下
const SNAPSHOT_PARTS = ['favs', 'space-name', 'pins', 'tabs', 'spaces'];
let snapshotTimer;
function saveSnapshot() {
  clearTimeout(snapshotTimer);
  snapshotTimer = setTimeout(() => {
    try {
      // 键盘选中框不存进去,下次打开时不该出现
      const html = Object.fromEntries(SNAPSHOT_PARTS.map((id) => [id, document.getElementById(id).innerHTML.replace(/ kb-(focus|pop)| fp(-\w+)?\b/g, '')]));
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
