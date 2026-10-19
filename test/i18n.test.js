import assert from 'node:assert/strict';
import test from 'node:test';
import { MESSAGE_KEYS, resolveLang } from '../src/i18n.js';

test('i18n:中英文的文案键一一对应', () => {
  assert.deepEqual([...MESSAGE_KEYS.en].sort(), [...MESSAGE_KEYS.zh].sort());
});

test('resolveLang:手动选的优先,否则看浏览器语言', () => {
  assert.equal(resolveLang('zh'), 'zh');
  assert.equal(resolveLang('en'), 'en');
  const old = globalThis.chrome;
  for (const [ui, want] of [['zh-CN', 'zh'], ['zh', 'zh'], ['zh-TW', 'en'], ['zh-HK', 'en'], ['en-US', 'en'], ['ja', 'en']]) {
    globalThis.chrome = { i18n: { getUILanguage: () => ui } };
    assert.equal(resolveLang('auto'), want);
  }
  globalThis.chrome = old;
});
