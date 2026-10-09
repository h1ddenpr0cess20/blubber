import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { jaChars, LANGS, NIGHT_WORDS, startingLang, WORDS } from '../src/lang.js';
import { NIGHTS } from '../src/nights.js';

test('every word is there in every language, and every night has its Japanese', () => {
  for (const code of LANGS) {
    assert.deepEqual(Object.keys(WORDS[code]).sort(), Object.keys(WORDS.en).sort(), `${code} is missing a word, or has one too many`);
    for (const [key, w] of Object.entries(WORDS[code])) assert.equal(typeof w, typeof WORDS.en[key], `${code}.${key}`);
  }
  for (const n of NIGHTS) assert.equal(NIGHT_WORDS.ja[n.theme]?.length, 2, `${n.name} has no Japanese`);
});

test('the Japanese fonts have every character the Japanese uses', () => {
  const cut = new Set(readFileSync(new URL('../src/fonts/ja.txt', import.meta.url), 'utf8'));
  const missing = jaChars().filter((c) => !cut.has(c));
  assert.deepEqual(missing, [], 'run node scripts/fonts.js again');
});

test('it starts in the language asked for, then the one picked, then the browser\'s', () => {
  const store = (v) => ({ getItem: () => v });
  assert.equal(startingLang({ search: '?lang=ja', store: store('en'), asks: [] }), 'ja');
  assert.equal(startingLang({ search: '', store: store('ja'), asks: ['en-GB'] }), 'ja');
  assert.equal(startingLang({ search: '', store: null, asks: ['ja-JP', 'en'] }), 'ja');
  assert.equal(startingLang({ search: '?lang=xx', store: { getItem: () => { throw new Error('no'); } }, asks: ['fr', 'de'] }), 'en');
});
