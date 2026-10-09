import assert from 'node:assert/strict';
import { test } from 'node:test';
import { E, generate, Maze, N, Plan, random, S, SIDES, STEP, W } from '../src/maze.js';

const edges = (maze) => {
  let n = 0;
  for (let j = 0; j < maze.rows; j++) for (let i = 0; i < maze.cols; i++) {
    if (maze.isOpen(i, j, E)) n++;
    if (maze.isOpen(i, j, S)) n++;
  }
  return n;
};

test('the same seed grows the same maze, and another seed another', () => {
  const a = generate({ cols: 9, rows: 7, seed: 42 });
  const b = generate({ cols: 9, rows: 7, seed: 42 });
  const c = generate({ cols: 9, rows: 7, seed: 43 });
  assert.deepEqual([...a.open], [...b.open]);
  assert.notDeepEqual([...a.open], [...c.open]);
});

test('a perfect maze has exactly one way between any two cells', () => {
  const maze = generate({ cols: 12, rows: 10, seed: 7, braid: 0 });
  assert.equal(edges(maze), 12 * 10 - 1);
  const dist = maze.distances(0, 0);
  assert.ok([...dist].every((d) => d >= 0), 'every cell can be reached');
});

test('sides open in pairs and never out of the grid', () => {
  const maze = generate({ cols: 8, rows: 8, seed: 3, braid: 0.5 });
  for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) for (const side of SIDES) {
    const [di, dj] = STEP[side];
    if (!maze.isOpen(i, j, side)) continue;
    assert.ok(maze.has(i + di, j + dj), `cell ${i},${j} opens off the edge`);
    const back = { [N]: S, [S]: N, [W]: E, [E]: W }[side];
    assert.ok(maze.isOpen(i + di, j + dj, back));
  }
});

test('braiding knocks most dead ends through', () => {
  const perfect = generate({ cols: 14, rows: 14, seed: 11, braid: 0 });
  const braided = generate({ cols: 14, rows: 14, seed: 11, braid: 0.8 });
  assert.ok(braided.deadEnds().length < perfect.deadEnds().length / 2);
});

test('rooms are open inside and still joined to the maze', () => {
  const maze = generate({ cols: 10, rows: 10, seed: 5, rooms: [{ i: 4, j: 4, w: 2, h: 2, name: 'plaza' }] });
  for (const [i, j] of [[4, 4], [5, 4], [4, 5]]) {
    assert.ok(maze.isOpen(i, j, i === 4 ? E : W) || maze.isOpen(i, j, E));
  }
  assert.ok(maze.isOpen(4, 4, E) && maze.isOpen(4, 4, S) && maze.isOpen(5, 5, N) && maze.isOpen(5, 5, W));
  assert.ok([...maze.distances(0, 0)].every((d) => d >= 0));
});

test('a path runs along open sides from end to end', () => {
  const maze = generate({ cols: 10, rows: 8, seed: 9 });
  const path = maze.path([0, 0], [9, 7]);
  assert.deepEqual(path[0], [0, 0]);
  assert.deepEqual(path.at(-1), [9, 7]);
  for (let k = 1; k < path.length; k++) {
    const [a, b] = [path[k - 1], path[k]];
    const side = SIDES.find((s) => a[0] + STEP[s][0] === b[0] && a[1] + STEP[s][1] === b[1]);
    assert.ok(side && maze.isOpen(a[0], a[1], side));
  }
});

test('the plan lays cells and walls on the tiles, joined where the maze is', () => {
  const maze = generate({ cols: 6, rows: 5, seed: 2 });
  const plan = new Plan(maze, { corridor: 2, wall: 1, margin: 3 });
  assert.equal(plan.cols, 3 * 2 + 1 + 6 * 3);
  // Flood the open tiles from the first cell: every cell's tiles are reached, and nothing outside.
  const [sx, sz] = plan.cellOrigin(0, 0);
  const seen = new Uint8Array(plan.cols * plan.rows);
  const stack = [[sx, sz]];
  seen[sz * plan.cols + sx] = 1;
  while (stack.length) {
    const [x, z] = stack.pop();
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz;
      if (plan.isSolid(nx, nz) || seen[nz * plan.cols + nx]) continue;
      seen[nz * plan.cols + nx] = 1;
      stack.push([nx, nz]);
    }
  }
  for (let j = 0; j < 5; j++) for (let i = 0; i < 6; i++) {
    const [x, z] = plan.cellOrigin(i, j);
    assert.ok(seen[z * plan.cols + x], `cell ${i},${j} is cut off`);
    assert.deepEqual(plan.cellAt(...plan.cellCentre(i, j)), [i, j]);
  }
  assert.equal(plan.solid[0], 2, 'the margin is outside the maze');
});

test('random is the same run for the same seed, in [0, 1)', () => {
  const a = random(99), b = random(99);
  for (let k = 0; k < 100; k++) {
    const v = a();
    assert.equal(v, b());
    assert.ok(v >= 0 && v < 1);
  }
  assert.ok(new Maze(2, 2));
});
