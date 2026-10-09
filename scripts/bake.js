/**
 * Bakes models the way the game does and says what came out: how many
 * vertices and triangles, per material, and how long it took.
 *
 *   node scripts/bake.js             every model, at the detail it is used at
 *   node scripts/bake.js zombie 1    one model at one detail
 */
import { CAST } from '../src/models/cast/index.js';
import { detailOf } from '../src/models/library.js';
import { bake } from '../src/models/model.js';
import { PROPS } from '../src/models/props/index.js';

const [name, detail] = process.argv.slice(2);
const names = name ? [name] : [...Object.keys(CAST), ...Object.keys(PROPS)];
for (const n of names) {
  const def = CAST[n] ?? PROPS[n] ?? (await import(`../src/models/cast/${n}.js`).catch(() => import(`../src/models/props/${n}.js`))).default;
  const d = detail ? Number(detail) : detailOf(n);
  const t0 = performance.now();
  const m = bake(def, { detail: d });
  const mats = Object.keys(def.materials);
  const groups = m.groups.map((g) => `${mats[g.materialIndex]} ${g.count / 3}`).join(', ');
  console.log(`${n} @${d}: ${m.count} vertices, ${m.index.length / 3} triangles (${groups}) in ${Math.round(performance.now() - t0)} ms`);
}
