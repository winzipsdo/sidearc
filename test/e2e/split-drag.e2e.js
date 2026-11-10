// 拆分视图:把标签页拖到另一个的右半边拼成拆分视图;拖到左半边还是变成子标签

import { e2e } from './harness.js';

e2e(async (t) => {
  const p = await t.start();
  const ids = await p.open(['T1', 'T2', 'T3', 'T4', 'T5']);
  const HINT = await p.text('splitDrop');
  // 模拟拖拽:fx 是落在目标那一行的横向位置(0 最左,1 最右);drop = false 时只拖到上面、不放下(之后调 __end() 松开)
  await p.ev(`
    window.__drag = async (fromTitle, toTitle, fx, drop) => {
      const row = (t) => [...document.querySelectorAll('#tabs .row')].find((r) => r.querySelector('.title')?.textContent === t);
      const from = row(fromTitle), to = row(toTitle);
      const dt = new DataTransfer();
      const r = to.getBoundingClientRect();
      const x = r.left + r.width * fx, y = r.top + r.height / 2;
      from.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }));
      await new Promise((ok) => setTimeout(ok, 50));
      const el = document.elementFromPoint(x, y);
      el.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: x, clientY: y }));
      const marks = { hint: to.querySelector('.split-hint')?.textContent ?? null, split: to.classList.contains('drop-split'), into: to.classList.contains('drop-into') };
      window.__end = () => from.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }));
      if (drop) {
        el.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: x, clientY: y }));
        __end();
      }
      return marks;
    };
  `);
  const drag = (a, b, fx, drop = false) => p.ev(`return __drag(${JSON.stringify(a)}, ${JSON.stringify(b)}, ${fx}, ${drop})`);
  const parentOf = (id) => p.ev(`return (await import('./src/store.js')).listedParent(${id}) ?? null`);
  await p.ev(`await chrome.tabs.update(${ids.T1}, { active: true })`);
  await p.settle();

  let m = await drag('T4', 'T2', 0.8);
  t.check('拖到 T2 右边:出现「' + HINT + '」虚线框,不是子标签', m.hint === HINT && m.split && !m.into, m);
  await p.ev(`__end()`);
  t.check('松开(没放下):虚线框没了', (await p.ev(`return document.querySelectorAll('.split-hint, .drop-split').length`)) === 0);

  m = await drag('T4', 'T2', 0.3);
  t.check('拖到 T2 左边:还是变成子标签', !m.hint && m.into, m);
  await p.ev(`__end()`);

  await drag('T4', 'T2', 0.8, true);
  let quiet = await p.settle();
  let s = await p.strip();
  console.log('  strip:', s, ' | rows:', await p.blocks());
  t.check('放下:T4 挪到 T2 右边拼成拆分视图,切过去了,标签栏安静', quiet && /T1\S* T2\[s\]\S*\* T4\[s\]\S* T3\S* T5/.test(s), s);
  t.check('侧边栏里是 [T2+T4],T4 不是子标签', (await p.blocks()).includes('[T2+T4]') && (await parentOf(ids.T4)) === null);

  m = await drag('T5', 'T2', 0.8);
  t.check('拖到已经在拆分视图里的行右边:没有虚线框,是子标签', !m.hint && m.into, m);
  await p.ev(`__end()`);
  m = await drag('T2', 'T5', 0.8);
  t.check('拖拆分视图里的一个到别的行右边:没有虚线框', !m.hint && !m.split, m);
  await p.ev(`__end()`);

  // 带着子标签的 T3 拖到 T1 右边:子标签跟着
  await p.ev(`await (await import('./src/store.js')).setTabParent(${ids.T5}, ${ids.T3})`);
  await p.settle();
  await drag('T3', 'T1', 0.8, true);
  quiet = await p.settle();
  s = await p.strip();
  console.log('  strip:', s, ' | rows:', await p.blocks());
  t.check('带子标签的 T3 拖到 T1 右边:拼成 [T1+T3],子标签 T5 跟在后面,标签栏安静', quiet && (await p.blocks()).startsWith('[T1+T3] T5') && /T1\[s\]\S* T3\[s\]\S* T5/.test(s), s);
  t.check('T5 还是 T3 的子标签', (await parentOf(ids.T5)) === ids.T3);

  // 多选一起拖:没有虚线框
  await p.ev(`await chrome.tabs.unsplit((await chrome.tabs.get(${ids.T1})).splitViewId)`);
  await p.settle();
  await p.ev(`const all = await chrome.tabs.query({ currentWindow: true }); await chrome.tabs.highlight({ tabs: ['T1', 'T3'].map((n) => all.find((t) => t.title === n).index) }); await new Promise((r) => setTimeout(r, 600));`);
  m = await drag('T3', 'T2', 0.8);
  t.check('多选一起拖:没有虚线框', !m.hint && !m.split, m);
  await p.ev(`__end()`);
  t.check('整个过程没有报错', t.errors.length === 0, t.errors);
});
