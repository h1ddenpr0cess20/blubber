import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGhost, HOVER, separate, span, stepGhost, TOP_SPEED } from '../src/float.js';

/** A little world from rows of text: # blocks, anything else is open ground at height 0. */
function world(rows) {
  const blocks = (x, z) => z < 0 || z >= rows.length || x < 0 || x >= rows[0].length || rows[z][x] === '#';
  return { blocks, floor: (x, z) => (blocks(Math.floor(x), Math.floor(z)) ? null : 0) };
}

const ROOM = world([
  '##########',
  '#........#',
  '#........#',
  '#........#',
  '##########',
]);

test('it never passes through a wall, however hard it is pushed', () => {
  const g = createGhost({ x: 5, z: 2.5 });
  for (let k = 0; k < 600; k++) stepGhost(g, [1, 0.3], 1 / 60, ROOM);
  assert.ok(g.x <= 9 - g.r + 1e-6, `got through to ${g.x}`);
  assert.ok(g.z <= 4 - g.r + 1e-6);
  // And with a huge frame step too.
  for (let k = 0; k < 20; k++) stepGhost(g, [-1, -1], 0.25, ROOM);
  assert.ok(g.x >= 1 + g.r - 1e-6 && g.z >= 1 + g.r - 1e-6);
});

test('it slides along a wall it is pushed into at a slant', () => {
  const g = createGhost({ x: 2, z: 1.4 });
  for (let k = 0; k < 60; k++) stepGhost(g, [0.7, -0.7], 1 / 60, ROOM);
  assert.ok(g.x > 3, 'kept going along the wall');
  assert.ok(Math.abs(g.z - (1 + g.r)) < 0.02, 'pressed against the wall');
});

test('it has a top speed, and drifts to a stop when let go', () => {
  const g = createGhost({ x: 2, z: 2.5 });
  for (let k = 0; k < 40; k++) stepGhost(g, [1, 0], 1 / 60, ROOM);
  assert.ok(Math.hypot(g.vx, g.vz) <= TOP_SPEED + 1e-9);
  const at = g.x;
  for (let k = 0; k < 240; k++) stepGhost(g, [0, 0], 1 / 60, ROOM);
  assert.ok(Math.hypot(g.vx, g.vz) < 0.01);
  assert.ok(g.x > at, 'it drifted on after being let go');
});

test('it floats at its height over the ground', () => {
  const g = createGhost({ x: 4, z: 2, y: 3 });
  for (let k = 0; k < 240; k++) stepGhost(g, [0, 0], 1 / 60, ROOM);
  assert.ok(Math.abs(g.y - HOVER) < 0.01);
});

test('in a corridor it is drawn to the middle', () => {
  const hall = world([
    '##########',
    '#........#',
    '#........#',
    '##########',
  ]);
  assert.deepEqual(span(hall.blocks, 3.5, 1.2, 'z'), [1, 2]);
  const g = createGhost({ x: 2, z: 1.35 });
  for (let k = 0; k < 60; k++) stepGhost(g, [1, 0], 1 / 60, hall);
  assert.ok(Math.abs(g.z - 2) < 0.15, `still at ${g.z}`);
});

test('pushed out of a wall it is left inside, onto open ground', () => {
  const g = createGhost({ x: 0.5, z: 2.5 });
  separate(g, ROOM.blocks);
  assert.ok(!ROOM.blocks(Math.floor(g.x), Math.floor(g.z)));
});
