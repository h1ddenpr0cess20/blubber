import { litCount, STEP_TIME, stepHaunt } from '../../src/haunt.js';

/**
 * Plays a night the way a careful player might: to the nearest lantern not
 * yet lit, by the fewest cells, then to the next, then out through the
 * gate; spooking anything that gets close. Steers by pushing toward the
 * middle of the next cell on the way, as the keys would.
 *
 * Returns how it went: whether it got out, how long it took, how often it
 * was caught, how much candy it came out with.
 */
export function autopilot(h, { limit = 900, candy = false } = {}) {
  const { maze, plan } = h.night;
  let route = [];
  let goal = null;
  const steps = Math.round(limit / STEP_TIME);
  for (let i = 0; i < steps && !h.escaped; i++) {
    const g = h.ghost;
    const here = plan.cellAt(g.x, g.z);
    if (!route.length || !goal || goal.done()) {
      goal = nextGoal(h, here, candy);
      route = goal ? maze.path(here, goal.cell) ?? [] : [];
    }
    // The next cell on the way whose middle isn't reached yet.
    while (route.length > 1) {
      const [cx, cz] = plan.cellCentre(...route[0]);
      if (Math.hypot(cx - g.x, cz - g.z) < 0.6) route.shift();
      else break;
    }
    // Straight at the goal once nothing stands between; otherwise from cell middle to cell middle.
    const open = goal && clear(h, g.x, g.z, goal.x, goal.z);
    const [tx, tz] = open ? [goal.x, goal.z] : route.length ? plan.cellCentre(...route[0]) : [g.x, g.z];
    let px = tx - g.x, pz = tz - g.z;
    const d = Math.hypot(px, pz);
    if (d > 0.05) { px /= d; pz /= d; } else { px = pz = 0; }
    const threat = h.chasers.some((c) => c.state !== 'scared' && Math.hypot(c.x - g.x, c.z - g.z) < 2.6);
    stepHaunt(h, [px, pz], { spook: threat && h.spookWait <= 0 });
  }
  return { escaped: h.escaped, time: h.time, caught: h.caught, carried: h.carried, total: h.total, lit: litCount(h) };
}

/** Whether the way from one point to another, as the ghost is wide, is free of walls. */
function clear(h, x0, z0, x1, z1) {
  const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.2) + 1;
  for (let k = 0; k <= n; k++) {
    const x = x0 + (x1 - x0) * (k / n), z = z0 + (z1 - z0) * (k / n);
    for (const [ox, oz] of [[0.32, 0], [-0.32, 0], [0, 0.32], [0, -0.32]]) if (h.blocks(Math.floor(x + ox), Math.floor(z + oz))) return false;
  }
  return true;
}

function nextGoal(h, here, candy) {
  const { maze } = h.night;
  const dist = maze.distances(...here);
  const steps = (x, z) => dist[maze.index(...h.night.plan.cellAt(x, z))];
  const todo = h.lanterns.filter((l) => !l.lit);
  if (candy) {
    const sweets = h.candy.filter((c) => !c.taken);
    if (sweets.length) {
      sweets.sort((a, b) => steps(a.x, a.z) - steps(b.x, b.z));
      const s = sweets[0];
      return { cell: h.night.plan.cellAt(s.x, s.z), x: s.x, z: s.z, done: () => s.taken };
    }
  }
  if (todo.length) {
    todo.sort((a, b) => steps(a.x, a.z) - steps(b.x, b.z));
    const l = todo[0];
    return { cell: l.cell, x: l.x, z: l.z, done: () => l.lit };
  }
  const gate = h.night.gate;
  return { cell: h.night.plan.cellAt(gate.x, gate.z), x: gate.x, z: gate.z, done: () => h.escaped };
}
