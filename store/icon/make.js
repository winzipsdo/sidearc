// 生成插件图标 icons/16、32、48、128.png。图标是一枚印:一个人在扫落叶。
// 图形在旁边的两个 SVG 里:seal.svg 是带毛边的大版(48、128 用),seal-small.svg 笔画更粗更简(16、32 用,工具栏上认得出)。
// 改了 SVG 后运行:node store/icon/make.js。需要本机装着 Chrome,路径不对时用环境变量 CHROME 指定。背景透明
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const out = join(HERE, '../../icons');
const CHROME =
  process.env.CHROME ||
  { win32: 'C:/Program Files/Google/Chrome/Application/chrome.exe', darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' }[process.platform] ||
  'google-chrome';
const svg = { small: readFileSync(join(HERE, 'seal-small.svg'), 'utf8'), big: readFileSync(join(HERE, 'seal.svg'), 'utf8') };
const profile = mkdtempSync(join(tmpdir(), 'monk-icon-'));
const proc = spawn(CHROME, ['--headless=new', `--user-data-dir=${profile}`, '--remote-debugging-pipe', '--no-first-run'], {
  stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'],
});
let seq = 0;
let buf = '';
const pending = new Map();
proc.stdio[4].on('data', (d) => {
  buf += d.toString('utf8');
  let i;
  while ((i = buf.indexOf('\0')) >= 0) {
    const m = JSON.parse(buf.slice(0, i));
    buf = buf.slice(i + 1);
    if (pending.has(m.id)) {
      pending.get(m.id)(m.result ?? m);
      pending.delete(m.id);
    }
  }
});
const send = (method, params = {}, sessionId) =>
  new Promise((r) => {
    pending.set(++seq, r);
    proc.stdio[3].write(JSON.stringify({ id: seq, method, params, sessionId }) + '\0');
  });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Page.enable', {}, sessionId);
await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } }, sessionId);
for (const [size, which] of [[16, 'small'], [32, 'small'], [48, 'big'], [128, 'big']]) {
  await send('Emulation.setDeviceMetricsOverride', { width: size, height: size, deviceScaleFactor: 1, mobile: false }, sessionId);
  const html = `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg[which]}`;
  await send('Page.navigate', { url: 'data:text/html;charset=utf-8,' + encodeURIComponent(html) }, sessionId);
  await sleep(600);
  const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: size, height: size, scale: 1 } }, sessionId);
  writeFileSync(join(out, `${size}.png`), Buffer.from(shot.data, 'base64'));
  console.log(`已生成 icons/${size}.png`);
}
await send('Browser.close');
await Promise.race([new Promise((r) => proc.on('exit', r)), sleep(4000)]);
try {
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
} catch {}
process.exit(0);
