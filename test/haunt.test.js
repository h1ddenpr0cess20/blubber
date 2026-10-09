import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHaunt, litCount, moons, SPOOK, STEP_TIME, stepHaunt } from '../src/haunt.js';
import { buildNight } from '../src/night.js';
import { NIGHTS } from '../src/nights.js';
import { autopilot } from './helpers/autopilot.js';

const first = () => createHaunt(buildNight(NIGHTS[0]));
const run = (h, push, seconds, opts) => {
  let out = null;
  for (let t = 0; t < seconds; t += STEP_TIME) out = stepHaunt(h, push, opts) ?? out;
  return out;
};

test('every night can be got out of: every lantern lit, and through the gate', () => {
  for (const [i, recipe] of NIGHTS.entries()) {
    const h = createHaunt(buildNight(recipe), { seed: 7 + i });
    const r = autopilot(h);
    assert.ok(r.escaped, `${recipe.name}: stuck with ${r.lit} of ${h.lanterns.length} lanterns after ${Math.round(r.time)} s`);
    // Done the straightest way, it should be well inside midnight.
    assert.ok(r.time < recipe.par * 0.75, `${recipe.name}: took ${Math.round(r.time)} s against a par of ${recipe.par}`);
  }
});

test('every moon can be won: most of the candy, and out before midnight', () => {
  for (const [i, recipe] of NIGHTS.entries()) {
    const h = createHaunt(buildNight(recipe), { seed: 7 + i });
    const r = autopilot(h, { candy: true, limit: 1200 });
    assert.ok(r.escaped, `${recipe.name}: didn't get out gathering candy`);
    assert.equal(moons({ carried: r.carried, total: r.total, time: r.time, par: recipe.par }), 3,
      `${recipe.name}: ${r.carried} of ${r.total} candy in ${Math.round(r.time)} s against a par of ${recipe.par}`);
  }
});

test('floating over a sweet eats it, and a treat is worth ten', () => {
  const h = first();
  const c = h.candy[0];
  Object.assign(h.ghost, { x: c.x, z: c.z });
  const out = stepHaunt(h, [0, 0]);
  assert.ok(c.taken);
  assert.ok(out.eaten.includes(c));
  assert.equal(h.carried, 1);
  const t = h.treats[0];
  Object.assign(h.ghost, { x: t.x, z: t.z });
  stepHaunt(h, [0, 0]);
  assert.equal(h.carried, 11);
});

test('the gate opens only when the last lantern is lit, and only then lets Blubber out', () => {
  const h = first();
  const gate = h.night.gate;
  Object.assign(h.ghost, { x: gate.x, z: gate.z });
  stepHaunt(h, [0, 0]);
  assert.ok(!h.escaped, 'out through a shut gate');
  h.lanterns.forEach((l, i) => {
    Object.assign(h.ghost, { x: l.x, z: l.z });
    const out = stepHaunt(h, [0, 0]);
    assert.equal(litCount(h), i + 1);
    assert.equal(out.opened, i === h.lanterns.length - 1);
  });
  Object.assign(h.ghost, { x: gate.x, z: gate.z });
  const out = stepHaunt(h, [0, 0]);
  assert.ok(out.escaped && h.escaped);
});

/** A night with its sweets all gone, so none are eaten by the way. */
const bare = () => {
  const h = first();
  for (const c of [...h.candy, ...h.treats]) c.taken = true;
  return h;
};

test('caught, Blubber spills candy, is knocked back, and is safe for a moment', () => {
  const h = bare();
  h.carried = 12;
  const z = h.chasers[0];
  Object.assign(h.ghost, { x: z.x + 0.3, z: z.z });
  const out = stepHaunt(h, [0, 0]);
  assert.ok(out.caught, 'not caught');
  assert.equal(out.caught.lost, 5);
  assert.equal(h.carried, 7);
  assert.equal(h.dropped.length, 5);
  assert.ok(h.ghost.vx > 0, 'knocked away from it');
  // Safe for a moment: not caught again straight away.
  Object.assign(h.ghost, { x: z.x + 0.2, z: z.z, vx: 0 });
  assert.equal(stepHaunt(h, [0, 0]).caught, null);
  // The spilled candy can be gathered up again once it has landed.
  run(h, [0, 0], 0.3);
  assert.equal(h.dropped.length, 5, 'gathered up before it landed');
  run(h, [0, 0], 0.5);
  const c = h.dropped[0] ?? { x: h.ghost.x, z: h.ghost.z };
  Object.assign(h.ghost, { x: c.x, z: c.z });
  stepHaunt(h, [0, 0]);
  assert.ok(h.carried > 7, 'none of it gathered up again');
});

test('nothing worse than spilled candy: an empty-handed Blubber loses nothing', () => {
  const h = bare();
  const z = h.chasers[0];
  Object.assign(h.ghost, { x: z.x + 0.3, z: z.z });
  const out = stepHaunt(h, [0, 0]);
  assert.equal(out.caught.lost, 0);
  assert.equal(h.carried, 0);
});

test('a spook sends whatever is close running, and has to wait to come again', () => {
  const h = first();
  const z = h.chasers[0];
  Object.assign(h.ghost, { x: z.x + 2, z: z.z });
  const out = stepHaunt(h, [0, 0], { spook: true });
  assert.deepEqual(out.spooked, [z]);
  assert.equal(z.state, 'scared');
  assert.equal(stepHaunt(h, [0, 0], { spook: true }).spooked, null, 'spooked again at once');
  // Scared, it doesn't catch.
  Object.assign(h.ghost, { x: z.x, z: z.z });
  assert.equal(stepHaunt(h, [0, 0]).caught, null);
  // And it gets over it.
  run(h, [0, 0], SPOOK.flee + 0.5);
  assert.notEqual(z.state, 'scared');
});

test('a chaser comes for Blubber when it is near, along the maze', () => {
  const h = first();
  const z = h.chasers[0];
  const { plan, maze } = h.night;
  // Put Blubber two cells away along the maze from it.
  const cell = plan.cellAt(z.x, z.z);
  const dist = maze.distances(...cell);
  let k = 0;
  for (let i = 0; i < dist.length; i++) if (dist[i] === 2) { k = i; break; }
  const [gx, gz] = plan.cellCentre(k % maze.cols, Math.floor(k / maze.cols));
  Object.assign(h.ghost, { x: gx, z: gz });
  const before = Math.hypot(z.x - gx, z.z - gz);
  run(h, [0, 0], 1.5, { live: false });
  assert.equal(z.state, 'chase');
  assert.ok(Math.hypot(z.x - gx, z.z - gz) < before);
});

test('chasers never walk through walls', () => {
  const h = createHaunt(buildNight(NIGHTS[3]));
  for (let t = 0; t < 40; t += STEP_TIME) {
    stepHaunt(h, [0, 0], { live: false });
    for (const c of h.chasers) assert.ok(!h.night.grounds.blocks(Math.floor(c.x), Math.floor(c.z)), `${c.kind} in a wall at ${c.x}, ${c.z}`);
  }
});

test('moons: one for getting out, one for most of the candy, one for beating midnight', () => {
  assert.equal(moons({ carried: 10, total: 100, time: 500, par: 200 }), 1);
  assert.equal(moons({ carried: 80, total: 100, time: 500, par: 200 }), 2);
  assert.equal(moons({ carried: 80, total: 100, time: 150, par: 200 }), 3);
  assert.equal(moons({ carried: 0, total: 100, time: 150, par: 200 }), 2);
});
