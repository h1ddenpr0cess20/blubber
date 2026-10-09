import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CAST } from '../src/models/cast/index.js';
import { decorDetailOf, detailOf, SCULPTED } from '../src/models/library.js';
import { bake } from '../src/models/model.js';
import { PROPS } from '../src/models/props/index.js';
import { Skeleton } from '../src/models/rig.js';

const baked = new Map();
const get = (name, detail) => {
  const k = `${name}@${detail}`;
  if (!baked.has(k)) baked.set(k, bake(SCULPTED[name], { detail }));
  return baked.get(k);
};

test('every model bakes to a sound mesh at the detail it is used at, within its budget', () => {
  for (const name of Object.keys(SCULPTED)) {
    const def = SCULPTED[name];
    const m = get(name, detailOf(name));
    assert.ok(m.count > 100, `${name}: hardly anything baked`);
    assert.ok(m.count <= (def.budget ?? 32000), `${name}: ${m.count} vertices`);
    assert.ok(m.position.every(Number.isFinite) && m.normal.every(Number.isFinite), `${name}: a broken vertex`);
    for (let i = 0; i < m.index.length; i++) assert.ok(m.index[i] < m.count);
    assert.ok(m.groups.every((g) => g.materialIndex < Object.keys(def.materials).length));
  }
});

test('the scenery is lighter as scenery, where there may be dozens of it', () => {
  for (const [name, def] of Object.entries(PROPS)) {
    if (!def.decor) continue;
    assert.ok(get(name, decorDetailOf(name)).count < 20000, `${name} as scenery is too heavy`);
  }
});

test('every creature poses in all its clips without coming apart', () => {
  for (const [name, def] of Object.entries(CAST)) {
    const k = new Skeleton(def.bones);
    for (const clip of ['idle', 'walk', 'attack', 'scared', 'grab']) {
      for (const t of [0, 0.2, 0.5]) {
        k.reset();
        def.animate(k, { clip, t, time: 3 + t, seed: 1, speed: 1 });
        k.compute();
        assert.ok(k.matrices.every(Number.isFinite), `${name} ${clip}: a bad matrix`);
      }
    }
  }
});

test('a bake comes out the same every time', () => {
  const a = bake(SCULPTED.candycorn, { detail: 1 });
  const again = bake({ ...SCULPTED.candycorn, name: 'candycorn-again' }, { detail: 1 });
  assert.deepEqual([...a.position.slice(0, 300)], [...again.position.slice(0, 300)]);
});
