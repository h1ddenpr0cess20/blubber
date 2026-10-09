/**
 * Bones, and skin over them. A creature's skeleton is a tree of bones, each
 * with a pivot in the creature's rest pose; a pose turns, moves and scales
 * each bone about its pivot, in its parent's frame. The skin — every vertex
 * of the sculpted mesh, with up to four bones and how much each pulls it —
 * is moved to match on the CPU, a blend of its bones' matrices, and handed
 * to the renderer as a fresh vertex buffer.
 *
 * Matrices are 3×4, row-major, twelve floats each: the rest pose is the
 * identity, so a bone's matrix takes rest-pose points straight to posed ones.
 */

/** A bone's pose: turned by `rot` (Euler x, y, z, radians), then scaled by `scale`, about its pivot; moved by `move`. */
const still = () => ({ rot: [0, 0, 0], move: [0, 0, 0], scale: [1, 1, 1] });

export class Skeleton {
  /** `bones`: [name, parent name or null, pivot [x, y, z]], parents before children. */
  constructor(bones) {
    this.names = bones.map(([name]) => name);
    this.parents = bones.map(([, parent]) => {
      if (parent === null) return -1;
      const i = this.names.indexOf(parent);
      if (i < 0) throw new Error(`rig: bone ${parent} comes after its child`);
      return i;
    });
    this.pivots = bones.map(([, , at]) => at);
    this.pose = bones.map(still);
    this.matrices = new Float32Array(bones.length * 12);
    this.index = new Map(this.names.map((n, i) => [n, i]));
  }

  /** Back to the rest pose. */
  reset() {
    for (const p of this.pose) {
      p.rot[0] = p.rot[1] = p.rot[2] = 0;
      p.move[0] = p.move[1] = p.move[2] = 0;
      p.scale[0] = p.scale[1] = p.scale[2] = 1;
    }
    return this;
  }

  /** The pose of the bone named `name`, to change in place; a no-op stand-in if there is no such bone. */
  bone(name) {
    const i = this.index.get(name);
    return i === undefined ? still() : this.pose[i];
  }

  /** Turns bone `name` by [x, y, z] more. */
  turn(name, x = 0, y = 0, z = 0) {
    const r = this.bone(name).rot;
    r[0] += x; r[1] += y; r[2] += z;
    return this;
  }

  move(name, x = 0, y = 0, z = 0) {
    const m = this.bone(name).move;
    m[0] += x; m[1] += y; m[2] += z;
    return this;
  }

  scale(name, x = 1, y = x, z = x) {
    const s = this.bone(name).scale;
    s[0] *= x; s[1] *= y; s[2] *= z;
    return this;
  }

  /** Works out every bone's matrix from the pose. */
  compute() {
    const M = this.matrices;
    for (let b = 0; b < this.pose.length; b++) {
      const { rot, move, scale } = this.pose[b];
      const [px, py, pz] = this.pivots[b];
      const cx = Math.cos(rot[0]), sx = Math.sin(rot[0]), cy = Math.cos(rot[1]), sy = Math.sin(rot[1]), cz = Math.cos(rot[2]), sz = Math.sin(rot[2]);
      // L = T(pivot + move) · Rz·Ry·Rx · S · T(−pivot)
      const r00 = cz * cy, r01 = cz * sy * sx - sz * cx, r02 = cz * sy * cx + sz * sx;
      const r10 = sz * cy, r11 = sz * sy * sx + cz * cx, r12 = sz * sy * cx - cz * sx;
      const r20 = -sy, r21 = cy * sx, r22 = cy * cx;
      const a00 = r00 * scale[0], a01 = r01 * scale[1], a02 = r02 * scale[2];
      const a10 = r10 * scale[0], a11 = r11 * scale[1], a12 = r12 * scale[2];
      const a20 = r20 * scale[0], a21 = r21 * scale[1], a22 = r22 * scale[2];
      const t0 = px + move[0] - (a00 * px + a01 * py + a02 * pz);
      const t1 = py + move[1] - (a10 * px + a11 * py + a12 * pz);
      const t2 = pz + move[2] - (a20 * px + a21 * py + a22 * pz);
      const o = b * 12, p = this.parents[b];
      if (p < 0) {
        M[o] = a00; M[o + 1] = a01; M[o + 2] = a02; M[o + 3] = t0;
        M[o + 4] = a10; M[o + 5] = a11; M[o + 6] = a12; M[o + 7] = t1;
        M[o + 8] = a20; M[o + 9] = a21; M[o + 10] = a22; M[o + 11] = t2;
      } else {
        // W = Wparent · L
        const q = p * 12;
        for (let r = 0; r < 3; r++) {
          const m0 = M[q + r * 4], m1 = M[q + r * 4 + 1], m2 = M[q + r * 4 + 2], m3 = M[q + r * 4 + 3];
          M[o + r * 4] = m0 * a00 + m1 * a10 + m2 * a20;
          M[o + r * 4 + 1] = m0 * a01 + m1 * a11 + m2 * a21;
          M[o + r * 4 + 2] = m0 * a02 + m1 * a12 + m2 * a22;
          M[o + r * 4 + 3] = m0 * t0 + m1 * t1 + m2 * t2 + m3;
        }
      }
    }
    return M;
  }

  /** Where the rest-pose point p is now, under bone `name`. */
  point(name, p) {
    const o = (this.index.get(name) ?? 0) * 12, M = this.matrices;
    return [
      M[o] * p[0] + M[o + 1] * p[1] + M[o + 2] * p[2] + M[o + 3],
      M[o + 4] * p[0] + M[o + 5] * p[1] + M[o + 6] * p[2] + M[o + 7],
      M[o + 8] * p[0] + M[o + 9] * p[1] + M[o + 10] * p[2] + M[o + 11],
    ];
  }
}

/**
 * Moves the skin: rest positions and normals (`rest`) to posed ones
 * (`position`, `normal`), under the bone matrices `M`.
 */
export function skin(rest, M, position, normal) {
  const { position: P, normal: N, skinIndex: I, skinWeight: W } = rest;
  const count = P.length / 3;
  for (let v = 0; v < count; v++) {
    const i4 = v * 4;
    let m0, m1, m2, m3, m4, m5, m6, m7, m8, m9, m10, m11;
    const w0 = W[i4];
    let o = I[i4] * 12;
    if (w0 >= 0.999) {
      m0 = M[o]; m1 = M[o + 1]; m2 = M[o + 2]; m3 = M[o + 3];
      m4 = M[o + 4]; m5 = M[o + 5]; m6 = M[o + 6]; m7 = M[o + 7];
      m8 = M[o + 8]; m9 = M[o + 9]; m10 = M[o + 10]; m11 = M[o + 11];
    } else {
      m0 = M[o] * w0; m1 = M[o + 1] * w0; m2 = M[o + 2] * w0; m3 = M[o + 3] * w0;
      m4 = M[o + 4] * w0; m5 = M[o + 5] * w0; m6 = M[o + 6] * w0; m7 = M[o + 7] * w0;
      m8 = M[o + 8] * w0; m9 = M[o + 9] * w0; m10 = M[o + 10] * w0; m11 = M[o + 11] * w0;
      for (let k = 1; k < 4; k++) {
        const w = W[i4 + k];
        if (w <= 0) break;
        o = I[i4 + k] * 12;
        m0 += M[o] * w; m1 += M[o + 1] * w; m2 += M[o + 2] * w; m3 += M[o + 3] * w;
        m4 += M[o + 4] * w; m5 += M[o + 5] * w; m6 += M[o + 6] * w; m7 += M[o + 7] * w;
        m8 += M[o + 8] * w; m9 += M[o + 9] * w; m10 += M[o + 10] * w; m11 += M[o + 11] * w;
      }
    }
    const v3 = v * 3;
    const x = P[v3], y = P[v3 + 1], z = P[v3 + 2];
    position[v3] = m0 * x + m1 * y + m2 * z + m3;
    position[v3 + 1] = m4 * x + m5 * y + m6 * z + m7;
    position[v3 + 2] = m8 * x + m9 * y + m10 * z + m11;
    // Normals by the same matrix: near enough for turns and gentle squashes.
    const a = N[v3], b = N[v3 + 1], c = N[v3 + 2];
    const nx = m0 * a + m1 * b + m2 * c, ny = m4 * a + m5 * b + m6 * c, nz = m8 * a + m9 * b + m10 * c;
    const l = 1 / (Math.sqrt(nx * nx + ny * ny + nz * nz) || 1);
    normal[v3] = nx * l; normal[v3 + 1] = ny * l; normal[v3 + 2] = nz * l;
  }
}
