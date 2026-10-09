/**
 * The grounds a night is played on: a grid of tiles, as Dungeon Roller's
 * dungeons are, each with its own four corner heights so the ground can roll
 * and the walls stand on it. A tile is floor, wall, bog (something brewing
 * that Blubber floats over) or nothing at all — the dark the grounds float
 * in.
 *
 * x runs along the columns and z down the rows; the camera looks from +z,
 * tipped down, so the back of a maze is low z and the front high z.
 *
 * `buildGrounds` turns it into what is drawn: the floor, the tops and sides
 * of the walls, the earth falling away under the edges, and the bog. The
 * light is baked into the vertex colours — a cold night everywhere, warm
 * round every lit lantern and candle — and `relight` bakes it again when a
 * lantern is lit, so the maze warms up as Blubber goes round it.
 */

/** How far the earth reaches down into the dark under the edge of the grounds. */
export const DEPTH = 5;

/** Corner order: (x, z), (x + 1, z), (x, z + 1), (x + 1, z + 1). */
const H00 = 0, H10 = 1, H01 = 2, H11 = 3;

export class Grounds {
  constructor({ cols, rows }) {
    this.cols = cols;
    this.rows = rows;
    this.cells = new Array(cols * rows).fill(null);
  }

  cell(x, z) {
    if (x < 0 || z < 0 || x >= this.cols || z >= this.rows) return null;
    return this.cells[z * this.cols + x];
  }

  /** Lays tile (x, z): `kind` is floor, wall, bog or exit; `h` its four corner heights. */
  set(x, z, kind, h, extra = {}) {
    this.cells[z * this.cols + x] = { kind, h, color: 0, ...extra };
    return this.cells[z * this.cols + x];
  }

  /** Whether nothing gets through tile (x, z): wall, or the dark off the edge. */
  blocks(x, z) {
    const c = this.cell(x, z);
    return !c || c.kind === 'wall';
  }

  /** The height of the ground at (x, z), or null over the dark. Walls give their tops. */
  heightAt(x, z) {
    const i = Math.floor(x), j = Math.floor(z);
    const c = this.cell(i, j);
    if (!c) return null;
    const u = x - i, w = z - j, h = c.h;
    if (u + w <= 1) return h[H00] + (h[H10] - h[H00]) * u + (h[H01] - h[H00]) * w;
    return h[H11] + (h[H01] - h[H11]) * (1 - u) + (h[H10] - h[H11]) * (1 - w);
  }

  /** The floor under (x, z): walls don't count, and over the dark it is null. */
  floorAt(x, z) {
    const c = this.cell(Math.floor(x), Math.floor(z));
    if (!c || c.kind === 'wall') return c?.floor ?? null;
    return this.heightAt(x, z);
  }
}

/** sRGB hex to linear RGB — vertex colours are linear. */
export function linearRGB(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
}

/** A little per-tile variety: the same for the same tile every time. */
export function grain(x, z) {
  let h = (x * 374761393 + z * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * The light at a point, from `lights` — [x, y, z, reach, [r, g, b]] each —
 * over `ambient`: each light falls off with the square of how far into its
 * reach the point is.
 */
export function lightAt(lights, ambient, x, y, z, out = [0, 0, 0]) {
  out[0] = ambient[0]; out[1] = ambient[1]; out[2] = ambient[2];
  for (let i = 0; i < lights.length; i++) {
    const [sx, sy, sz, reach, colour] = lights[i];
    const dx = x - sx, dz = z - sz;
    if (dx > reach || dx < -reach || dz > reach || dz < -reach) continue;
    const dy = (y - sy) * 0.8;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d >= reach) continue;
    const k = (1 - d / reach) ** 2;
    out[0] += colour[0] * k; out[1] += colour[1] * k; out[2] += colour[2] * k;
  }
  out[0] = Math.min(1.7, out[0]); out[1] = Math.min(1.7, out[1]); out[2] = Math.min(1.7, out[2]);
  return out;
}

/**
 * Everything drawn of the grounds, as plain arrays (so the tests can look at
 * it too): `floor` (the tops of floor tiles), `tops` (the tops of walls),
 * `walls` (their sides, cut into bands a tile high so the courses line up),
 * `earth` (the sides of the ground falling into the dark) and `bog`. Each
 * part keeps its unlit colours in `base`; `relight(lights)` lights them.
 *
 * `look` gives the colours: `floor` (a list, by a tile's `color`),
 * `wall`, `top`, `earth`, `bog`, `ambient`; and `uv`: 'tile' to lay the
 * floor texture once per tile, turned every which way, or 'world' to lay it
 * across the whole floor, `scale` tiles to a repeat.
 */
export function buildGrounds(grounds, look) {
  const parts = {};
  const part = (name) => (parts[name] ??= { position: [], normal: [], base: [], uv: [] });
  const floorColours = look.floor.map(linearRGB);
  const wallColour = linearRGB(look.wall);
  const topColour = linearRGB(look.top ?? look.wall);
  const earthColour = linearRGB(look.earth);
  const bogColour = linearRGB(look.bog ?? '#3a5a2a');
  const exitColour = linearRGB(look.exit ?? look.floor[0]);
  const scale = look.scale ?? 4;
  const contact = look.contact ?? 0.6;

  const normalOf = (a, b, c) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    return [nx / l, ny / l, nz / l];
  };

  const face = (out, a, b, c, normal, colours, uvs) => {
    out.position.push(...a, ...b, ...c);
    for (let k = 0; k < 3; k++) out.normal.push(...normal);
    out.base.push(...colours[0], ...colours[1], ...colours[2]);
    out.uv.push(...uvs[0], ...uvs[1], ...uvs[2]);
  };

  // How shut in a floor corner is: the more walls round it, the darker it sits.
  const wallish = (x, z) => {
    const c = grounds.cell(x, z);
    return c && c.kind === 'wall' ? 1 : 0;
  };
  const shutIn = (X, Z) => (wallish(X - 1, Z - 1) + wallish(X, Z - 1) + wallish(X - 1, Z) + wallish(X, Z)) / 2;

  const wallSide = (p0, p1, poly, out, shade, dest) => {
    const at = (t, y) => [p0[0] + (p1[0] - p0[0]) * t, y, p0[1] + (p1[1] - p0[1]) * t];
    const facing = (a, b, c) => {
      const n = normalOf(a, b, c);
      return n[0] * out[0] + n[2] * out[2] < 0 ? null : n;
    };
    const lowY = Math.min(...poly.map((p) => p[1])), highY = Math.max(...poly.map((p) => p[1]));
    for (let y0 = Math.floor(lowY); y0 < highY; y0++) {
      const band = clip(clip(poly, (p) => p[1] - y0), (p) => y0 + 1 - p[1]);
      if (band.length < 3) continue;
      const bp = band.map(([t, y]) => at(t, y));
      for (let k = 1; k < band.length - 1; k++) {
        let ib = k, ic = k + 1;
        let n = facing(bp[0], bp[ib], bp[ic]);
        if (!n) { [ib, ic] = [ic, ib]; n = normalOf(bp[0], bp[ib], bp[ic]); }
        const vs = [0, ib, ic];
        face(dest, bp[0], bp[ib], bp[ic], n, vs.map((v) => shade(band[v][1])), vs.map((v) => [band[v][0], band[v][1] - y0]));
      }
    }
  };

  for (let z = 0; z < grounds.rows; z++) {
    for (let x = 0; x < grounds.cols; x++) {
      const c = grounds.cell(x, z);
      if (!c) continue;
      const [h00, h10, h01, h11] = c.h;
      const A = [x, h00, z], B = [x + 1, h10, z], C = [x, h01, z + 1], D = [x + 1, h11, z + 1];
      const wall = c.kind === 'wall';
      const vary = look.grain ?? 0.24;
      const tint = (wall ? 1 : 1 - vary * 0.6 + vary * grain(x, z)) * (look.checker && (x + z) % 2 ? 0.93 : 1);
      let base;
      if (wall) base = topColour;
      else if (c.kind === 'bog') base = bogColour;
      else if (c.kind === 'exit') base = exitColour;
      else base = floorColours[((c.color % floorColours.length) + floorColours.length) % floorColours.length];
      const out = part(wall ? 'tops' : c.kind === 'bog' ? 'bog' : 'floor');
      const corner = (X, Z) => {
        const k = wall || c.kind === 'bog' ? 1 : 1 - contact * 0.5 * Math.min(1, shutIn(X, Z));
        return base.map((v) => v * tint * k);
      };
      let uv;
      if (!wall && (look.uv === 'world' || c.kind === 'bog')) {
        // Each tile takes its own square of a texture `scale` tiles across, so it runs on without a seam
        // (the textures are painted to wrap) and without the sampler having to repeat it.
        const ox = ((x % scale) + scale) % scale, oz = ((z % scale) + scale) % scale;
        uv = (u, v) => [(ox + u) / scale, 1 - (oz + 1 - v) / scale];
      } else {
        // Each tile turned and flipped its own way, so the floor doesn't repeat.
        const spin = Math.floor(grain(z, x) * 8);
        uv = (u, v) => {
          if (spin & 4) u = 1 - u;
          for (let k = 0; k < (spin & 3); k++) [u, v] = [v, 1 - u];
          return [u, v];
        };
      }
      face(out, A, C, B, normalOf(A, C, B), [corner(x, z), corner(x, z + 1), corner(x + 1, z)], [uv(0, 1), uv(0, 0), uv(1, 1)]);
      face(out, B, C, D, normalOf(B, C, D), [corner(x + 1, z), corner(x, z + 1), corner(x + 1, z + 1)], [uv(1, 1), uv(0, 0), uv(1, 0)]);

      // The sides: up a wall to its top, or down from an edge into the dark.
      const low = Math.min(...c.h) - DEPTH;
      const edges = [
        [[x, z], [x + 1, z], h00, h10, grounds.cell(x, z - 1), (n) => [n.h[H01], n.h[H11]], [0, 0, -1]],
        [[x, z + 1], [x + 1, z + 1], h01, h11, grounds.cell(x, z + 1), (n) => [n.h[H00], n.h[H10]], [0, 0, 1]],
        [[x, z], [x, z + 1], h00, h01, grounds.cell(x - 1, z), (n) => [n.h[H10], n.h[H11]], [-1, 0, 0]],
        [[x + 1, z], [x + 1, z + 1], h10, h11, grounds.cell(x + 1, z), (n) => [n.h[H00], n.h[H01]], [1, 0, 0]],
      ];
      for (const [p0, p1, a0, a1, n, theirs, outward] of edges) {
        const [b0, b1] = n ? theirs(n) : [low, low];
        const d0 = a0 - b0, d1 = a1 - b1;
        if (d0 <= 1e-6 && d1 <= 1e-6) continue;
        const top = Math.max(a0, a1);
        const dest = wall && n ? part('walls') : part('earth');
        const colour = wall && n ? wallColour : earthColour;
        // Walls go a little darker toward their feet; earth fades into the dark below.
        const shade = wall && n
          ? (y) => colour.map((v) => v * (0.72 + 0.28 * Math.min(1, Math.max(0, 1 - (top - y) / 1.6))))
          : (y) => { const k = Math.max(0, Math.min(1, 1 - (top - y) / DEPTH)); return colour.map((v) => v * (0.05 + 0.95 * k * k)); };
        if (d0 >= -1e-6 && d1 >= -1e-6) {
          wallSide(p0, p1, [[0, b0], [1, b1], [1, a1], [0, a0]], outward, shade, dest);
        } else {
          const t = d0 / (d0 - d1);
          const ym = a0 + (a1 - a0) * t;
          if (d0 > 0) wallSide(p0, p1, [[0, b0], [t, ym], [0, a0]], outward, shade, dest);
          else wallSide(p0, p1, [[1, b1], [1, a1], [t, ym]], outward, shade, dest);
        }
      }
    }
  }

  const typed = {};
  for (const [name, p] of Object.entries(parts)) {
    typed[name] = {
      position: new Float32Array(p.position),
      normal: new Float32Array(p.normal),
      base: new Float32Array(p.base),
      color: new Float32Array(p.base.length),
      uv: new Float32Array(p.uv),
    };
  }
  const ambient = look.ambient ?? [0.4, 0.42, 0.55];
  const light = [0, 0, 0];
  return {
    parts: typed,
    /** Bakes `lights` ([x, y, z, reach, [r, g, b]] each) into every part's colours; the bog lights itself. */
    relight(lights) {
      for (const [name, p] of Object.entries(typed)) {
        const { position: P, base, color } = p;
        for (let i = 0; i < P.length; i += 3) {
          if (name === 'bog') { color[i] = base[i]; color[i + 1] = base[i + 1]; color[i + 2] = base[i + 2]; continue; }
          lightAt(lights, ambient, P[i], P[i + 1], P[i + 2], light);
          color[i] = base[i] * light[0]; color[i + 1] = base[i + 1] * light[1]; color[i + 2] = base[i + 2] * light[2];
        }
      }
    },
  };
}

/** The part of a polygon of [t, y] points where `inside(p) >= 0` (Sutherland–Hodgman, against one line). */
function clip(poly, inside) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const fa = inside(a), fb = inside(b);
    if (fa >= 0) out.push(a);
    if ((fa >= 0) !== (fb >= 0)) {
      const t = fa / (fa - fb);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out.filter((p, i) => {
    const q = out[(i + 1) % out.length];
    return out.length < 2 || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-7;
  });
}
