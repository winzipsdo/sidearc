// 拆分视图:右键菜单的「与当前标签页拆分视图」。固定标签和收藏不能拼进拆分视图

import { e2e } from './harness.js';

e2e(async (t) => {
  const p = await t.start();
  const ids = await p.open(['T1', 'T2', 'T3', 'T4', 'T5']);
  const L = await p.text('splitWithCurrent');
  const O = await p.text('splitView');

  // T5 变成固定标签
  await p.ev(`const { addItemFromTab } = await import('./src/items.js'); await addItemFromTab(await chrome.tabs.get(${ids.T5}), 'pin')`);
  await p.settle();
  const pinSel = await p.rowOf('T5', '#pins');
  t.check('T5 在固定区', !!pinSel, pinSel);

  // 正在看固定标签 T5,右键列表里的 T4
  await p.ev(`await chrome.tabs.update(${ids.T5}, { active: true })`);
  await p.settle();
  await p.mouse('T4');
  let l = await p.labels();
  t.check('正在看固定标签,右键列表里的标签页:没有这一项', l && !l.includes(L), l);
  await p.closeMenu();

  // 正在看 T1
  await p.ev(`await chrome.tabs.update(${ids.T1}, { active: true })`);
  await p.settle();
  await p.clickAt(pinSel, 'right');
  l = await p.labels();
  t.check('右键固定标签:没有这一项', l && !l.includes(L), l);
  await p.closeMenu();
  await p.mouse('T1');
  l = await p.labels();
  t.check('右键正在看的那个:没有这一项', l && !l.includes(L), l);
  await p.closeMenu();

  // 多选里有固定标签:没有「在拆分视图中打开」;两个都在列表里时有
  const hl = (names) => p.ev(`const all = await chrome.tabs.query({ currentWindow: true }); await chrome.tabs.highlight({ tabs: ${JSON.stringify(names)}.map((n) => all.find((t) => t.title === n).index) }); await new Promise((r) => setTimeout(r, 800));`);
  await hl(['T1', 'T5']);
  await p.mouse('T1');
  l = await p.labels();
  t.check('多选里有固定标签:没有「' + O + '」', l && !l.includes(O), l);
  await p.closeMenu();
  await hl(['T1', 'T2']);
  await p.mouse('T1');
  l = await p.labels();
  t.check('多选两个列表里的:有「' + O + '」', l?.includes(O), l);
  await p.closeMenu();
  await hl(['T1']);
  t.check('到这里还没有拼出拆分视图', !(await p.strip()).includes('[s]'), await p.strip());

  // 右键 T4 → 与当前标签页拆分视图
  await p.mouse('T4');
  l = await p.labels();
  t.check('右键列表里别的标签页:有这一项', l?.includes(L), l);
  await p.clickLabel(L);
  const quiet = await p.settle();
  const s = await p.strip();
  console.log('  strip:', s, ' | rows:', await p.blocks());
  t.check('T4 挪到 T1 右边拼成拆分视图,T1 还在看,标签栏安静', quiet && /T1\[s\]\S*\* T4\[s\]\S* T2\S* T3/.test(s), s);
  t.check('侧边栏里是 [T1+T4]', (await p.blocks()).includes('[T1+T4]'), await p.blocks());
  await p.mouse('T2');
  l = await p.labels();
  t.check('正在看的已经在拆分视图里:不显示这一项', l && !l.includes(L), l);
  await p.closeMenu();

  // 中文:这一项不被截断
  await p.ev(`await chrome.tabs.update(${ids.T2}, { active: true }); (await import('./src/i18n.js')).setLangPref('zh')`);
  await t.sleep(1500);
  await p.mouse('T3');
  const zh = await p.text('splitWithCurrent');
  const w = await p.ev(`const b = [...document.querySelectorAll('#menu button')].find((b) => b.textContent === ${JSON.stringify(zh)}); return b && { text: b.textContent, sw: b.scrollWidth, cw: b.clientWidth }`);
  t.check('中文这一项放得下', w && w.sw <= w.cw + 1, w);
  t.check('整个过程没有报错', t.errors.length === 0, t.errors);
});
