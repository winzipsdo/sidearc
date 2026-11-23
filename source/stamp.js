// 给主页引用的文件加上版本号(?v=内容的哈希)。由 source/pages.js 在生成页面后运行,一般不用单独运行。
// GitHub Pages 让浏览器把文件缓存 10 分钟:不加版本号的话,更新后有人会拿到新的 index.html 配旧的样式和脚本,页面就乱了。
// 改的是中英文两个页面、main.js、demo/ 和 ext/ 里的引用。插件的模块(ext/src/)互相引用、主页也引用,
// 同一个模块各处必须是同一个地址(不然会加载出两份),所以它们共用一个版本号:所有模块内容合起来的哈希。

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = fileURLToPath(new URL('../', import.meta.url));
const hash = (file) => createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 8);
// 引用:引号里的相对路径,以这些扩展名结尾,后面可能已经有旧的 ?v=
const REF = /(["'])((?:\.{1,2}\/)?[\w./-]+\.(?:js|css|html|mp4|jpg|svg))(?:\?v=\w+)?\1/g;

// 按依赖顺序处理:先处理被引用的文件,它的哈希才包含它自己里面的新版本号
const SRC = readdirSync(join(SITE, 'ext/src'))
  .filter((f) => f.endsWith('.js'))
  .sort()
  .map((f) => 'ext/src/' + f);
const whole = createHash('sha256');
// 算之前去掉已经加上的版本号,重新运行时结果不变
for (const f of SRC) whole.update(readFileSync(join(SITE, f), 'utf8').replace(/[?]v=[0-9a-f]{8}/g, ''));
const SRC_V = whole.digest('hex').slice(0, 8);
const FILES = [...SRC, 'ext/sidepanel.js', 'ext/background.js', 'demo/web.js', 'demo/sim.js', 'demo/inject.js', 'ext/sidepanel.html', 'ext/background.html', 'demo/demo.js', 'main.js', 'index.html', 'en/index.html'];
for (const name of FILES) {
  const file = join(SITE, name);
  const text = readFileSync(file, 'utf8');
  const out = text.replace(REF, (all, q, ref) => {
    if (/^(https?:|\/\/)/.test(ref)) return all;
    const target = resolve(dirname(file), ref);
    // Windows 上是反斜杠
    const rel = relative(SITE, target).replaceAll('\\', '/');
    if (rel.startsWith('..')) return all;
    if (rel.startsWith('ext/src/') && rel.endsWith('.js')) return `${q}${ref}?v=${SRC_V}${q}`;
    // 插件代码里别的看着像路径的字符串不动
    if (name.startsWith('ext/') && name.endsWith('.js')) return all;
    try {
      return `${q}${ref}?v=${hash(target)}${q}`;
    } catch {
      return all; // 不是本地文件(比如字符串里碰巧像路径的文字)
    }
  });
  if (out !== text) writeFileSync(file, out);
}
console.log('已更新引用的版本号');
