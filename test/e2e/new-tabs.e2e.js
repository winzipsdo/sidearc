// 新标签页归到哪里(background.js):网页里点开的成为子标签、留在来源的空间;Ctrl+T 之类的归入当前空间。
// 相同地址只开一份:同一个空间里重复的关掉、切到已有的;别的空间开着的不算;网页里特意新开的不合并;
// 地址和没打开的固定项相同时直接成为它的标签页;提示条上能撤销

import { e2e } from './harness.js';

e2e(async (t) => {
  const p = await t.start();
  const ids = await p.open(['N1', 'D1', 'D2', 'P1']);
  const store = `const s = await import('./src/store.js');`;
  const home = await p.ev(`${store} return s.state.spaces[0].id`);
  const work = await p.addSpace('工作');
  const active = () => p.ev(`${store} return s.state.activeSpaceId`);
  const switchTo = (id) => p.ev(`await (await import('./src/spaces.js')).switchSpace(${JSON.stringify(id)})`);
  const session = async (key) => (await p.session())[key] ?? null;
  const count = (name) => p.ev(`return (await chrome.tabs.query({})).filter((t) => t.url === ${JSON.stringify(t.url(name))}).length`);
  const moveTo = (id, space) => p.ev(`await (await import('./src/tabs.js')).moveTabToSpace(${id}, ${JSON.stringify(space)})`);
  await moveTo(ids.N1, work);
  await moveTo(ids.D2, work);
  await p.settle();

  // 在「工作」里的 N1 网页上点开一个链接(新标签页打开)
  t.check('准备好:当前空间是第一个', (await active()) === home);
  await t.inTab('N1', `window.open(location.origin + '/N2')`, { gesture: true });
  await t.sleep(1500);
  const N2 = await p.id('N2');
  t.check('网页里点开的:是 N1 的子标签', (await session('c:' + N2)) === ids.N1, await session('c:' + N2));
  t.check('网页里点开的:留在来源的空间「工作」,不是当前空间', (await session('t:' + N2)) === work, await session('t:' + N2));
  await switchTo(home);
  await p.settle();

  // 不是从网页里开的(比如 Ctrl+T,openerTabId 是当时的前台标签页 N1):归入当前空间,不是子标签
  await p.ev(`await chrome.tabs.create({ url: ${JSON.stringify(t.url('N3'))}, openerTabId: ${ids.N1}, active: false })`);
  await t.sleep(1500);
  const N3 = await p.id('N3');
  t.check('Ctrl+T 之类新建的:归入当前空间', (await session('t:' + N3)) === home, await session('t:' + N3));
  t.check('Ctrl+T 之类新建的:不是子标签', (await session('c:' + N3)) === null, await session('c:' + N3));

  // 切到一个空的空间,在里面新建标签页:留在这个空间
  const empty = await p.addSpace('空');
  await switchTo(empty);
  await p.settle();
  await p.ev(`await chrome.tabs.create({ url: ${JSON.stringify(t.url('N4'))}, active: true })`);
  await p.settle();
  const N4 = await p.id('N4');
  t.check('空的空间里新建的标签页留在这个空间', (await session('t:' + N4)) === empty && (await active()) === empty, [await session('t:' + N4), await active()]);
  await switchTo(home);
  await p.settle();

  // 同一个空间里已经开着 D1:再开一个 D1,关掉新的、切到已有的
  await p.ev(`await chrome.tabs.create({ url: ${JSON.stringify(t.url('D1'))}, active: true })`);
  await t.sleep(2000);
  t.check('同一个空间里重复的:关掉了,只剩一个', (await count('D1')) === 1, await count('D1'));
  t.check('切到了已有的 D1', (await p.ev(`return (await chrome.tabs.query({ active: true, currentWindow: true }))[0].id`)) === ids.D1);
  const toast = await p.ev(`const el = document.querySelector('#toast'); return el.hidden ? null : el.textContent`);
  t.check('提示条上有撤销', toast?.includes(await p.text('undo')), toast);
  // 只有 # 后面不一样:也算同一个地址
  await p.ev(`await chrome.tabs.create({ url: ${JSON.stringify(t.url('D1') + '#part')}, active: false })`);
  await t.sleep(2000);
  t.check('只有 # 后面不一样:也合并', (await p.ev(`return (await chrome.tabs.query({})).filter((t) => t.url.startsWith(${JSON.stringify(t.url('D1'))})).length`)) === 1);
  // 点提示条上的撤销(这时是带 # 的那次):照原样再开一份,这次不再合并
  await p.ev(`document.querySelector('#toast button').click()`);
  await t.sleep(2000);
  const d1 = await p.ev(`return (await chrome.tabs.query({})).filter((t) => t.url.startsWith(${JSON.stringify(t.url('D1'))})).map((t) => t.url.slice(-6))`);
  t.check('撤销:又开了一份带 # 的 D1,没有再被合并', d1.length === 2 && d1.some((u) => u.endsWith('#part')), d1);

  // 「工作」里开着 D2,在当前空间再开一个:不合并,也不跳过去
  await p.ev(`await chrome.tabs.create({ url: ${JSON.stringify(t.url('D2'))}, active: true })`);
  await t.sleep(2000);
  t.check('别的空间开着同一个地址:不合并', (await count('D2')) === 2, await count('D2'));
  t.check('也没跳到别的空间', (await active()) === home, await active());

  // 网页里特意在新标签页打开同一个地址:不合并
  await t.inTab('D2', `window.open(location.href)`, { gesture: true });
  await t.sleep(2000);
  t.check('网页里特意新开的:地址重复也不合并', (await count('D2')) === 3, await count('D2'));
  await switchTo(home);
  await p.settle();

  // 固定项 P1 没打开时,新开的 P1 直接成为它的标签页
  await p.ev(`await (await import('./src/items.js')).addItemFromTab(await chrome.tabs.get(${ids.P1}), 'pin')`);
  await p.settle();
  const item = await p.ev(`${store} return s.state.spaces[0].pinned[0].id`);
  await p.ev(`await chrome.tabs.remove(${ids.P1})`);
  await t.sleep(1000);
  t.check('关掉后固定项没绑着标签页', (await session('b:' + item)) === null);
  await p.ev(`await chrome.tabs.create({ url: ${JSON.stringify(t.url('P1'))}, active: false })`);
  await t.sleep(2000);
  const P1 = await p.id('P1');
  t.check('新开的 P1 绑到了固定项上', P1 != null && (await session('b:' + item)) === P1, [P1, await session('b:' + item)]);
  const rows = (await p.rows()).map((r) => r.title);
  const pin = (await p.rows('#pins')).find((r) => r.title === 'P1');
  t.check('P1 显示在固定标签里(开着),不在下面的列表里', pin?.open && !rows.includes('P1'), { pin, rows });
  t.check('整个过程没有报错', t.errors.length === 0, t.errors);
});
