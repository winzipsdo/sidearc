// 把主页要发布的文件收集到 dist/site/,用于 GitHub Pages:npm run site
// site/ 下的页面和 assets/ 原样复制(video/ 是生成视频用的,不发布),再加上商店截图和图标。
// 本地预览:npx serve dist/site

import { cpSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUT = join(ROOT, 'dist/site');

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
for (const f of ['index.html', 'style.css', 'main.js', 'assets']) cpSync(join(ROOT, 'site', f), join(OUT, f), { recursive: true });
for (const dir of ['store', 'store/en']) {
  mkdirSync(join(OUT, dir), { recursive: true });
  for (const f of readdirSync(join(ROOT, dir)).filter((f) => f.startsWith('screenshot-'))) cpSync(join(ROOT, dir, f), join(OUT, dir, f));
}
cpSync(join(ROOT, 'icons'), join(OUT, 'icons'), { recursive: true });
// 纯静态页面,不需要 GitHub Pages 用 Jekyll 处理
writeFileSync(join(OUT, '.nojekyll'), '');
console.log('已生成', OUT.slice(ROOT.length));
