// 空间 ↔ 顶部标签栏的分组(src/groups.js):每个空间一个分组,当前空间的展开、其他的收起;
// 只有新标签页时不建分组;别人建的分组不动;在标签栏里拖进别的空间的分组 = 移到那个空间

import { e2e } from './harness.js';

e2e(async (t) => {
  // 侧边栏放在单独的窗口里,测试的窗口里一开始只有一个新标签页
  const p = await t.start({ extra: ['chrome://newtab/'], newWindow: true });
  const win = await p.ev(`return (await chrome.tabs.query({})).find((t) => /newtab|new-tab-page/.test(t.url || t.pendingUrl)).windowId`);
  const groups = () =>
    p.ev(`return (await chrome.tabGroups.query({ windowId: ${win} })).map((g) => ({ id: g.id, title: g.title, collapsed: g.collapsed }))`);
  // 测试窗口的标签栏:标题{分组名},别的分组标出名字
  const strip = () =>
    p.ev(`
      const gs = new Map((await chrome.tabGroups.query({ windowId: ${win} })).map((g) => [g.id, g.title]));
      return (await chrome.tabs.query({ windowId: ${win} })).map((t) => (/newtab|new-tab-page/.test(t.url || t.pendingUrl) ? 'NEW' : t.title) + (t.groupId > -1 ? '{' + gs.get(t.groupId) + '}' : '')).join(' ');
    `);
  const open = (names) => p.open(names, { windowId: win });
  const space = (id) => p.ev(`return (await chrome.storage.session.get('t:${id}'))['t:${id}'] ?? null`);
  const homeName = await p.ev(`return (await import('./src/store.js')).state.spaces[0].name`);
  await p.settle();

  t.check('只有新标签页:不建分组(免得书签栏上的同名分组越积越多)', (await groups()).length === 0, await strip());

  // 打开真正的网页:只有一个空间也分组
  const ids = await open(['G1', 'G2', 'G3']);
  await p.settle();
  let s = await strip();
  console.log('  ', s);
  t.check('打开网页后:只有一个空间也分组,名字是空间名', (await groups()).length === 1 && ['G1', 'G2', 'G3'].every((n) => s.includes(`${n}{${homeName}}`)), s);

  // 别人建的分组(用户自己建的、别的扩展建的)
  const own = await open(['M1', 'M2']);
  await p.settle();
  await p.ev(`const g = await chrome.tabs.group({ tabIds: [${own.M1}, ${own.M2}], createProperties: { windowId: ${win} } }); await chrome.tabGroups.update(g, { title: 'Mine' }); window.__mine = g;`);
  await p.settle();
  s = await strip();
  console.log('  ', s);
  const mine = (await groups()).find((g) => g.title === 'Mine');
  t.check('别人的分组没被拆开,整组放在空间分组的后面', mine && /G3\{[^}]+\} M1\{Mine\} M2\{Mine\}$/.test(s), s);

  // 第二个空间:G2 移过去
  const work = await p.addSpace('工作');
  await p.ev(`await (await import('./src/tabs.js')).moveTabToSpace(${ids.G2}, ${JSON.stringify(work)})`);
  await p.settle();
  s = await strip();
  console.log('  ', s);
  let gs = await groups();
  t.check('两个空间两个分组,G2 在「工作」里', gs.filter((g) => g.title !== 'Mine').length === 2 && s.includes('G2{工作}'), s);
  t.check('当前空间的展开,「工作」的收起', gs.find((g) => g.title === homeName)?.collapsed === false && gs.find((g) => g.title === '工作')?.collapsed === true, gs);

  // 切到「工作」:展开收起跟着换
  await p.ev(`await (await import('./src/spaces.js')).switchSpace(${JSON.stringify(work)})`);
  await p.settle();
  gs = await groups();
  t.check('切到「工作」后:它展开,原来的收起', gs.find((g) => g.title === '工作')?.collapsed === false && gs.find((g) => g.title === homeName)?.collapsed === true, gs);
  await p.ev(`await (await import('./src/spaces.js')).switchSpace((await import('./src/store.js')).state.spaces[0].id)`);
  await p.settle();

  // 用户在标签栏里把 G3 拖进「工作」的分组
  await t.sleep(1000);
  const workGroup = (await groups()).find((g) => g.title === '工作').id;
  await p.ev(`await chrome.tabs.group({ tabIds: [${ids.G3}], groupId: ${workGroup} })`);
  await p.settle();
  t.check('在标签栏里拖进「工作」的分组 = 移到「工作」', (await space(ids.G3)) === work, await space(ids.G3));

  // 子标签在标签栏里被拖到最左边:不再是子标签(以前会报错,还挂在原来的父标签下)
  const kid = await open(['G4']);
  await p.ev(`await (await import('./src/store.js')).setTabParent(${kid.G4}, ${ids.G1})`);
  await p.settle();
  await t.sleep(1000);
  await p.ev(`await chrome.tabs.move(${kid.G4}, { index: 0 })`);
  await p.settle();
  const par = await p.ev(`return (await chrome.storage.session.get('c:${kid.G4}'))['c:${kid.G4}'] ?? null`);
  t.check('子标签拖到最左边后不再是子标签', par === null, par);
  s = await strip();
  console.log('  ', s);
  t.check('别人的分组到最后还在', s.endsWith('M1{Mine} M2{Mine}'), s);
  t.check('整个过程没有报错', t.errors.length === 0, t.errors);
});
