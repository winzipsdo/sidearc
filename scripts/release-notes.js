// 生成 GitHub Release 的说明:从 CHANGELOG.md 里挑出「上一个版本标签之后」的提交对应的条目,按类别合并。
// 用法:node scripts/release-notes.js [起点标签]   不给起点就用最近的一个版本标签;一个标签都没有就列出全部
// 条目末尾带着提交链接,按链接里的 hash 判断属不属于这次发布

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

let since = process.argv[2];
if (!since) {
  try {
    since = git('describe', '--tags', '--abbrev=0', '--match', 'v*');
  } catch {
    since = null; // 还没有任何版本标签
  }
}
const range = since ? `${since}..HEAD` : 'HEAD';
const inRange = new Set(git('rev-list', range).split('\n').filter(Boolean).map((h) => h.slice(0, 7)));

// 解析 CHANGELOG:「### 类别」下面,每个条目是一行「- 」加上缩进的子行
const ORDER = ['新增', '变更', '修复', '移除', '内部改进', '文档'];
const picked = new Map();
let section = null;
let entry = null;
const flush = () => {
  if (!entry || !section) return;
  const hashes = [...entry.join('\n').matchAll(/commit\/([0-9a-f]{7})/g)].map((m) => m[1]);
  if (hashes.some((h) => inRange.has(h))) {
    if (!picked.has(section)) picked.set(section, []);
    picked.get(section).push(entry.join('\n'));
  }
  entry = null;
};
for (const line of readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8').split('\n')) {
  if (line.startsWith('## ')) (flush(), (section = null));
  else if (line.startsWith('### ')) (flush(), (section = line.slice(4).trim()));
  else if (line.startsWith('- ')) (flush(), (entry = [line]));
  else if (entry && line.startsWith('  ')) entry.push(line);
  else flush();
}
flush();

const { version } = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'));
const sections = [...picked.keys()].sort((a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99));
const out = sections.map((s) => `## ${s}\n\n${picked.get(s).join('\n')}`);
if (!out.length) out.push('这个版本没有面向用户的变化。');
out.push(`## 安装

下载下方的 \`sidearc-${version}.zip\`,解压后在 \`chrome://extensions\` 打开「开发者模式」,点「加载已解压的扩展程序」选择解压出的文件夹。

完整记录见 [CHANGELOG.md](https://github.com/winzipsdo/sidearc/blob/main/CHANGELOG.md)。`);
console.log(out.join('\n\n'));
