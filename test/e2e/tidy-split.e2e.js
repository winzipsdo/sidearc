// 按域名整理遇到拆分视图:一对一起走,要越过另一对时也不拆散(拆开、一起挪、再拼回去),撤销时同样

import { e2e } from './harness.js';

e2e(async (t) => {
  const p = await t.start();
  const [a, b] = ['alpha.localhost', 'beta.localhost'];
  const hosts = { T1: a, T2: b, T3: b, T4: a, T5: a, T8: a, T9: a };
  const ids = await p.open(['T1', 'T10', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T0', 'T8', 'T9'], { hosts });
  await p.ev(`
    for (const pair of [[${ids.T2}, ${ids.T3}], [${ids.T4}, ${ids.T5}], [${ids.T8}, ${ids.T9}]]) await chrome.tabs.createSplit(pair);
    await (await import('./src/store.js')).setTabParent(${ids.T6}, ${ids.T5});
    // T0 夹在 T7 和 T8+T9 中间:那一对往左走时先把它挤到右边,最后又和 T7 一起排到 T10 下面,中途不能掉了父标签
    await (await import('./src/store.js')).setTabParent(${ids.T0}, ${ids.T7});
    await chrome.tabs.update(${ids.T5}, { active: true });
  `);
  await p.settle();
  const order = () => p.ev(`return (await chrome.tabs.query({ currentWindow: true })).map((t) => t.title).filter((x) => /^T\\d/.test(x)).join(' ')`);
  const pairs = () =>
    p.ev(`
      const by = new Map();
      for (const t of await chrome.tabs.query({ currentWindow: true })) if (t.splitViewId > -1) by.set(t.splitViewId, [...(by.get(t.splitViewId) ?? []), t.title]);
      return [...by.values()].map((x) => x.join('+')).sort().join(' ');
    `);
  const kept = async () => {
    const s = await p.session();
    return s['c:' + ids.T6] === ids.T5 && s['c:' + ids.T0] === ids.T7;
  };
  const active = () => p.ev(`return (await chrome.tabs.query({ active: true, currentWindow: true }))[0].title`);
  const ORIGINAL = 'T1 T10 T2 T3 T4 T5 T6 T7 T0 T8 T9';
  const PAIRS = 'T2+T3 T4+T5 T8+T9';
  t.check('准备好:三对拆分视图', (await order()) === ORIGINAL && (await pairs()) === PAIRS, [await order(), await pairs()]);

  await p.clickAt('#tidy');
  let quiet = await p.settle();
  t.check('整理:两对都越过了 T2+T3', quiet && (await order()) === 'T1 T4 T5 T6 T8 T9 T10 T7 T0 T2 T3', await order());
  t.check('三对都还拼着,左右没换', (await pairs()) === PAIRS, await pairs());
  t.check('侧边栏里还是三块', (await p.blocks()) === 'T1 [T4+T5] T6 [T8+T9] T10 T7 T0 [T2+T3]', await p.blocks());
  t.check('子标签和正在看的都没变', (await kept()) && (await active()) === 'T5', [await kept(), await active()]);

  await p.ev(`document.querySelector('#toast button').click()`);
  quiet = await p.settle();
  t.check('撤销:原样恢复', quiet && (await order()) === ORIGINAL && (await pairs()) === PAIRS, [await order(), await pairs()]);
  t.check('撤销后子标签和正在看的也没变', (await kept()) && (await active()) === 'T5', [await kept(), await active()]);
  // 挪得很慢时(几百个标签页要好几秒)中途也不能被当成用户拖的,拆掉父子关系
  await t.bg(`globalThis.__move = chrome.tabs.move; chrome.tabs.move = async (...a) => { await new Promise((r) => setTimeout(r, 2100)); return __move.apply(chrome.tabs, a); };`);
  await p.ev(`await (await import('./src/tabs.js')).tidyTabs()`);
  await t.bg(`chrome.tabs.move = __move;`);
  await p.settle();
  t.check('挪得很慢:照样排好,分屏和父子关系都还在', (await kept()) && (await pairs()) === PAIRS && (await order()) === 'T1 T4 T5 T6 T8 T9 T10 T7 T0 T2 T3', [await kept(), await pairs(), await order()]);
  t.check('整个过程没有报错', t.errors.length === 0, t.errors);
});
