// 撒落叶的彩蛋:在列表里的标签页上按住不动一会儿,撒下几片落叶(会话存储里记下 l:<tabId>),
// 松手不切过去、不改多选、不拖起来;没到时间松手是普通的点击,按住时动了就作罢;右键菜单里没有「撒落叶」了

import { e2e } from './harness.js';

e2e(async (t) => {
  const p = await t.start();
  const ids = await p.open(['L1', 'L2', 'L3', 'L4']);
  await p.settle();
  const input = (params) => p.b.send('Input.dispatchMouseEvent', params, p.sessionId);
  const CTRL = 2;
  const scattered = async (name) => (await p.session())['l:' + ids[name]] ?? null;
  const active = () => p.ev(`return (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.title`);
  const isActive = (name) => p.ev(`return (await chrome.tabs.get(${ids[name]})).active`);
  const picked = () => p.ev(`return [...document.querySelectorAll('#tabs .row.selected .title')].map((x) => x.textContent).filter((x) => /^L\\d$/.test(x)).join(' ')`);
  const order = () => p.blocks('^L\\d$');
  // 侧边栏页面在这里是一个普通的标签页:别的标签页成了当前标签页时它就被挡在后面,计时器和鼠标事件都被浏览器放慢。
  // 所以多选用 tabs.highlight 布置(第一个是侧边栏自己,它还是当前标签页),会切走的操作做完把它切回来
  const me = await p.ev(`return (await chrome.tabs.query({ url: location.href }))[0].id`);
  const front = async () => {
    await p.ev(`await chrome.tabs.update(${me}, { active: true })`);
    await t.sleep(500);
  };
  const select = async (names) => {
    await p.ev(`const all = await chrome.tabs.query({ currentWindow: true }); const idx = (id) => all.find((x) => x.id === id).index;
      await chrome.tabs.highlight({ tabs: [idx(${me}), ${names.map((n) => `idx(${ids[n]})`).join(', ')}] });`);
    await t.sleep(600);
  };
  const at = async (name) => {
    const r = await p.rect(await p.rowOf(name));
    return { x: r.left + Math.min(40, r.w / 2), y: r.top + r.h / 2 };
  };
  // 按下,(可选)按住时挪一挪,等 ms 毫秒;返回松手的函数
  const press = async (name, { ms = 900, move = null, mods = 0 } = {}) => {
    const { x, y } = await at(name);
    await input({ type: 'mouseMoved', x, y });
    await input({ type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1, modifiers: mods });
    let [ex, ey] = [x, y];
    if (move) {
      // 一点一点挪过去,和真的手一样
      for (let i = 1; i <= 5; i++) {
        await t.sleep(30);
        [ex, ey] = [x + (move.dx * i) / 5, y + (move.dy * i) / 5];
        await input({ type: 'mouseMoved', x: ex, y: ey, button: 'left', buttons: 1, modifiers: mods });
      }
    }
    await t.sleep(ms);
    return async () => {
      await input({ type: 'mouseReleased', x: ex, y: ey, button: 'left', buttons: 0, clickCount: 1, modifiers: mods });
      await t.sleep(600);
    };
  };

  const before = await active();
  t.check('准备好:L1–L4 都没有撒过落叶,也都不是当前标签页', !(await scattered('L1')) && !(await isActive('L1')) && before !== 'L1', { before, session: await p.session() });

  // 长按 L1:还没松手就撒下来了
  let release = await press('L1');
  const n1 = await scattered('L1');
  t.check('长按 L1:撒下了 1 到 6 片落叶', n1 >= 1 && n1 <= 6, n1);
  await release();
  t.check('松手后没有切到 L1', !(await isActive('L1')) && (await active()) === before, await active());
  t.check('松手后撒的落叶还在(没被点进去吹走)', (await scattered('L1')) === n1, await scattered('L1'));
  t.check('L1 这一行画上了落叶', await p.ev(`return !!document.querySelector('#tabs .row[data-id="${ids.L1}"] canvas.leaves')`));

  // 多选着 L2、L3 时长按 L4:只撒 L4,多选不变
  await select(['L2', 'L3']);
  t.check('选中 L2、L3', (await picked()) === 'L2 L3', await picked());
  release = await press('L4');
  await release();
  t.check('多选着别的时长按 L4:只撒 L4', (await scattered('L4')) >= 1 && !(await scattered('L2')) && !(await scattered('L3')), await p.session());
  t.check('长按 L4 没有改多选,也没切过去', (await picked()) === 'L2 L3' && !(await isActive('L4')), { picked: await picked(), active: await active() });
  await p.ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
  await t.sleep(500);

  // 按着 Ctrl 长按:不算
  release = await press('L3', { mods: CTRL });
  t.check('按着 Ctrl 长按不撒', !(await scattered('L3')), await scattered('L3'));
  await release();
  await front();

  // 按住时动了:作罢(在松手之前看,免得松手算成点击、点进去把落叶吹走而看不出来)
  release = await press('L2', { move: { dx: 0, dy: 14 } });
  t.check('按住时挪了 14px:不撒', !(await scattered('L2')), await scattered('L2'));
  await release();
  await p.settle();
  t.check('挪过以后也没撒', !(await scattered('L2')), await scattered('L2'));

  // 撒下来以后再拖:拖不起来,顺序不变
  const orderBefore = await order();
  release = await press('L3', { ms: 900 });
  const n3 = await scattered('L3');
  const { x, y } = await at('L3');
  for (let i = 1; i <= 6; i++) await input({ type: 'mouseMoved', x, y: y + i * 10, button: 'left', buttons: 1 });
  await t.sleep(300);
  const dragging = await p.ev(`return (await import('./src/store.js')).dragging`);
  await input({ type: 'mouseReleased', x, y: y + 60, button: 'left', buttons: 0, clickCount: 1 });
  await t.sleep(600);
  await p.settle();
  t.check('撒下来以后按着往下挪:撒了,但没拖起来', n3 >= 1 && !dragging && !(await p.ev(`return !!document.querySelector('.dragging')`)), { n3, dragging });
  t.check('列表顺序没变,L3 也没切过去', (await order()) === orderBefore && !(await isActive('L3')), { before: orderBefore, after: await order() });

  // 右键菜单里没有「撒落叶」了(单个、多选都没有)
  const gone = (labels) => Array.isArray(labels) && labels.length > 0 && !labels.some((x) => /撒落叶|Scatter leaves/.test(x));
  await p.mouse('L4', 'right');
  const single = await p.labels();
  t.check('右键单个标签页:菜单里没有撒落叶', gone(single), single);
  await p.closeMenu();
  await select(['L3', 'L4']);
  await p.mouse('L4', 'right');
  const many = await p.labels();
  const head = await p.ev(`return document.querySelector('#menu .menu-head')?.textContent ?? null`);
  t.check('右键多选的标签页:是多选的菜单,里面没有撒落叶', gone(many) && head === (await p.ev(`return (await import('./src/i18n.js')).t('nTabs', { n: 3 })`)), { head, many });
  await p.closeMenu();

  // 普通的点击照旧切过去
  await p.mouse('L2', 'left');
  await t.sleep(600);
  t.check('短按 L2 照旧切过去', await isActive('L2'), await active());

  t.check('没有报错', !t.errors.length, t.errors);
});
