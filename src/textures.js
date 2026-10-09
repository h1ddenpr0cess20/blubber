/**
 * Every surface's texture, painted on a canvas at startup, as Dungeon
 * Roller's stone is: a colour map near white (the tile's colour comes from
 * the vertex colours under it) and a bump map that raises what stands out.
 * Each is painted from a seed, so it comes out the same every time, and the
 * ones laid across whole floors (`world`) wrap at their edges so no seam
 * shows. Under node (the tests) there is no canvas and nothing is painted.
 */

const painted = new Map();

/** A seeded random source, so every texture is painted the same. */
export function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

export function mix(a, b, t) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`;
}

/** Draws `fn(dx, dy)` nine times, offset by the size each way, so whatever crosses an edge comes back on the other side. */
function wrap(size, fn) {
  for (const dy of [-size, 0, size]) for (const dx of [-size, 0, size]) fn(dx, dy);
}

const PAINTERS = {
  /** Clipped leaves in clusters, packed close: a hedge's sides and top. Lit from above, dark in the gaps. */
  hedge(map, bump, size, rnd) {
    const clusters = Array.from({ length: 150 }, () => [rnd() * size, rnd() * size, 10 + rnd() * 9, rnd()]);
    for (const [ctx, b] of [[map, false], [bump, true]]) {
      ctx.fillStyle = b ? '#000' : '#525c48';
      ctx.fillRect(0, 0, size, size);
      for (const [cx, cy, R, v] of clusters) {
        const leaves = Array.from({ length: 9 }, (_, k) => [Math.cos(k * 2.4) * R * 0.55 * Math.sqrt(k / 9), Math.sin(k * 2.4) * R * 0.55 * Math.sqrt(k / 9), k * 1.7 + v * 6]);
        wrap(size, (dx, dy) => {
          for (const [lx, ly, a] of leaves) {
            const x = cx + dx + lx, y = cy + dy + ly;
            if (x < -20 || x > size + 20 || y < -20 || y > size + 20) continue;
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(a);
            // Lighter on top of each leaf, darker under.
            const g = ctx.createLinearGradient(0, -R * 0.3, 0, R * 0.3);
            const hi = b ? 255 : 235 + v * 20, lo = b ? 90 : 120 + v * 40;
            g.addColorStop(0, `rgb(${hi},${hi},${b ? hi : hi - 25})`);
            g.addColorStop(1, `rgb(${lo},${lo},${b ? lo : lo - 20})`);
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.ellipse(0, 0, R * 0.42, R * 0.24, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        });
      }
    }
  },

  /** Short grass, tufted, with a few worn patches. */
  grass(map, bump, size, rnd) {
    const patches = Array.from({ length: 6 }, () => [rnd() * size, rnd() * size, 24 + rnd() * 40]);
    const tufts = Array.from({ length: 520 }, () => [rnd() * size, rnd() * size, rnd()]);
    for (const [ctx, b] of [[map, false], [bump, true]]) {
      ctx.fillStyle = b ? '#505050' : '#c8ccb0';
      ctx.fillRect(0, 0, size, size);
      for (const [x, y, r] of patches) {
        wrap(size, (dx, dy) => {
          const g = ctx.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
          g.addColorStop(0, b ? 'rgba(0,0,0,0.35)' : 'rgba(200,170,120,0.35)');
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
        });
      }
      ctx.lineCap = 'round';
      for (const [x, y, v] of tufts) {
        wrap(size, (dx, dy) => {
          if (x + dx < -12 || x + dx > size + 12 || y + dy < -12 || y + dy > size + 12) return;
          for (let k = 0; k < 7; k++) {
            const lean = (k - 3) * 0.28 + (v - 0.5) * 0.4, len = 5 + ((k * 7 + v * 13) % 5);
            const t = (k % 3) / 2;
            ctx.strokeStyle = b ? `rgba(255,255,255,${0.35 + t * 0.4})` : `rgb(${200 + t * 50 | 0},${210 + t * 45 | 0},${170 + t * 40 | 0})`;
            ctx.lineWidth = 1.3;
            ctx.beginPath();
            ctx.moveTo(x + dx + (k - 3) * 0.8, y + dy);
            ctx.lineTo(x + dx + (k - 3) * 0.8 + lean * len, y + dy - len);
            ctx.stroke();
          }
        });
      }
    }
  },

  /** Earth falling away under the edge: layers of soil, stones in them, roots hanging. */
  earth(map, bump, size, rnd) {
    const stones = Array.from({ length: 70 }, () => [rnd() * size, rnd() * size, 3 + rnd() * 10, rnd()]);
    const roots = Array.from({ length: 9 }, () => [rnd() * size, rnd() * size * 0.4, 20 + rnd() * 60]);
    for (const [ctx, b] of [[map, false], [bump, true]]) {
      for (let y = 0; y < size; y += 4) {
        const v = 0.5 + 0.5 * Math.sin(y * 0.11) * Math.sin(y * 0.037 + 1);
        ctx.fillStyle = b ? `rgb(${80 + v * 60 | 0},${80 + v * 60 | 0},${80 + v * 60 | 0})` : mix('#8e7c68', '#c4b29a', v);
        ctx.fillRect(0, y, size, 4);
      }
      for (const [x, y, r, v] of stones) {
        wrap(size, (dx, dy) => {
          ctx.fillStyle = b ? '#e0e0e0' : mix('#9c968c', '#e4ded2', v);
          ctx.beginPath();
          ctx.ellipse(x + dx, y + dy, r, r * 0.7, v, 0, Math.PI * 2);
          ctx.fill();
        });
      }
      ctx.strokeStyle = b ? '#c0c0c0' : '#6a5440';
      ctx.lineWidth = 2;
      for (const [x, y, len] of roots) {
        wrap(size, (dx, dy) => {
          ctx.beginPath();
          ctx.moveTo(x + dx, y + dy);
          ctx.bezierCurveTo(x + dx + 8, y + dy + len * 0.3, x + dx - 8, y + dy + len * 0.6, x + dx + 3, y + dy + len);
          ctx.stroke();
        });
      }
    }
  },

  /** Flagstones, a tile across: Dungeon Roller's, four slabs worn at the edges. */
  flagstone(map, bump, size, rnd) {
    const slabs = [[0, 0, 0.56, 0.47], [0.56, 0, 0.44, 0.62], [0, 0.47, 0.42, 0.53], [0.42, 0.62, 0.58, 0.38], [0.42, 0.47, 0.14, 0.15]];
    const speckle = Array.from({ length: 900 }, () => [rnd() * size, rnd() * size, rnd(), rnd() * 1.6 + 0.4]);
    for (const [ctx, face, edge, joint, dots] of [
      [map, '#e8e4dc', '#a9a49b', '#2a2622', (v) => (v > 0.5 ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.18)')],
      [bump, '#ffffff', '#707070', '#000000', (v) => (v > 0.5 ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)')],
    ]) {
      ctx.fillStyle = joint;
      ctx.fillRect(0, 0, size, size);
      for (const [sx, sy, sw, sh] of slabs) {
        const x = sx * size + 3, y = sy * size + 3, w = sw * size - 6, h = sh * size - 6;
        for (let k = 0; k <= 8; k++) {
          ctx.fillStyle = mix(edge, face, Math.sin((k / 8) * Math.PI / 2));
          ctx.beginPath();
          ctx.roundRect(x + k, y + k, w - k * 2, h - k * 2, 10 - k);
          ctx.fill();
        }
      }
      for (const [x, y, v, r] of speckle) {
        ctx.fillStyle = dots(v);
        ctx.fillRect(x, y, r, r);
      }
    }
  },

  /** Bricks, a tile wide and high, four courses. */
  brick(map, bump, size, rnd) {
    const tones = Array.from({ length: 40 }, () => rnd());
    for (const [ctx, face, joint, vary] of [[map, '#e2ddd4', '#3a342e', true], [bump, '#ffffff', '#000000', false]]) {
      ctx.fillStyle = joint;
      ctx.fillRect(0, 0, size, size);
      const rows = 4, per = 2, bh = size / rows, bw = size / per;
      let n = 0;
      for (let r = 0; r < rows; r++) {
        const shift = (r % 2) * bw / 2;
        for (let k = -1; k < per + 1; k++) {
          ctx.fillStyle = vary ? mix(face, '#8a847a', tones[n++ % tones.length] * 0.5) : face;
          ctx.beginPath();
          ctx.roundRect(k * bw + shift + 4, r * bh + 4, bw - 8, bh - 8, 5);
          ctx.fill();
        }
      }
    }
  },

  /** Fieldstones in mortar, moss on them: a graveyard wall. */
  fieldstone(map, bump, size, rnd) {
    const stones = [];
    for (let r = 0; r < 5; r++) {
      let x = rnd() * -30;
      while (x < size) {
        const w = 34 + rnd() * 40;
        stones.push([x, r * size / 5, w, size / 5, rnd(), rnd()]);
        x += w;
      }
    }
    const moss = Array.from({ length: 260 }, () => [rnd() * size, rnd() * size, 2 + rnd() * 7]);
    for (const [ctx, b] of [[map, false], [bump, true]]) {
      ctx.fillStyle = b ? '#000' : '#4a463e';
      ctx.fillRect(0, 0, size, size);
      for (const [x, y, w, h, v, j] of stones) {
        for (const dx of [-size, 0, size]) {
          for (let k = 0; k <= 6; k++) {
            ctx.fillStyle = b ? `rgb(${120 + k * 22},${120 + k * 22},${120 + k * 22})` : mix(mix('#8c887e', '#d8d2c4', v), '#efe9dc', k / 12);
            ctx.beginPath();
            ctx.roundRect(x + dx + 3 + k, y + 3 + k + (j - 0.5) * 3, w - 6 - k * 2, h - 6 - k * 2, 9 - k);
            ctx.fill();
          }
        }
      }
      if (!b) {
        for (const [x, y, r] of moss) {
          wrap(size, (dx, dy) => {
            ctx.fillStyle = 'rgba(110, 140, 70, 0.32)';
            ctx.beginPath();
            ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2);
            ctx.fill();
          });
        }
      }
    }
  },

  /** Tall corn: stalks with their joints, and long leaves crossing them. */
  corn(map, bump, size, rnd) {
    const stalks = Array.from({ length: 16 }, (_, i) => [(i + rnd() * 0.6) * size / 16, 4 + rnd() * 3, rnd()]);
    const leaves = Array.from({ length: 70 }, () => [rnd() * size, rnd() * size, (rnd() < 0.5 ? -1 : 1) * (0.4 + rnd() * 0.7), 30 + rnd() * 50, rnd()]);
    for (const [ctx, b] of [[map, false], [bump, true]]) {
      ctx.fillStyle = b ? '#000' : '#5a5236';
      ctx.fillRect(0, 0, size, size);
      for (const [x, w, v] of stalks) {
        ctx.fillStyle = b ? '#ddd' : mix('#c8b880', '#efe2b0', v);
        ctx.fillRect(x - w / 2, 0, w, size);
        ctx.fillStyle = b ? '#888' : 'rgba(90,70,30,0.6)';
        for (let y = (v * 40) % 40; y < size; y += 40) ctx.fillRect(x - w / 2 - 1, y, w + 2, 3);
      }
      for (const [x, y, dir, len, v] of leaves) {
        wrap(size, (dx, dy) => {
          ctx.fillStyle = b ? `rgb(${170 + v * 80 | 0},${170 + v * 80 | 0},${170 + v * 80 | 0})` : mix('#b8b070', '#f0e6b8', v);
          ctx.beginPath();
          ctx.moveTo(x + dx, y + dy);
          ctx.quadraticCurveTo(x + dx + dir * len * 0.6, y + dy - len * 0.5, x + dx + dir * len, y + dy + len * 0.15);
          ctx.quadraticCurveTo(x + dx + dir * len * 0.5, y + dy - len * 0.3, x + dx, y + dy + 5);
          ctx.fill();
        });
      }
    }
  },

  /** Trodden straw and dirt: the harvest floors. */
  straw(map, bump, size, rnd) {
    const bits = Array.from({ length: 2600 }, () => [rnd() * size, rnd() * size, rnd() * Math.PI, 4 + rnd() * 9, rnd()]);
    for (const [ctx, b] of [[map, false], [bump, true]]) {
      ctx.fillStyle = b ? '#303030' : '#a8987c';
      ctx.fillRect(0, 0, size, size);
      ctx.lineCap = 'round';
      for (const [x, y, a, len, v] of bits) {
        wrap(size, (dx, dy) => {
          if (x + dx < -12 || x + dx > size + 12 || y + dy < -12 || y + dy > size + 12) return;
          ctx.strokeStyle = b ? `rgba(255,255,255,${0.3 + v * 0.5})` : mix('#c4b286', '#f6ecc8', v);
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(x + dx, y + dy);
          ctx.lineTo(x + dx + Math.cos(a) * len, y + dy + Math.sin(a) * len);
          ctx.stroke();
        });
      }
    }
  },

  /** Planks across the tile, their grain and their nails. */
  planks(map, bump, size, rnd) {
    const boards = 4, bh = size / boards;
    const tones = Array.from({ length: boards }, () => rnd());
    const grainLines = Array.from({ length: 60 }, () => [rnd() * boards | 0, rnd() * bh, rnd()]);
    for (const [ctx, b] of [[map, false], [bump, true]]) {
      ctx.fillStyle = b ? '#000' : '#2a2018';
      ctx.fillRect(0, 0, size, size);
      for (let k = 0; k < boards; k++) {
        ctx.fillStyle = b ? '#d0d0d0' : mix('#c8a886', '#f0dcc0', tones[k]);
        ctx.fillRect(0, k * bh + 2, size, bh - 4);
        const cut = (tones[k] * size * 0.8 + size * 0.1) | 0;
        ctx.fillStyle = b ? '#000' : '#2a2018';
        ctx.fillRect(cut, k * bh, 3, bh);
        ctx.fillStyle = b ? '#555' : '#5a4636';
        for (const x of [cut - 8, cut + 10]) {
          ctx.beginPath();
          ctx.arc(x, k * bh + bh * 0.3, 2.2, 0, Math.PI * 2);
          ctx.arc(x, k * bh + bh * 0.7, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.lineWidth = 1;
      for (const [k, y, v] of grainLines) {
        ctx.strokeStyle = b ? 'rgba(80,80,80,0.6)' : `rgba(110,80,50,${0.15 + v * 0.25})`;
        ctx.beginPath();
        ctx.moveTo(0, k * bh + 3 + y * 0.9);
        for (let x = 0; x <= size; x += 16) ctx.lineTo(x, k * bh + 3 + y * 0.9 + Math.sin(x * 0.03 + v * 9) * 2.5);
        ctx.stroke();
      }
    }
  },

  /** Wainscot below and striped paper above: the manor's walls. */
  panelling(map, bump, size, rnd) {
    const v = rnd();
    for (const [ctx, b] of [[map, false], [bump, true]]) {
      // Paper: stripes with a little damask between.
      for (let x = 0; x < size; x += 32) {
        ctx.fillStyle = b ? '#808080' : mix('#d8c4c8', '#efe2e2', v);
        ctx.fillRect(x, 0, 16, size * 0.55);
        ctx.fillStyle = b ? '#7a7a7a' : '#c4a8b0';
        ctx.fillRect(x + 16, 0, 16, size * 0.55);
      }
      // The rail, then panels of wood under it.
      ctx.fillStyle = b ? '#ffffff' : '#c8a07a';
      ctx.fillRect(0, size * 0.55, size, 14);
      ctx.fillStyle = b ? '#404040' : '#8a6448';
      ctx.fillRect(0, size * 0.55 + 14, size, size * 0.45 - 14);
      for (let x = 8; x < size; x += size / 2) {
        for (let k = 0; k < 6; k++) {
          ctx.fillStyle = b ? `rgb(${100 + k * 25},${100 + k * 25},${100 + k * 25})` : mix('#9a7454', '#d8b08a', k / 8);
          ctx.fillRect(x + k, size * 0.55 + 26 + k, size / 2 - 16 - k * 2, size * 0.45 - 40 - k * 2);
        }
      }
    }
  },

  /** Snow, drifted and glittering. */
  snow(map, bump, size, rnd) {
    const drifts = Array.from({ length: 40 }, () => [rnd() * size, rnd() * size, 20 + rnd() * 60, rnd()]);
    const glints = Array.from({ length: 700 }, () => [rnd() * size, rnd() * size, rnd()]);
    for (const [ctx, b] of [[map, false], [bump, true]]) {
      ctx.fillStyle = b ? '#808080' : '#e6ecf4';
      ctx.fillRect(0, 0, size, size);
      for (const [x, y, r, v] of drifts) {
        wrap(size, (dx, dy) => {
          const g = ctx.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
          const c = b ? (v > 0.5 ? '255,255,255' : '0,0,0') : (v > 0.5 ? '255,255,255' : '170,190,220');
          g.addColorStop(0, `rgba(${c},0.35)`);
          g.addColorStop(1, `rgba(${c},0)`);
          ctx.fillStyle = g;
          ctx.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
        });
      }
      if (!b) {
        for (const [x, y, v] of glints) {
          ctx.fillStyle = `rgba(255,255,255,${0.4 + v * 0.6})`;
          ctx.fillRect(x, y, 1.2, 1.2);
        }
      }
    }
  },
};

/**
 * The texture `name` (one of the painters above), as { map, bump } textures
 * for `GFX`; both null under node. `size` is in pixels.
 */
export function surface(GFX, name, size = name === 'grass' || name === 'snow' || name === 'straw' ? 512 : 256) {
  if (typeof document === 'undefined' || !PAINTERS[name]) return { map: null, bump: null };
  const key = `${name}@${size}`;
  if (!painted.has(key)) {
    const [mc, map] = canvas(size);
    const [bc, bump] = canvas(size);
    PAINTERS[name](map, bump, size, seeded(name.length * 7919 + size));
    const texture = (c, srgb) => {
      const t = new GFX.CanvasTexture(c);
      if (srgb) t.colorSpace = GFX.SRGBColorSpace;
      t.anisotropy = 8;
      return t;
    };
    painted.set(key, { map: texture(mc, true), bump: texture(bc, false) });
  }
  return painted.get(key);
}

/** A soft round glow, for halos round flames and lanterns. */
export function glow(GFX, inner = 'rgba(255, 220, 150, 1)', mid = 'rgba(255, 150, 60, 0.45)', outer = 'rgba(255, 90, 20, 0)') {
  if (typeof document === 'undefined') return null;
  const key = `glow:${inner}:${mid}:${outer}`;
  if (!painted.has(key)) {
    const [c, ctx] = canvas(64);
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, inner);
    g.addColorStop(0.25, mid);
    g.addColorStop(1, outer);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    const t = new GFX.CanvasTexture(c);
    t.colorSpace = GFX.SRGBColorSpace;
    painted.set(key, t);
  }
  return painted.get(key);
}

/** A soft white radial, `stops` as [offset, alpha]: the halos round Blubber, as the original's. */
export function radial(GFX, stops) {
  if (typeof document === 'undefined') return null;
  const key = `radial:${JSON.stringify(stops)}`;
  if (!painted.has(key)) {
    const [c, ctx] = canvas(256);
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    for (const [p, a] of stops) g.addColorStop(p, `rgba(255,255,255,${a})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    const t = new GFX.CanvasTexture(c);
    t.colorSpace = GFX.SRGBColorSpace;
    painted.set(key, t);
  }
  return painted.get(key);
}

/** A wisp of mist: a soft, lumpy cloud, for the ground fog. */
export function mist(GFX) {
  if (typeof document === 'undefined') return null;
  if (!painted.has('mist')) {
    const [c, ctx] = canvas(256);
    const rnd = seeded(77);
    for (let k = 0; k < 26; k++) {
      const x = 60 + rnd() * 136, y = 80 + rnd() * 96, r = 24 + rnd() * 50;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.22)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 256, 256);
    }
    const t = new GFX.CanvasTexture(c);
    t.colorSpace = GFX.SRGBColorSpace;
    painted.set('mist', t);
  }
  return painted.get('mist');
}
