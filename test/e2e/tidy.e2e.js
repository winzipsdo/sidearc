// 按域名整理(列表上方的按钮):同站、同子域名的排在一起,子标签跟着父标签;
// 收藏、固定标签、Chrome 固定的、别人分组里的、别的空间的都不动;撤销能原样恢复

import { e2e } from './harness.js';

e2e(async (t) => {
  const p = await t.start();
  const [mail, docs, beta] = ['mail.alpha.localhost', 'docs.alpha.localhost', 'beta.localhost'];
  // T3 是 T2 的子标签,站不一样也要跟着走;127.0.0.1 是第三个站
  const hosts = { T1: mail, T2: beta, T4: docs, T5: mail, T6: beta, T8: mail, P1: beta, F1: mail, N1: mail, M1: mail, M2: beta, W1: beta, W2: mail, W3: beta };
  const ids = await p.open(['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'P1', 'F1', 'N1', 'M1', 'M2', 'W1', 'W2', 'W3'], { hosts });
  const home = await p.ev(`return (await import('./src/store.js')).state.spaces[0].id`);
  const work = await p.addSpace('工作');
  await p.ev(`
    const s = await import('./src/store.js');
    const items = await import('./src/items.js');
    const { moveTabToSpace } = await import('./src/tabs.js');
    await s.setTabParent(${ids.T3}, ${ids.T2});
    await s.setTabAlias(${ids.T3}, '子标签');
    await items.addItemFromTab(await chrome.tabs.get(${ids.P1}), 'pin');
    await items.addItemFromTab(await chrome.tabs.get(${ids.F1}), 'fav');
    for (const id of [${ids.W1}, ${ids.W2}, ${ids.W3}]) await moveTabToSpace(id, ${JSON.stringify(work)});
    await chrome.tabs.update(${ids.N1}, { pinned: true });
    const g = await chrome.tabs.group({ tabIds: [${ids.M1}, ${ids.M2}] });
    await chrome.tabGroups.update(g, { title: '别人的' });
    await chrome.tabs.update(${ids.T3}, { active: true });
  `);
  await p.settle();

  const tabOrder = () => p.ev(`return (await chrome.tabs.query({ currentWindow: true })).map((t) => t.title).filter((x) => /^T\\d/.test(x)).join(' ')`);
  const listed = async () => (await p.rows()).map((r) => r.title).filter((x) => /^T\d/.test(x)).join(' ');
  // 整理时不该动的:其他标签页各自的先后、分组、是不是原生固定
  const others = () =>
    p.ev(`
      const gs = new Map((await chrome.tabGroups.query({})).map((g) => [g.id, g.title]));
      return (await chrome.tabs.query({ currentWindow: true })).filter((t) => /^[PFNMW]\\d$/.test(t.title)).map((t) => t.title + (t.pinned ? '!' : '') + '{' + (gs.get(t.groupId) ?? '') + '}').join(' ');
    `);
  const parent = async (id) => (await p.session())['c:' + id] ?? null;
  const active = () => p.ev(`return (await chrome.tabs.query({ active: true, currentWindow: true }))[0].title`);
  const toast = () => p.ev(`const el = document.querySelector('#toast'); return el.hidden ? '' : el.textContent`);
  const ctrlZ = () => p.ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }))`);
  const tidy = async () => {
    await p.clickAt('#tidy');
    await p.settle();
  };
  const switchTo = async (id) => {
    await p.ev(`await (await import('./src/spaces.js')).switchSpace(${JSON.stringify(id)})`);
    await p.settle();
  };
  const [TIDIED, ALREADY, UNDO] = await Promise.all(['tidied', 'alreadyTidy', 'undo'].map((k) => p.text(k)));
  const ORIGINAL = 'T1 T2 T3 T4 T5 T6 T7 T8';
  const SORTED = 'T1 T5 T8 T4 T2 T3 T6 T7';
  t.check('准备好:原来的顺序', (await tabOrder()) === ORIGINAL, await tabOrder());
  const untouched = await others();

  await tidy();
  t.check('整理:同站、同子域名的在一起,按第一次出现的先后', (await tabOrder()) === SORTED, await tabOrder());
  t.check('侧边栏和标签栏一样', (await listed()) === SORTED, await listed());
  const kid = (await p.rows()).find((r) => r.title === 'T3');
  t.check('T3 还是 T2 的子标签,别名还在', (await parent(ids.T3)) === ids.T2 && kid?.depth === 1 && kid.alias === '子标签', kid);
  t.check('正在看的没变', (await active()) === 'T3', await active());
  t.check('收藏、固定、原生固定、别人的分组、别的空间都没动', (await others()) === untouched, [await others(), untouched]);
  t.check('提示条:已整理 + 撤销', (await toast()) === TIDIED + UNDO, await toast());

  await p.ev(`document.querySelector('#toast button').click()`);
  await p.settle();
  t.check('点提示条上的撤销:原样恢复', (await tabOrder()) === ORIGINAL && (await listed()) === ORIGINAL, await tabOrder());
  t.check('撤销后父子关系还在、其他的还是没动', (await parent(ids.T3)) === ids.T2 && (await others()) === untouched);

  // 已经排好时再点:不动;之后按 Ctrl+Z 撤销的还是上一次整理
  await tidy();
  await tidy();
  t.check('再点一次:顺序不变,提示已经排好', (await tabOrder()) === SORTED && (await toast()) === ALREADY, [await tabOrder(), await toast()]);
  await ctrlZ();
  await p.settle();
  t.check('Ctrl+Z:撤销上一次整理', (await tabOrder()) === ORIGINAL, await tabOrder());

  // 双击只算一次,撤销按钮不会被「已经排好」顶掉
  const btn = await p.rect('#tidy');
  for (const clickCount of [1, 2]) {
    for (const type of ['mousePressed', 'mouseReleased'])
      await p.b.send('Input.dispatchMouseEvent', { type, x: btn.left + btn.w / 2, y: btn.top + btn.h / 2, button: 'left', clickCount }, p.sessionId);
    await t.sleep(150);
  }
  await p.settle();
  t.check('双击:提示条上还是带撤销', (await toast()) === TIDIED + UNDO, await toast());

  // 整理后休眠一个(换编号),再切到别的空间撤销:排的还是原来那个空间
  await p.ev(`await (await import('./src/tabs.js')).discardTabs([await chrome.tabs.get(${ids.T5})])`);
  await p.settle();
  await switchTo(work);
  await ctrlZ();
  await p.settle();
  t.check('换过编号、切了空间也能原样撤销', (await tabOrder()) === ORIGINAL, await tabOrder());
  t.check('「工作」没被动到', (await others()) === untouched, await others());
  await switchTo(home);

  // 整理后关掉一个再撤销关闭(也会换编号),接着撤销整理
  await tidy();
  await p.ev(`await (await import('./src/tabs.js')).closeTab(await chrome.tabs.get(${ids.T6}))`);
  await p.settle();
  // 连按两下,中间不等
  await ctrlZ();
  await ctrlZ();
  await p.settle();
  await p.settle();
  t.check('连按两下 Ctrl+Z,撤销关闭再撤销整理:原样恢复', (await tabOrder()) === ORIGINAL, await tabOrder());

  // 整理后在标签栏里关掉一个、按 Ctrl+Z 恢复(侧边栏不知道它的新编号,按地址认),再撤销整理
  await tidy();
  await t.sleep(1100); // 「最近关闭」的时间只精确到秒
  await p.ev(`await chrome.tabs.remove((await chrome.tabs.query({})).find((t) => t.title === 'T4').id)`);
  await p.settle();
  await ctrlZ();
  await p.settle();
  await ctrlZ();
  await p.settle();
  t.check('从「最近关闭」恢复过的也回到原来的位置', (await tabOrder()) === ORIGINAL, await tabOrder());

  // 整理还没做完就按 Ctrl+Z:撤销的是这次整理
  await p.ev(`document.querySelector('#tidy').click(); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));`);
  await p.settle();
  await p.settle();
  t.check('整理到一半按 Ctrl+Z:撤销这次整理', (await tabOrder()) === ORIGINAL, await tabOrder());

  // 整理之后新开的,撤销时排在最后
  await tidy();
  await p.open(['T9'], { hosts: { T9: beta } });
  await p.settle();
  await ctrlZ();
  await p.settle();
  t.check('整理后新开的:撤销时排在最后', (await tabOrder()) === ORIGINAL + ' T9', await tabOrder());

  // 整理到一半时最左边的关掉了:位置都错开一格,最后一个不能被挪进右边空间的分组
  const expected = (await others()).split(' ').filter((x) => !x.startsWith('N1')).join(' ');
  await t.bg(`globalThis.__move = chrome.tabs.move; chrome.tabs.move = async (...a) => { const out = await __move.apply(chrome.tabs, a); await new Promise((r) => setTimeout(r, 150)); return out; };`);
  const done = p.ev(`await (await import('./src/tabs.js')).tidyTabs()`);
  await t.sleep(60);
  await p.ev(`await chrome.tabs.remove(${ids.N1})`);
  await done;
  await t.bg(`chrome.tabs.move = __move;`);
  await p.settle();
  t.check('中途关掉一个:照样排好', (await tabOrder()) === 'T1 T5 T8 T4 T2 T3 T6 T9 T7', await tabOrder());
  t.check('中途关掉一个:没有标签页被挪进别的空间', (await listed()).split(' ').length === 9 && (await others()) === expected, [await listed(), await others()]);
  t.check('整个过程没有报错', t.errors.length === 0, t.errors);
});
