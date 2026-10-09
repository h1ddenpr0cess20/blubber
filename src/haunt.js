import { createGhost, stepGhost } from './float.js';
import { random, SIDES, STEP } from './maze.js';

/**
 * One night with nothing drawn: Blubber floating round the maze, the candy
 * it eats, the lanterns it lights, the moon gate that opens when they are
 * all lit, and everything that gets in the way. The game draws it; the
 * tests play it.
 *
 * Nothing in here can end the night badly. Whatever catches Blubber knocks
 * it back and makes it drop some candy, which it can gather up again if it
 * is quick. Space spooks whatever is close: the chasers turn and flee for
 * a while, and the flyers scatter.
 */

/** The fixed step everything moves at. */
export const STEP_TIME = 1 / 120;

/** How close Blubber has to come to eat a sweet, and from how far sweets drift to it. */
const EAT = 0.5, MAGNET = 1.25;
/** How close to a lantern lights it, and to the gate goes through it. */
const LIGHT = 0.9, ENTER = 1.0;
/** How long Blubber shimmers, untouchable, after being caught; how much candy it drops. */
const SAFE = 2, DROP = 5;
/** How long dropped candy lies before it fades, and before it can be picked up again. */
const LIES = 7, SETTLE = 0.5;
/** Spooking: how far it reaches, how long the chasers flee, how long before the next. */
export const SPOOK = Object.freeze({ reach: 3.4, flee: 4.5, every: 2.2 });

export function createHaunt(night, { seed = 1 } = {}) {
  const { grounds, plan } = night;
  const ghost = createGhost({ x: night.start.x, z: night.start.z, y: night.start.y + 0.62 });
  const rand = random(seed);
  const chasers = night.chasers.map((c, i) => ({
    ...c, id: i, state: 'wander', timer: 0, from: [...c.cell], to: [...c.cell], along: 1,
    facing: 0, home: [...c.cell], scaredFor: 0, stunned: 0, moving: false,
  }));
  return {
    night,
    ghost,
    rand,
    time: 0,
    carried: 0,
    /** All there is to eat in the maze, at the start. */
    total: night.candy.reduce((s, c) => s + c.amount, 0) + night.treats.reduce((s, t) => s + t.amount, 0),
    candy: night.candy.map((c) => ({ ...c, taken: false })),
    treats: night.treats.map((t) => ({ ...t, taken: false })),
    dropped: [],
    lanterns: night.lanterns.map((l) => ({ ...l, lit: false })),
    chasers,
    hands: night.hands.map((h) => ({ ...h, out: 0 })),
    rollers: night.rollers.map((r) => ({ ...r, x: r.from[0], z: r.from[1], t: r.phase, spin: 0 })),
    flyers: night.flyers.map((f) => ({ ...f, t: f.phase, x: f.path[0][0], z: f.path[0][1], y: 1.6, scared: 0 })),
    open: false,
    escaped: false,
    safe: 0,
    spookWait: 0,
    caught: 0,
    explored: new Uint8Array(plan.cols * plan.rows),
    blocks: (x, z) => grounds.blocks(x, z),
    floor: (x, z) => grounds.floorAt(x, z),
    /** Steps from Blubber's cell to every cell; worked out again when it moves cell. */
    trail: null,
    trailFrom: -1,
  };
}

/** How many of the night's lanterns are lit. */
export const litCount = (h) => h.lanterns.reduce((n, l) => n + (l.lit ? 1 : 0), 0);

/**
 * One fixed step. `push` is [x, z] on the ground; `spook` whether Space was
 * pressed. Returns what happened, for the game to show and sound.
 */
export function stepHaunt(h, push, { spook = false, live = true } = {}) {
  const dt = STEP_TIME;
  const out = { eaten: [], lit: null, opened: false, caught: null, spooked: null, escaped: false, bump: 0, near: [] };
  h.time += dt;
  const g = h.ghost;
  out.bump = stepGhost(g, live ? push : [0, 0], dt, { blocks: h.blocks, floor: h.floor });
  if (h.safe > 0) h.safe = Math.max(0, h.safe - dt);
  if (h.spookWait > 0) h.spookWait = Math.max(0, h.spookWait - dt);
  explore(h);

  // Eating: sweets drift in when close, and are eaten when closer.
  const clear = (x0, z0, x1, z1) => {
    for (const t of [0.25, 0.5, 0.75, 1]) if (h.blocks(Math.floor(x0 + (x1 - x0) * t), Math.floor(z0 + (z1 - z0) * t))) return false;
    return true;
  };
  const eat = (c) => {
    const dx = g.x - c.x, dz = g.z - c.z, d = Math.hypot(dx, dz);
    // Only with nothing between: a sweet never comes through a wall.
    if (d < MAGNET && d > 1e-6 && clear(c.x, c.z, g.x, g.z)) {
      const k = Math.min(1, (dt * 6 * (MAGNET - d)) / d);
      c.x += dx * k; c.z += dz * k;
    }
    return d < EAT && clear(c.x, c.z, g.x, g.z);
  };
  for (const list of [h.candy, h.treats]) {
    for (const c of list) {
      if (c.taken || !live || !eat(c)) continue;
      c.taken = true;
      h.carried += c.amount;
      out.eaten.push(c);
    }
  }
  for (let i = h.dropped.length - 1; i >= 0; i--) {
    const c = h.dropped[i];
    c.age += dt;
    // Thrown out, they skid to a stop where they land.
    if (c.age < SETTLE) {
      c.x += c.vx * dt; c.z += c.vz * dt;
      c.vx *= 0.96; c.vz *= 0.96;
      if (h.blocks(Math.floor(c.x), Math.floor(c.z))) { c.x -= c.vx * dt; c.z -= c.vz * dt; c.vx = c.vz = 0; }
    } else if (live && eat(c)) {
      h.dropped.splice(i, 1);
      h.carried += c.amount;
      out.eaten.push(c);
      continue;
    }
    if (c.age > LIES) h.dropped.splice(i, 1);
  }

  // Lanterns, and the gate when the last of them is lit.
  for (const l of h.lanterns) {
    if (l.lit || !live) continue;
    if (Math.hypot(g.x - l.x, g.z - l.z) < LIGHT) {
      l.lit = true;
      out.lit = l;
      if (!h.open && litCount(h) === h.lanterns.length) { h.open = true; out.opened = true; }
    }
  }
  if (h.open && live && !h.escaped && Math.hypot(g.x - h.night.gate.x, g.z - h.night.gate.z) < ENTER) {
    h.escaped = true;
    out.escaped = true;
  }

  // Spooking.
  if (spook && live && h.spookWait <= 0) {
    h.spookWait = SPOOK.every;
    const scared = [];
    for (const c of h.chasers) {
      if (Math.hypot(c.x - g.x, c.z - g.z) > SPOOK.reach) continue;
      c.state = 'scared';
      c.scaredFor = SPOOK.flee;
      c.stunned = 0;
      scared.push(c);
    }
    for (const f of h.flyers) if (Math.hypot(f.x - g.x, f.z - g.z) < SPOOK.reach * 1.2) { f.scared = 3; scared.push(f); }
    out.spooked = scared;
  }

  moveChasers(h, dt);
  moveRollers(h, dt);
  moveFlyers(h, dt);
  for (const hand of h.hands) {
    const p = ((h.time + hand.phase) % hand.period) / hand.period;
    hand.rumble = p > 0.35 && p < 0.55;
    hand.out = p >= 0.55 && p < 0.85 ? Math.sin(((p - 0.55) / 0.3) * Math.PI) : 0;
  }

  // Getting caught: by a chaser, a hand out of the ground, a roller or a flyer low enough.
  if (live && h.safe <= 0 && !h.escaped) {
    let by = null;
    for (const c of h.chasers) if (!by && c.state !== 'scared' && c.stunned <= 0 && Math.hypot(c.x - g.x, c.z - g.z) < 0.6) by = c;
    for (const hand of h.hands) if (!by && hand.out > 0.3 && Math.hypot(hand.x - g.x, hand.z - g.z) < 0.6) by = hand;
    for (const r of h.rollers) if (!by && Math.hypot(r.x - g.x, r.z - g.z) < 0.7) by = r;
    for (const f of h.flyers) if (!by && f.scared <= 0 && Math.hypot(f.x - g.x, f.z - g.z) < 0.5 && f.y - (g.ground ?? 0) < 1.15) by = f;
    if (by) out.caught = catchGhost(h, by);
  }
  return out;
}

/** Marks the tiles round Blubber as seen, for the map. */
function explore(h) {
  const g = h.ghost, plan = h.night.plan;
  const r = 4;
  for (let z = Math.floor(g.z - r); z <= Math.floor(g.z + r); z++) {
    for (let x = Math.floor(g.x - r); x <= Math.floor(g.x + r); x++) {
      if (x < 0 || z < 0 || x >= plan.cols || z >= plan.rows) continue;
      if ((x + 0.5 - g.x) ** 2 + (z + 0.5 - g.z) ** 2 <= r * r) h.explored[z * plan.cols + x] = 1;
    }
  }
}

/** Caught by `by`: Blubber is knocked back and spills candy, and is untouchable for a moment. */
function catchGhost(h, by) {
  const g = h.ghost;
  const dx = g.x - by.x, dz = g.z - by.z, d = Math.hypot(dx, dz) || 1;
  g.vx = (dx / d) * 6; g.vz = (dz / d) * 6;
  h.safe = SAFE;
  h.caught += 1;
  if (by.state !== undefined) by.stunned = 1.4;
  const lost = Math.min(DROP, h.carried);
  h.carried -= lost;
  for (let k = 0; k < lost; k++) {
    const a = h.rand() * Math.PI * 2, s = 2 + h.rand() * 2.5;
    h.dropped.push({ x: g.x, z: g.z, vx: Math.cos(a) * s, vz: Math.sin(a) * s, age: 0, amount: 1, kind: 'dropped' });
  }
  return { by, lost };
}

// ———————————————————————————————————————— the chasers, on the maze's cells

function cellIndex(h, [i, j]) { return h.night.maze.index(i, j); }

/** Steps from Blubber's cell to every cell, worked out again only when Blubber changes cell. */
function trail(h) {
  const cell = h.night.plan.cellAt(h.ghost.x, h.ghost.z);
  const k = cellIndex(h, cell);
  if (k !== h.trailFrom) {
    h.trail = h.night.maze.distances(...cell);
    h.trailFrom = k;
  }
  return h.trail;
}

function neighbours(maze, [i, j]) {
  const out = [];
  for (const side of SIDES) if (maze.isOpen(i, j, side)) out.push([i + STEP[side][0], j + STEP[side][1]]);
  return out;
}

function moveChasers(h, dt) {
  const { maze, plan } = h.night;
  const dist = trail(h);
  for (const c of h.chasers) {
    if (c.stunned > 0) { c.stunned -= dt; c.moving = false; continue; }
    if (c.scaredFor > 0) {
      c.scaredFor -= dt;
      if (c.scaredFor <= 0) c.state = 'wander';
    }
    const here = dist[cellIndex(h, c.to)];
    const reach = Math.round(c.sight * 0.6);
    if (c.state === 'wander' && here >= 0 && here <= reach) c.state = 'chase';
    else if (c.state === 'chase' && (here < 0 || here > reach + 2)) c.state = 'wander';

    const speed = c.speed * (c.state === 'scared' ? 1.35 : c.state === 'chase' ? 1.15 : 0.75);
    const [ax, az] = plan.cellCentre(...c.from), [bx, bz] = plan.cellCentre(...c.to);
    const length = Math.hypot(bx - ax, bz - az);
    if (length > 0) c.along = Math.min(1, c.along + (speed * dt) / length);
    else c.along = 1;
    if (c.along >= 1) {
      // At a cell: choose the next.
      const options = neighbours(maze, c.to);
      let next = null;
      if (c.state === 'chase') {
        let best = Infinity;
        for (const n of options) { const d = dist[cellIndex(h, n)]; if (d >= 0 && d < best) { best = d; next = n; } }
        // Already in Blubber's cell: go straight at it.
        if (here === 0) next = null;
      } else if (c.state === 'scared') {
        let best = -1;
        for (const n of options) { const d = dist[cellIndex(h, n)]; if (d > best) { best = d; next = n; } }
      } else {
        const ahead = options.filter((n) => n[0] !== c.from[0] || n[1] !== c.from[1]);
        const pool = ahead.length ? ahead : options;
        next = pool[Math.floor(h.rand() * pool.length)] ?? null;
      }
      if (next) {
        c.from = c.to;
        c.to = next;
        c.along = 0;
      }
    }
    // Where it is: along the way between cells, or closing on Blubber in the same cell.
    const [fx, fz] = plan.cellCentre(...c.from), [tx, tz] = plan.cellCentre(...c.to);
    let x = fx + (tx - fx) * c.along, z = fz + (tz - fz) * c.along;
    if (c.state === 'chase' && here === 0 && c.along >= 1) {
      const dx = h.ghost.x - c.x, dz = h.ghost.z - c.z, d = Math.hypot(dx, dz);
      const step = Math.min(d, speed * dt);
      x = c.x + (d ? (dx / d) * step : 0);
      z = c.z + (d ? (dz / d) * step : 0);
      // Kept to its own cell: it doesn't follow through walls.
      if (h.blocks(Math.floor(x), Math.floor(z))) { x = c.x; z = c.z; }
    }
    const mx = x - (c.x ?? x), mz = z - (c.z ?? z);
    c.moving = Math.hypot(mx, mz) > 1e-5;
    if (c.moving) c.facing = Math.atan2(mx, mz);
    c.x = x; c.z = z;
    c.y = h.night.grounds.floorAt(x, z) ?? c.y;
  }
}

function moveRollers(h, dt) {
  for (const r of h.rollers) {
    const len = Math.hypot(r.to[0] - r.from[0], r.to[1] - r.from[1]) || 1;
    r.t += (r.speed * dt) / len;
    // Back and forth, easing at each end as it turns.
    const p = (r.t % 2 + 2) % 2;
    const u = p < 1 ? p : 2 - p;
    const k = u * u * (3 - 2 * u) * 0.25 + u * 0.75;
    const x = r.from[0] + (r.to[0] - r.from[0]) * k, z = r.from[1] + (r.to[1] - r.from[1]) * k;
    const moved = Math.hypot(x - r.x, z - r.z);
    r.dir = p < 1 ? 1 : -1;
    r.spin += moved / 0.45;
    r.x = x; r.z = z;
    r.y = h.night.grounds.floorAt(x, z) ?? r.y ?? 0;
  }
}

function moveFlyers(h, dt) {
  for (const f of h.flyers) {
    const pts = f.path;
    let perimeter = 0;
    for (let k = 0; k < pts.length; k++) perimeter += Math.hypot(pts[(k + 1) % pts.length][0] - pts[k][0], pts[(k + 1) % pts.length][1] - pts[k][1]);
    f.t += (f.speed * dt) / perimeter;
    let d = ((f.t % 1) + 1) % 1 * perimeter;
    let x = pts[0][0], z = pts[0][1];
    for (let k = 0; k < pts.length; k++) {
      const a = pts[k], b = pts[(k + 1) % pts.length];
      const seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (d <= seg) { x = a[0] + (b[0] - a[0]) * (d / seg); z = a[1] + (b[1] - a[1]) * (d / seg); break; }
      d -= seg;
    }
    if (f.scared > 0) f.scared -= dt;
    const ground = h.night.grounds.heightAt(x, z) ?? 0;
    // Swooping: down low over the corridors now and then, high when spooked.
    const swoop = 0.5 + 0.5 * Math.sin(h.time * 1.3 + f.phase * 9);
    const target = ground + (f.scared > 0 ? 3 : 0.95 + swoop * 1.1);
    f.y += (target - f.y) * Math.min(1, dt * 3);
    f.facing = Math.atan2(x - f.x, z - f.z);
    f.x = x; f.z = z;
  }
}

/** The moons for a night escaped with `carried` of `total` candy in `time` seconds, against `par`. */
export function moons({ carried, total, time, par }) {
  return 1 + (carried >= Math.ceil(total * 0.8) ? 1 : 0) + (time <= par ? 1 : 0);
}
