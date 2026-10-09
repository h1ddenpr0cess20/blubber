/**
 * Prints a night as text, for looking over a maze: `node scripts/map.js 3`.
 * # wall, . floor, , margin, ~ bog, S start, G gate, L lantern, T treat, Z chaser, H hand, R a roller's run, * candy.
 */
import { buildNight } from '../src/night.js';
import { NIGHTS } from '../src/nights.js';

const index = Math.max(0, Number(process.argv[2] ?? 1) - 1);
const n = buildNight(NIGHTS[index]);
const { grounds } = n;
const rows = [];
for (let z = 0; z < grounds.rows; z++) {
  let row = '';
  for (let x = 0; x < grounds.cols; x++) {
    const c = grounds.cell(x, z);
    row += !c ? ' ' : c.kind === 'wall' ? '#' : c.kind === 'bog' ? '~' : c.margin ? ',' : '.';
  }
  rows.push(row.split(''));
}
const put = (x, z, ch) => { if (rows[Math.floor(z)]) rows[Math.floor(z)][Math.floor(x)] = ch; };
for (const c of n.candy) put(c.x, c.z, '*');
for (const r of n.rollers) { put(...r.from, 'R'); put(...r.to, 'R'); }
for (const t of n.treats) put(t.x, t.z, 'T');
for (const h of n.hands) put(h.x, h.z, 'H');
for (const c of n.chasers) put(c.x, c.z, 'Z');
for (const l of n.lanterns) put(l.x, l.z, 'L');
put(n.start.x, n.start.z, 'S');
put(n.gate.x, n.gate.z, 'G');
console.log(`${n.name}: ${grounds.cols}×${grounds.rows} tiles, ${n.candy.length} candy, ${n.lanterns.length} lanterns, ${n.chasers.length} chasers, ${n.decor.length} decor, ${n.candles.length} candles`);
console.log(rows.map((r) => r.join('')).join('\n'));
