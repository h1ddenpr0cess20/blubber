import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildGrounds } from '../src/grounds.js';
import { buildNight } from '../src/night.js';
import { NIGHTS } from '../src/nights.js';
import { SCULPTED } from '../src/models/library.js';
import { SEASONS, THEMES } from '../src/themes.js';

const nights = NIGHTS.map(buildNight);

test('ten nights: four in October, three in November, three in December, in that order', () => {
  assert.deepEqual(NIGHTS.map((n) => n.season), ['halloween', 'halloween', 'halloween', 'halloween', 'harvest', 'harvest', 'harvest', 'winter', 'winter', 'winter']);
  assert.ok(NIGHTS.slice(-2).every((n) => n.look.ice), 'the last nights are walled with ice');
});

test('a night is built the same every time', () => {
  const again = buildNight(NIGHTS[2]);
  assert.deepEqual(again.candy.map((c) => [c.x, c.z]), nights[2].candy.map((c) => [c.x, c.z]));
  assert.deepEqual(again.lanterns.map((l) => l.cell), nights[2].lanterns.map((l) => l.cell));
  assert.deepEqual(again.decor.map((d) => [d.kind, d.x]), nights[2].decor.map((d) => [d.kind, d.x]));
});

test('everything Blubber can take or light lies on open ground inside the maze', () => {
  for (const n of nights) {
    for (const thing of [...n.candy, ...n.treats, ...n.lanterns]) {
      const c = n.grounds.cell(Math.floor(thing.x), Math.floor(thing.z));
      assert.ok(c && c.kind !== 'wall' && !c.margin, `${n.name}: something at ${thing.x}, ${thing.z} is in a wall or outside`);
    }
    for (const c of n.chasers) assert.ok(!n.grounds.blocks(Math.floor(c.x), Math.floor(c.z)), `${n.name}: a ${c.kind} starts in a wall`);
    assert.equal(n.lanterns.length, n.recipe.lanterns);
    assert.ok(!n.grounds.blocks(Math.floor(n.start.x), Math.floor(n.start.z)));
  }
});

test('the lanterns are spread out, none in the start or the gate', () => {
  for (const n of nights) {
    const start = n.maze.distances(0, n.maze.rows - 1);
    for (const l of n.lanterns) {
      assert.ok(start[n.maze.index(...l.cell)] >= 3, `${n.name}: a lantern right by the start`);
      assert.ok(n.maze.room[n.maze.index(...l.cell)] < 0, `${n.name}: a lantern in a room`);
    }
  }
});

test('the maze is shut in: no way off the edge from inside', () => {
  for (const n of nights) {
    const { plan, grounds } = n;
    for (let z = 0; z < plan.rows; z++) for (let x = 0; x < plan.cols; x++) {
      if (plan.solid[z * plan.cols + x] !== 0) continue;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const next = plan.solid[(z + dz) * plan.cols + x + dx];
        assert.ok(next !== 2, `${n.name}: open tile ${x},${z} runs out of the maze`);
      }
      assert.ok(!grounds.blocks(x, z));
    }
  }
});

test('every model a night asks for is sculpted', () => {
  for (const n of nights) {
    const kinds = [...n.candy, ...n.treats, ...n.chasers, ...n.rollers, ...n.flyers, ...n.decor].map((t) => t.kind);
    kinds.push(n.recipe.lantern, n.recipe.dark);
    if (n.hands.length) kinds.push('hand');
    for (const k of new Set(kinds)) assert.ok(SCULPTED[k] || k === 'icecube', `${n.name}: no model for ${k}`);
  }
  for (const season of Object.values(SEASONS)) for (const k of [season.lantern, season.dark, season.chaser, season.roller, season.flyer, season.treat, ...season.sweets]) assert.ok(SCULPTED[k], `no model for ${k}`);
});

test('the grounds are drawn with a top for every tile and sides where they drop away', () => {
  const n = nights[1];
  const built = buildGrounds(n.grounds, THEMES.cemetery);
  let tiles = 0;
  for (const c of n.grounds.cells) if (c) tiles++;
  const tops = (built.parts.floor.position.length + built.parts.tops.position.length) / 9;
  assert.equal(tops, tiles * 2, 'two triangles a tile');
  assert.ok(built.parts.walls.position.length > 0 && built.parts.earth.position.length > 0);
  // Lit, the ground near a lantern is warmer than far from it.
  const l = n.lanterns[0];
  built.relight([[l.x, l.y + 0.4, l.z, 6.5, [1, 0.5, 0.14]]]);
  const P = built.parts.floor.position, C = built.parts.floor.color;
  let near = 0, far = 0;
  for (let i = 0; i < P.length; i += 3) {
    const d = Math.hypot(P[i] - l.x, P[i + 2] - l.z);
    if (d < 1.5) near = Math.max(near, C[i] / (C[i + 2] || 1));
    if (d > 12) far = Math.max(far, C[i] / (C[i + 2] || 1));
  }
  assert.ok(near > far, 'the lantern warms the ground round it');
});
