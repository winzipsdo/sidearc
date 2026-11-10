// 拆分视图:右键「交换左右」。当前标签页不变,子标签还挂在原来的父标签下

import { e2e } from './harness.js';

e2e(async (t) => {
  const p = await t.start();
  const ids = await p.open(['T1', 'T2', 'T3', 'T4', 'T5']);
  const REV = await p.text('reverseViews');
  const SEP = await p.text('unsplit');
  await p.ev(`await chrome.tabs.createSplit([${ids.T2}, ${ids.T3}]); await chrome.tabs.update(${ids.T3}, { active: true });`);
  await p.ev(`await (await import('./src/store.js')).setTabParent(${ids.T4}, ${ids.T2})`);
  await p.settle();
  let s = await p.strip();
  console.log('  before:', s, ' | rows:', await p.blocks());
  t.check('准备好:T2+T3 在拆分视图里,T3 在看', /T2\[s\]\S* T3\[s\]\S*\*/.test(s), s);

  await p.mouse('T5');
  let l = await p.labels();
  t.check('普通标签页:没有「' + REV + '」', l && !l.includes(REV), l);
  await p.closeMenu();

  await p.mouse('T2');
  l = await p.labels();
  t.check('拆分视图里的标签页:「' + REV + '」和「' + SEP + '」挨着', l?.indexOf(REV) > -1 && l.indexOf(SEP) === l.indexOf(REV) + 1, l);
  await p.clickLabel(REV);
  const quiet = await p.settle();
  s = await p.strip();
  console.log('  after:', s, ' | rows:', await p.blocks());
  t.check('换过来了:T3 在左 T2 在右,T3 还在看,标签栏安静', quiet && /T1\S* T3\[s\]\S*\* T2\[s\]\S* T4\S* T5/.test(s), s);
  t.check('侧边栏里是 [T3+T2] 一块', (await p.blocks()).includes('[T3+T2]'), await p.blocks());
  const par = await p.ev(`return (await import('./src/store.js')).listedParent(${ids.T4})`);
  t.check('T2 的子标签 T4 还挂在 T2 下面', par === ids.T2, par);

  // 从右边那个(T2)右键再换回来
  await p.mouse('T2');
  await p.clickLabel(REV);
  await p.settle();
  s = await p.strip();
  t.check('再换一次:回到 T2 左 T3 右,T3 还在看', /T1\S* T2\[s\]\S* T3\[s\]\S*\* T4\S* T5/.test(s), s);
  t.check('整个过程没有报错', t.errors.length === 0, t.errors);
});
