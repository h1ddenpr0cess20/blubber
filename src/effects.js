/**
 * Bits that fly, as Dungeon Roller has them: each ballistic, bouncing off
 * the ground or settling on it, and shrinking away. Here: a glitter when a
 * sweet is eaten, sparks and rising embers when a lantern catches, a ring
 * spreading over the ground when Blubber spooks, drops of juice when it is
 * caught, and dirt where a hand comes up out of a grave.
 */

const GRAVITY = 18;

export function createEffects(GFX, scene) {
  const group = new GFX.Group();
  group.name = 'effects';
  scene.add(group);
  let grounds = null;
  const bits = [];
  const rings = [];

  const mote = new GFX.SphereGeometry(0.035, 6, 4);
  const glows = new Map();
  const glow = (colour) => {
    if (!glows.has(colour)) glows.set(colour, new GFX.MeshBasicMaterial({ name: 'glow', color: new GFX.Color(colour), toneMapped: false }));
    return glows.get(colour);
  };
  const drop = new GFX.SphereGeometry(0.05, 10, 8);
  const juice = new GFX.MeshPhysicalMaterial({ name: 'juice-drop', color: new GFX.Color('#5b4fd2'), emissive: new GFX.Color('#7d6ae4'), emissiveIntensity: 0.8, roughness: 0.15, clearcoat: 1 });
  const grit = new GFX.BoxGeometry(0.05, 0.05, 0.05);
  const dirt = new GFX.MeshStandardMaterial({ name: 'grit', color: new GFX.Color('#5a4a3a'), roughness: 1 });
  const ringGeometry = new GFX.TorusGeometry(1, 0.035, 6, 48);

  function spawn(mesh, { x, y, z, vx, vy, vz, life, spin = 6, drag = 0, floaty = 1, bounce = 0.35, grow = 0 }) {
    mesh.position.set(x, y, z);
    mesh.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    group.add(mesh);
    bits.push({
      mesh, vx, vy, vz, life, age: 0, drag, floaty, bounce, grow,
      spin: [(Math.random() - 0.5) * spin, (Math.random() - 0.5) * spin, (Math.random() - 0.5) * spin],
      scale: mesh.scale.x,
    });
  }

  const outward = (speed, up) => {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.4 + Math.random() * 0.6);
    return [Math.cos(a) * s, up * (0.5 + Math.random()), Math.sin(a) * s];
  };

  return {
    setGrounds(g) {
      grounds = g;
      for (const b of bits) group.remove(b.mesh);
      for (const r of rings) group.remove(r.mesh);
      bits.length = 0;
      rings.length = 0;
    },

    /** A sweet eaten: a little glitter in its colour. */
    sparkle(x, y, z, colour = '#ffd27a', n = 10) {
      for (let i = 0; i < n; i++) {
        const m = new GFX.Mesh(mote, glow(colour));
        m.scale.setScalar(0.7);
        const [ox, oy, oz] = outward(1.1, 2.6);
        spawn(m, { x, y, z, vx: ox, vy: oy, vz: oz, life: 0.45 + Math.random() * 0.35, floaty: -0.1, drag: 1.5, bounce: 0 });
      }
    },

    /** A lantern catching: sparks out, then embers drifting up out of it. */
    kindle(x, y, z, colour = '#ffb040') {
      for (let i = 0; i < 26; i++) {
        const m = new GFX.Mesh(mote, glow(i % 3 ? colour : '#fff0a8'));
        const [ox, oy, oz] = outward(2.4, 3.5);
        spawn(m, { x, y, z, vx: ox, vy: oy, vz: oz, life: 0.5 + Math.random() * 0.4, bounce: 0.4 });
      }
      for (let i = 0; i < 22; i++) {
        const m = new GFX.Mesh(mote, glow(i % 2 ? colour : '#ffd27a'));
        m.scale.setScalar(0.6 + Math.random() * 0.6);
        const [ox, , oz] = outward(0.5, 0);
        spawn(m, { x: x + ox * 0.3, y, z: z + oz * 0.3, vx: ox, vy: 0.8 + Math.random() * 1.6, vz: oz, life: 1 + Math.random() * 1.2, floaty: -0.04, spin: 0, bounce: 0 });
      }
    },

    /** A spook: a ring spreading out over the ground from Blubber, as far as it reaches. */
    ring(x, y, z, reach, colour = '#b9aeff') {
      for (let k = 0; k < 2; k++) {
        const m = new GFX.Mesh(ringGeometry, new GFX.MeshBasicMaterial({ name: 'spook-ring', color: new GFX.Color(colour), transparent: true, opacity: 0.9, toneMapped: false, depthWrite: false, blending: GFX.AdditiveBlending }));
        m.rotation.x = Math.PI / 2;
        m.position.set(x, y + 0.08 + k * 0.25, z);
        m.scale.setScalar(0.2);
        group.add(m);
        rings.push({ mesh: m, age: -k * 0.08, life: 0.55, reach });
      }
      for (let i = 0; i < 18; i++) {
        const m = new GFX.Mesh(mote, glow(colour));
        const a = (i / 18) * Math.PI * 2;
        spawn(m, { x, y: y + 0.3, z, vx: Math.cos(a) * 6, vy: 0.6, vz: Math.sin(a) * 6, life: 0.45, floaty: 0, drag: 3, bounce: 0, spin: 0 });
      }
    },

    /** Caught: drops of juice flung out of Blubber. */
    splash(x, y, z) {
      for (let i = 0; i < 16; i++) {
        const m = new GFX.Mesh(drop, juice);
        m.scale.setScalar(0.6 + Math.random() * 0.7);
        const [ox, oy, oz] = outward(3, 4);
        spawn(m, { x, y, z, vx: ox, vy: oy, vz: oz, life: 0.7 + Math.random() * 0.4, spin: 4, bounce: 0.25 });
      }
    },

    /** Earth thrown up by a hand coming out of the ground. */
    dust(x, y, z, n = 10) {
      for (let i = 0; i < n; i++) {
        const m = new GFX.Mesh(grit, dirt);
        const [ox, oy, oz] = outward(1.6, 2.4);
        spawn(m, { x, y: y + 0.05, z, vx: ox, vy: oy, vz: oz, life: 0.5 + Math.random() * 0.4, spin: 12, bounce: 0.3 });
      }
    },

    update(dt) {
      for (let i = bits.length - 1; i >= 0; i--) {
        const b = bits[i];
        b.age += dt;
        if (b.age >= b.life) {
          group.remove(b.mesh);
          bits.splice(i, 1);
          continue;
        }
        const m = b.mesh;
        b.vy -= GRAVITY * b.floaty * dt;
        const k = Math.max(0, 1 - b.drag * dt);
        b.vx *= k; b.vy *= b.drag ? Math.max(0, 1 - b.drag * 0.5 * dt) : 1; b.vz *= k;
        m.position.x += b.vx * dt;
        m.position.y += b.vy * dt;
        m.position.z += b.vz * dt;
        const ground = grounds?.heightAt(m.position.x, m.position.z);
        if (ground != null && b.bounce > 0 && m.position.y < ground + 0.03 && m.position.y > ground - 0.4 && b.vy < 0) {
          m.position.y = ground + 0.03;
          b.vy *= -b.bounce;
          b.vx *= 0.55; b.vz *= 0.55;
          b.spin = b.spin.map((s) => s * 0.5);
        }
        m.rotation.x += b.spin[0] * dt;
        m.rotation.y += b.spin[1] * dt;
        m.rotation.z += b.spin[2] * dt;
        const fade = Math.min(1, (b.life - b.age) / 0.4);
        m.scale.setScalar(b.scale * fade * (1 + b.grow * (b.age / b.life)));
      }
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        r.age += dt;
        if (r.age >= r.life) {
          group.remove(r.mesh);
          rings.splice(i, 1);
          continue;
        }
        const t = Math.max(0, r.age / r.life);
        r.mesh.scale.setScalar(0.2 + r.reach * (1 - (1 - t) * (1 - t)));
        r.mesh.material.opacity = 0.9 * (1 - t);
      }
    },
  };
}
