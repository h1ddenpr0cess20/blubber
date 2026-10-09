import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createView, groundAxes, HOME, LIMITS } from '../src/view.js';

test('the view starts square on to the maze, so the keys push along its corridors', () => {
  const { right, up } = groundAxes(HOME.yaw);
  assert.deepEqual(right.map((v) => Math.round(v)), [1, -0]);
  assert.deepEqual(up.map((v) => Math.round(v)), [-0, -1]);
});

test('it eases toward where it is turned, and stays within its limits', () => {
  const v = createView();
  v.turn(0.5, 5);
  v.zoomBy(100);
  assert.equal(v.aim.pitch, LIMITS.pitch[1]);
  assert.equal(v.aim.zoom, LIMITS.zoom[1]);
  v.step(1 / 60);
  assert.ok(v.yaw > HOME.yaw && v.yaw < HOME.yaw + 0.5);
  v.reset();
  v.step(0, true);
  assert.ok(Math.abs(v.yaw - HOME.yaw) < 1e-9 && v.zoom === HOME.zoom);
});
