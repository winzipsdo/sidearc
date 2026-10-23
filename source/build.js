// 把主页要用到的、来自 main 分支的文件复制到这个分支(gh-pages)的根目录:
//   ext/     插件本身的代码,给「在线试用」跑(sidepanel.html 里插入 demo/inject.js,另生成 background.html)
//   store/   应用商店截图(中英文)
//   icons/   插件图标
//   demo/brand-icons.js  网站图标的图形(试用里的假网站、介绍视频都用)
// 用法:在 gh-pages 的工作目录里运行 node source/build.js <main 的检出目录>(默认是 ../sidearc)。
// 插件代码改了,重新运行一次再提交推送,在线试用就是最新的版本。

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = fileURLToPath(new URL('../', import.meta.url));
const MAIN = resolve(process.argv[2] ?? join(SITE, '../sidearc'));
if (!existsSync(join(MAIN, 'manifest.json'))) throw new Error(`${MAIN} 不是插件的检出目录(找不到 manifest.json)`);

const copy = (from, to) => cpSync(join(MAIN, from), join(SITE, to), { recursive: true });

// 插件代码:侧边栏和后台用到的文件
const EXT = join(SITE, 'ext');
rmSync(EXT, { recursive: true, force: true });
mkdirSync(EXT, { recursive: true });
for (const f of ['sidepanel.css', 'sidepanel.js', 'boot.js', 'background.js', 'src']) copy(f, join('ext', f));
// 模拟的 chrome.* 接口要在插件自己的脚本之前就位
const inject = (ctx) => `<script src="../demo/inject.js" data-ctx="${ctx}"></script>`;
const panel = readFileSync(join(MAIN, 'sidepanel.html'), 'utf8').replace(/<head>/i, `<head>\n  ${inject('panel')}`);
writeFileSync(join(EXT, 'sidepanel.html'), panel);
writeFileSync(join(EXT, 'background.html'), `<!doctype html>\n<meta charset="utf-8">\n<title>Sidearc background</title>\n${inject('background')}\n<script type="module" src="background.js"></script>\n`);

// 截图和图标
for (const dir of ['store', 'store/en']) {
  mkdirSync(join(SITE, dir), { recursive: true });
  for (const f of readdirSync(join(MAIN, dir)).filter((f) => f.startsWith('screenshot-'))) copy(join(dir, f), join(dir, f));
}
copy('icons', 'icons');
copy('store/screenshots/brand-icons.js', 'demo/brand-icons.js');
writeFileSync(join(SITE, '.nojekyll'), '');

const { version } = JSON.parse(readFileSync(join(MAIN, 'manifest.json'), 'utf8'));
writeFileSync(join(EXT, 'version.json'), JSON.stringify({ version }) + '\n');
console.log(`已从 ${MAIN} 复制插件 ${version} 的代码、截图和图标`);

// 复制来的文件变了,引用它们的版本号也要跟着变
await import('./stamp.js');
