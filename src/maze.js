/**
 * The mazes. A maze is a grid of cells, each open or shut on its four sides;
 * it is grown from a seed so a night is the same maze every time it is
 * played. Growing it is a depth-first walk (a "recursive backtracker"),
 * which makes long, winding corridors; then some of the dead ends are
 * knocked through into a neighbour (`braid`), so there are loops to dodge
 * round, and a few blocks of cells are opened into rooms.
 *
 * Sides are named for the way out of the cell: N is −z, S is +z, W is −x
 * and E is +x. Cell (i, j) is column i (along x), row j (along z).
 */

export const N = 1, S = 2, W = 4, E = 8;
export const SIDES = [N, S, W, E];
export const STEP = { [N]: [0, -1], [S]: [0, 1], [W]: [-1, 0], [E]: [1, 0] };
export const OPPOSITE = { [N]: S, [S]: N, [W]: E, [E]: W };

/** A seeded source of numbers in [0, 1) (mulberry32), the same run for the same seed. */
export function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Maze {
  constructor(cols, rows) {
    this.cols = cols;
    this.rows = rows;
    /** Each cell's open sides, as a mask of N, S, W, E. */
    this.open = new Uint8Array(cols * rows);
    /** Which room each cell is in, or −1. */
    this.room = new Int16Array(cols * rows).fill(-1);
    this.rooms = [];
  }

  index(i, j) { return j * this.cols + i; }

  has(i, j) { return i >= 0 && j >= 0 && i < this.cols && j < this.rows; }

  isOpen(i, j, side) { return this.has(i, j) && (this.open[this.index(i, j)] & side) !== 0; }

  /** Opens the side of (i, j) and the matching side of the cell beyond it. */
  carve(i, j, side) {
    const [di, dj] = STEP[side];
    if (!this.has(i, j) || !this.has(i + di, j + dj)) return false;
    this.open[this.index(i, j)] |= side;
    this.open[this.index(i + di, j + dj)] |= OPPOSITE[side];
    return true;
  }

  /** How many ways out of (i, j). */
  exits(i, j) {
    const o = this.open[this.index(i, j)];
    return (o & 1) + ((o >> 1) & 1) + ((o >> 2) & 1) + ((o >> 3) & 1);
  }

  /** The cells with only one way out, not in a room. */
  deadEnds() {
    const out = [];
    for (let j = 0; j < this.rows; j++) {
      for (let i = 0; i < this.cols; i++) if (this.exits(i, j) === 1 && this.room[this.index(i, j)] < 0) out.push([i, j]);
    }
    return out;
  }

  /** Steps from (i, j) to every cell along open sides, −1 where it can't be reached. */
  distances(i, j) {
    const dist = new Int32Array(this.cols * this.rows).fill(-1);
    const queue = [this.index(i, j)];
    dist[queue[0]] = 0;
    for (let q = 0; q < queue.length; q++) {
      const c = queue[q], ci = c % this.cols, cj = (c - ci) / this.cols;
      for (const side of SIDES) {
        if (!(this.open[c] & side)) continue;
        const n = this.index(ci + STEP[side][0], cj + STEP[side][1]);
        if (dist[n] >= 0) continue;
        dist[n] = dist[c] + 1;
        queue.push(n);
      }
    }
    return dist;
  }

  /** The cells from `from` to `to` along open sides, both ends included; null if there is no way. */
  path([fi, fj], [ti, tj]) {
    const dist = this.distances(ti, tj);
    if (dist[this.index(fi, fj)] < 0) return null;
    const out = [[fi, fj]];
    let i = fi, j = fj;
    while (i !== ti || j !== tj) {
      const here = dist[this.index(i, j)];
      for (const side of SIDES) {
        if (!this.isOpen(i, j, side)) continue;
        const ni = i + STEP[side][0], nj = j + STEP[side][1];
        if (dist[this.index(ni, nj)] === here - 1) { i = ni; j = nj; break; }
      }
      out.push([i, j]);
    }
    return out;
  }

  /** Opens a block of cells into one room: every side between them knocked through. */
  addRoom(i, j, w, h, name = 'room') {
    const id = this.rooms.length;
    this.rooms.push({ i, j, w, h, name, id });
    for (let b = j; b < j + h; b++) {
      for (let a = i; a < i + w; a++) {
        this.room[this.index(a, b)] = id;
        if (a < i + w - 1) this.carve(a, b, E);
        if (b < j + h - 1) this.carve(a, b, S);
      }
    }
    return this.rooms[id];
  }
}

/**
 * Grows a maze `cols` × `rows` from `seed`. `rooms` are blocks of cells
 * ({ i, j, w, h, name }) opened up afterwards; `braid` is the share of dead
 * ends knocked through (0 is a perfect maze, one way between any two cells).
 */
export function generate({ cols, rows, seed = 1, braid = 0.3, rooms = [] }) {
  const maze = new Maze(cols, rows);
  const rand = random(seed);
  // The walk: from a corner, always on to a cell not seen yet, back up when stuck.
  const seen = new Uint8Array(cols * rows);
  const stack = [[0, 0]];
  seen[0] = 1;
  while (stack.length) {
    const [i, j] = stack[stack.length - 1];
    const ways = SIDES.filter((side) => {
      const ni = i + STEP[side][0], nj = j + STEP[side][1];
      return maze.has(ni, nj) && !seen[maze.index(ni, nj)];
    });
    if (!ways.length) { stack.pop(); continue; }
    const side = ways[Math.floor(rand() * ways.length)];
    maze.carve(i, j, side);
    const ni = i + STEP[side][0], nj = j + STEP[side][1];
    seen[maze.index(ni, nj)] = 1;
    stack.push([ni, nj]);
  }
  for (const r of rooms) maze.addRoom(r.i, r.j, r.w, r.h, r.name);
  // Knock some dead ends through, into another dead end where there is one.
  const ends = maze.deadEnds();
  shuffle(ends, rand);
  for (const [i, j] of ends) {
    if (maze.exits(i, j) !== 1 || rand() >= braid) continue;
    const shut = SIDES.filter((side) => !maze.isOpen(i, j, side) && maze.has(i + STEP[side][0], j + STEP[side][1]));
    if (!shut.length) continue;
    const better = shut.filter((side) => maze.exits(i + STEP[side][0], j + STEP[side][1]) === 1);
    const pool = better.length ? better : shut;
    maze.carve(i, j, pool[Math.floor(rand() * pool.length)]);
  }
  return maze;
}

export function shuffle(list, rand) {
  for (let k = list.length - 1; k > 0; k--) {
    const m = Math.floor(rand() * (k + 1));
    [list[k], list[m]] = [list[m], list[k]];
  }
  return list;
}

/**
 * Where a maze's cells and walls fall on the tile grid: each cell
 * `corridor` tiles square, a wall `wall` tiles thick between cells and all
 * round, and `margin` tiles of open ground outside that. `solid` marks the
 * tiles that are wall (1); the rest of the maze is open (0), and the margin
 * is outside (2).
 */
export class Plan {
  constructor(maze, { corridor = 2, wall = 1, margin = 3 } = {}) {
    this.maze = maze;
    this.corridor = corridor;
    this.wall = wall;
    this.margin = margin;
    this.pitch = corridor + wall;
    this.cols = margin * 2 + wall + maze.cols * this.pitch;
    this.rows = margin * 2 + wall + maze.rows * this.pitch;
    this.solid = new Uint8Array(this.cols * this.rows);
    const inside = (x, z) => x >= margin && z >= margin && x < this.cols - margin && z < this.rows - margin;
    for (let z = 0; z < this.rows; z++) for (let x = 0; x < this.cols; x++) this.solid[z * this.cols + x] = inside(x, z) ? 1 : 2;
    const clear = (x, z, w, d) => {
      for (let b = z; b < z + d; b++) for (let a = x; a < x + w; a++) this.solid[b * this.cols + a] = 0;
    };
    for (let j = 0; j < maze.rows; j++) {
      for (let i = 0; i < maze.cols; i++) {
        const [x, z] = this.cellOrigin(i, j);
        clear(x, z, corridor, corridor);
        if (maze.isOpen(i, j, E)) clear(x + corridor, z, wall, corridor);
        if (maze.isOpen(i, j, S)) clear(x, z + corridor, corridor, wall);
        // A pillar between four cells of one room goes too.
        const r = maze.room[maze.index(i, j)];
        if (r >= 0 && maze.isOpen(i, j, E) && maze.isOpen(i, j, S) && maze.isOpen(i + 1, j, S) && maze.isOpen(i, j + 1, E)
          && maze.room[maze.index(i + 1, j + 1)] === r) clear(x + corridor, z + corridor, wall, wall);
      }
    }
  }

  /** The first tile of cell (i, j). */
  cellOrigin(i, j) {
    return [this.margin + this.wall + i * this.pitch, this.margin + this.wall + j * this.pitch];
  }

  /** The middle of cell (i, j), in tiles. */
  cellCentre(i, j) {
    const [x, z] = this.cellOrigin(i, j);
    return [x + this.corridor / 2, z + this.corridor / 2];
  }

  /** The cell a point is in or nearest to: the gaps and walls between cells belong to the cell before them. */
  cellAt(x, z) {
    const i = Math.floor((x - this.margin - this.wall + this.wall / 2) / this.pitch);
    const j = Math.floor((z - this.margin - this.wall + this.wall / 2) / this.pitch);
    return [Math.max(0, Math.min(this.maze.cols - 1, i)), Math.max(0, Math.min(this.maze.rows - 1, j))];
  }

  isSolid(x, z) {
    if (x < 0 || z < 0 || x >= this.cols || z >= this.rows) return true;
    return this.solid[z * this.cols + x] !== 0;
  }

  /** The tiles of the wall between cell (i, j) and the one beyond `side`, as [x, z, w, d]. */
  between(i, j, side) {
    const [x, z] = this.cellOrigin(i, j);
    const c = this.corridor, w = this.wall;
    if (side === E) return [x + c, z, w, c];
    if (side === W) return [x - w, z, w, c];
    if (side === S) return [x, z + c, c, w];
    return [x, z - w, c, w];
  }
}
