// 搜索时顺便查浏览历史:最近 30 天里标题或地址匹配的网页,列在标签页下面的「历史记录」里,先列 8 条,最近访问的在前;
// 还有更多时末尾一行「再显示 N 条」,点了展开到最多 50 条。
// 历史记录是整个浏览器共用的,不分空间;这个窗口里已经开着的地址不重复列。
// 输入两个字以上才查,停顿一下再查,免得每敲一个字查一次。点一下在新标签页打开,归入当前空间;
// 点行尾的叉号(或选中后按 Delete)从浏览器的历史记录里删掉这个网址

import { $, faviconFor, h, icon } from './dom.js';
import { durationParts } from './logic.js';
import { formatDuration, t } from './i18n.js';
import { query, tabs } from './store.js';

const DAYS = 30;
const MAX = 8;
const LIMIT = 50; // 「显示更多」最多展开到这么多条
let searched = null; // 上次查的搜索词
let timer;
let seq = 0;
let hits = []; // 这次查到的全部(已去掉开着的)
let expanded = false; // 点过「显示更多」;换了搜索词就收回 8 条

// render() 每次重画后调用:搜索词变了才重新查
export function refreshHistory() {
  const q = query.trim();
  if (q === searched) return;
  searched = q;
  expanded = false;
  clearTimeout(timer);
  if (q.length < 2) return paint([]);
  timer = setTimeout(() => load(q), 150);
}

async function load(q) {
  const mine = ++seq;
  const found = await chrome.history.search({ text: q, startTime: Date.now() - DAYS * 86400000, maxResults: LIMIT }).catch(() => []);
  // 等结果的时候又输入了别的:这次的作废
  if (mine !== seq) return;
  const open = new Set(tabs.map((x) => x.url));
  paint(found.filter((x) => x.url && !open.has(x.url)));
}

// 从浏览器的历史记录里删掉这个网址(所有访问记录):列表里先立刻去掉,再重新查一次补满
export async function deleteHistory(url) {
  paint(hits.filter((x) => x.url !== url));
  await chrome.history.deleteUrl({ url }).catch(() => {});
  if (searched?.length >= 2) load(searched);
}

// 点了末尾的「显示更多」:把这次查到的全列出来
export function expandHistory() {
  expanded = true;
  paint(hits);
}

function paint(list) {
  hits = list;
  const shown = expanded ? list : list.slice(0, MAX);
  const more = list.length - shown.length;
  const box = $('#history');
  box.hidden = !list.length;
  const rows = shown.map((x) =>
      h(
        'div',
        { class: 'row hist', data: { kind: 'hist', id: x.url } },
        h('img', { class: 'icon', src: faviconFor(x.url), alt: '', draggable: false }),
        h('span', { class: 'title' }, x.title || x.url),
        x.lastVisitTime && h('span', { class: 'ago' }, t('ago', { duration: formatDuration(durationParts(Date.now() - x.lastVisitTime)) })),
        h('button', { class: 'btn x', title: t('deleteHistory'), data: { act: 'close' } }, icon('close'))
      )
  );
  // 还有没列出来的:末尾一行「再显示 N 条」,点一下(或选中后按回车)展开,选中框落到原来第 9 条上
  if (more > 0) rows.push(h('div', { class: 'row hist-more', data: { kind: 'hist-more', id: 'more' } }, Object.assign(icon('chevron'), { className: 'i open' }), h('span', { class: 'title' }, t('historyMore', { n: more }))));
  $('#history-list').replaceChildren(...rows);
}
