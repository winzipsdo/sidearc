import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TAB_KEYS } from '../src/protocol.js';
import { bind, replaceTabId, TAB_MAPS, tabParent, tabSpace, tabs } from '../src/store.js';

test('侧边栏按 tabId 记的表,后台换编号时也都会挪(都在 TAB_KEYS 里)', () => {
  const perTab = new Set(TAB_KEYS.map((key) => key(1).split(':')[0]));
  for (const p of Object.keys(TAB_MAPS)) assert.ok(perTab.has(p), `前缀 ${p} 不在 TAB_KEYS 里`);
});

test('replaceTabId:每张表都挪到新编号,指向旧编号的父标签和绑定也改过来', () => {
  for (const map of Object.values(TAB_MAPS)) map.set(1, 'x');
  tabParent.set(1, 9);
  tabParent.set(2, 1);
  bind.set('item', 1);
  tabs.push({ id: 1 });
  replaceTabId(5, 1);
  for (const [p, map] of Object.entries(TAB_MAPS)) {
    assert.equal(map.has(1), false, `${p} 还留着旧编号`);
    assert.ok(map.has(5), `${p} 没挪到新编号`);
  }
  assert.equal(tabParent.get(5), 9);
  assert.equal(tabParent.get(2), 5);
  assert.equal(bind.get('item'), 5);
  assert.equal(tabSpace.get(5), 'x');
  assert.equal(tabs[0].id, 5);
});
