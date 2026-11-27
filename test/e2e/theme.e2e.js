// 设置菜单里的「外观」:自动(跟随系统)、浅色、深色。选了马上换,别的窗口的侧边栏跟着换,重新打开时在画出来之前就套上

import { e2e, sleep } from './harness.js';

e2e(async (t) => {
  const p = await t.start();
  const media = (panel, scheme) => panel.b.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] }, panel.sessionId);
  // 底色:浅色是 #fbfbfc,深色是 #1d1e22(sidepanel.css 的 --base)
  const look = (panel) => panel.ev(`return { attr: document.documentElement.dataset.theme ?? null, base: getComputedStyle(document.documentElement).getPropertyValue('--base').trim(), scheme: getComputedStyle(document.documentElement).colorScheme }`);
  const LIGHT = '#fbfbfc';
  const DARK = '#1d1e22';
  const [APPEARANCE, AUTO, LIGHT_LABEL, DARK_LABEL] = await Promise.all(['appearance', 'themeAuto', 'themeLight', 'themeDark'].map((k) => p.text(k)));
  const openSettings = async (panel) => {
    await panel.clickAt('#spaces .space-dot.settings');
    await sleep(300);
  };
  // 点「外观」那一行里的某个选项
  const pick = async (panel, label) => {
    const r = await panel.ev(`const el = [...document.querySelectorAll('#menu .theme-pick .opts i')].find((x) => x.textContent === ${JSON.stringify(label)}); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }`);
    if (!r) throw new Error('菜单里没有 ' + label);
    for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await panel.b.send('Input.dispatchMouseEvent', { type, x: r.x, y: r.y, button: type === 'mouseMoved' ? 'none' : 'left', clickCount: 1 }, panel.sessionId);
    await sleep(500);
  };
  const on = (panel) => panel.ev(`return document.querySelector('#menu .theme-pick .opts i.on')?.textContent ?? null`);

  await media(p, 'light');
  await sleep(300);
  let s = await look(p);
  t.check('一开始跟随系统:系统是浅色就是浅色', s.attr === null && s.base === LIGHT, s);
  await media(p, 'dark');
  await sleep(300);
  s = await look(p);
  t.check('系统换成深色,跟着变深', s.attr === null && s.base === DARK, s);

  await openSettings(p);
  t.check('设置菜单里有「外观」,选中的是「自动」', (await p.ev(`return document.querySelector('#menu .theme-pick .label')?.textContent`)) === APPEARANCE && (await on(p)) === AUTO, await on(p));
  await pick(p, LIGHT_LABEL);
  s = await look(p);
  t.check('选浅色:系统是深色也用浅色', s.attr === 'light' && s.base === LIGHT && s.scheme === 'light', s);
  t.check('菜单没关,选中的换成「浅色」', (await on(p)) === LIGHT_LABEL && !(await p.ev(`return document.querySelector('#menu').hidden`)), await on(p));
  t.check('存下来了', (await p.ev(`return (await chrome.storage.local.get('theme')).theme`)) === 'light');

  // 另一个窗口的侧边栏
  const q = await t.openPanel({ newWindow: true });
  await media(q, 'dark');
  await sleep(300);
  s = await look(q);
  t.check('新打开的侧边栏也是浅色', s.attr === 'light' && s.base === LIGHT, s);
  await media(p, 'light');
  await pick(p, DARK_LABEL);
  s = await look(p);
  t.check('选深色:系统是浅色也用深色', s.attr === 'dark' && s.base === DARK && s.scheme === 'dark', s);
  s = await look(q);
  t.check('别的窗口的侧边栏跟着换', s.attr === 'dark' && s.base === DARK, s);

  // 重新打开:页面脚本还没加载时就已经是深色(boot.js),不会先闪一下浅色
  await p.b.send('Page.enable', {}, p.sessionId);
  await p.b.send('Page.addScriptToEvaluateOnNewDocument', { source: `addEventListener('DOMContentLoaded', () => (window.__early = document.documentElement.dataset.theme ?? null))` }, p.sessionId);
  await p.ev('location.reload()').catch(() => {});
  await sleep(2500);
  t.check('重新打开时一开始就是深色', (await p.ev('return window.__early')) === 'dark', await p.ev('return window.__early'));

  await openSettings(p);
  t.check('菜单里选中的是「深色」', (await on(p)) === DARK_LABEL, await on(p));
  await pick(p, AUTO);
  s = await look(p);
  t.check('选回自动:又跟随系统(这里是浅色)', s.attr === null && s.base === LIGHT, s);
  s = await look(q);
  t.check('另一个窗口也回到跟随系统(它那边是深色)', s.attr === null && s.base === DARK, s);
});
