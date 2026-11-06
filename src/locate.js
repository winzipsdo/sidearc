// 当前标签页滚出了视野:在它所在的那一边(上面或下面)浮出一个小胶囊,里面是它的图标和箭头。
// 点一下滚回去,让它停在中间并亮一下。它露出来哪怕一点就收起;搜索时不出现(可能被过滤掉了)。
// 收藏在滚动区外面,一直看得见,不管;别的空间、别的窗口的标签页列表里没有这一行,也不管。
// 合并相同地址的标签页后,也用同样的方式滚到已有的那个(见 revealTab)

import { $, h } from './dom.js';
import { t } from './i18n.js';
import { bind, query } from './store.js';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const arrow = (d) => `<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
const ARROWS = { up: arrow('M8 12.5v-9M4.5 7L8 3.5 11.5 7'), down: arrow('M8 3.5v9M4.5 9L8 12.5 11.5 9') };

let btn;
const activeRow = () => $('#pins .row.active') || $('#tabs .row.active');

// 滚动、重画、窗口大小变了时调用
export function refreshLocate() {
  btn ??= makeButton();
  const row = !query.trim() && activeRow();
  const box = $('#scroll').getBoundingClientRect();
  const r = row?.getBoundingClientRect();
  // 留几像素余量:只露出一条边也算看得见
  const dir = !r || !r.height ? null : r.bottom < box.top + 6 ? 'up' : r.top > box.bottom - 6 ? 'down' : null;
  btn.classList.toggle('on', !!dir);
  if (!dir) return;
  btn.title = btn.ariaLabel = t('locateActive');
  btn.dataset.dir = dir;
  btn.style.setProperty('--top', box.top + 8 + 'px');
  btn.style.setProperty('--bottom', innerHeight - box.bottom + 10 + 'px');
  const src = row.querySelector('img.icon')?.src;
  if (btn.dataset.src !== src || btn.dataset.arrow !== dir) {
    btn.dataset.src = src;
    btn.dataset.arrow = dir;
    btn.replaceChildren(h('img', { src, alt: '', draggable: false }), h('span', { class: 'arrow', innerHTML: ARROWS[dir] }));
  }
}

function makeButton() {
  const el = h('button', { id: 'locate', type: 'button', onclick: locate });
  document.body.append(el);
  return el;
}

function locate() {
  goTo(activeRow);
}

// 滚到这一项(已经整个看得见就不滚)并让它亮一下。find 每次重新找:重画后元素会换掉
function goTo(find) {
  const row = find();
  if (!row) return;
  const scroll = $('#scroll');
  // 滚到了再亮:平滑滚动要一会儿,先亮的话还没看见就亮完了
  let done = false;
  const flash = () => {
    if (done) return;
    done = true;
    refreshLocate();
    const el = find();
    if (!el) return;
    el.classList.remove('located');
    void el.offsetWidth;
    el.classList.add('located');
    el.addEventListener('animationend', () => el.classList.remove('located'), { once: true });
  };
  const box = scroll.getBoundingClientRect();
  const r = row.getBoundingClientRect();
  if (!scroll.contains(row) || (r.top >= box.top && r.bottom <= box.bottom)) return flash();
  scroll.addEventListener('scrollend', flash, { once: true });
  setTimeout(flash, 700);
  row.scrollIntoView({ block: 'center', behavior: reduceMotion.matches ? 'auto' : 'smooth' });
}

// 合并了相同地址的标签页(后台关掉新开的、切到已有的):滚到已有的那个,告诉你它在哪。
// 消息可能比列表重画先到,这时先记着,重画后(revealPending)再滚;等太久了就算了
let pending = null;
const rowOf = (tabId) => () => {
  const item = [...bind].find(([, id]) => id === tabId)?.[0];
  return item ? $(`#pins [data-kind="pin"][data-id="${item}"], #favs [data-kind="fav"][data-id="${item}"]`) : $(`#tabs [data-kind="tab"][data-id="${tabId}"]`);
};
export function revealTab(tabId) {
  pending = { find: rowOf(tabId), until: Date.now() + 2000 };
  // 新开的那个刚被关掉,列表多半马上要重画、少一行:等一下再滚,免得滚完位置又变
  setTimeout(revealPending, 200);
}
export function revealPending() {
  if (!pending) return;
  if (Date.now() > pending.until) return (pending = null);
  if (query.trim() || !pending.find()) return;
  const { find } = pending;
  pending = null;
  goTo(find);
}
