import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hasPrefix, KEY, MSG, PREFIX } from '../src/protocol.js';

test('KEY:按前缀拼出会话存储的键', () => {
  assert.equal(KEY.space(12), 't:12');
  assert.equal(KEY.alias(12), 'a:12');
  assert.equal(KEY.parent(12), 'c:12');
  assert.equal(KEY.bind('ab12cd34'), 'b:ab12cd34');
  assert.equal(KEY.fresh(12), 'n:12');
});

test('前缀都是单个字符且互不相同(store.js 的 applySession 按第一个字符分发)', () => {
  const prefixes = Object.values(PREFIX);
  assert.ok(prefixes.every((p) => p.length === 1));
  assert.equal(new Set(prefixes).size, prefixes.length);
});

test('hasPrefix', () => {
  assert.equal(hasPrefix('c:5', PREFIX.parent), true);
  assert.equal(hasPrefix('b:x', PREFIX.parent), false);
  assert.equal(hasPrefix('_restore', PREFIX.bind), false);
});

test('MSG:消息名互不相同', () => {
  assert.equal(new Set(Object.values(MSG)).size, Object.keys(MSG).length);
});
