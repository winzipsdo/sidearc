// 上次的标签页没有回来(Chrome 的「启动时」没选「从上次停下的地方继续」):后台把它们存成 lastSession
// (见 background.js 的 keepLastSession),这里在顶部给一条提示,点「恢复」照原样打开回来。
// 不自动恢复:用户在 Chrome 里选了别的启动方式,多半就是不想要旧标签页。提示关掉后「最近关闭」菜单里还能恢复

import { $, h, icon } from './dom.js';
import { t } from './i18n.js';
import { LAST_TAKEN } from './protocol.js';
import { render, schedule } from './render.js';
import { bind, findItem, replaceTabId, setBind, setRenderHeld, setTabAlias, setTabParent, setTabSpace, state, windowId } from './store.js';
import { createTab } from './tabs.js';
import { toast } from './ui.js';

let last = null;

export async function initRestore() {
  ({ lastSession: last = null } = await chrome.storage.local.get('lastSession'));
  showBar();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.lastSession) return;
    last = changes.lastSession.newValue ?? null;
    showBar();
  });
}

// 还能恢复几个:没有就是 0
export const lastSessionCount = () => last?.todo.length ?? 0;

// 出现和收起都有动效(见 sidepanel.css):收起时内容留着,不然动效还没走完就空了
function showBar() {
  const bar = $('#restore-bar');
  const n = lastSessionCount();
  const show = n > 0 && !last.dismissed;
  bar.classList.toggle('show', show);
  if (!show) return;
  bar.querySelector('.card').replaceChildren(
    h('span', {}, t('lastSessionBar', { n })),
    h('button', { class: 'restore', onclick: restoreLastSession }, t('restore')),
    h('button', { class: 'ghost', title: t('dismiss'), onclick: () => chrome.storage.local.set({ lastSession: { ...last, dismissed: true } }) }, icon('close'))
  );
}

async function waitForUrl(id) {
  for (let i = 0; i < 60; i++) {
    const tab = await chrome.tabs.get(id).catch(() => null);
    if (!tab || tab.url) return;
    await new Promise((r) => setTimeout(r, 50));
  }
}

// 照原样打开:原来的空间、顺序、父子层级、别名,原来绑着收藏/固定项的重新绑上。
// 一律先休眠(点到才加载),几十个一起开也不卡。哪个窗口里都已经开着同一地址的跳过
export async function restoreLastSession() {
  const s = last;
  if (!s) return;
  // 先告诉后台别再提示:恢复出来的标签页会被它陆续对上,中途它会以为还缺着
  await chrome.storage.session.set({ [LAST_TAKEN]: 1 });
  await chrome.storage.local.remove('lastSession');
  const open = new Set((await chrome.tabs.query({})).map((x) => x.url || x.pendingUrl));
  const made = {};
  // 新开的标签页在设好空间之前不重画,免得先被归到当前空间、闪一下
  setRenderHeld(true);
  try {
    for (const pos of s.todo) {
      const e = s.tabs[pos];
      if (open.has(e.u)) continue;
      open.add(e.u);
      const tab = await createTab({ windowId, url: e.u, active: false }).catch(() => null);
      if (!tab) continue;
      made[pos] = tab.id;
      await setTabSpace(tab.id, state.spaces.some((x) => x.id === e.s) ? e.s : state.activeSpaceId);
      if (e.a) await setTabAlias(tab.id, e.a);
      for (const itemId of e.b ?? []) if (findItem(itemId) && !bind.has(itemId)) await setBind(itemId, tab.id);
    }
    // 父子关系:父标签页也是刚恢复的,或者是 Chrome 自己打开、当时已经对上的
    for (const [pos, id] of Object.entries(made)) {
      const p = s.tabs[pos].p;
      const parent = made[p] ?? s.claimed[p];
      if (parent != null && parent !== id && (await chrome.tabs.get(parent).catch(() => null))) await setTabParent(id, parent);
    }
    // 要等标签页记上了网址再休眠,太早休眠会丢掉网址,变成一个空白的新标签页
    await Promise.all(Object.values(made).map(waitForUrl));
    for (const id of Object.values(made)) {
      const done = await chrome.tabs.discard(id).catch(() => null);
      if (done && done.id !== id) replaceTabId(done.id, id);
    }
  } finally {
    setRenderHeld(false);
  }
  const n = Object.keys(made).length;
  toast(n ? t('lastSessionRestored', { n }) : t('lastSessionNothing'));
  schedule();
  render();
}
