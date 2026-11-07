// 固定标签里的文件夹:{ id, folder: true, name, open, noHistory?, items: [项] }。
// 文件夹只放在空间的固定区顶层,里面只放固定项,不再嵌套。

import { t } from './i18n.js';
import { isFolder } from './logic.js';
import { render } from './render.js';
import { closeItemTab, detachTab } from './items.js';
import { h } from './dom.js';
import { activeSpace, bind, findItem, save, setBind, setPressing, setRenderHeld, setTabAlias, setTabSpace, state, tabs, takeItem, uid, unbind, windowId } from './store.js';
import { createTab, returnBeforeClose } from './tabs.js';
import { ask, pushUndo, toast } from './ui.js';

export function findFolder(id) {
  for (const space of state.spaces) {
    const folder = space.pinned.find((x) => isFolder(x) && x.id === id);
    if (folder) return { folder, space };
  }
  return null;
}

// 新建文件夹;给了 itemId 就把那个固定项移进去
export async function createFolder(itemId) {
  const out = await ask(t('newFolderTitle'), [{ key: 'name', label: t('name'), value: '' }]);
  if (!out) return;
  const folder = { id: uid(), folder: true, name: out.name, open: true, items: [] };
  const space = activeSpace();
  const hit = itemId && findItem(itemId);
  // 放在被移入的那一项原来的位置,否则放在固定区最后
  const at = hit && hit.list === space.pinned ? space.pinned.indexOf(hit.item) : space.pinned.length;
  const item = itemId && takeItem(itemId);
  if (item) folder.items.push(item);
  space.pinned.splice(at, 0, folder);
  await save();
  render();
}

export async function renameFolder(id) {
  const folder = findFolder(id)?.folder;
  if (!folder) return;
  const out = await ask(t('renameFolderTitle'), [{ key: 'name', label: t('name'), value: folder.name }]);
  const target = out && findFolder(id)?.folder;
  if (!target) return;
  target.name = out.name;
  await save();
  render();
}

// 展开、收起的动效:里面的几行像抽屉一样,从文件夹那一行下面整块滑出来、滑回去,同时淡入、淡出,
// 文件夹那一行的箭头同时转下来、转回去。动画时临时把这几行装进一个裁剪用的容器,播完整体重画,容器就没了;
// 这期间暂停重画(保存状态会触发一次),不然动画会被打断。行之间有 2px 间隔,容器高度为 0 时用 -2px 上边距抵掉
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
// 动画都用 fill: 'both':连续点击时会把正在播的动画倒着播回去(见 toggleFolder),倒回起点也得停在起点的样子
function drawer(id, opening) {
  const els = [...document.querySelectorAll(`#pins [data-in="${id}"]`)];
  if (!els.length) return [];
  const box = h('div', { class: 'drawer' });
  els[0].before(box);
  box.append(...els);
  const full = box.offsetHeight;
  // 展开:起步柔和、中间匀速、最后轻轻停稳,同时从半透明变实,边缘不像被硬切出来的;收起更快,滑回去时变淡。
  // 展开不能用起步太猛的曲线:文件夹里只有一两行时,头几十毫秒就走完大半,看着像一下子弹出来、没有动效
  const opts = { ...timing(opening), fill: 'both' };
  const shut = { height: '0px', marginTop: '-2px' };
  const open = { height: `${full}px`, marginTop: '0px' };
  const out = { transform: `translateY(-${full}px)`, opacity: 0.2 };
  const home = { transform: 'none', opacity: 1 };
  return [box.animate(opening ? [shut, open] : [open, shut], opts), ...els.map((el) => el.animate(opening ? [out, home] : [home, out], opts))];
}
const timing = (opening) => (opening ? { duration: 320, easing: 'cubic-bezier(0.3, 0, 0.2, 1)' } : { duration: 240, easing: 'cubic-bezier(0.4, 0, 1, 1)' });
const chevOf = (id) => document.querySelector(`#pins .row.folder[data-id="${id}"] .i`);
// 箭头:展开时从朝右转到朝下,收起时反过来,时长、曲线和抽屉一样。
// 直接播一段转动的动画,不靠 CSS 过渡:展开前的那次重画已经把箭头画成朝下、浏览器也量过一次布局,
// 再退回朝右、切回朝下的话,过渡只会往回转一点又转回来,几乎看不出动
function flipIcon(id, opening) {
  const ico = chevOf(id);
  if (!ico) return [];
  ico.classList.toggle('open', opening);
  const turn = [{ transform: 'rotate(0deg)' }, { transform: 'rotate(90deg)' }];
  const chev = ico.querySelector('.chev');
  return chev ? [chev.animate(opening ? turn : turn.reverse(), { ...timing(opening), fill: 'both' })] : [];
}

// 正在播的展开 / 收起:{ id, anims, done }。播完前又点了同一个文件夹,就让这些动画从当前位置原路倒回去,
// 而不是另起一段(新的一段会从完全展开或完全收起的地方开始,画面会跳一下)
let running = null;

export async function toggleFolder(id) {
  const folder = findFolder(id)?.folder;
  if (!folder) return;
  // 点击已经发生了:提前结束「按着鼠标时不重画」(见 events.js),不然展开时里面的几行要等松手后才画出来,抽屉就没的可拉
  setPressing(false);
  // 只在动画还在播的时候倒回去;刚好播完、还没收尾重画的那一瞬间又点的,等收尾完再正常开合,
  // 不然倒放已经播完的动画、紧接着收尾重画又把画面切到最终状态,箭头和抽屉就对不上
  if (running?.id === id && running.anims.some((a) => a.playState === 'running')) {
    folder.open = !folder.open;
    chevOf(id)?.classList.toggle('open', folder.open);
    for (const a of running.anims) a.reverse();
    save();
    return;
  }
  // 别的文件夹还在播:直接播完,再开始这一个
  if (running) {
    for (const a of running.anims) a.finish();
    await running.done;
  }
  const opening = !folder.open;
  folder.open = opening;
  if (reduceMotion.matches) {
    await save();
    return render();
  }
  // 展开先把里面的行画出来,抽屉才有东西可拉;之后到播完都暂停重画(保存状态会触发一次),不然动画会被打断
  if (opening) render();
  setRenderHeld(true);
  const saved = save();
  const anims = [...flipIcon(id, opening), ...drawer(id, opening)];
  let finish;
  running = { id, anims, done: new Promise((r) => (finish = r)) };
  try {
    await Promise.all(anims.map((a) => a.finished.catch(() => {})));
    await saved;
  } finally {
    running = null;
    setRenderHeld(false);
  }
  // 按最后的状态(中途可能被倒回去了)整体重画,临时的容器和动画就都没了
  render();
  finish();
}

// 不记录历史:文件夹里的项打开的标签页,访问记录由 background.js 立刻删掉;开启时顺手清掉已打开页面的记录
export async function toggleFolderNoHistory(id) {
  const folder = findFolder(id)?.folder;
  if (!folder) return;
  folder.noHistory = !folder.noHistory;
  if (!folder.noHistory) delete folder.noHistory;
  await save();
  render();
  if (folder.noHistory) {
    for (const item of folder.items) {
      const tab = tabs.find((t) => t.id === bind.get(item.id));
      if (tab?.url) chrome.history.deleteUrl({ url: tab.url }).catch(() => {});
    }
  }
  toast(t(folder.noHistory ? 'folderNoHistoryOn' : 'folderNoHistoryOff', { name: folder.name }));
}

// 关掉文件夹里所有开着的标签页,固定标签都留着(和单个固定标签的「关闭」一样,点一下就重新打开)。
// 一下关好几个可能是手滑,所以可以撤销:先用浏览器的「最近关闭」恢复(保留前进后退记录),找不到就按固定的地址重新打开,再绑回原来的固定标签
export async function closeFolderTabs(id) {
  const folder = findFolder(id)?.folder;
  if (!folder) return;
  const open = folder.items.filter((i) => bind.has(i.id)).map((i) => ({ item: i, tab: tabs.find((t) => t.id === bind.get(i.id)) }));
  if (!open.length) return;
  await returnBeforeClose(new Set(open.map((x) => bind.get(x.item.id))));
  for (const { item } of open) await closeItemTab(item);
  pushUndo(t('closedTabs', { n: open.length }), async () => {
    const recent = (await chrome.sessions.getRecentlyClosed().catch(() => [])).filter((s) => s.tab);
    for (const { item, tab: was } of open) {
      if (!findItem(item.id) || bind.has(item.id)) continue;
      const url = was?.url || item.url;
      const i = recent.findIndex((r) => r.tab.url === url);
      let tab = i < 0 ? null : (await chrome.sessions.restore(recent.splice(i, 1)[0].tab.sessionId).catch(() => null))?.tab;
      tab ??= await createTab({ url: item.url, windowId, active: false }).catch(() => null);
      if (!tab) continue;
      await detachTab(tab.id);
      await setBind(item.id, tab.id);
    }
    render();
  });
}

// 删除文件夹:连同里面的固定标签一起删。开着的标签页留下,变成这个空间里的普通标签页(和取消固定一样)
export async function deleteFolder(id) {
  const hit = findFolder(id);
  if (!hit) return;
  const { folder, space } = hit;
  const at = space.pinned.indexOf(folder);
  space.pinned.splice(at, 1);
  const opened = [];
  for (const item of folder.items) {
    const tabId = bind.get(item.id);
    if (tabId == null) continue;
    opened.push([item.id, tabId]);
    await unbind(item.id);
    await setTabSpace(tabId, space.id);
    await setTabAlias(tabId, item.alias);
  }
  await save();
  render();
  pushUndo(t('folderDeleted', { name: folder.name }), async () => {
    const s = state.spaces.find((x) => x.id === space.id);
    if (!s || findFolder(id)) return;
    s.pinned.splice(Math.min(at, s.pinned.length), 0, folder);
    // 标签页还开着的话重新绑回原来的固定标签
    for (const [itemId, tabId] of opened) {
      if (!(await chrome.tabs.get(tabId).catch(() => null))) continue;
      await detachTab(tabId);
      await setBind(itemId, tabId);
    }
    await save();
    render();
  });
}

// 把固定项移进文件夹(folderId 为 null 则移出到固定区顶层,放在原文件夹后面)
export async function moveToFolder(itemId, folderId) {
  const hit = findItem(itemId);
  if (!hit || hit.kind !== 'pin') return;
  const space = hit.space;
  if (folderId == null) {
    if (!hit.folder) return;
    const item = takeItem(itemId);
    space.pinned.splice(space.pinned.indexOf(hit.folder) + 1, 0, item);
  } else {
    const folder = space.pinned.find((x) => isFolder(x) && x.id === folderId);
    if (!folder) return;
    folder.items.push(takeItem(itemId));
    folder.open = true;
  }
  await save();
  render();
}
