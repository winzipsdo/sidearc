// 拆分视图:多选两个右键「在拆分视图中打开」,右键拆分视图里的一个「取消拆分视图」

import { e2e } from './harness.js';

e2e(async (t) => {
  const p = await t.start();
  await p.open(['T1', 'T2', 'T3', 'T4', 'T5']);
  await p.settle();
  const OPEN = await p.text('splitView');
  const SEP = await p.text('unsplit');

  await p.mouse('T1');
  let l = await p.labels();
  t.check('普通标签页的菜单里没有拆分视图的项', l && !l.includes(OPEN) && !l.includes(SEP), l);
  await p.closeMenu();

  // 点 T2,Ctrl+点 T4,右键 T4
  await p.mouse('T2', 'left');
  await p.mouse('T4', 'left', 2);
  await t.sleep(500);
  await p.mouse('T4');
  l = await p.labels();
  t.check('选了两个:有「' + OPEN + '」', l?.includes(OPEN) && !l.includes(SEP), l);
  await p.clickLabel(OPEN);
  const quiet1 = await p.settle();
  let s = await p.strip();
  console.log('  strip:', s, ' | rows:', await p.blocks());
  t.check('T4 挪到 T2 旁边拼成拆分视图,切过去了,标签栏安静', quiet1 && /T2\[s\]\{g\}\*? T4\[s\]\{g\}\*?/.test(s) && /T[24]\S*\*/.test(s), s);
  t.check('侧边栏里合成一块', (await p.blocks()).includes('[T2+T4]'), await p.blocks());

  // 多选里有拆分视图里的:显示「取消」
  await p.mouse('T1', 'left', 2);
  await p.mouse('T5', 'left', 2);
  await t.sleep(500);
  await p.mouse('T5');
  l = await p.labels();
  t.check('多选里有拆分视图里的:显示「' + SEP + '」', l?.includes(SEP) && !l.includes(OPEN), l);
  await p.closeMenu();

  // 选了三个、都不在拆分视图里:都不显示
  await p.ev(`const all = await chrome.tabs.query({ currentWindow: true }); await chrome.tabs.highlight({ tabs: ['T1', 'T3', 'T5'].map((n) => all.find((t) => t.title === n).index) }); await new Promise((r) => setTimeout(r, 600));`);
  await p.mouse('T3');
  l = await p.labels();
  t.check('选了三个:没有拆分视图的项', l && !l.includes(OPEN) && !l.includes(SEP), l);
  await p.closeMenu();
  await p.mouse('T1', 'left');
  await t.sleep(400);

  // 右键拆分视图里的一个 → 取消
  await p.mouse('T4');
  l = await p.labels();
  t.check('拆分视图里的标签页:有「' + SEP + '」', l?.includes(SEP), l);
  await p.clickLabel(SEP);
  const quiet2 = await p.settle();
  s = await p.strip();
  console.log('  strip:', s, ' | rows:', await p.blocks());
  t.check('取消后两个都留在原地,标签栏安静', quiet2 && /T2\{g\}\*? T4\{g\}\*?/.test(s) && !s.includes('[s]'), s);
  t.check('侧边栏里变回两行', !(await p.blocks()).includes('['), await p.blocks());
  t.check('整个过程没有报错', t.errors.length === 0, t.errors);
});
