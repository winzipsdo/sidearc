// 设置菜单里的「字体」:默认、今楷。今楷第一次选时下载一次字体存在本机,之后从本机读、不再联网;
// 别的窗口的侧边栏跟着换,重新打开还在;下载失败、下到的不是字体时不换

import { e2e, sleep } from './harness.js';

// 一个很小的真字体(只有字母 A),代替 9 MB 的仓耳今楷:测试不真的去下载
const TINY_FONT = 'AAEAAAAKAIAAAwAgT1MvMkUgRWEAAAEoAAAAYGNtYXAADACUAAABkAAAADRnbHlmsqCyngAAAcwAAAA0aGVhZDAxCmIAAACsAAAANmhoZWEF3gJaAAAA5AAAACRobXR4AyAAZAAAAYgAAAAGbG9jYQAaAA0AAAHEAAAABm1heHAABAAGAAABCAAAACBuYW1lYUx5agAAAgAAAABXcG9zdAAoAAAAAAJYAAAAJgABAAAAAQAAgHueQF8PPPUAAwPoAAAAAOcvY2MAAAAA5y9jYwBkAAACWAK8AAAAAwACAAAAAAAAAAEAAAMg/zgAAAK8AGQAZAJYAAEAAAAAAAAAAAAAAAAAAAABAAEAAAACAAQAAQAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAwK8AZAABQAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAPz8/PwAAAEEAQQMgAAAAAAMgAMgAAAAAAAAAAAAAAAAAAAAgAAACvABkAGQAAAAAAAIAAAADAAAAFAADAAEAAAAUAAQAIAAAAAQABAABAAAAQf//AAAAQf///8AAAQAAAAAAAAANABoAAAABAGQAAAJYArwAAwAAMxEhEWQB9AK8/UQAAAEAZAAAAlgCvAADAAAzESERZAH0Arz9RAAAAAAEADYAAQAAAAAAAQAEAAAAAQAAAAAAAgAHAAQAAwABBAkAAQAIAAsAAwABBAkAAgAOABNUZXN0UmVndWxhcgBUAGUAcwB0AFIAZQBnAHUAbABhAHIAAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAACQAAA==';

e2e(async (t) => {
  const p = await t.start();
  await p.open(['A1', 'A2']);
  const [FONT, DEFAULT, KAI, APPLIED, FAILED] = await Promise.all(['font', 'fontDefault', 'fontKai', 'fontApplied', 'fontFailed'].map((k) => p.text(k)));
  // 记下每一次联网:页面一开始就把 fetch 包一层。mode 决定下载字体时拿到什么:font 是那个小字体,html 是一个网页,fail 是断网
  const WRAP = `
    window.__fetched = [];
    window.__mode = 'real';
    const real = window.fetch;
    window.fetch = async (url, ...rest) => {
      __fetched.push(String(url));
      if (__mode === 'real') return real(url, ...rest);
      if (__mode === 'fail') throw new TypeError('Failed to fetch');
      const bytes = __mode === 'font' ? Uint8Array.from(atob(${JSON.stringify(TINY_FONT)}), (c) => c.charCodeAt(0)) : new TextEncoder().encode('<!doctype html><title>404</title>');
      return new Response(bytes, { headers: { 'content-length': String(bytes.length) } });
    };
  `;
  const wrap = async (panel) => {
    await panel.b.send('Page.enable', {}, panel.sessionId);
    await panel.b.send('Page.addScriptToEvaluateOnNewDocument', { source: WRAP }, panel.sessionId);
    await panel.ev(WRAP);
  };
  const look = (panel) =>
    panel.ev(`
      const row = document.querySelector('#tabs .row .title');
      return {
        attr: document.documentElement.dataset.font ?? null,
        family: getComputedStyle(row).fontFamily.split(',')[0].replaceAll('"', ''),
        loaded: [...document.fonts].some((f) => f.family.replaceAll('"', '') === 'Monk Kai' && f.status === 'loaded'),
        fetched: window.__fetched?.length ?? null,
      };
    `);
  const openSettings = async (panel) => {
    await panel.clickAt('#spaces .space-dot.settings');
    await sleep(300);
  };
  const pick = async (panel, v) => {
    const r = await panel.ev(`const el = document.querySelector('#menu .font-pick .opts [data-v="${v}"]'); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }`);
    if (!r) throw new Error('菜单里没有字体的选项 ' + v);
    for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await panel.b.send('Input.dispatchMouseEvent', { type, x: r.x, y: r.y, button: type === 'mouseMoved' ? 'none' : 'left', clickCount: 1 }, panel.sessionId);
    await sleep(900);
  };
  const on = (panel) => panel.ev(`return document.querySelector('#menu .font-pick .opts i.on')?.textContent ?? null`);
  const toast = (panel) => panel.ev(`const el = document.querySelector('#toast'); return el.hidden ? '' : el.textContent`);
  const stored = () => p.ev(`return (await chrome.storage.local.get('font')).font ?? null`);
  const inCache = () => p.ev(`return !!(await (await caches.open('fonts')).match((await import('./src/font.js')).FONT_URL))`);

  await wrap(p);
  let s = await look(p);
  t.check('一开始是默认字体,没有联网', s.attr === null && s.family !== 'Monk Kai' && s.fetched === 0, s);

  await openSettings(p);
  t.check('设置菜单里有「字体」,选中的是「默认」', (await p.ev(`return document.querySelector('#menu .font-pick .label')?.textContent`)) === FONT && (await on(p)) === DEFAULT, await on(p));

  // 断网:换不成
  await p.ev(`__mode = 'fail'`);
  await pick(p, 'kai');
  s = await look(p);
  t.check('下载失败:字体没换,提示再试一次', s.attr === null && (await toast(p)) === FAILED && (await stored()) === null && !(await inCache()), [s, await toast(p)]);
  t.check('失败后「今楷」那一项恢复原样,还能再点', (await p.ev(`const el = document.querySelector('#menu .font-pick [data-v="kai"]'); return el.textContent + '|' + el.classList.contains('busy')`)) === `${KAI}|false`);

  // 下到的是个网页(比如主页还没更新):不当成字体存下来
  await p.ev(`__mode = 'html'`);
  await pick(p, 'kai');
  s = await look(p);
  t.check('下到的不是字体:不换,也不存', s.attr === null && (await toast(p)) === FAILED && !(await inCache()), [s, await toast(p)]);

  // 正常下载
  await p.ev(`__mode = 'font'; __fetched.length = 0`);
  await pick(p, 'kai');
  s = await look(p);
  t.check('选今楷:下载一次,换上', s.attr === 'kai' && s.family === 'Monk Kai' && s.loaded && s.fetched === 1, s);
  t.check('提示已换成今楷,菜单没关,选中的是「今楷」', (await toast(p)) === APPLIED && (await on(p)) === KAI && !(await p.ev(`return document.querySelector('#menu').hidden`)), [await toast(p), await on(p)]);
  t.check('存下来了:选择和字体文件', (await stored()) === 'kai' && (await inCache()));

  // 换回默认再换回今楷:字体已经在本机,不再下载
  await pick(p, 'default');
  s = await look(p);
  t.check('选默认:换回系统字体', s.attr === null && s.family !== 'Monk Kai' && (await stored()) === 'default', s);
  await p.ev(`__mode = 'fail'`);
  await pick(p, 'kai');
  s = await look(p);
  t.check('再选今楷:直接用本机的,不联网', s.attr === 'kai' && s.fetched === 1, s);

  // 另一个窗口的侧边栏、重新打开:都从本机读
  const q = await t.openPanel({ newWindow: true });
  await wrap(q);
  s = await look(q);
  t.check('新打开的侧边栏也是今楷,没有联网', s.attr === 'kai' && s.family === 'Monk Kai' && s.fetched === 0, s);
  await p.ev('location.reload()').catch(() => {});
  await sleep(2500);
  s = await look(p);
  t.check('重新打开:还是今楷,没有联网', s.attr === 'kai' && s.family === 'Monk Kai' && s.fetched === 0, s);

  await openSettings(p);
  await pick(p, 'default');
  s = await look(q);
  t.check('在一个窗口换回默认,另一个窗口跟着换', s.attr === null && s.family !== 'Monk Kai', s);

  // 选着今楷,但本机的字体没了(清过浏览器数据):照默认字体显示
  await pick(p, 'kai');
  await p.ev(`await caches.delete('fonts')`);
  await p.ev('location.reload()').catch(() => {});
  await sleep(2500);
  s = await look(p);
  t.check('字体文件没了:按默认字体显示,不自己去下载', s.attr === null && s.fetched === 0, s);
});
