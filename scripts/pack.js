// 打包成上传 Chrome 应用商店用的 zip:npm run pack → dist/sidearc-<版本号>.zip
// 只放扩展运行需要的文件;测试、上架资料、截图脚本都不进包。
// macOS / Linux 用系统的 zip,Windows 用自带的 tar(-a 按扩展名生成 zip)

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const FILES = ['manifest.json', 'background.js', 'sidepanel.html', 'sidepanel.css', 'sidepanel.js', 'boot.js', '_locales', 'icons', 'src'];

const { version } = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'));
for (const f of FILES) if (!existsSync(join(ROOT, f))) throw new Error(`缺少 ${f}`);
mkdirSync(join(ROOT, 'dist'), { recursive: true });
const out = join('dist', `sidearc-${version}.zip`);
rmSync(join(ROOT, out), { force: true });

if (process.platform === 'win32') execFileSync('tar', ['-a', '-cf', out, ...FILES], { cwd: ROOT, stdio: 'inherit' });
else execFileSync('zip', ['-qr', out, ...FILES, '-x', '*.DS_Store'], { cwd: ROOT, stdio: 'inherit' });
console.log('已生成', out);
