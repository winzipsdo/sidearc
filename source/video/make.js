// 生成主页上的介绍视频 site/assets/intro.mp4(1920×1080,30fps)和封面 site/assets/intro-poster.jpg。
// 画面和动画在 scene.html / scene.js 里(Web Animations,所有动画都暂停,按时间定格);
// 这里用 Chrome 打开它,一帧帧调用 seek(t) 截图交给 ffmpeg 编码,再配上 music.js 生成的背景音乐。
// 需要本机装有 Chrome(路径可用环境变量 CHROME 指定)和 ffmpeg:npm run video
// 想在浏览器里实时预览动画:在仓库根目录起一个静态服务器,打开 /site/video/scene.html?play

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderMusic } from './music.js';

// 用 fileURLToPath 而不是 .pathname:Windows 上 .pathname 是 /C:/... 这样的路径,拼不出正确的文件路径
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const OUT = join(ROOT, 'site/assets');
const FPS = 30;
const SCALE = 1.5; // 画面按 1280×720 排版,截图时放大 1.5 倍,输出 1920×1080
const CHROME =
  process.env.CHROME ??
  [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].find(existsSync);
if (!CHROME) throw new Error('找不到 Chrome,请用环境变量 CHROME 指定路径');

// 从仓库根目录提供静态文件:画面要用到 sidepanel.css 和 store/ 下的图标
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = createServer((req, res) => {
  const file = join(ROOT, normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (!file.startsWith(ROOT) || !existsSync(file)) return res.writeHead(404).end();
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));

// 启动无头 Chrome,通过 DevTools 协议控制(Node 自带 WebSocket,不需要装别的包)
const profile = mkdtempSync(join(tmpdir(), 'sidearc-video-'));
const flags = ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--hide-scrollbars', '--mute-audio', '--force-color-profile=srgb'];
if (process.getuid?.() === 0) flags.push('--no-sandbox');
const chrome = spawn(CHROME, [...flags, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
const wsUrl = await new Promise((resolve, reject) => {
  let log = '';
  chrome.stderr.on('data', (d) => {
    log += d;
    const m = log.match(/DevTools listening on (ws:\S+)/);
    if (m) resolve(m[1]);
  });
  chrome.on('exit', () => reject(new Error('Chrome 启动失败:\n' + log)));
});
const ws = new WebSocket(wsUrl);
await new Promise((r, j) => ((ws.onopen = r), (ws.onerror = j)));
let lastId = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  const p = pending.get(msg.id);
  if (!p) return;
  pending.delete(msg.id);
  msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
};
const send = (method, params = {}, sessionId) =>
  new Promise((resolve, reject) => {
    const id = ++lastId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
const page = (method, params) => send(method, params, sessionId);
const evaluate = async (expression) => {
  const { result, exceptionDetails } = await page('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
  return result.value;
};
await page('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: SCALE, mobile: false });
await page('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
await page('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/site/video/scene.html` });
// 等画面搭好(字体、图标、侧边栏 iframe 都加载完),拿到总时长和点击音效的时间点
const deadline = Date.now() + 30000;
while (!(await evaluate('window.sceneReady === true').catch(() => false))) {
  if (Date.now() > deadline) throw new Error('画面加载超时:' + (await evaluate('String(window.sceneError)').catch(() => '')));
  await new Promise((r) => setTimeout(r, 100));
}
const { duration, clicks, poster } = await evaluate('({ duration: DURATION, clicks: CLICKS, poster: POSTER })');

// 背景音乐(含点击音效)先写成临时 wav,和画面一起交给 ffmpeg
const work = mkdtempSync(join(tmpdir(), 'sidearc-audio-'));
const wav = join(work, 'music.wav');
writeFileSync(wav, renderMusic(duration, clicks));

const mp4 = join(OUT, 'intro.mp4');
// 截图是 sRGB,按 BT.709 转成 yuv420p 并写明色彩信息,浏览器里颜色才不会偏
const ffmpeg = spawn(
  'ffmpeg',
  [
    ...['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-', '-i', wav],
    ...['-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709'],
    ...['-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-tune', 'animation', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', mp4],
  ],
  { stdio: ['pipe', 'inherit', 'inherit'] }
);
const done = new Promise((resolve, reject) => ffmpeg.on('exit', (code) => (code ? reject(new Error('ffmpeg 出错')) : resolve())));

const frames = Math.round(duration * FPS);
const started = Date.now();
for (let f = 0; f < frames; f++) {
  await evaluate(`seek(${f / FPS})`);
  const { data } = await page('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true });
  if (!ffmpeg.stdin.write(Buffer.from(data, 'base64'))) await new Promise((r) => ffmpeg.stdin.once('drain', r));
  if (f % FPS === 0) process.stdout.write(`\r第 ${f / FPS} / ${Math.round(duration)} 秒 (${((Date.now() - started) / 1000).toFixed(0)}s)`);
}
ffmpeg.stdin.end();
await done;
console.log('\n已生成', mp4.slice(ROOT.length));

// 封面:取 POSTER 那一刻的画面
await evaluate(`seek(${poster})`);
const { data } = await page('Page.captureScreenshot', { format: 'jpeg', quality: 88 });
writeFileSync(join(OUT, 'intro-poster.jpg'), Buffer.from(data, 'base64'));
console.log('已生成', 'site/assets/intro-poster.jpg');

ws.close();
chrome.kill();
await new Promise((r) => chrome.once('exit', r));
server.close();
rmSync(work, { recursive: true, force: true });
rmSync(profile, { recursive: true, force: true });
