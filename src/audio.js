import { createScore } from './score.js';

/**
 * Every sound, made on the spot with Web Audio — no samples — as Dungeon
 * Roller does it. A soft airy whoosh as Blubber floats, rising with its
 * speed; a bright plink for each sweet, climbing the scale as a trail is
 * eaten up; a whoomp and a chime as a lantern catches; a hollow,
 * wavering "oooo" when Blubber spooks; a squelch when it is caught; a
 * swell of bells as the moon gate opens; twelve tolls at midnight. The
 * music is a score of its own (score.js), a tune for each season.
 *
 * Nothing can play until the page has had a click or a key (browsers insist),
 * so `wake()` is called on the first one.
 */

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

/** A major pentatonic, for the trail of sweets to climb. */
const PENTA = [0, 2, 4, 7, 9];

export function createAudio() {
  let ctx = null, master = null, sfx = null, music = null, noise = null;
  let air = null;
  let muted = false;
  let score = null;
  let chain = 0, chainAt = 0;

  try { muted = localStorage.getItem('blubber.muted') === '1'; } catch {}

  function wake() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.8;
    master.connect(ctx.destination);
    sfx = ctx.createGain();
    sfx.gain.value = 0.85;
    sfx.connect(master);
    music = ctx.createGain();
    music.gain.value = 0.55;
    music.connect(master);
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    // The float: breathy noise through a band that rises with speed.
    const source = ctx.createBufferSource();
    source.buffer = noise;
    source.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 500;
    band.Q.value = 1.4;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    source.connect(band).connect(gain).connect(sfx);
    source.start();
    air = { band, gain };
  }

  const now = () => ctx.currentTime;

  function tone({ at = 0, freq = 440, to = null, length = 0.15, type = 'sine', gain = 0.3, attack = 0.005 }) {
    if (!ctx) return;
    const t = now() + at;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + length);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + length);
    o.connect(g).connect(sfx);
    o.start(t);
    o.stop(t + length + 0.05);
  }

  function burst({ at = 0, length = 0.1, type = 'lowpass', freq = 1000, q = 0.7, gain = 0.5, sweep = null }) {
    if (!ctx) return;
    const t = now() + at;
    const s = ctx.createBufferSource();
    s.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + length);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + length);
    s.connect(f).connect(g).connect(sfx);
    s.start(t, Math.random() * 1.5);
    s.stop(t + length + 0.05);
  }

  /** A sung vowel: a buzz through two formant bands, gliding from `from` to `to` (MIDI), wavering. */
  function voice({ from, to, length, gain = 0.2, formants = [400, 800], at = 0 }) {
    if (!ctx) return;
    const t = now() + at;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(NOTE(from), t);
    o.frequency.exponentialRampToValueAtTime(NOTE(to), t + length);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 6.5;
    const depth = ctx.createGain();
    depth.gain.value = 18;
    lfo.connect(depth).connect(o.detune);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.08);
    g.gain.setValueAtTime(gain, t + length * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + length);
    for (const f of formants) {
      const b = ctx.createBiquadFilter();
      b.type = 'bandpass';
      b.frequency.value = f;
      b.Q.value = 6;
      o.connect(b).connect(g);
    }
    g.connect(sfx);
    o.start(t); lfo.start(t);
    o.stop(t + length + 0.05); lfo.stop(t + length + 0.05);
  }

  /** A bell: struck partials ringing down. */
  function bell(note, { at = 0, gain = 0.12, length = 2.2 } = {}) {
    for (const [ratio, g] of [[1, 1], [2.01, 0.5], [2.98, 0.3], [4.2, 0.18], [5.4, 0.1]]) {
      tone({ at, freq: NOTE(note) * ratio, length: length / Math.sqrt(ratio), gain: gain * g, attack: 0.003 });
    }
  }

  return {
    wake,

    get muted() { return muted; },

    toggleMute() {
      muted = !muted;
      try { localStorage.setItem('blubber.muted', muted ? '1' : '0'); } catch {}
      if (master) master.gain.setTargetAtTime(muted ? 0 : 0.8, now(), 0.05);
      return muted;
    },

    /** The whoosh of floating, every frame: speed in tiles a second. */
    floating(speed) {
      if (!air) return;
      air.gain.gain.setTargetAtTime(Math.min(0.09, speed * 0.016), now(), 0.08);
      air.band.frequency.setTargetAtTime(380 + speed * 120, now(), 0.1);
    },

    /** A sweet: a plink, a step higher each time if they come quick, back down when the trail goes cold. */
    candy(big = false) {
      if (!ctx) return;
      if (now() - chainAt > 0.6) chain = 0;
      chainAt = now();
      const n = 76 + Math.floor(chain / 5) * 12 + PENTA[chain % 5];
      chain = Math.min(chain + 1, 14);
      tone({ freq: NOTE(n), length: 0.12, type: 'triangle', gain: 0.1 });
      tone({ freq: NOTE(n + 12), length: 0.08, type: 'sine', gain: 0.05, at: 0.02 });
      if (big) [0, 4, 7, 12].forEach((k, i) => tone({ at: 0.05 + i * 0.06, freq: NOTE(84 + k), length: 0.22, type: 'triangle', gain: 0.09 }));
    },

    /** A lantern catching: the whoomp of the flame, then a chime. */
    lantern() {
      burst({ length: 0.45, type: 'lowpass', freq: 200, sweep: 1600, q: 1.2, gain: 0.6 });
      tone({ freq: 90, to: 160, length: 0.35, gain: 0.25 });
      [72, 76, 79, 84].forEach((n, i) => tone({ at: 0.18 + i * 0.07, freq: NOTE(n), length: 0.5, type: 'triangle', gain: 0.08 }));
    },

    /** The moon gate opening: bells, rising. */
    gate() {
      [60, 67, 72, 76, 79, 84].forEach((n, i) => bell(n, { at: i * 0.14, gain: 0.07 }));
      burst({ length: 1.6, type: 'bandpass', freq: 600, sweep: 4000, q: 2, gain: 0.15 });
    },

    /** Blubber spooking: a hollow "oooo", wavering down; a little shriek for each thing it scared. */
    spook(scared = 0) {
      voice({ from: 62, to: 50, length: 0.75, gain: 0.22, formants: [350, 650] });
      voice({ from: 69, to: 57, length: 0.7, gain: 0.08, formants: [330, 600], at: 0.02 });
      for (let i = 0; i < Math.min(3, scared); i++) tone({ at: 0.25 + i * 0.09, freq: NOTE(84 + i * 3), to: NOTE(96 + i * 3), length: 0.12, type: 'square', gain: 0.03 });
    },

    /** Caught: a squelch, and the candy spilling. */
    caught(lost = 0) {
      burst({ length: 0.25, type: 'lowpass', freq: 900, sweep: 160, q: 6, gain: 0.5 });
      tone({ freq: 260, to: 90, length: 0.3, type: 'sine', gain: 0.25 });
      for (let i = 0; i < Math.min(5, lost); i++) tone({ at: 0.08 + i * 0.05, freq: NOTE(84 - i * 2), length: 0.08, type: 'triangle', gain: 0.06 });
    },

    /** Bumping into a wall hard: a soft, jelly thud. */
    bump(speed) {
      const k = Math.min(1, speed / 6);
      tone({ freq: 140, to: 70, length: 0.12, gain: 0.12 * k });
    },

    /** A night starting: a little phrase in its season's way. */
    night(season) {
      const phrase = { halloween: [62, 65, 69, 68], harvest: [67, 71, 74, 79], winter: [64, 67, 71, 76] }[season] ?? [62, 65, 69];
      phrase.forEach((n, i) => tone({ at: i * 0.14, freq: NOTE(n), length: 0.32, type: 'triangle', gain: 0.1 }));
    },

    /** Out through the gate: a whoosh up and away, and a happy run. */
    escape() {
      burst({ length: 1, type: 'bandpass', freq: 400, sweep: 5000, q: 1.5, gain: 0.3 });
      [72, 76, 79, 84, 88].forEach((n, i) => tone({ at: 0.2 + i * 0.09, freq: NOTE(n), length: 0.3, type: 'triangle', gain: 0.1 }));
    },

    /** The tally's moons, one bell for each. */
    tally(moons) {
      for (let i = 0; i < moons; i++) bell(79 + i * 5, { at: 0.35 + i * 0.25, gain: 0.08, length: 1.6 });
    },

    /** Midnight: twelve tolls, far off. */
    midnight() {
      for (let i = 0; i < 12; i++) bell(43, { at: i * 0.9, gain: 0.06, length: 2.4 });
    },

    startMusic(season, night = 0) {
      if (!ctx) return;
      score ??= createScore(ctx, music, noise);
      if (score.playing) return;
      score.start(season, night);
    },

    stopMusic() {
      score?.stop();
    },
  };
}
