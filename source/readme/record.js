// 录 README 里的动图和主页上的演示视频:在在线试用里(插件本身的代码)用脚本操作一遍,录屏后转成 GIF 和视频,中英文各一套:
//   assets/readme/<zh|en>/sync.gif    双向同步:侧边栏里拖,顶部标签栏跟着变;顶部拖,侧边栏跟着变
//   assets/readme/<zh|en>/spaces.gif  空间:点顶部折叠的分组、底部圆点切换,侧边栏换颜色
//   assets/readme/<zh|en>/leaves.gif  落叶:鼠标左右扫几下,落满叶子的一行扫干净(只截侧边栏里的列表,放大了看)
// README 用 https://winzipsdo.github.io/sidearc/assets/readme/... 引用这些图,main 上不放大文件。
// 同名的 .mp4、.webm 是给主页用的:按 2 倍分辨率录,比 GIF 清楚得多(GIF 只有 256 色,还得缩小了才不太大)。
// 需要 Playwright 和 ffmpeg。在 gh-pages 的工作目录里运行(Playwright 装在全局时让 require 找得到它):
//   NODE_PATH=$(npm root -g) node source/readme/record.js
// Chrome 不在 Playwright 默认的位置时,用环境变量 CHROME 指定。

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)('playwright');
const SITE = fileURLToPath(new URL('../../', import.meta.url));
const W = 1040;
const H = 720;
const GIF_W = 860; // 动图的宽度:README 里显示时还会再缩,太大只是白占体积
const FPS = 14;
const ONLY = process.argv.slice(2); // 只录这几段,比如 node source/readme/record.js leaves

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };
const server = createServer((req, res) => {
  const file = join(SITE, normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (!file.startsWith(SITE) || !existsSync(file) || statSync(file).isDirectory()) return res.writeHead(404).end();
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/source/readme/stage.html`;

const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--force-color-profile=srgb'] });

// 每一段:打开录制台,等插件就绪,跑一遍操作,录下来。
// 都把浏览器窗口放大 2 倍(CSS zoom,无头模式的 screencast 不管设备像素比)再录,视频就是 2 倍清晰度;
// crop:只截 crop(page) 给的那块(落叶很小,整个窗口缩下来看不清)。width:GIF 的宽度,视频是它的 2 倍
async function record(lang, name, script, { crop, width = GIF_W } = {}) {
  if (ONLY.length && !ONLY.includes(name)) return;
  const k = 2;
  const dir = mkdtempSync(join(tmpdir(), 'sidearc-readme-'));
  const ctx = await browser.newContext({ viewport: { width: W * k, height: H * k }, locale: lang === 'zh' ? 'zh-CN' : 'en-US', colorScheme: 'light' });
  const page = await ctx.newPage();
  // 录屏:用 Chrome 自己的 screencast(按实际像素出图,带时间戳),每一帧存成文件,最后按时间戳拼起来
  const cdp = await ctx.newCDPSession(page);
  const frames = [];
  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    frames.push({ t: metadata.timestamp, data });
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${BASE}?lang=${lang}&zoom=${k}`);
  await page.frameLocator('.sb-panel').locator('#tabs .row').first().waitFor();
  await page.waitForTimeout(900);
  await cdp.send('Page.startScreencast', { format: 'png', everyNthFrame: 1 });
  const panel = page.frameLocator('.sb-panel');

  // 鼠标:真的移动(触发页面事件),同时挪动画出来的指针
  let at = [W * k - 40, H * k - 40];
  const move = async (to, ms = 500, down = false) => {
    const steps = Math.max(2, Math.round(ms / 16));
    const [x0, y0] = at;
    for (let i = 1; i <= steps; i++) {
      const k = i / steps;
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2; // 先加速后减速
      const x = x0 + (to[0] - x0) * e;
      const y = y0 + (to[1] - y0) * e;
      await page.mouse.move(x, y);
      await page.evaluate(([x, y, d]) => window.pointAt(x, y, d), [x, y, down]);
    }
    at = to;
  };
  const press = async (down) => {
    await (down ? page.mouse.down() : page.mouse.up());
    await page.evaluate(([x, y, d]) => window.pointAt(x, y, d), [...at, down]);
  };
  const click = async () => {
    await press(true);
    await page.waitForTimeout(90);
    await press(false);
  };
  // 元素的中心(或者 fx、fy 指定的相对位置),相对整个页面。侧边栏 iframe 里的元素自己算:
  // 窗口用 CSS zoom 放大时,Playwright 给的 iframe 里元素的位置没有算上放大
  const where = async (locator, fx = 0.5, fy = 0.5) => {
    const b = await locator.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const f = el.ownerDocument.defaultView.frameElement?.getBoundingClientRect() ?? { x: 0, y: 0, width: 1 };
      const z = el.ownerDocument.defaultView.frameElement ? f.width / el.ownerDocument.defaultView.innerWidth : 1;
      return { x: f.x + r.x * z, y: f.y + r.y * z, width: r.width * z, height: r.height * z };
    });
    return [b.x + b.width * fx, b.y + b.height * fy];
  };
  const box = crop && (await crop({ page, panel, where }));
  await script({ page, panel, move, press, click, where, wait: (ms) => page.waitForTimeout(ms) });
  await page.waitForTimeout(700);
  await cdp.send('Page.stopScreencast');
  await ctx.close();
  if (errors.length) throw new Error(`${lang}/${name}: ${errors.join('; ')}`);

  // 画面不变时 Chrome 不出新帧:用 concat 列表写明每帧停多久,ffmpeg 再按固定帧率重采样
  let list = '';
  frames.forEach((f, i) => {
    const file = join(dir, `${String(i).padStart(5, '0')}.png`);
    writeFileSync(file, Buffer.from(f.data, 'base64'));
    const next = frames[i + 1]?.t ?? f.t + 0.7;
    list += `file '${file}'\nduration ${(next - f.t).toFixed(4)}\n`;
  });
  list += `file '${join(dir, `${String(frames.length - 1).padStart(5, '0')}.png`)}'\n`;
  writeFileSync(join(dir, 'frames.txt'), list);
  const out = join(SITE, 'assets/readme', lang, `${name}.gif`);
  mkdirSync(join(out, '..'), { recursive: true });
  // 调色板每段单独算,只编码有变化的区域,文件小很多
  execFileSync('ffmpeg', [
    ...['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', join(dir, 'frames.txt')],
    ...['-vf', `fps=${FPS},${box ? `crop=${Math.round(box.width)}:${Math.round(box.height)}:${Math.round(box.x)}:${Math.round(box.y)},` : ''}scale=${width}:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff:max_colors=160[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`],
    out,
  ]);
  // 主页用的视频:2 倍宽,H.264(mp4,Safari)和 VP9(webm),没有声音
  const vf = `fps=30,${box ? `crop=${Math.round(box.width)}:${Math.round(box.height)}:${Math.round(box.x)}:${Math.round(box.y)},` : ''}scale=${width * 2}:-2:flags=lanczos,format=yuv420p`;
  const input = ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', join(dir, 'frames.txt'), '-an', '-vf', vf];
  execFileSync('ffmpeg', [...input, '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-tune', 'animation', '-movflags', '+faststart', out.replace(/\.gif$/, '.mp4')]);
  execFileSync('ffmpeg', [...input, '-c:v', 'libvpx-vp9', '-crf', '32', '-b:v', '0', '-row-mt', '1', '-deadline', 'good', out.replace(/\.gif$/, '.webm')]);
  // 封面:视频的第一帧,还没开始播的时候显示
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', out.replace(/\.gif$/, '.mp4'), '-frames:v', '1', '-c:v', 'libwebp', '-quality', '85', out.replace(/\.gif$/, '.webp')]);
  rmSync(dir, { recursive: true, force: true });
  const mb = (f) => (statSync(f).size / 1048576).toFixed(1);
  console.log(`已生成 assets/readme/${lang}/${name}.gif(${mb(out)} MB)、.mp4(${mb(out.replace(/\.gif$/, '.mp4'))} MB)、.webm(${mb(out.replace(/\.gif$/, '.webm'))} MB)`);
}

const row = (panel, text) => panel.locator('#tabs .row', { hasText: text });

for (const lang of ['zh', 'en']) {
  const t = lang === 'zh' ? { work: '工作' } : { work: 'Work' };

  // 双向同步:侧边栏里把 Hacker News 拖到最上面,顶部跟着变;再在顶部把 lofi 拖到前面,侧边栏跟着变
  await record(lang, 'sync', async ({ page, panel, move, press, where, wait }) => {
    await move(await where(row(panel, 'Hacker'), 0.35), 700);
    await wait(250);
    await press(true);
    const top = await where(row(panel, 'chrome.sidePanel'), 0.35, 0.12);
    await move([top[0], top[1] + 30], 250, true);
    await move(top, 650, true);
    await wait(350);
    await press(false);
    await wait(1300);
    const lofi = page.locator('.sb-tab', { hasText: 'lofi' });
    await move(await where(lofi, 0.4), 700);
    await wait(250);
    await press(true);
    const notion = await where(page.locator('.sb-tab', { hasText: 'Notion' }), 0.1);
    await move([notion[0] + 40, notion[1]], 700, true);
    await move(notion, 300, true);
    await wait(250);
    await press(false);
    await wait(1500);
  });

  // 空间:点顶部折叠的「工作」分组,再点底部的圆点切到「学习」,最后回到第一个空间
  await record(lang, 'spaces', async ({ page, panel, move, click, where, wait }) => {
    await move(await where(page.locator('.sb-chip', { hasText: t.work })), 800);
    await wait(200);
    await click();
    await wait(1500);
    await move(await where(panel.locator('#spaces .space-dot[data-space="s-study"]')), 700);
    await wait(200);
    await click();
    await wait(1500);
    await move(await where(panel.locator('#spaces .space-dot[data-space="s-me"]')), 600);
    await wait(200);
    await click();
    await wait(1400);
  });

  // 落叶:Hacker News 好几天没进去过,落满了叶子;鼠标在那一行上左右快速扫几下
  await record(lang, 'leaves', async ({ panel, move, where, wait }) => {
    const hn = row(panel, 'Hacker');
    const [x1, y] = await where(hn, 0.4);
    const [x2] = await where(hn, 0.97);
    await move([x1, y], 900);
    await wait(500);
    for (let i = 0; i < 6; i++) {
      await move([x2, y + (i % 2 ? 2 : -2)], 170);
      await move([x1, y], 170);
    }
    // 从右边移出侧边栏(1.9 起最后一个标签页下面是新建标签页的加号,往下走会经过它,让它浮出来)
    await move([x2 + 260, y - 20], 600);
    await wait(1600);
  }, {
    // 只截侧边栏里标签页列表这一块
    crop: async ({ page, panel, where }) => {
      const side = await page.locator('.sb-panel').boundingBox();
      const [, top] = await where(panel.locator('#tabs .row[data-kind="tab"]').first(), 0, 0);
      const [, bottom] = await where(panel.locator('#tabs .row[data-kind="tab"]').last(), 0, 1);
      return { x: side.x, y: top - 8, width: side.width, height: bottom + 140 - (top - 8) };
    },
    width: 640,
  });
}

await browser.close();
server.close();
