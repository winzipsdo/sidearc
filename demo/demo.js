// 在线试用:在主页上画一个假的 Chrome 窗口(顶部标签栏、地址栏、网页),
// 插件真正的侧边栏(左边)和后台(看不见)跑在里面的 iframe 里,用的是 sim.js 模拟的 chrome.* 接口。
// 用户在这里做的操作(拖动、切换空间、休眠……)通过 onAction 报给主页,用来勾掉试用任务。

import { Browser } from './sim.js';
import { GLOBE, iconFor, NEW_TAB, page, scenario, tiles } from './web.js';
import { buildLayout, groupColor, toUrl } from '../ext/src/logic.js';
import { KEY, MSG } from '../ext/src/protocol.js';

const TEXT = {
  zh: { back: '后退', forward: '前进', reload: '重新加载', newTab: '新建标签页', close: '关闭', toggle: '打开/关闭侧边栏', search: '搜索或输入网址', play: '播放', pause: '暂停', newTabHint: '点一个快捷方式。已经开着的网站不会再开一份:会直接切过去。', muted: '已静音' },
  en: { back: 'Back', forward: 'Forward', reload: 'Reload', newTab: 'New tab', close: 'Close', toggle: 'Toggle the sidebar', search: 'Search or type a URL', play: 'Play', pause: 'Pause', newTabHint: 'Pick a shortcut. A site that’s already open won’t open twice: you’ll jump to it instead.', muted: 'Muted' },
};
const ICON = {
  back: '<path d="M10 3.5L5.5 8l4.5 4.5"/>',
  forward: '<path d="M6 3.5L10.5 8 6 12.5"/>',
  reload: '<path d="M12.8 8a4.8 4.8 0 11-1.4-3.4M12.8 2.8v2.6h-2.6"/>',
  close: '<path d="M5 5l6 6M11 5l-6 6"/>',
  plus: '<path d="M8 3.5v9M3.5 8h9"/>',
  sound: '<path d="M2.5 6.2v3.6h2.3L8 12.5v-9L4.8 6.2z"/><path d="M10.5 5.8a3 3 0 010 4.4"/>',
  muted: '<path d="M2.5 6.2v3.6h2.3L8 12.5v-9L4.8 6.2z"/><path d="M10.8 6.3l3 3.4M13.8 6.3l-3 3.4"/>',
  newtab: '<path d="M9.5 2.5h4v4"/><path d="M13.5 2.5L8 8"/><path d="M12 9.5v3a1 1 0 01-1 1H3.5a1 1 0 01-1-1V5a1 1 0 011-1h3"/>',
  play: '<path d="M5 3.5v9l7-4.5z" fill="currentColor"/>',
  pause: '<path d="M5.5 3.5v9M10.5 3.5v9"/>',
};
const svg = (name, size = 14) => `<svg viewBox="0 0 16 16" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`;
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const LOGO = 'assets/logo.svg';

// 打开试用时的样子:按 web.js 的设定开好标签页、写好存储,再按侧边栏的顺序排好、分好组
function setup(b, lang) {
  const { state, tabs } = scenario(lang);
  const now = Date.now();
  const session = {};
  const byKey = {};
  tabs.forEach((d, i) => {
    const p = page(d.url, lang);
    const t = b.newTab({
      url: d.url,
      title: p.title,
      favIconUrl: p.icon,
      status: d.slept ? 'unloaded' : 'complete',
      discarded: !!d.slept,
      playing: !!d.playing,
      audible: !!d.playing && !d.slept,
      lastAccessed: now - (tabs.length - i) * 60000,
    });
    b.history.set(t.id, { list: [d.url], pos: 0 });
    b.tabs.push(t);
    byKey[d.key] = t;
    if (d.space) session[KEY.space(t.id)] = d.space;
    if (d.item) session[KEY.bind(d.item)] = t.id;
    if (d.alias) session[KEY.alias(t.id)] = d.alias;
    if (d.slept) session[KEY.slept(t.id)] = now - d.slept * 60000;
  });
  for (const d of tabs) if (d.parent) session[KEY.parent(byKey[d.key].id)] = byKey[d.parent].id;
  const layout = buildLayout(state, session, b.tabs);
  const order = layout.flatMap((c) => c.ids);
  b.tabs.sort((x, y) => order.indexOf(x.id) - order.indexOf(y.id));
  b.reindex();
  for (const c of layout) {
    const space = state.spaces.find((s) => s.id === c.spaceId);
    if (!space) continue;
    const g = { id: b.nextGroup++, windowId: 1, title: space.name, color: groupColor(space.color), collapsed: space.id !== state.activeSpaceId };
    b.groups.set(g.id, g);
    session[KEY.group(g.id)] = space.id;
    for (const id of c.ids) b.tab(id).groupId = g.id;
  }
  const active = byKey[tabs.find((d) => d.active).key];
  Object.assign(active, { active: true, highlighted: true, selected: true, lastAccessed: now });
  // 足迹:刚才离开的几个标签页
  const left = tabs.filter((d) => d.trail).sort((x, y) => x.trail - y.trail);
  session[KEY.trail(1)] = { active: active.id, trail: left.map((d) => ({ id: byKey[d.key].id, at: now - d.trail * 60000 })) };
  b.store.local = { state, lang, trail: true };
  b.store.session = session;
}

export function mountDemo(root, { lang, onAction = () => {} }) {
  let b;
  let tx;
  let dragging = null;
  let lastPage = '';

  root.classList.add('sb');
  root.innerHTML = `
    <div class="sb-window">
      <div class="sb-strip"><div class="sb-lights"><i></i><i></i><i></i></div><div class="sb-tabs"></div></div>
      <div class="sb-toolbar">
        <button class="sb-btn" data-act="back">${svg('back')}</button>
        <button class="sb-btn" data-act="forward">${svg('forward')}</button>
        <button class="sb-btn" data-act="reload">${svg('reload')}</button>
        <form class="sb-omni"><img alt=""><input spellcheck="false" autocomplete="off"></form>
        <button class="sb-btn sb-ext" data-act="side"><img src="${LOGO}" alt=""></button>
      </div>
      <div class="sb-main">
        <div class="sb-side"></div>
        <div class="sb-page"></div>
      </div>
    </div>`;
  const $ = (s) => root.querySelector(s);
  const strip = $('.sb-tabs');
  const pageEl = $('.sb-page');
  const omni = $('.sb-omni input');

  // ---------- 顶部标签栏 ----------

  function renderStrip() {
    if (dragging) return;
    const html = [];
    let prevGroup = -1;
    for (const t of b.tabs) {
      const g = b.groups.get(t.groupId);
      if (g && t.groupId !== prevGroup) {
        html.push(`<button class="sb-chip${g.collapsed ? ' collapsed' : ''}" data-group="${g.id}" data-color="${g.color}" title="${esc(g.title)}">${esc(g.title) || '&nbsp;'}</button>`);
      }
      prevGroup = t.groupId;
      if (g?.collapsed) continue;
      const icon = t.status === 'loading' ? '<span class="sb-spin"></span>' : `<img src="${esc(t.favIconUrl || iconFor(t.url))}" alt="">`;
      const sound = t.audible || t.mutedInfo?.muted ? `<span class="sb-sound${t.mutedInfo?.muted ? ' muted' : ''}">${svg(t.mutedInfo?.muted ? 'muted' : 'sound', 12)}</span>` : '';
      html.push(
        `<div class="sb-tab${t.active ? ' active' : ''}${t.discarded || t.status === 'unloaded' ? ' asleep' : ''}${t.highlighted && !t.active ? ' picked' : ''}${g ? ' grouped' : ''}" data-id="${t.id}" data-color="${g?.color ?? ''}" title="${esc(t.title)}">${icon}<span class="sb-title">${esc(t.title || TEXT[lang].newTab)}</span>${sound}<button class="sb-x" data-act="close" title="${TEXT[lang].close}">${svg('close', 12)}</button></div>`
      );
    }
    html.push(`<button class="sb-btn sb-new" data-act="new" title="${TEXT[lang].newTab}">${svg('plus')}</button>`);
    strip.innerHTML = html.join('');
  }

  strip.addEventListener('click', (e) => {
    const chip = e.target.closest('.sb-chip');
    if (chip) {
      const g = b.groups.get(+chip.dataset.group);
      if (g?.collapsed) onAction('groupExpand');
      return b.userToggleGroup(+chip.dataset.group);
    }
    if (e.target.closest('[data-act="new"]')) return b.create({}, { transition: 'typed' });
    const tab = e.target.closest('.sb-tab');
    if (tab && e.target.closest('[data-act="close"]')) b.remove(+tab.dataset.id);
  });
  strip.addEventListener('auxclick', (e) => {
    const tab = e.target.closest('.sb-tab');
    if (tab && e.button === 1) b.remove(+tab.dataset.id);
  });
  // 拖动顶部的标签页换位置;没拖动就是点击切换
  strip.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('.sb-tab');
    if (!el || e.button !== 0 || e.target.closest('.sb-x')) return;
    const id = +el.dataset.id;
    const x0 = e.clientX;
    let moved = false;
    const others = [...strip.querySelectorAll('.sb-tab')].filter((x) => x !== el);
    const onMove = (ev) => {
      const dx = ev.clientX - x0;
      if (!moved && Math.abs(dx) < 6) return;
      if (!moved) {
        moved = true;
        dragging = { id };
        el.classList.add('dragging');
        el.setPointerCapture?.(e.pointerId);
      }
      el.style.transform = `translateX(${dx}px)`;
      const mid = el.getBoundingClientRect().left + el.offsetWidth / 2;
      dragging.before = others.find((x) => mid < x.getBoundingClientRect().left + x.offsetWidth / 2) ?? null;
      for (const x of others) x.classList.toggle('gap-before', x === dragging.before);
      strip.classList.toggle('gap-end', !dragging.before);
    };
    const onUp = () => {
      removeEventListener('pointermove', onMove);
      removeEventListener('pointerup', onUp);
      if (!moved) return b.activate(b.tab(id));
      const before = dragging.before;
      dragging = null;
      strip.classList.remove('gap-end');
      const t = b.tab(id);
      const rest = b.tabs.filter((x) => x !== t);
      const to = before ? rest.findIndex((x) => x.id === +before.dataset.id) : rest.indexOf(b.tab(+others.at(-1)?.dataset.id || id)) + 1;
      b.userMove(id, to);
      onAction('stripDrag');
      renderStrip();
    };
    addEventListener('pointermove', onMove);
    addEventListener('pointerup', onUp);
  });

  // ---------- 地址栏和网页 ----------

  function renderToolbar() {
    const t = b.active;
    if (!t) return;
    $('.sb-omni img').src = t.url === NEW_TAB || /^chrome:/.test(t.url) ? GLOBE : t.favIconUrl || iconFor(t.url);
    if (document.activeElement !== omni) omni.value = t.url === NEW_TAB ? '' : t.url;
    omni.placeholder = TEXT[lang].search;
    const h = b.history.get(t.id);
    $('[data-act="back"]').disabled = !h || h.pos <= 0;
    $('[data-act="forward"]').disabled = !h || h.pos >= h.list.length - 1;
  }

  function renderPage() {
    const t = b.active;
    if (!t) return;
    const key = [t.id, t.url, t.status, t.audible, t.mutedInfo?.muted].join('|');
    if (key === lastPage) return;
    lastPage = key;
    const p = page(t.url, lang);
    const T = TEXT[lang];
    if (p.kind === 'newtab') {
      pageEl.innerHTML = `<div class="sb-ntp"><img class="sb-ntp-logo" src="${LOGO}" alt=""><p class="sb-hint">${T.newTabHint}</p><div class="sb-tiles">${tiles(lang)
        .map((u) => `<button class="sb-tile" data-url="${esc(u)}"><span><img src="${esc(iconFor(u))}" alt=""></span>${esc(page(u, lang).title.split(/ [–|-] /)[0])}</button>`)
        .join('')}</div></div>`;
      return;
    }
    const loading = t.status === 'loading';
    const site = p.site ?? { name: '', color: '#888', icon: GLOBE };
    const links = (p.links ?? [])
      .map((l) => `<a href="${esc(l.url)}" class="sb-link" data-url="${esc(l.url)}"${l.newTab ? ' data-new="1"' : ''}>${esc(l.label)}${l.newTab ? `<span class="sb-new-badge">${svg('newtab', 12)}</span>` : ''}</a>`)
      .join('');
    const player = p.media
      ? `<div class="sb-player"><button class="sb-play" data-act="media">${svg(t.audible ? 'pause' : 'play', 22)}</button><div class="sb-wave${t.audible && !t.mutedInfo?.muted ? ' on' : ''}">${'<i></i>'.repeat(24)}</div>${t.mutedInfo?.muted ? `<span class="sb-muted">${T.muted}</span>` : ''}</div>`
      : '';
    pageEl.innerHTML = `<div class="sb-doc${loading ? ' loading' : ''}" style="--site:${site.color}">
      <div class="sb-site"><img src="${esc(site.icon)}" alt=""><span>${esc(site.name)}</span></div>
      <h3>${esc(p.title)}</h3>
      ${p.text ? `<p class="sb-text">${esc(p.text)}</p>` : '<i class="sb-sk" style="width:86%"></i><i class="sb-sk" style="width:70%"></i>'}
      ${player}
      ${links ? `<nav class="sb-links">${links}</nav>` : ''}
      <i class="sb-sk" style="width:92%"></i><i class="sb-sk" style="width:64%"></i><i class="sb-sk block"></i>
    </div>`;
  }

  pageEl.addEventListener('click', (e) => {
    const tile = e.target.closest('.sb-tile');
    if (tile) return b.navigate(b.active, tile.dataset.url, 'auto_bookmark');
    if (e.target.closest('[data-act="media"]')) return b.setAudible(b.active, !b.active.audible);
    const a = e.target.closest('.sb-link');
    if (!a) return;
    e.preventDefault();
    const background = e.ctrlKey || e.metaKey;
    if (a.dataset.new || background) onAction('childTab');
    b.userOpen(a.dataset.url, { newTab: !!a.dataset.new, background });
  });
  // 中键:在后台新标签页打开
  pageEl.addEventListener('auxclick', (e) => {
    const a = e.target.closest('.sb-link');
    if (!a || e.button !== 1) return;
    e.preventDefault();
    onAction('childTab');
    b.userOpen(a.dataset.url, { background: true });
  });

  root.querySelector('.sb-toolbar').addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'back') b.userBack(-1);
    if (act === 'forward') b.userBack(1);
    if (act === 'reload') b.navigate(b.active, b.active.url, 'reload');
    if (act === 'side') root.classList.toggle('no-side');
  });
  $('.sb-omni').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = omni.value.trim();
    if (!q) return;
    omni.blur();
    b.navigate(b.active, toUrl(q) ?? `https://www.google.com/search?q=${encodeURIComponent(q)}`, 'typed');
  });
  omni.addEventListener('focus', () => omni.select());

  function render() {
    renderStrip();
    renderToolbar();
    renderPage();
  }

  // ---------- 插件:后台和侧边栏 ----------

  // 插件调用了哪些接口:用来判断试用任务
  function watch(name, ctx, args) {
    if (ctx === 'panel') {
      if (name === 'tabs.discard') onAction('sleep');
      if (name === 'sessions.restore') onAction('undo');
      if (name === 'tabs.update' && args[1]?.url) onAction('pinBack');
      if (name === 'storage.local.set' && args[0]?.state && args[0].state.activeSpaceId !== b.store.local.state?.activeSpaceId) onAction('space');
    }
    if (ctx === 'background' && name === 'storage.local.set' && args[0]?.state && args[0].state.activeSpaceId !== b.store.local.state?.activeSpaceId) onAction('space');
    if (name === 'runtime.sendMessage' && (args[0]?.[MSG.deduped] || args[0]?.[MSG.adopted])) onAction('dedupe');
  }

  async function start(nextLang) {
    lang = nextLang;
    root.classList.add('booting');
    for (const f of root.querySelectorAll('iframe')) f.remove();
    lastPage = '';
    b = new Browser(lang, {
      change: () => {
        cancelAnimationFrame(tx);
        tx = requestAnimationFrame(render);
      },
      call: watch,
    });
    window.sidearcDemo = { connect: (win, name) => b.connect(win, name), favicon: iconFor };
    setup(b, lang);
    render();
    // 先启动后台,再打开侧边栏,和真的浏览器一样
    const bg = document.createElement('iframe');
    bg.className = 'sb-bg';
    bg.hidden = true;
    bg.src = 'ext/background.html';
    await new Promise((r) => {
      bg.onload = r;
      root.append(bg);
    });
    const panel = document.createElement('iframe');
    panel.className = 'sb-panel';
    panel.title = 'Sidearc';
    panel.allow = 'clipboard-write';
    panel.src = 'ext/sidepanel.html';
    panel.onload = () => {
      root.classList.remove('booting');
      const w = panel.contentWindow;
      w.addEventListener('keydown', (e) => /^Arrow(Up|Down)$/.test(e.key) && onAction('keys'));
      w.addEventListener('drop', () => onAction('sidebarDrag'), true);
    };
    $('.sb-side').append(panel);
  }

  start(lang);
  return { reset: (next = lang) => start(next) };
}
