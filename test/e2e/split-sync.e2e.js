// 分组同步排顺序时,一对拆分视图被另一对挡着挪不动:不能把后面的标签页插进它们中间(会把拆分视图拆开)

import { e2e } from './harness.js';

e2e(async (t) => {
  const p = await t.start();
  const ids = await p.open(['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8']);
  await p.ev(`
    await chrome.tabs.createSplit([${ids.T4}, ${ids.T5}]);
    await chrome.tabs.createSplit([${ids.T7}, ${ids.T8}]);
    const { setTabParent } = await import('./src/store.js');
    for (const id of [${ids.T3}, ${ids.T4}, ${ids.T5}]) await setTabParent(id, ${ids.T2});
    for (const id of [${ids.T7}, ${ids.T8}]) await setTabParent(id, ${ids.T6});
  `);
  await p.settle();
  t.check('准备好:两对拆分视图', (await p.strip()).split('[s]').length === 5, await p.strip());

  // 在标签栏里把 T6 拖到 T2 上面:它名下的一对要跟过去,但被 T4+T5 挡着
  await t.sleep(1000);
  await p.ev(`await chrome.tabs.move(${ids.T6}, { index: (await chrome.tabs.get(${ids.T2})).index })`);
  await p.settle();
  const s = await p.strip();
  console.log('  strip:', s);
  t.check('两对拆分视图都还在', s.split('[s]').length === 5, s);
  t.check('整个过程没有报错', t.errors.length === 0, t.errors);
});
