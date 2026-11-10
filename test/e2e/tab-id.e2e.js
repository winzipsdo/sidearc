// 标签页换编号(休眠后 Chrome 会给它一个新 id)和关闭:它的数据要跟着挪到新编号上,关掉时清干净

import { e2e } from './harness.js';

e2e(async (t) => {
  const p = await t.start();
  await p.ev(`for (const n of ['P', 'C', 'D']) await chrome.tabs.create({ url: ${JSON.stringify(t.url(''))} + n, active: false });`);
  await t.sleep(1500);
  const P = await p.id('P');
  const C = await p.id('C');
  const D = await p.id('D');
  // C 挂在 P 下,D 挂在 C 下;给 C 设别名、离开时间、撒过的落叶
  await p.ev(`await chrome.storage.session.set({ ['c:${C}']: ${P}, ['c:${D}']: ${C}, ['a:${C}']: '别名C', ['v:${C}']: 123, ['l:${C}']: 3 }); await new Promise((r) => setTimeout(r, 800));`);

  // 休眠 C:Chrome 会给它换编号
  const C2 = await p.ev(`return (await chrome.tabs.discard(${C})).id`);
  await t.sleep(1500);
  t.check('休眠后换了编号', C2 !== C, { C, C2 });
  const s = await p.session();
  const left = Object.keys(s).filter((k) => k[1] === ':' && k.endsWith(':' + C));
  t.check('存储里没有留下旧编号的键', left.length === 0, left);
  for (const k of ['t', 'a', 'c', 'v', 'l']) t.check(`存储里 ${k}: 挪到了新编号`, `${k}:${C2}` in s, Object.keys(s));
  t.check('父标签还是 P', s['c:' + C2] === P, s['c:' + C2]);
  t.check('D 的父标签改成了新编号', s['c:' + D] === C2, s['c:' + D]);
  const mem = await p.ev(`const m = await import('./src/store.js'); return { alias: m.tabAlias.get(${C2}), parent: m.tabParent.get(${C2}), child: m.tabParent.get(${D}), seen: m.tabSeen.get(${C2}), scat: m.tabScattered.get(${C2}), old: Object.values(m.TAB_MAPS).some((x) => x.has(${C})) }`);
  t.check('侧边栏内存里也挪好了', mem.alias === '别名C' && mem.parent === P && mem.child === C2 && mem.seen === 123 && mem.scat === 3 && !mem.old, mem);
  const rows = await p.rows();
  const row = rows.find((r) => r.title === 'C');
  t.check('列表里还是 P 的子标签、显示着别名、变淡了', row?.alias === '别名C' && row.depth === 1 && row.asleep, rows);

  // 关掉 C:它自己的键都删掉,子标签 D 一起关
  await p.ev(`await chrome.tabs.remove(${C2})`);
  await t.sleep(1500);
  const s2 = await p.session();
  const rest = Object.keys(s2).filter((k) => k[1] === ':' && k.endsWith(':' + C2));
  t.check('关掉后它的键都删了', rest.length === 0, rest);
  t.check('子标签 D 一起关了', (await p.id('D')) === null);
  t.check('整个过程没有报错', t.errors.length === 0, t.errors);
});
