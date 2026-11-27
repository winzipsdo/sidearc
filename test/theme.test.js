// 深色的那组颜色在 sidepanel.css 里写了两遍:一遍跟随系统(媒体查询),一遍给设置里固定成深色用(data-theme="dark")。
// 改了一处忘了另一处,两种深色就不一样了

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const css = readFileSync(new URL('../sidepanel.css', import.meta.url), 'utf8');
const vars = (block) => [...block.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(([, name, value]) => `${name}: ${value.trim()}`);

test('两处深色的变量一样', () => {
  const system = css.match(/@media \(prefers-color-scheme: dark\) \{\s*:root:not\(\[data-theme="light"\]\) \{([\s\S]*?)\}\s*\}/);
  const forced = css.match(/:root\[data-theme="dark"\] \{([\s\S]*?)\}/);
  assert.ok(system && forced, '找不到深色的两组变量');
  assert.ok(vars(system[1]).length > 5);
  assert.deepEqual(vars(forced[1]), vars(system[1]));
});
