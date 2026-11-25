// 固定标签的多选:Ctrl/Shift+点击选中(开着的、没开着的都行),一起拖动、一起右键操作;
// 收藏、固定标签和文件夹的拖动都能撤销,拖到下面列表里 = 取消固定,也能撤销

import { e2e } from './harness.js';

e2e(async (t) => {
  const p = await t.start();
  const ids = await p.open(['P1', 'P2', 'P3', 'P4', 'P5', 'T1', 'T2']);
  await p.ev(`
    const items = await import('./src/items.js');
    for (const id of [${['P1', 'P2', 'P3', 'P4', 'P5'].map((n) => ids[n])}]) await items.addItemFromTab(await chrome.tabs.get(id), 'pin');
    await chrome.tabs.update(${ids.T1}, { active: true });
  `);
  // P2、P3 关掉:固定标签还在,只是没开着
  await p.ev(`
    const s = await import('./src/store.js');
    const items = await import('./src/items.js');
    for (const title of ['P2', 'P3']) await items.closeItemTab(s.state.spaces[0].pinned.find((i) => i.title === title));
  `);
  await p.settle();

  // 布置数据和读结果的小工具
  const itemId = (title) => p.ev(`return (await import('./src/store.js')).state.spaces.flatMap((s) => s.pinned.flatMap((x) => (x.folder ? x.items : [x]))).find((i) => i.title === ${JSON.stringify(title)})?.id ?? null`);
  const pinRow = async (title) => `#pins .row[data-id="${await itemId(title)}"]`;
  // 固定区的样子:文件夹写成 名字(里面的项),开着的项后面加 +
  const layout = () =>
    p.ev(`
      const s = await import('./src/store.js');
      const name = (i) => i.title + (s.bind.has(i.id) ? '+' : '');
      return s.activeSpace().pinned.map((x) => (x.folder ? x.name + '(' + x.items.map(name).join(' ') + ')' : name(x))).join(' ');
    `);
  const picked = () => p.ev(`return [...document.querySelectorAll('#pins .row.selected .title')].map((x) => x.textContent).join(' ')`);
  const toast = () => p.ev(`const el = document.querySelector('#toast'); return el.hidden ? '' : el.querySelector('span').textContent`);
  const listed = async () => (await p.rows()).map((r) => r.title).filter((x) => /^[PT]\d$/.test(x)).join(' ');
  const ctrlZ = async () => {
    await p.ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }))`);
    await p.settle();
  };
  const CTRL = 2;
  const SHIFT = 8;
  // 模拟拖拽:把 from(选择器)拖到 to(选择器)那一行上,fy 是落在那一行的纵向位置(0 顶,1 底)
  await p.ev(`
    window.__drag = async (fromSel, toSel, fy) => {
      const from = document.querySelector(fromSel), to = document.querySelector(toSel);
      const dt = new DataTransfer();
      const r = to.getBoundingClientRect();
      const x = r.left + Math.min(60, r.width / 2), y = r.top + r.height * fy;
      from.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }));
      await new Promise((ok) => setTimeout(ok, 50));
      const el = document.elementFromPoint(x, y);
      el.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: x, clientY: y }));
      el.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: x, clientY: y }));
      from.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }));
    };
  `);
  const drag = async (fromSel, toSel, fy) => {
    await p.ev(`await __drag(${JSON.stringify(fromSel)}, ${JSON.stringify(toSel)}, ${fy})`);
    await p.settle();
  };
  const [MOVED2, UNPINNED2, PINS2] = await Promise.all([p.ev(`return (await import('./src/i18n.js')).t('movedN', { n: 2 })`), p.ev(`return (await import('./src/i18n.js')).t('unpinnedN', { n: 2 })`), p.ev(`return (await import('./src/i18n.js')).t('nPins', { n: 2 })`)]);
  const UNPIN = await p.text('unpin');
  const ORIGINAL = 'P1+ P2 P3 P4+ P5+';
  t.check('准备好:5 个固定标签,P2、P3 没开着', (await layout()) === ORIGINAL, await layout());

  // 选中
  const tabsBefore = await p.ev(`return (await chrome.tabs.query({})).length`);
  await p.clickAt(await pinRow('P2'), 'left', CTRL);
  await p.clickAt(await pinRow('P4'), 'left', CTRL);
  t.check('Ctrl+点击选中两个(没开着的也行)', (await picked()) === 'P2 P4', await picked());
  t.check('Ctrl+点击不会打开没开着的固定标签', (await p.ev(`return (await chrome.tabs.query({})).length`)) === tabsBefore);
  await p.clickAt(await pinRow('P1'), 'left', SHIFT);
  t.check('Shift+点击从上一次点的连选到这一个', (await picked()) === 'P1 P2 P3 P4', await picked());
  await p.clickAt(await pinRow('P3'), 'left', CTRL);
  t.check('再 Ctrl+点击一次取消选中', (await picked()) === 'P1 P2 P4', await picked());
  await p.ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
  await p.settle();
  t.check('Esc 取消多选', (await picked()) === '', await picked());

  // 一起拖到最后,撤销
  await p.clickAt(await pinRow('P1'), 'left', CTRL);
  await p.clickAt(await pinRow('P3'), 'left', CTRL);
  await drag(await pinRow('P1'), await pinRow('P5'), 0.85);
  t.check('选中的两个一起拖到最后,按原来的先后', (await layout()) === 'P2 P4+ P5+ P1+ P3', await layout());
  t.check('提示可以撤销', (await toast()) === MOVED2, await toast());
  t.check('拖完还选着', (await picked()) === 'P1 P3', await picked());
  await ctrlZ();
  t.check('撤销:各回各位', (await layout()) === ORIGINAL, await layout());

  // 拖进文件夹,撤销
  await p.ev(`
    const s = await import('./src/store.js');
    const pinned = s.activeSpace().pinned;
    const p5 = s.takeItem(pinned.find((i) => i.title === 'P5').id);
    pinned.push({ id: 'fold1', folder: true, name: 'F', open: true, items: [p5] });
    await s.save();
    (await import('./src/render.js')).render();
  `);
  const WITH_FOLDER = 'P1+ P2 P3 P4+ F(P5+)';
  await drag(await pinRow('P1'), '#pins .row.folder', 0.5);
  t.check('拖进文件夹', (await layout()) === 'P2 P4+ F(P5+ P1+ P3)', await layout());
  await ctrlZ();
  t.check('撤销:从文件夹里回到原来的位置', (await layout()) === WITH_FOLDER, await layout());

  // 文件夹里的拖出来,撤销
  await p.ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
  await drag(await pinRow('P5'), await pinRow('P1'), 0.2);
  t.check('单个拖出文件夹', (await layout()) === 'P5+ P1+ P2 P3 P4+ F()', await layout());
  await ctrlZ();
  t.check('撤销:回到文件夹里', (await layout()) === WITH_FOLDER, await layout());

  // 文件夹本身挪位置,撤销
  await drag('#pins .row.folder', await pinRow('P1'), 0.2);
  t.check('文件夹挪到最前', (await layout()) === 'F(P5+) P1+ P2 P3 P4+', await layout());
  await ctrlZ();
  t.check('撤销:文件夹回到原处', (await layout()) === WITH_FOLDER, await layout());

  // 放回原处:没动,不提示
  await p.ev(`(await import('./src/ui.js')).toast('—')`);
  await drag(await pinRow('P2'), await pinRow('P3'), 0.2);
  t.check('放回原处不算挪动', (await layout()) === WITH_FOLDER && (await toast()) === '—', [await layout(), await toast()]);

  // 一起拖到下面列表里 = 取消固定;没开着的会打开。撤销后回到原位,开着的重新绑上
  await p.clickAt(await pinRow('P2'), 'left', CTRL);
  await p.clickAt(await pinRow('P4'), 'left', CTRL);
  await drag(await pinRow('P2'), await p.rowOf('T1'), 0.2);
  t.check('拖到列表里:两个都取消固定', (await layout()) === 'P1+ P3 F(P5+)', await layout());
  t.check('它们出现在列表里', (await listed()).includes('P2') && (await listed()).includes('P4'), await listed());
  t.check('提示可以撤销', (await toast()) === UNPINNED2, await toast());
  await ctrlZ();
  t.check('撤销:回到原来的位置,都开着', (await layout()) === 'P1+ P2+ P3 P4+ F(P5+)', await layout());
  t.check('撤销后不在列表里了', !/P[24]/.test(await listed()), await listed());

  // 列表里的标签页拖进固定区,撤销
  await drag(await p.rowOf('T2'), await pinRow('P1'), 0.2);
  t.check('标签页拖进固定区', (await layout()) === 'T2+ P1+ P2+ P3 P4+ F(P5+)', await layout());
  await ctrlZ();
  t.check('撤销:回到列表里', (await layout()) === 'P1+ P2+ P3 P4+ F(P5+)' && (await listed()).includes('T2'), [await layout(), await listed()]);

  // 右键选中的其中一个:菜单作用于全部
  await p.clickAt(await pinRow('P1'), 'left', CTRL);
  await p.clickAt(await pinRow('P3'), 'left', CTRL);
  await p.clickAt(await pinRow('P3'), 'right');
  t.check('右键菜单写着选了几个', (await p.ev(`return document.querySelector('#menu').textContent`)).includes(PINS2));
  await p.clickLabel(UNPIN);
  await p.settle();
  t.check('右键取消固定:两个都取消', (await layout()) === 'P2+ P4+ F(P5+)', await layout());
  await ctrlZ();
  t.check('撤销', (await layout()) === 'P1+ P2+ P3 P4+ F(P5+)', await layout());

  // 普通点击取消多选
  await p.clickAt(await pinRow('P1'), 'left', CTRL);
  await p.clickAt(await pinRow('P2'), 'left');
  t.check('普通点击取消多选', (await picked()) === '', await picked());
});
