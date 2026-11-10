// 依次跑 test/e2e 下所有的 *.e2e.js:npm run e2e
// 只跑名字里带某个词的:npm run e2e -- split(可以给好几个)
// 每个测试都会启动一个全新的 Chrome,互不影响;一个大概 20–60 秒

import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('.', import.meta.url));
const words = process.argv.slice(2);
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.e2e.js') && (!words.length || words.some((w) => f.includes(w))))
  .sort();
if (!files.length) {
  console.log('没有匹配的测试');
  process.exit(1);
}

const failed = [];
const start = Date.now();
for (const f of files) {
  console.log(`\n=== ${f}`);
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [f], { cwd: dir, stdio: 'inherit' });
  console.log(`(${Math.round((Date.now() - t0) / 1000)} 秒)`);
  if (r.status !== 0) failed.push(f);
}
console.log(`\n${files.length - failed.length}/${files.length} 个通过,共 ${Math.round((Date.now() - start) / 1000)} 秒`);
if (failed.length) console.log('没通过:', failed.join(' '));
process.exit(failed.length ? 1 : 0);
