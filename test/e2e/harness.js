// 端到端测试的公共部分:启动一个全新的 Chrome、加载扩展、在标签页里打开侧边栏页面,
// 提供在侧边栏里执行代码、模拟鼠标、查看标签栏的工具,最后汇总结果。
// 需要本机装着 Chrome(拆分视图的测试要 155 以上);路径不对时用环境变量 CHROME 指定。
// HEADFUL=1 时显示浏览器窗口,方便看它在做什么。
//
// 写法:
//   e2e(async (t) => {
//     const p = await t.start();          // 启动浏览器并打开侧边栏
//     await p.ev(`return 1 + 1`);         // 在侧边栏页面里执行(可以 await、可以 import('./src/...'))
//     t.check('说明', 条件, 出错时打印的东西);
//   });
// 布置数据尽量直接调扩展自己的函数或写存储,不经过界面:界面一改,经过界面布置的测试就跑不起来了。

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const EXT = fileURLToPath(new URL('../../', import.meta.url));
const CHROME =
  process.env.CHROME ||
  { win32: 'C:/Program Files/Google/Chrome/Application/chrome.exe', darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' }[process.platform] ||
  'google-chrome';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 本地网页:/<名字> 返回标题是这个名字的页面。查重、子标签只认 http(s) 的网页,data: 地址不算
function serve() {
  const server = createServer((req, res) => {
    const name = decodeURIComponent(new URL(req.url, 'http://x').pathname.slice(1)) || 'index';
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><title>${name}</title><body>${name}</body>`);
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server)));
}

// 启动 Chrome,通过管道(--remote-debugging-pipe)收发调试协议消息
function launch(profile, extra, errors) {
  const headless = process.env.HEADFUL ? [] : ['--headless=new'];
  const proc = spawn(
    CHROME,
    [...headless, `--user-data-dir=${profile}`, '--remote-debugging-pipe', '--enable-unsafe-extension-debugging', '--no-first-run', '--no-default-browser-check', '--window-size=900,900', ...extra],
    { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] }
  );
  const [tx, rx] = [proc.stdio[3], proc.stdio[4]];
  let seq = 0;
  let buf = '';
  const pending = new Map();
  const listeners = new Set();
  rx.on('data', (d) => {
    buf += d.toString('utf8');
    let i;
    while ((i = buf.indexOf('\0')) >= 0) {
      const msg = JSON.parse(buf.slice(0, i));
      buf = buf.slice(i + 1);
      if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
      for (const fn of listeners) fn(msg);
      const p = pending.get(msg.id);
      if (!p) continue;
      pending.delete(msg.id);
      msg.error ? p.reject(new Error(`${msg.error.message}`)) : p.resolve(msg.result);
    }
  });
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { resolve, reject });
      tx.write(JSON.stringify({ id, method, params, sessionId }) + '\0');
    });
  const exited = new Promise((r) => proc.on('exit', r));
  return { send, exited, listeners, close: () => send('Browser.close').catch(() => {}) };
}

// 在某个目标(页面、service worker)里执行代码的函数
const evaluator = (send, sessionId) => async (expr, { gesture = false } = {}) => {
  const r = await send('Runtime.evaluate', { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true, userGesture: gesture }, sessionId);
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
};

export function e2e(fn) {
  const profile = mkdtempSync(join(tmpdir(), 'sidearc-e2e-'));
  const errors = [];
  let pass = 0;
  let fail = 0;
  let browser;
  let server;

  const t = {
    errors,
    sleep,
    check(name, cond, detail) {
      if (cond) pass++, console.log('  PASS', name);
      else fail++, console.log('  FAIL', name, detail !== undefined ? '→ ' + JSON.stringify(detail) : '');
    },
    // 本地网页的地址
    url: (name) => `http://127.0.0.1:${server.address().port}/${encodeURIComponent(name)}`,

    // 启动浏览器(同一个测试里再调用就是用同一个用户目录重启)并打开侧边栏。
    // extra 是额外的启动参数;wait 是启动后等多久再加载扩展(重启时要等浏览器把上次的标签页恢复出来)
    async start({ extra = ['about:blank'], width = 360, wait = 0, newWindow = false } = {}) {
      server ??= await serve();
      browser = launch(profile, extra, errors);
      const b = browser;
      await sleep(wait);
      // 重启后扩展还装着,这里再加载一次也是同一个 id
      const { id: extId } = await b.send('Extensions.loadUnpacked', { path: EXT });
      t.extId = extId;
      await sleep(800);
      // 后台的报错也收集起来
      const { targetInfos } = await b.send('Target.getTargets');
      const sw = targetInfos.find((x) => x.type === 'service_worker' && x.url.startsWith(`chrome-extension://${extId}/`));
      if (sw) {
        const { sessionId } = await b.send('Target.attachToTarget', { targetId: sw.targetId, flatten: true });
        await b.send('Runtime.enable', {}, sessionId);
        t.bg = evaluator(b.send, sessionId);
      }
      return t.openPanel({ width, newWindow });
    },

    // 在新标签页里打开侧边栏页面(真正的侧边栏没法用调试协议打开,页面是同一个)。
    // newWindow:放在单独的窗口里,不占原来那个窗口的标签栏(这时侧边栏显示的是它自己那个窗口)
    async openPanel({ width = 360, newWindow = false } = {}) {
      const b = browser;
      const { targetId } = await b.send('Target.createTarget', { url: `chrome-extension://${t.extId}/sidepanel.html`, newWindow });
      const { sessionId } = await b.send('Target.attachToTarget', { targetId, flatten: true });
      await b.send('Runtime.enable', {}, sessionId);
      await b.send('Emulation.setDeviceMetricsOverride', { width, height: 800, deviceScaleFactor: 1, mobile: false }, sessionId);
      await sleep(1500);
      return panelTools(b, sessionId, targetId, t.url);
    },

    // 关掉浏览器(等它真的退出)。关闭过程中扩展里冒出的「The browser is shutting down」之类不算报错
    async quit() {
      const n = errors.length;
      await browser?.close();
      await Promise.race([browser?.exited, sleep(5000)]);
      browser = null;
      errors.length = n;
      await sleep(1000);
    },

    // 在某个网页标签页里执行代码(比如用 window.open 模拟点开链接)。gesture:当作用户点击触发的
    async inTab(tabTitle, expr, opts) {
      const { targetInfos } = await browser.send('Target.getTargets');
      const target = targetInfos.find((x) => x.type === 'page' && x.title === tabTitle);
      if (!target) throw new Error('找不到标签页 ' + tabTitle);
      const { sessionId } = await browser.send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
      return evaluator(browser.send, sessionId)(expr, opts);
    },

    screenshot: (file, data) => writeFileSync(file, Buffer.from(data, 'base64')),
  };

  Promise.resolve()
    .then(() => fn(t))
    .catch((e) => {
      fail++;
      console.log('ERROR', e.stack || e.message);
    })
    .finally(async () => {
      await t.quit();
      server?.close();
      rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
      console.log(`\n${pass} passed, ${fail} failed`);
      process.exit(fail ? 1 : 0);
    });
}

// 侧边栏页面上的工具
function panelTools(b, sessionId, targetId, url) {
  const ev = evaluator(b.send, sessionId);
  const input = (params) => b.send('Input.dispatchMouseEvent', params, sessionId);
  const p = {
    b,
    sessionId,
    targetId,
    ev,
    // 在后台打开几个本地网页(标题就是名字),等标题都出来;返回 { 名字: tabId }。windowId 不给就是侧边栏所在的窗口
    async open(names, { windowId } = {}) {
      await ev(`for (const u of ${JSON.stringify(names.map(url))}) await chrome.tabs.create({ url: u, active: false${windowId != null ? ', windowId: ' + windowId : ''} });`);
      for (let i = 0; i < 50; i++) {
        const ids = await ev(`const all = await chrome.tabs.query({}); return Object.fromEntries(${JSON.stringify(names)}.map((n) => [n, all.find((t) => t.title === n)?.id]))`);
        // 没找到的值是 undefined,传回来时整个键就没了,所以数键的个数
        if (names.every((n) => ids[n] != null)) return ids;
        await sleep(200);
      }
      throw new Error('标签页没有打开:' + names.join());
    },
    // 新建一个空间(不切过去),返回它的 id
    addSpace: (name) =>
      ev(`const s = await import('./src/store.js'); const id = s.uid(); s.state.spaces.push({ id, name: ${JSON.stringify(name)}, color: s.COLORS[s.state.spaces.length % s.COLORS.length], pinned: [] }); await s.save(); return id;`),
    // 界面上的文字(按 i18n.js 里的键取,跟着当前语言)
    text: (key) => ev(`return (await import('./src/i18n.js')).t(${JSON.stringify(key)})`),
    // 某个标签页的 id(按标题找)
    id: (title) => ev(`return (await chrome.tabs.query({})).find((t) => t.title === ${JSON.stringify(title)})?.id ?? null`),
    // 列表里某个标签页那一行的选择器
    rowOf: (title, list = '#tabs') => ev(`const r = [...document.querySelectorAll('${list} .row')].find((r) => r.querySelector('.title')?.textContent === ${JSON.stringify(title)}); return r ? '${list} .row[data-id="' + r.dataset.id + '"]' : null`),
    rect: (sel) => ev(`const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { left: r.left, top: r.top, w: r.width, h: r.height }`),
    // 在元素上点一下(button:left / right;mods:2 = Ctrl,8 = Shift)
    async clickAt(sel, button = 'left', mods = 0) {
      const r = await p.rect(sel);
      const x = r.left + 40;
      const y = r.top + r.h / 2;
      await input({ type: 'mouseMoved', x, y });
      for (const type of ['mousePressed', 'mouseReleased']) await input({ type, x, y, button, clickCount: 1, modifiers: mods });
      await sleep(400);
    },
    // 在列表里某个标签页上点一下,默认右键
    async mouse(title, button = 'right', mods = 0) {
      const sel = await p.rowOf(title);
      if (!sel) throw new Error('列表里没有 ' + title);
      await p.clickAt(sel, button, mods);
    },
    // 右键菜单里的各项文字;菜单没开时是 null
    labels: () => ev(`return document.querySelector('#menu').hidden ? null : [...document.querySelectorAll('#menu button')].map((b) => b.textContent)`),
    async clickLabel(label) {
      const r = await ev(`const b = [...document.querySelectorAll('#menu button')].find((b) => b.textContent === ${JSON.stringify(label)}); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + 30, y: r.top + r.height / 2 }`);
      if (!r) return false;
      await input({ type: 'mouseMoved', x: r.x, y: r.y });
      for (const type of ['mousePressed', 'mouseReleased']) await input({ type, x: r.x, y: r.y, button: 'left', clickCount: 1 });
      return true;
    },
    closeMenu: () => ev(`(await import('./src/ui.js')).hideMenu()`),
    // 顶部标签栏:标题匹配 pattern 的标签页,[s] 在拆分视图里,{g} 在分组里,* 是当前标签页
    strip: (pattern = '^T\\d') =>
      ev(`return (await chrome.tabs.query({ currentWindow: true })).filter((t) => new RegExp(${JSON.stringify(pattern)}).test(t.title)).map((t) => t.title + (t.splitViewId > -1 ? '[s]' : '') + (t.groupId > -1 ? '{g}' : '') + (t.active ? '*' : '')).join(' ')`),
    // 侧边栏列表:拆分视图的一对写成 [A+B]
    blocks: (pattern = 'T\\d') =>
      ev(`return [...document.querySelectorAll('#tabs > *')].map((el) => el.classList.contains('split') ? '[' + [...el.querySelectorAll('.title')].map((x) => x.textContent).join('+') + ']' : el.querySelector?.('.title')?.textContent).filter((x) => x && new RegExp(${JSON.stringify(pattern)}).test(x)).join(' ')`),
    // 列表里的行:{ title, alias, depth 缩进几层, asleep 休眠着(变淡), open 固定项开着 }
    rows: (list = '#tabs') =>
      ev(`return [...document.querySelectorAll('${list} .row:not(.new)')].map((r) => ({ title: r.querySelector('.title')?.textContent, alias: r.querySelector('.alias')?.textContent ?? null, depth: +((r.closest('.split') ?? r).style.getPropertyValue('--depth') || 0), asleep: r.classList.contains('discarded'), open: r.classList.contains('open') }))`),
    // 等标签栏安静下来(后台排分组时会连着挪标签页)。返回 false = 一直停不下来
    async settle() {
      await ev(`if (window.__moves == null) { window.__moves = 0; for (const e of ['onMoved', 'onAttached', 'onDetached']) chrome.tabs[e].addListener(() => __moves++); chrome.tabGroups.onUpdated.addListener(() => __moves++); }`);
      for (let i = 0; i < 20; i++) {
        const m0 = await ev(`return __moves`);
        await sleep(1500);
        if ((await ev(`return __moves`)) === m0) return true;
      }
      return false;
    },
    // 会话存储里的全部内容
    session: () => ev(`return await chrome.storage.session.get(null)`),
  };
  return p;
}
