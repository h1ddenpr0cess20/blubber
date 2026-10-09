import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createStorage } from '../src/storage.js';

const memory = () => {
  const data = new Map();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)) };
};

test('it remembers the furthest night, the most moons and the most candy', () => {
  const store = memory();
  const s = createStorage(store);
  s.reached(3);
  s.reached(1);
  s.moons(0, 2);
  s.moons(0, 1);
  s.record(120);
  s.record(80);
  const again = createStorage(store).load();
  assert.equal(again.reached, 3);
  assert.equal(again.moons[0], 2);
  assert.equal(again.best, 120);
});

test('it plays on without storage, or with storage that refuses, or with rubbish in it', () => {
  assert.doesNotThrow(() => createStorage(null).moons(0, 3));
  const refusing = { getItem: () => { throw new Error('no'); }, setItem: () => { throw new Error('no'); } };
  assert.equal(createStorage(refusing).reached(2).reached, 2);
  const store = memory();
  store.setItem('blubber.v1', '{"best":"lots","reached":1.5,"moons":{"0":9,"1":2}}');
  assert.deepEqual(createStorage(store).load(), { best: 0, reached: 0, moons: { 1: 2 } });
});
