/**
 * The music, played live with Web Audio — no samples. Blubber is a ghost
 * out for a big night, so each season gets a proper dance track: a kit
 * (kick, clap, snare, hats, crashes, risers and snare rolls), a bass that
 * pumps against the kick, and the season's own band riding on top.
 *
 *  - October: spooky electro. A galloping bass, a harpsichord arpeggio in
 *    sixteenths, a theremin on the tune, an organ joining it for the last
 *    drop, and a bell tolling in each one.
 *  - November: a barn-dance stomp. Four to the floor with claps and a
 *    tambourine, an offbeat bass, a banjo rolling the chords, a fiddle on
 *    the tune.
 *  - December: future bass. A half-time kit with trap hats, supersaw
 *    chords pumping hard, a sub, a music box on the tune, sleigh bells
 *    all the way through.
 *
 * The tune is eight bars, and the track is built round it: a short intro
 * with the filter opening, then a drop, a lift with the tune doubled, a
 * breakdown that builds to a snare roll, and a second, bigger drop, then
 * round again from the first drop. Each night of a season moves the key
 * up a step and the tempo up a touch. Notes are scheduled a little ahead
 * of time, so the beat stays steady whatever the frame rate does.
 */

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

/** Chords as semitones over their root. */
const MIN = [0, 3, 7], MAJ = [0, 4, 7], DOM = [0, 4, 7, 10];

/**
 * The tunes, all in 4/4. `bars` are chords [root over the key, shape];
 * `tune` is [beat, semitones over the key, beats long], beats counted from
 * the start of the eight bars.
 */
export const SONGS = {
  halloween: {
    key: 50, tempo: 124, pump: 0.3,
    bars: [[0, MIN], [0, MIN], [5, MIN], [7, DOM], [0, MIN], [8, MAJ], [5, MIN], [7, DOM]],
    tune: [
      [0, 12, 1.5], [1.5, 15, 0.5], [2, 14, 1], [3, 12, 1],
      [4, 11, 1], [5, 12, 1], [6, 7, 2],
      [8, 17, 1.5], [9.5, 15, 0.5], [10, 14, 1], [11, 12, 1],
      [12, 14, 1], [13, 11, 1], [14, 7, 2],
      [16, 12, 1.5], [17.5, 15, 0.5], [18, 19, 1], [19, 20, 1],
      [20, 19, 1], [21, 15, 1], [22, 12, 2],
      [24, 17, 1], [25, 15, 1], [26, 14, 1], [27, 11, 1],
      [28, 12, 3],
    ],
  },
  harvest: {
    key: 55, tempo: 128, pump: 0.4,
    bars: [[0, MAJ], [5, MAJ], [0, MAJ], [7, MAJ], [0, MAJ], [5, MAJ], [7, DOM], [0, MAJ]],
    tune: [
      [0, 7, 0.5], [0.5, 9, 0.5], [1, 11, 0.5], [1.5, 12, 0.5], [2, 14, 1], [3, 12, 1],
      [4, 9, 0.5], [4.5, 12, 0.5], [5, 17, 1], [6, 16, 1], [7, 14, 1],
      [8, 12, 0.5], [8.5, 11, 0.5], [9, 12, 0.5], [9.5, 14, 0.5], [10, 16, 1], [11, 12, 1],
      [12, 14, 1], [13, 11, 1], [14, 7, 2],
      [16, 7, 0.5], [16.5, 9, 0.5], [17, 11, 0.5], [17.5, 12, 0.5], [18, 14, 1], [19, 16, 1],
      [20, 17, 1], [21, 14, 0.5], [21.5, 12, 0.5], [22, 9, 1], [23, 12, 1],
      [24, 11, 1], [25, 14, 1], [26, 17, 0.5], [26.5, 16, 0.5], [27, 14, 1],
      [28, 12, 3],
    ],
  },
  winter: {
    key: 52, tempo: 140, pump: 0.12,
    bars: [[0, MIN], [8, MAJ], [3, MAJ], [10, MAJ], [0, MIN], [8, MAJ], [5, MIN], [7, DOM]],
    tune: [
      [0, 19, 1.5], [1.5, 17, 0.5], [2, 15, 1], [3, 12, 1],
      [4, 15, 1.5], [5.5, 17, 0.5], [6, 19, 1], [7, 20, 1],
      [8, 22, 1.5], [9.5, 19, 0.5], [10, 15, 1], [11, 19, 1],
      [12, 17, 2], [14, 14, 1], [15, 17, 1],
      [16, 19, 1.5], [17.5, 17, 0.5], [18, 15, 1], [19, 24, 1],
      [20, 24, 1], [21, 22, 0.5], [21.5, 20, 0.5], [22, 19, 2],
      [24, 17, 1], [25, 20, 1], [26, 24, 1], [27, 22, 1],
      [28, 23, 1.5], [29.5, 21, 0.5], [30, 19, 2],
    ],
  },
};

/** The shape of the track, in bars: the intro once, then the rest round and round. */
const INTRO = 4;
const CYCLE = [['drop', 8], ['lift', 8], ['break', 8], ['drop2', 8]];
const ROUND = CYCLE.reduce((n, [, bars]) => n + bars, 0);

/** Which part of the track bar `bar` is in: { name, bar (into the part), bars (its length) }. */
export function section(bar) {
  if (bar < INTRO) return { name: 'intro', bar, bars: INTRO };
  let b = (bar - INTRO) % ROUND;
  for (const [name, bars] of CYCLE) {
    if (b < bars) return { name, bar: b, bars };
    b -= bars;
  }
}

/** How loud the music comes out, after the squeeze: enough to have weight, still under the sounds. */
const TRIM = 0.5;

export function createScore(ctx, out, noise) {
  const bus = ctx.createGain();
  bus.gain.value = 0.9;
  // Squeezed together so the kick drives it, then trimmed back down (the compressor adds gain of its own).
  const glue = ctx.createDynamicsCompressor();
  glue.threshold.value = -18;
  glue.knee.value = 8;
  glue.ratio.value = 4;
  glue.attack.value = 0.006;
  glue.release.value = 0.14;
  const trim = ctx.createGain();
  trim.gain.value = TRIM;
  bus.connect(glue).connect(trim).connect(out);
  const room = ctx.createConvolver();
  room.buffer = impulse(ctx, 2.4, 2.8);
  const wet = ctx.createGain();
  wet.gain.value = 0.5;
  room.connect(wet).connect(bus);

  /** This start's own nodes, faded out together on stop. */
  let target = null, pump = null, sends = null, echo = null;
  let timer = null;
  let song = null, transpose = 0, tempo = 120;
  let beat = 0, at = 0;

  const env = (g, when, peak, attack, decay) => {
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(peak, when + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, when + attack + decay);
    return when + attack + decay + 0.05;
  };
  /** A held note: in over `attack`, held to `length`, out over `release`. */
  const hold = (g, when, peak, attack, length, release) => {
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(peak, when + attack);
    g.gain.setValueAtTime(peak, when + Math.max(attack + 0.01, length));
    g.gain.exponentialRampToValueAtTime(0.0001, when + Math.max(attack + 0.01, length) + release);
    return when + Math.max(attack + 0.01, length) + release + 0.05;
  };
  /** A voice's gain: into the dry mix or the pumped one, with as much room and echo as it wants. */
  const voice = ({ pumped = false, room: r = 0, delay = 0 } = {}) => {
    const g = ctx.createGain();
    g.connect(pumped ? pump : target);
    if (r) { const s = ctx.createGain(); s.gain.value = r; g.connect(s).connect(sends); }
    if (delay) { const s = ctx.createGain(); s.gain.value = delay; g.connect(s).connect(echo); }
    return g;
  };
  const osc = (type, freq, when, end, dest, detune = 0) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, when);
    o.detune.value = detune;
    o.connect(dest);
    o.start(when);
    o.stop(end);
    return o;
  };
  const filtered = (type, freq, q, dest) => {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    f.connect(dest);
    return f;
  };
  const hiss = (when, length, dest) => {
    const s = ctx.createBufferSource();
    s.buffer = noise;
    s.connect(dest);
    s.start(when, Math.random() * 1.5);
    s.stop(when + length + 0.05);
    return s;
  };

  // ———————————————— the kit

  /** The kick: a sine thudding down, a click on the front, and everything pumped ducks under it. */
  const kick = (when, gain = 0.85) => {
    const g = voice();
    const end = env(g, when, gain, 0.002, 0.42);
    const o = osc('sine', 165, when, end, g);
    o.frequency.exponentialRampToValueAtTime(48, when + 0.11);
    o.frequency.exponentialRampToValueAtTime(40, when + 0.4);
    const c = voice();
    env(c, when, gain * 0.25, 0.001, 0.012);
    hiss(when, 0.02, filtered('highpass', 2500, 0.7, c));
    duck(when);
  };
  const duck = (when) => {
    const depth = song.pump;
    pump.gain.setValueAtTime(1, when);
    pump.gain.linearRampToValueAtTime(depth, when + 0.012);
    pump.gain.setTargetAtTime(1, when + 0.03, 60 / tempo * 0.22);
  };
  /** A snare: a crack of noise over a short drum tone. `up` raises it, for the rolls. */
  const snare = (when, gain = 0.3, up = 0) => {
    const g = voice({ room: 0.25 });
    env(g, when, gain, 0.001, 0.17);
    hiss(when, 0.2, filtered('highpass', 1200 + up * 2000, 0.7, g));
    const t = voice();
    const end = env(t, when, gain * 0.7, 0.001, 0.09);
    const o = osc('triangle', 230 + up * 300, when, end, t);
    o.frequency.exponentialRampToValueAtTime(160 + up * 260, when + 0.08);
  };
  /** A clap: three quick slaps of noise and a tail. */
  const clap = (when, gain = 0.32) => {
    const g = voice({ room: 0.35 });
    const p = g.gain;
    p.setValueAtTime(0.0001, when);
    for (const k of [0, 0.011, 0.022]) {
      p.setValueAtTime(gain, when + k);
      p.exponentialRampToValueAtTime(gain * 0.15, when + k + 0.009);
    }
    p.setValueAtTime(gain, when + 0.033);
    p.exponentialRampToValueAtTime(0.0001, when + 0.24);
    hiss(when, 0.26, filtered('bandpass', 1300, 1.1, g));
  };
  /** A hi-hat, closed or open. */
  const hat = (when, gain = 0.07, open = false) => {
    const g = voice();
    env(g, when, gain, 0.001, open ? 0.24 : 0.035);
    hiss(when, open ? 0.26 : 0.05, filtered('highpass', 7800, 0.8, g));
  };
  /** A shaker of jingles: a tambourine, or sleigh bells. */
  const jingle = (when, gain = 0.05, kind = 'tamb') => {
    const g = voice({ room: kind === 'bells' ? 0.3 : 0.1 });
    env(g, when, gain, 0.003, kind === 'bells' ? 0.16 : 0.09);
    hiss(when, 0.2, filtered('bandpass', kind === 'bells' ? 7200 : 9200, kind === 'bells' ? 7 : 1.6, g));
  };
  /** A crash on the first beat of a part. */
  const crash = (when, gain = 0.13) => {
    const g = voice({ room: 0.5 });
    env(g, when, gain, 0.002, 1.9);
    hiss(when, 2, filtered('highpass', 4200, 0.6, g));
  };
  /** A deep boom under the crash, as a drop lands. */
  const boom = (when, gain = 0.5) => {
    const g = voice();
    const end = env(g, when, gain, 0.004, 1.3);
    const o = osc('sine', 90, when, end, g);
    o.frequency.exponentialRampToValueAtTime(32, when + 1.2);
  };
  /** Noise swelling and sweeping up over `length` seconds, into a drop. */
  const riser = (when, length, gain = 0.12) => {
    const g = voice({ room: 0.4 });
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain, when + length);
    g.gain.exponentialRampToValueAtTime(0.0001, when + length + 0.05);
    const f = filtered('bandpass', 300, 2.5, g);
    f.frequency.setValueAtTime(300, when);
    f.frequency.exponentialRampToValueAtTime(7000, when + length);
    hiss(when, length + 0.1, f);
  };

  // ———————————————— the instruments

  /** A bass: a saw and a square under a lowpass that snaps shut; `open` (0 to 1) is how far the filter lets it out. */
  const bass = (note, when, length, gain = 0.2, open = 1, sub = true) => {
    const g = voice({ pumped: true });
    const top = 160 + 1800 * open * open;
    const f = filtered('lowpass', top, 6, g);
    f.frequency.setValueAtTime(top, when);
    f.frequency.exponentialRampToValueAtTime(Math.max(90, top * 0.25), when + length);
    const end = hold(g, when, gain, 0.004, length * 0.85, 0.05);
    osc('sawtooth', NOTE(note), when, end, f, -6);
    osc('square', NOTE(note), when, end, f, 6);
    if (sub) {
      const s = voice({ pumped: true });
      hold(s, when, gain * 0.8, 0.004, length * 0.85, 0.05);
      osc('sine', NOTE(note - 12), when, end, s);
    }
  };
  /** A sub: a plain sine, felt more than heard. */
  const subBass = (note, when, length, gain = 0.32) => {
    const g = voice({ pumped: true });
    const end = hold(g, when, gain, 0.01, length, 0.08);
    osc('sine', NOTE(note), when, end, g);
    const h = voice({ pumped: true });
    hold(h, when, gain * 0.12, 0.01, length, 0.08);
    osc('triangle', NOTE(note + 12), when, end, h);
  };
  /** A plucked string, banjo or otherwise: a bright saw dying quickly through a closing filter. */
  const pluck = (note, when, length, gain = 0.06, bright = 3200, opts = {}) => {
    const g = voice({ pumped: true, ...opts });
    const f = filtered('lowpass', bright, 2, g);
    f.frequency.setValueAtTime(bright, when);
    f.frequency.exponentialRampToValueAtTime(260, when + length);
    const end = env(g, when, gain, 0.003, length);
    osc('sawtooth', NOTE(note), when, end, f);
    osc('triangle', NOTE(note + 12), when, end, f);
  };
  /** A harpsichord: two thin detuned squares, a hard attack, gone fast. */
  const harpsichord = (note, when, gain = 0.04, open = 1, opts = { pumped: true, delay: 0.15 }) => {
    const g = voice(opts);
    const f = filtered('highpass', 300, 0.7, g);
    const l = filtered('lowpass', 900 + 7000 * open * open, 0.7, f);
    const end = env(g, when, gain, 0.002, 0.3);
    osc('square', NOTE(note), when, end, l, -4);
    osc('square', NOTE(note + 12), when, end, l, 5);
  };
  /** The theremin: a pure tone sliding up to each note, with a wide slow vibrato. */
  let thereminFreq = null;
  const theremin = (note, when, length, gain = 0.1) => {
    const g = voice({ room: 0.5, delay: 0.3 });
    hold(g, when, gain, 0.06, length, 0.08);
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(thereminFreq ?? NOTE(note), when);
    o.frequency.exponentialRampToValueAtTime(NOTE(note), when + 0.08);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5.5;
    const depth = ctx.createGain();
    depth.gain.setValueAtTime(0, when);
    depth.gain.linearRampToValueAtTime(NOTE(note) * 0.012, when + Math.min(0.4, length));
    lfo.connect(depth).connect(o.frequency);
    // A touch of its octave, to cut through the drums.
    const h = ctx.createGain();
    h.gain.value = 0.18;
    o.connect(g);
    const o2 = osc('triangle', NOTE(note + 12), when, when + length + 0.15, h);
    depth.connect(o2.frequency);
    h.connect(g);
    o.start(when); lfo.start(when);
    o.stop(when + length + 0.15); lfo.stop(when + length + 0.15);
    thereminFreq = NOTE(note);
  };
  /** An organ: stacked saws an octave apart through a growling lowpass. */
  const organ = (note, when, length, gain = 0.05) => {
    const g = voice({ room: 0.35, delay: 0.15 });
    const f = filtered('lowpass', 2200, 3, g);
    const end = hold(g, when, gain, 0.01, length, 0.1);
    osc('sawtooth', NOTE(note), when, end, f, -8);
    osc('sawtooth', NOTE(note), when, end, f, 8);
    osc('square', NOTE(note - 12), when, end, f);
  };
  /** The fiddle: a saw with a little vibrato and a bow-like swell. */
  const fiddle = (note, when, length, gain = 0.075) => {
    const g = voice({ room: 0.35, delay: 0.2 });
    const f = filtered('bandpass', 1900, 0.8, g);
    const end = hold(g, when, gain, 0.035, length, 0.08);
    for (const d of [-5, 5]) {
      const o = osc('sawtooth', NOTE(note), when, end, f, d);
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 6;
      const depth = ctx.createGain();
      depth.gain.value = 7;
      lfo.connect(depth).connect(o.detune);
      lfo.start(when); lfo.stop(end);
    }
  };
  /** The music box: a sine and its bright overtone, struck and ringing. */
  const musicbox = (note, when, length, gain = 0.1) => {
    const g = voice({ room: 0.45, delay: 0.3 });
    const end = env(g, when, gain, 0.003, Math.min(1.4, length + 0.6));
    osc('sine', NOTE(note + 12), when, end, g);
    const h = ctx.createGain();
    h.gain.value = 0.3;
    h.connect(g);
    osc('sine', NOTE(note + 12) * 4.07, when, end, h);
  };
  /** A supersaw: each note a stack of detuned saws, pumping, for chords that hit. */
  const supersaw = (notes, when, length, gain = 0.022, open = 1) => {
    const g = voice({ pumped: true, room: 0.3 });
    const top = 700 + 6000 * open * open;
    const f = filtered('lowpass', top, 1, g);
    const end = hold(g, when, gain, 0.006, length, 0.12);
    for (const n of notes) for (const d of [-16, 0, 16]) osc('sawtooth', NOTE(n), when, end, f, d);
  };
  /** A soft pad of the chord. */
  const pad = (notes, when, length, gain = 0.02, wave = 'sawtooth', bright = 1100) => {
    const g = voice({ pumped: true, room: 0.5 });
    const f = filtered('lowpass', bright, 0.6, g);
    const end = hold(g, when, gain, 0.35, length, 0.5);
    for (const n of notes) {
      osc(wave, NOTE(n), when, end, f, -8);
      osc(wave, NOTE(n), when, end, f, 8);
    }
  };
  /** A bell: struck partials ringing down. */
  const bell = (note, when, gain = 0.06) => {
    for (const [ratio, k] of [[1, 1], [2.01, 0.5], [2.98, 0.32], [4.2, 0.2], [5.4, 0.12]]) {
      const g = voice({ room: 0.6 });
      const end = env(g, when, gain * k, 0.003, 2.4 / Math.sqrt(ratio));
      osc('sine', NOTE(note) * ratio, when, end, g);
    }
  };

  // ———————————————— the arrangement

  /** How far the filters are open, 0 to 1: shut at the start of the intro and the breakdown, opening up into each drop. */
  const openness = ({ name, bar }, inBar) => {
    const t = bar * 4 + inBar;
    if (name === 'intro') return 0.15 + 0.7 * t / (INTRO * 4);
    if (name === 'break') return bar < 4 ? 0.3 : 0.3 + 0.65 * (t - 16) / 16;
    return 1;
  };

  /** The drums for one beat. `half` is the half-time kit, for December. */
  function drums(sec, inBar, when, spb, half) {
    const { name, bar, bars } = sec;
    const lastBar = bar === bars - 1;
    if (bar === 0 && inBar === 0 && name !== 'intro') {
      crash(when, name === 'break' ? 0.08 : 0.13);
      if (name !== 'break') boom(when, name === 'drop2' ? 0.55 : 0.4);
    }

    if (name === 'break') {
      // The kick drops out. Then the build: a riser over the last four bars,
      // a snare roll over the last two, quicker and higher, and a breath before the drop.
      if (bar === bars - 4 && inBar === 0) riser(when, spb * 16 - 0.02);
      if (bar >= bars - 2) {
        const per = lastBar ? 4 : 2;
        for (let i = 0; i < per; i++) {
          if (lastBar && inBar === 3 && i >= 2) break;
          const k = ((bar - (bars - 2)) * 4 + inBar + i / per) / 8;
          snare(when + i * spb / per, 0.06 + 0.22 * k, k);
        }
      }
      if (bar >= bars - 4 && bar < bars - 2 && inBar % 2 === 0) kick(when, 0.5);
      return;
    }

    if (name === 'intro') {
      kick(when, 0.75);
      hat(when + spb / 2, 0.05);
      if (lastBar) {
        if (inBar === 0) riser(when, spb * 4 - 0.02);
        for (let i = 0; i < 4; i++) if (!(inBar === 3 && i >= 2)) snare(when + i * spb / 4, 0.08 + 0.05 * inBar, inBar / 4);
      }
      return;
    }

    const big = name === 'lift' || name === 'drop2';
    if (half) {
      // Kick on one and the and-of-two, the snare and clap together on three, hats in eighths with a roll.
      if (inBar === 0) kick(when);
      if (inBar === 1) kick(when + spb / 2, 0.7);
      if (inBar === 3 && bar % 2 === 1) kick(when + spb / 2, 0.6);
      if (inBar === 2) { snare(when, 0.22); clap(when, 0.28); }
      if (inBar === 3 && bar % 2 === 1) {
        for (let i = 0; i < 6; i++) hat(when + i * spb / 6, 0.03 + i * 0.008);
      } else {
        hat(when, 0.06); hat(when + spb / 2, big ? 0.05 : 0.035, big && inBar % 2 === 1);
      }
    } else {
      // Four to the floor, the clap on two and four, sixteenth hats leaning on the offbeat.
      kick(when);
      if (inBar % 2 === 1) { clap(when); if (big) snare(when, 0.12); }
      const lean = [0.025, 0.02, 0.07, 0.02];
      for (let i = 0; i < 4; i++) {
        if (i === 2 && big) hat(when + spb / 2, 0.05, true);
        else hat(when + i * spb / 4, lean[i]);
      }
      // A fill into the next part.
      if (lastBar && inBar === 3) for (let i = 0; i < 4; i++) snare(when + i * spb / 4, 0.1 + i * 0.04, i / 4);
    }
  }

  /** Everything that sounds on one beat. */
  function play(b, when) {
    const s = song, spb = 60 / tempo;
    const barNo = Math.floor(b / 4), inBar = b % 4;
    const sec = section(barNo);
    const { name, bar } = sec;
    const phrase = bar % 8;
    const [root, shape] = s.bars[phrase];
    const key = s.key + transpose;
    const chord = shape.map((n) => key + root + n);
    const open = openness(sec, inBar);
    const loopBeat = phrase * 4 + inBar;
    const tune = s.tune.filter(([t]) => t >= loopBeat && t < loopBeat + 1);
    const full = name === 'drop' || name === 'lift' || name === 'drop2';
    const building = name === 'break' && bar >= 4;
    const sings = full || (name === 'break' && bar < 6);
    const at16 = (i) => when + i * spb / 4;

    if (s === SONGS.halloween) {
      drums(sec, inBar, when, spb, false);
      // The bass gallops round the kick: root, its octave, root, off the beat.
      if (full || building || name === 'intro') {
        [null, 0, 12, 0].forEach((k, i) => k !== null && bass(key + root + k - 24, at16(i), spb / 4, 0.17, open, k === 0));
      }
      // The harpsichord climbs and falls through the chord in sixteenths.
      const tones = [chord[0], chord[1], chord[2], chord[0] + 12];
      const order = [0, 1, 2, 3, 2, 1, 2, 3];
      if (name !== 'break' || building) {
        for (let i = 0; i < 4; i++) harpsichord(tones[order[(inBar * 4 + i) % 8]] + 12, at16(i), name === 'drop' ? 0.028 : 0.036, open);
      }
      if ((name === 'break' || name === 'lift') && inBar === 0) pad(chord.map((n) => n + 12), when, spb * 4, name === 'break' ? 0.022 : 0.012, 'square', 1400);
      if (full && bar === 0 && inBar === 0) bell(key + root - 12, when, 0.07);
      if (sings) {
        for (const [t, n, len] of tune) {
          const w = when + (t - loopBeat) * spb;
          theremin(key + n + 12, w, len * spb * 0.95, name === 'break' ? 0.08 : 0.1);
          if (name === 'lift') harpsichord(key + n + 24, w, 0.04, 1, { room: 0.3, delay: 0.25 });
          if (name === 'drop2') organ(key + n, w, len * spb * 0.9, 0.045);
        }
      }
    } else if (s === SONGS.harvest) {
      drums(sec, inBar, when, spb, false);
      if (full) for (let i = 0; i < 4; i++) jingle(at16(i), i % 2 ? 0.035 : 0.05);
      // An offbeat bass, up to the fifth at the end of the bar.
      if (full || building || name === 'intro') {
        bass(key + root + (inBar === 3 ? 7 : 0) - 24, when + spb / 2, spb / 2, 0.2, open);
      }
      // The banjo's forward roll through the chord.
      const tones = [chord[0] + 12, chord[1] + 12, chord[2] + 12];
      const roll = [0, 1, 2, 0, 1, 2, 0, 2];
      if (name !== 'break' || building) {
        for (let i = 0; i < 4; i++) pluck(tones[roll[(inBar * 4 + i) % 8]] + 12, at16(i), spb * 0.45, name === 'drop' ? 0.04 : 0.05, 1200 + 3200 * open);
      }
      if (name === 'break' && inBar === 0) pad(chord.map((n) => n + 12), when, spb * 4, 0.02, 'square', 1600);
      if (sings) {
        for (const [t, n, len] of tune) {
          const w = when + (t - loopBeat) * spb;
          fiddle(key + n + 12, w, len * spb * 0.9);
          if (name === 'lift') fiddle(key + n + 24, w, len * spb * 0.9, 0.035);
          if (name === 'drop2') fiddle(key + n, w, len * spb * 0.9, 0.06);
        }
      }
    } else {
      drums(sec, inBar, when, spb, true);
      // Sleigh bells all the way through.
      for (let i = 0; i < 4; i++) jingle(at16(i), i === 0 ? 0.06 : 0.035, 'bells');
      const notes = [...chord.map((n) => n + 12), chord[0] + 24];
      if (full) {
        // The chords hit in a syncopated stab, pumping hard under the kick.
        for (const [i, len] of [[0, 1.5], [3, 1.5], [6, 1.5], [10, 1.5], [12, 1], [14, 1.5]]) {
          if (Math.floor(i / 4) === inBar) supersaw(notes, at16(i % 4), len * spb / 4, name === 'drop' ? 0.018 : 0.022);
        }
        if (inBar % 2 === 0) subBass(key + root - 24, when, spb * 2 * 0.9);
      } else if (inBar === 0) {
        supersaw(notes, when, spb * 4 * 0.9, 0.014, open);
        if (name === 'intro' || building) subBass(key + root - 24, when, spb * 4 * 0.9, 0.22);
      }
      if (sings) {
        for (const [t, n, len] of tune) {
          const w = when + (t - loopBeat) * spb;
          musicbox(key + n, w, len * spb);
          if (name === 'lift' || name === 'drop2') musicbox(key + n + 12, w, len * spb, 0.045);
          if (name === 'drop2') pluck(key + n, w, Math.min(0.5, len * spb), 0.05, 4000, { room: 0.3, delay: 0.25 });
        }
      }
    }
  }

  function schedule() {
    const spb = 60 / tempo;
    // Back from a hidden tab: skip what was missed rather than play it all at once, but keep to the bar.
    while (at < ctx.currentTime) { at += spb; beat += 1; }
    const ahead = ctx.currentTime + 0.2;
    while (at < ahead) {
      play(beat, at);
      at += spb;
      beat += 1;
    }
  }

  return {
    get playing() { return timer !== null; },
    /** Starts the season's track, `night` steps up. */
    start(season, night = 0) {
      if (timer) return;
      song = SONGS[season] ?? SONGS.halloween;
      transpose = night % 4;
      tempo = song.tempo + (night % 4) * 2;
      target = ctx.createGain();
      target.connect(bus);
      pump = ctx.createGain();
      pump.connect(target);
      sends = ctx.createGain();
      sends.connect(room);
      // A dotted-eighth echo, darkened a little each time round.
      echo = ctx.createGain();
      const delay = ctx.createDelay(2);
      delay.delayTime.value = 0.75 * 60 / tempo;
      const back = ctx.createGain();
      back.gain.value = 0.35;
      const dark = filtered('lowpass', 3000, 0.5, back);
      echo.connect(delay).connect(dark);
      back.connect(delay);
      back.connect(target);
      thereminFreq = null;
      beat = 0;
      at = ctx.currentTime + 0.1;
      timer = setInterval(schedule, 25);
      schedule();
    },
    stop() {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
      const nodes = [target, sends, echo];
      for (const g of nodes) g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.15);
      setTimeout(() => { for (const g of nodes) g.disconnect(); }, 1200);
    },
  };
}

/** A room's echo: noise dying away, for the convolver. */
function impulse(ctx, seconds, decay) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
  }
  return buffer;
}
