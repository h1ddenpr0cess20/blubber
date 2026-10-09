import { Grounds } from './grounds.js';
import { E, generate, N, Plan, random, S, shuffle, SIDES, STEP, W } from './maze.js';

/**
 * A night, built from its recipe (nights.js): the maze grown from its seed
 * and laid out on the tiles, the ground rolled into hills, and everything
 * in it put where it goes — Blubber's start, the moon gate out, the
 * lanterns at far-apart dead ends, trails of candy down every corridor,
 * treats in the corners, what shambles about, what flies
 * over, what grabs from the ground and what rolls down the long halls; and
 * the scenery round the outside. Nothing here draws: the game draws it and
 * the tests walk it.
 *
 * Built the same every time from the same recipe.
 */

/** The candy's worth: a sweet on the trail, a treat in a corner. */
export const CANDY = 1;
export const TREAT = 10;

/** How the ground rolls: smooth bumps, as high as `hills`, the same for the same seed. */
function rolling(seed, hills) {
  if (!hills) return () => 0;
  const rand = random(seed * 31 + 7);
  const waves = Array.from({ length: 5 }, () => ({
    fx: (0.04 + rand() * 0.1) * (rand() < 0.5 ? -1 : 1),
    fz: (0.04 + rand() * 0.1) * (rand() < 0.5 ? -1 : 1),
    p: rand() * Math.PI * 2,
    a: 0.35 + rand() * 0.65,
  }));
  const total = waves.reduce((s, w) => s + w.a, 0);
  return (x, z) => hills * waves.reduce((s, w) => s + w.a * Math.sin(x * w.fx * Math.PI * 2 + z * w.fz * Math.PI * 2 + w.p), 0) / total;
}

/**
 * Picks `count` of `cells` spread as far apart as they can be — from each
 * other and from everything in `away` — by steps through the maze.
 */
function spread(maze, cells, count, away) {
  const far = new Int32Array(maze.cols * maze.rows).fill(1 << 20);
  const keep = (dist) => { for (let k = 0; k < far.length; k++) if (dist[k] >= 0) far[k] = Math.min(far[k], dist[k]); };
  for (const [i, j] of away) keep(maze.distances(i, j));
  const picked = [];
  const pool = [...cells];
  while (picked.length < count && pool.length) {
    let best = 0;
    for (let k = 1; k < pool.length; k++) if (far[maze.index(...pool[k])] > far[maze.index(...pool[best])]) best = k;
    const [cell] = pool.splice(best, 1);
    picked.push(cell);
    keep(maze.distances(...cell));
  }
  return picked;
}

/** A 2 × 2 block of cells holding (i, j), kept inside the maze and clear of `avoid`. */
function blockAround(maze, i, j, avoid) {
  const options = [[i, j], [i - 1, j], [i, j - 1], [i - 1, j - 1]]
    .filter(([a, b]) => a >= 0 && b >= 0 && a + 2 <= maze.cols && b + 2 <= maze.rows)
    .filter(([a, b]) => !avoid || a + 2 <= avoid.i || avoid.i + avoid.w <= a || b + 2 <= avoid.j || avoid.j + avoid.h <= b);
  return options[0] ?? [Math.min(Math.max(0, i), maze.cols - 2), Math.min(Math.max(0, j), maze.rows - 2)];
}

export function buildNight(recipe) {
  const { seed, cols, rows, braid = 0.35 } = recipe.maze;
  const rand = random(seed * 977 + 13);
  // The way in: a little room at the front left. The way out is decided once the maze is grown.
  const startRoom = { i: 0, j: rows - 2, w: 2, h: 2, name: 'start' };
  const extra = recipe.maze.rooms ?? [];
  const maze = generate({ cols, rows, seed, braid, rooms: [startRoom, ...extra] });
  const dist = maze.distances(0, rows - 1);
  let far = 0;
  for (let k = 1; k < dist.length; k++) if (dist[k] > dist[far]) far = k;
  const [ei, ej] = blockAround(maze, far % cols, Math.floor(far / cols), startRoom);
  maze.addRoom(ei, ej, 2, 2, 'exit');
  const startCell = [0, rows - 1];
  const plan = new Plan(maze, { corridor: recipe.corridor ?? 2, wall: 1, margin: recipe.margin ?? 4 });

  // The ground: hills, walls standing on them, and the dark beyond the margin.
  const look = recipe.look;
  const ground = rolling(seed, recipe.hills ?? 0);
  const grounds = new Grounds({ cols: plan.cols, rows: plan.rows });
  const wallHeight = look.wallHeight ?? 1.3;
  const corner = (x, z) => ground(x, z);
  const cornersOf = (x, z) => [corner(x, z), corner(x + 1, z), corner(x, z + 1), corner(x + 1, z + 1)];
  for (let z = 0; z < plan.rows; z++) {
    for (let x = 0; x < plan.cols; x++) {
      const kind = plan.solid[z * plan.cols + x];
      const h = cornersOf(x, z);
      // The margin's outer edge is ragged, so the grounds don't end in a ruler line.
      const edge = Math.min(x, z, plan.cols - 1 - x, plan.rows - 1 - z);
      if (kind === 2 && edge === 0 && random(x * 7919 + z * 104729)() < 0.45) continue;
      if (kind === 1) {
        const floor = Math.max(...h);
        const top = floor + wallHeight;
        const outer = x <= plan.margin || z <= plan.margin || x >= plan.cols - 1 - plan.margin || z >= plan.rows - 1 - plan.margin;
        // Ice walls are blocks standing on the ground (ice.js): the tile under them stays ground.
        if (look.ice) grounds.set(x, z, 'wall', [floor, floor, floor, floor], { floor, edge: outer, ice: true });
        else grounds.set(x, z, 'wall', [top, top, top, top], { floor, edge: outer });
      } else {
        grounds.set(x, z, 'floor', h, { color: kind === 2 ? 1 : 0, margin: kind === 2 });
      }
    }
  }

  const centre = (i, j) => {
    const [x, z] = plan.cellCentre(i, j);
    return { x, z, y: grounds.heightAt(x, z) ?? 0, cell: [i, j] };
  };
  const inRoom = (i, j) => maze.room[maze.index(i, j)] >= 0;

  // Where things go: dead ends first, far from the start and the gate and each other.
  const deadEnds = shuffle(maze.deadEnds(), rand);
  const used = new Set();
  const key = ([i, j]) => `${i},${j}`;
  const take = (cells) => { for (const c of cells) used.add(key(c)); return cells; };
  const exitCentre = [ei, ej];
  const lanternCells = take(spread(maze, deadEnds.length >= recipe.lanterns ? deadEnds : allCells(maze).filter((c) => !inRoom(...c)), recipe.lanterns, [startCell, exitCentre]));
  const lanterns = lanternCells.map((c) => ({ ...centre(...c), lit: false }));
  const left = () => deadEnds.filter((c) => !used.has(key(c)));
  // Treats in the dead ends left over, or failing those the quiet corners of the corridors.
  const corners = allCells(maze).filter((c) => !inRoom(...c) && !used.has(key(c)) && maze.exits(...c) === 2);
  const treatCells = take(spread(maze, [...left(), ...(left().length < (recipe.treats ?? 4) ? corners : [])], recipe.treats ?? 4, [startCell, exitCentre, ...lanternCells]));
  const treats = treatCells.map((c) => ({ ...centre(...c), kind: recipe.treat ?? 'treat', amount: TREAT }));

  // Candy down every corridor: in each cell, and in each gap between two joined cells.
  const sweets = recipe.sweets ?? ['sweet'];
  const candy = [];
  const sweet = (x, z, i) => ({ x, z, y: grounds.heightAt(x, z) ?? 0, kind: sweets[i % sweets.length], amount: CANDY });
  let n = 0;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const r = maze.room[maze.index(i, j)];
      const special = used.has(key([i, j]));
      const [x, z] = plan.cellCentre(i, j);
      if (r < 0 && !special) candy.push(sweet(x, z, n++));
      for (const side of [E, S]) {
        if (!maze.isOpen(i, j, side)) continue;
        const ni = i + STEP[side][0], nj = j + STEP[side][1];
        if (r >= 0 && maze.room[maze.index(ni, nj)] === r) continue;
        const [bx, bz, bw, bd] = plan.between(i, j, side);
        candy.push(sweet(bx + bw / 2, bz + bd / 2, n++));
      }
    }
  }
  // A ring of sweets round each room that isn't the start or the gate.
  for (const room of maze.rooms) {
    if (room.name === 'start' || room.name === 'exit') continue;
    const [x0, z0] = plan.cellOrigin(room.i, room.j);
    const w = room.w * plan.pitch - plan.wall, d = room.h * plan.pitch - plan.wall;
    const cx = x0 + w / 2, cz = z0 + d / 2;
    const ring = Math.max(6, Math.round((w + d) * 1.2));
    for (let k = 0; k < ring; k++) {
      const a = (k / ring) * Math.PI * 2;
      candy.push(sweet(cx + Math.cos(a) * (w / 2 - 1), cz + Math.sin(a) * (d / 2 - 1), n++));
    }
  }

  // What wanders the maze, starting far from Blubber.
  const roomless = allCells(maze).filter((c) => !inRoom(...c) || maze.rooms[maze.room[maze.index(...c)]].name === 'room');
  const startDist = maze.distances(...startCell);
  const maxDist = Math.max(...startDist);
  const farCells = roomless.filter((c) => startDist[maze.index(...c)] >= maxDist * 0.35 && !used.has(key(c)));
  const chasers = [];
  for (const group of recipe.chasers ?? []) {
    const cells = spread(maze, farCells, group.count, [startCell, ...chasers.map((c) => c.cell)]);
    for (const c of cells) chasers.push({ kind: group.kind, speed: group.speed ?? 1.5, sight: group.sight ?? 7, ...centre(...c) });
  }

  // Hands that come up out of the ground in the corridors, now and then.
  const straight = (i, j) => {
    const o = maze.open[maze.index(i, j)];
    return o === (N | S) || o === (E | W);
  };
  const handCells = spread(maze, roomless.filter((c) => straight(...c) && !used.has(key(c)) && startDist[maze.index(...c)] > 4), recipe.hands ?? 0, [startCell, exitCentre]);
  const hands = handCells.map((c, k) => ({ ...centre(...c), period: 2.6 + (k % 3) * 0.4, phase: rand() * 3 }));

  // Things that roll up and down the long straight halls.
  const rollers = [];
  if (recipe.rollers) {
    const runs = straightRuns(maze, 4).filter((run) => run.every((c) => !inRoom(...c) && startDist[maze.index(...c)] > 3));
    shuffle(runs, rand);
    runs.sort((a, b) => b.length - a.length);
    for (const run of runs) {
      if (rollers.length >= recipe.rollers.count) break;
      if (rollers.some((r) => r.cells.some((c) => run.some((d) => d[0] === c[0] && d[1] === c[1])))) continue;
      const a = centre(...run[0]), b = centre(...run.at(-1));
      rollers.push({ kind: recipe.rollers.kind, from: [a.x, a.z], to: [b.x, b.z], speed: recipe.rollers.speed ?? 2.6, phase: rand(), cells: run });
    }
  }

  // Flyers go round loops over the walls, each round a block of cells.
  const flyers = [];
  for (let k = 0; k < (recipe.flyers?.count ?? 0); k++) {
    const w = 2 + Math.floor(rand() * 3), h = 2 + Math.floor(rand() * 3);
    const i = Math.floor(rand() * (cols - w)), j = Math.floor(rand() * (rows - h - 2));
    const corners = [[i, j], [i + w, j], [i + w, j + h], [i, j + h]].map(([a, b]) => plan.cellCentre(Math.min(a, cols - 1), Math.min(b, rows - 1)));
    flyers.push({ kind: recipe.flyers.kind, path: k % 2 ? corners.reverse() : corners, speed: recipe.flyers.speed ?? 2.2, phase: rand() });
  }

  // Lights on the walls, if the night has them: on wall tiles beside the corridors, every so often.
  const candles = [];
  if (look.candles) {
    for (let z = 0; z < plan.rows; z++) {
      for (let x = 0; x < plan.cols; x++) {
        const c = grounds.cell(x, z);
        if (c?.kind !== 'wall' || c.edge) continue;
        // Only on wall ends and pillars that stand beside open floor.
        const open = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dz]) => grounds.cell(x + dx, z + dz)?.kind === 'floor').length;
        if (open >= 2 && random(x * 31 + z * 977 + seed)() < look.candles) candles.push({ x: x + 0.5, z: z + 0.5, y: c.h[0] });
      }
    }
  }

  // Bog in the rooms that ask for it, and round the outside if the night has a moat.
  for (const room of maze.rooms) {
    if (room.name !== 'bog') continue;
    const [x0, z0] = plan.cellOrigin(room.i, room.j);
    const w = room.w * plan.pitch - plan.wall, d = room.h * plan.pitch - plan.wall;
    for (let z = z0 + 1; z < z0 + d - 1; z++) for (let x = x0 + 1; x < x0 + w - 1; x++) {
      const c = grounds.cell(x, z);
      if (c) { c.kind = 'bog'; c.h = c.h.map(() => Math.min(...c.h) - 0.12); }
    }
  }
  if (look.moat) {
    for (let z = 0; z < plan.rows; z++) for (let x = 0; x < plan.cols; x++) {
      const c = grounds.cell(x, z);
      const edge = Math.min(x, z, plan.cols - 1 - x, plan.rows - 1 - z);
      if (c?.margin && edge >= 1 && edge <= 2) { c.kind = 'bog'; c.h = c.h.map(() => Math.min(...c.h) - 0.15); }
    }
  }

  // Scenery round the outside of the maze, and in its rooms.
  const decor = [];
  const props = look.props ?? [];
  if (props.length) {
    for (let z = 0; z < plan.rows; z += 2) {
      for (let x = 0; x < plan.cols; x += 2) {
        const px = x + 0.5 + rand() * 1.0, pz = z + 0.5 + rand() * 1.0;
        const c = grounds.cell(Math.floor(px), Math.floor(pz));
        if (!c?.margin || c.kind !== 'floor') continue;
        // Not crowding the wall, and not every spot.
        const fromWall = Math.min(
          Math.abs(px - plan.margin), Math.abs(pz - plan.margin),
          Math.abs(px - (plan.cols - plan.margin)), Math.abs(pz - (plan.rows - plan.margin)),
        );
        const inside = px > plan.margin && px < plan.cols - plan.margin && pz > plan.margin && pz < plan.rows - plan.margin;
        if (inside || fromWall < 0.9 || rand() > (look.density ?? 0.55)) continue;
        const pick = weighted(props, rand);
        decor.push({ kind: pick.kind, x: px, z: pz, y: grounds.heightAt(px, pz) ?? 0, turn: rand() * Math.PI * 2, scale: (pick.scale ?? 1) * (0.85 + rand() * 0.3), glow: Boolean(pick.glow) });
      }
    }
  }
  for (const room of maze.rooms) {
    const piece = look.rooms?.[room.name];
    if (!piece) continue;
    const [x0, z0] = plan.cellOrigin(room.i, room.j);
    const w = room.w * plan.pitch - plan.wall, d = room.h * plan.pitch - plan.wall;
    const x = x0 + w / 2, z = z0 + d / 2;
    decor.push({ kind: piece, x, z, y: grounds.heightAt(x, z) ?? 0, turn: 0, scale: 1, centre: true });
  }
  // A little something tucked into the dead ends nothing else wanted.
  for (const c of left().slice(0, look.nooks ? 12 : 0)) {
    const at = centre(...c);
    const side = SIDES.find((s) => maze.isOpen(c[0], c[1], s));
    const [dx, dz] = STEP[side];
    decor.push({ kind: weighted(look.nooks, rand).kind, x: at.x - dx * 0.55, z: at.z - dz * 0.55, y: at.y, turn: Math.atan2(dx, dz), scale: 0.9 + rand() * 0.2 });
  }

  const [sx0, sz0] = plan.cellOrigin(startRoom.i, startRoom.j);
  const startSize = 2 * plan.pitch - plan.wall;
  const [sx, sz] = [sx0 + startSize / 2, sz0 + startSize / 2];
  const [gx0, gz0] = plan.cellOrigin(ei, ej);
  const gateSize = 2 * plan.pitch - plan.wall;
  const gate = { x: gx0 + gateSize / 2, z: gz0 + gateSize / 2, size: gateSize };
  gate.y = grounds.heightAt(gate.x, gate.z) ?? 0;
  return {
    recipe,
    name: recipe.name,
    season: recipe.season,
    maze,
    plan,
    grounds,
    start: { x: sx, z: sz, y: grounds.heightAt(sx, sz) ?? 0 },
    gate,
    lanterns,
    candy,
    treats,
    chasers,
    hands,
    rollers,
    flyers,
    candles,
    decor,
    rooms: maze.rooms,
  };
}

function allCells(maze) {
  const out = [];
  for (let j = 0; j < maze.rows; j++) for (let i = 0; i < maze.cols; i++) out.push([i, j]);
  return out;
}

/** Runs of `min` or more cells joined in a straight line, along x or z, with no side ways off the middle of them. */
function straightRuns(maze, min) {
  const runs = [];
  for (const [side, back] of [[E, W], [S, N]]) {
    const [di, dj] = STEP[side];
    for (let j = 0; j < maze.rows; j++) {
      for (let i = 0; i < maze.cols; i++) {
        if (maze.isOpen(i, j, back)) continue;
        const run = [[i, j]];
        let a = i, b = j;
        while (maze.isOpen(a, b, side)) { a += di; b += dj; run.push([a, b]); }
        if (run.length >= min) runs.push(run);
      }
    }
  }
  return runs;
}

function weighted(list, rand) {
  const total = list.reduce((s, p) => s + (p.weight ?? 1), 0);
  let r = rand() * total;
  for (const p of list) { r -= p.weight ?? 1; if (r <= 0) return p; }
  return list[list.length - 1];
}
