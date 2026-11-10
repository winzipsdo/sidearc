// 关闭和撤销:关父标签页带走子标签,撤销时连别名、父子关系一起接回来;绑在固定项上的不连带;
// 「清理」不关正在看的、不关收藏;Ctrl/Cmd+Z 也能恢复在标签栏里关掉的标签页

import { e2e } from './harness.js';

e2e(async (t) => {
  const p = await t.start();
  const ids = await p.open(['K1', 'K2', 'K3', 'K4', 'Q1', 'Q2']);
  const store = `const s = await import('./src/store.js');`;
  const home = await p.ev(`${store} return s.state.spaces[0].id`);
  // 侧边栏页面自己也是个标签页:挪到别的空间,免得被「清理」关掉
  const side = await p.addSpace('侧边栏');
  await p.ev(`const [me] = await chrome.tabs.query({ url: location.href }); await (await import('./src/tabs.js')).moveTabToSpace(me.id, ${JSON.stringify(side)})`);
  await p.ev(`${store} await s.setTabParent(${ids.K2}, ${ids.K1}); await s.setTabAlias(${ids.K1}, 'K1别名'); await chrome.tabs.update(${ids.K3}, { active: true });`);
  await p.settle();
  const names = async () => (await p.rows()).map((r) => r.title).filter((x) => /^[KQ]\d$/.test(x)).join(' ');
  const clickUndo = () => p.ev(`document.querySelector('#toast button').click()`);
  const look = (name) =>
    p.ev(`const all = await chrome.storage.session.get(null); const tabs = await chrome.tabs.query({}); const tab = tabs.find((t) => t.title === ${JSON.stringify(name)}); if (!tab) return null;
      const parent = tabs.find((t) => t.id === all['c:' + tab.id]); return { space: all['t:' + tab.id] ?? null, alias: all['a:' + tab.id] ?? null, parent: parent?.title ?? null };`);

  // 侧边栏里关掉父标签页 K1(行上的叉号):子标签 K2 一起关
  await p.ev(`${store} await (await import('./src/tabs.js')).closeTab(s.tabs.find((t) => t.id === ${ids.K1}))`);
  await t.sleep(1500);
  t.check('关掉 K1:子标签 K2 一起关了', !(await names()).includes('K1') && !(await names()).includes('K2'), await names());
  await clickUndo();
  await t.sleep(2500);
  const k1 = await look('K1');
  const k2 = await look('K2');
  t.check('撤销:K1、K2 都回来了,在原来的空间', k1?.space === home && k2?.space === home, { k1, k2 });
  t.check('撤销:K1 的别名还在,K2 还是 K1 的子标签', k1?.alias === 'K1别名' && k2?.parent === 'K1', { k1, k2 });

  // 固定标签 Q1 下面挂着 Q2:关掉 Q1 的标签页,Q2 不跟着关(它在列表里单独显示,看不出和 Q1 是一起的)
  await p.ev(`await (await import('./src/items.js')).addItemFromTab(await chrome.tabs.get(${ids.Q1}), 'pin')`);
  await p.ev(`${store} await s.setTabParent(${ids.Q2}, ${ids.Q1})`);
  await p.settle();
  await p.ev(`await chrome.tabs.remove(${ids.Q1})`);
  await t.sleep(1500);
  t.check('关掉固定标签的标签页:挂在它下面的 Q2 还在', (await p.id('Q2')) != null);

  // K4 收藏起来,然后「清理」:只留正在看的 K3 和收藏的 K4
  await p.ev(`await (await import('./src/items.js')).addItemFromTab(await chrome.tabs.get(${ids.K4}), 'fav')`);
  await p.settle();
  const beforeClear = await names();
  await p.ev(`(await import('./src/tabs.js')).clearTabs()`);
  await t.sleep(2000);
  const open = await p.ev(`return (await chrome.tabs.query({})).map((t) => t.title).filter((x) => /^[KQ]\\d$/.test(x)).sort().join(' ')`);
  t.check('清理:正在看的 K3 和收藏的 K4 留着,其余都关了', open === 'K3 K4', open);
  await clickUndo();
  await t.sleep(3000);
  t.check('撤销清理:列表回到清理前的样子', (await names()) === beforeClear, [await names(), beforeClear]);

  // 在浏览器自己的标签栏里关掉 K3(不经过侧边栏),然后 Ctrl/Cmd+Z
  await t.sleep(1100); // 「最近关闭」的时间只精确到秒,要晚于上一步撤销栈的记录
  await p.ev(`await chrome.tabs.remove((await chrome.tabs.query({})).find((t) => t.title === 'K3').id)`);
  await t.sleep(1000);
  await p.ev(`await (await import('./src/ui.js')).undo()`);
  await t.sleep(2000);
  t.check('Ctrl/Cmd+Z 恢复了在标签栏里关掉的 K3', (await p.id('K3')) != null);
  t.check('整个过程没有报错', t.errors.length === 0, t.errors);
});
