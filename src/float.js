/**
 * How Blubber moves: it floats. It drifts where it is pushed and keeps
 * drifting a little after, as a ghost should, held a fixed height over
 * whatever ground is under it — up steps and over humps without noticing,
 * on a spring, so it bobs.
 *
 * Across the ground it is a circle among square tiles: it can't go into a
 * tile that `blocks`, and slides along it instead, losing only the speed it
 * had into it. In a corridor it is drawn gently to the middle, so turning
 * off into a side passage is easy with the keys.
 *
 * Units are tiles; plain numbers throughout, so the tests move it just as
 * the game does.
 */

/** How hard the controls push, how quickly it slows, its top speed. */
export const ACCEL = 26;
export const DRAG = 3.4;
export const TOP_SPEED = 4.8;

/** How high it floats over the ground, and how stiff the spring holding it there is. */
export const HOVER = 0.62;
const SPRING = 60, DAMP = 11;

/** Its size, as a circle on the ground. */
export const RADIUS = 0.3;

/** A corridor no wider than this is one to be drawn to the middle of. */
const LANE = 3;
const CENTRE = 7;

export function createGhost({ x = 0, z = 0, y = HOVER } = {}) {
  return { x, y, z, vx: 0, vy: 0, vz: 0, r: RADIUS };
}

/**
 * The open span across a corridor at (x, z): along `axis` ('x' or 'z'),
 * from the tile at the point out to the first tile that blocks either way.
 * Returns [first, last] tile, or null if the point's own tile blocks.
 */
export function span(blocks, x, z, axis, limit = 6) {
  const tx = Math.floor(x), tz = Math.floor(z);
  if (blocks(tx, tz)) return null;
  let lo = 0, hi = 0;
  if (axis === 'z') {
    while (lo < limit && !blocks(tx, tz - lo - 1)) lo++;
    while (hi < limit && !blocks(tx, tz + hi + 1)) hi++;
    return [tz - lo, tz + hi];
  }
  while (lo < limit && !blocks(tx - lo - 1, tz)) lo++;
  while (hi < limit && !blocks(tx + hi + 1, tz)) hi++;
  return [tx - lo, tx + hi];
}

/** Pushes the circle at (x, z) out of every tile that blocks round it; returns the push. */
export function separate(ghost, blocks) {
  const r = ghost.r;
  let px = 0, pz = 0;
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    const x0 = Math.floor(ghost.x - r), x1 = Math.floor(ghost.x + r);
    const z0 = Math.floor(ghost.z - r), z1 = Math.floor(ghost.z + r);
    for (let tz = z0; tz <= z1; tz++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (!blocks(tx, tz)) continue;
        // The nearest point of the tile to the middle of the circle.
        const cx = Math.max(tx, Math.min(tx + 1, ghost.x));
        const cz = Math.max(tz, Math.min(tz + 1, ghost.z));
        let dx = ghost.x - cx, dz = ghost.z - cz;
        let d = Math.hypot(dx, dz);
        if (d >= r) continue;
        if (d < 1e-9) {
          // The middle is inside the tile: out the nearest face onto open ground, if it has one.
          const faces = [[ghost.x - tx, -1, 0], [tx + 1 - ghost.x, 1, 0], [ghost.z - tz, 0, -1], [tz + 1 - ghost.z, 0, 1]];
          faces.sort((a, b) => (blocks(tx + a[1], tz + a[2]) - blocks(tx + b[1], tz + b[2])) || a[0] - b[0]);
          const [depth, fx, fz] = faces[0];
          dx = fx; dz = fz;
          const push = depth + r;
          ghost.x += fx * push; ghost.z += fz * push;
          px += fx * push; pz += fz * push;
        } else {
          const push = r - d;
          ghost.x += (dx / d) * push; ghost.z += (dz / d) * push;
          px += (dx / d) * push; pz += (dz / d) * push;
          dx /= d; dz /= d;
        }
        // Lose the speed into the tile, keep the speed along it.
        const into = ghost.vx * dx + ghost.vz * dz;
        if (into < 0) { ghost.vx -= into * dx; ghost.vz -= into * dz; }
        moved = true;
      }
    }
    if (!moved) break;
  }
  return [px, pz];
}

/**
 * One step of `dt` seconds. `push` is [x, z] on the ground, up to a unit
 * long; `blocks(tx, tz)` says whether a tile blocks; `floor(x, z)` is the
 * ground height there (null over the dark). Returns how hard it ran into
 * anything (speed lost), for a bump.
 */
export function stepGhost(ghost, push, dt, { blocks, floor, accel = ACCEL, top = TOP_SPEED, drag = DRAG }) {
  let [ax, az] = push;
  const pl = Math.hypot(ax, az);
  if (pl > 1) { ax /= pl; az /= pl; }
  ghost.vx += ax * accel * dt;
  ghost.vz += az * accel * dt;
  const k = Math.exp(-drag * dt);
  ghost.vx *= k; ghost.vz *= k;
  let speed = Math.hypot(ghost.vx, ghost.vz);
  if (speed > top) { ghost.vx *= top / speed; ghost.vz *= top / speed; speed = top; }

  // Drawn to the middle of a corridor, across the way it is being pushed.
  if (pl > 0.2) {
    const along = Math.abs(ax) >= Math.abs(az) ? 'x' : 'z';
    const across = along === 'x' ? 'z' : 'x';
    const s = span(blocks, ghost.x, ghost.z, across);
    if (s && s[1] - s[0] + 1 <= LANE) {
      const mid = (s[0] + s[1] + 1) / 2;
      const off = mid - (across === 'z' ? ghost.z : ghost.x);
      const pull = Math.max(-1.6, Math.min(1.6, off * CENTRE)) * dt * 4;
      if (across === 'z') ghost.vz += pull; else ghost.vx += pull;
    }
  }

  // Moved in steps short enough that it can't pass through a tile.
  const before = Math.hypot(ghost.vx, ghost.vz);
  const n = Math.max(1, Math.ceil((speed * dt) / (ghost.r * 0.5)));
  for (let s = 0; s < n; s++) {
    ghost.x += (ghost.vx * dt) / n;
    ghost.z += (ghost.vz * dt) / n;
    separate(ghost, blocks);
  }
  const bump = Math.max(0, before - Math.hypot(ghost.vx, ghost.vz));

  // The spring holding it over the highest ground under it.
  let ground = -Infinity;
  for (const [ox, oz] of [[0, 0], [ghost.r, 0], [-ghost.r, 0], [0, ghost.r], [0, -ghost.r]]) {
    const h = floor(ghost.x + ox, ghost.z + oz);
    if (h != null && h > ground) ground = h;
  }
  if (Number.isFinite(ground)) ghost.ground = ground;
  const target = (ghost.ground ?? 0) + HOVER;
  ghost.vy += ((target - ghost.y) * SPRING - ghost.vy * DAMP) * dt;
  ghost.y += ghost.vy * dt;
  return bump;
}
