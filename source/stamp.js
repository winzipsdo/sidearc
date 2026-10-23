// 给主页引用的文件加上版本号(?v=内容的哈希),推送前运行:node source/stamp.js(source/build.js 最后也会运行)。
// GitHub Pages 让浏览器把文件缓存 10 分钟:不加版本号的话,更新后有人会拿到新的 index.html 配旧的样式和脚本,页面就乱了。
// 改的是 index.html、main.js、demo/ 和 ext/ 的两个页面里的引用;插件代码(ext/src/)内部互相引用的模块不改。

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = fileURLToPath(new URL('../', import.meta.url));
const hash = (file) => createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 8);
// 引用:引号里的相对路径,以这些扩展名结尾,后面可能已经有旧的 ?v=
const REF = /(["'])((?:\.{1,2}\/)?[\w./-]+\.(?:js|css|html|mp4|jpg|svg))(?:\?v=\w+)?\1/g;

// 按依赖顺序处理:先处理被引用的文件,它的哈希才包含它自己里面的新版本号
const FILES = ['demo/web.js', 'demo/sim.js', 'demo/inject.js', 'ext/sidepanel.html', 'ext/background.html', 'demo/demo.js', 'main.js', 'index.html'];
for (const name of FILES) {
  const file = join(SITE, name);
  const text = readFileSync(file, 'utf8');
  const out = text.replace(REF, (all, q, ref) => {
    // 插件自己的模块(ext/src/)由 sidepanel.js 不带版本号地引用,预加载也得是同一个地址;
    // 主页也用到其中两个,要和插件用同一个地址,不然会加载出两份
    if (/^(https?:|\/\/)/.test(ref)) return all;
    const target = resolve(dirname(file), ref);
    const rel = relative(SITE, target);
    if (rel.startsWith('..') || rel.startsWith('ext/src/')) return all;
    try {
      return `${q}${ref}?v=${hash(target)}${q}`;
    } catch {
      return all; // 不是本地文件(比如字符串里碰巧像路径的文字)
    }
  });
  if (out !== text) writeFileSync(file, out);
}
console.log('已更新引用的版本号');
