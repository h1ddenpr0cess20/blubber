/**
 * The music, played live with Web Audio — no samples — as Dungeon Roller's
 * is, but lighter on its feet: this is a ghost having a nice night out.
 *
 * Each season has its own little band and tune, eight bars round:
 *  - October: pizzicato bass walking, a harpsichord picking out the
 *    chords, a theremin singing the tune, a tick of brushes.
 *  - November: a jig — a plucked bass going oom-pah, a fiddle on the
 *    tune, a banjo on the chords, a tambourine.
 *  - December: a waltz — a music box on the tune, a soft pad, a bass on
 *    the one, sleigh bells.
 * Each night of a season moves the tune up a step and a touch faster.
 * Notes are scheduled a little ahead of time, so the beat stays steady
 * whatever the frame rate does.
 */

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

/** Chords as semitones over their root. */
const MIN = [0, 3, 7], MAJ = [0, 4, 7], DOM = [0, 4, 7, 10];

/**
 * The tunes. `bars` are chords [root over the key, shape]; `tune` is
 * [beat, semitones over the key, beats long] — beats counted from the
 * start of the eight bars; `beats` to a bar.
 */
export const SONGS = {
  halloween: {
    key: 50, tempo: 118, beats: 4,
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
    key: 55, tempo: 132, beats: 4,
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
    key: 52, tempo: 150, beats: 3,
    bars: [[0, MIN], [5, MIN], [10, MAJ], [3, MAJ], [8, MAJ], [5, MIN], [7, DOM], [0, MIN]],
    tune: [
      [0, 12, 1], [1, 15, 1], [2, 19, 1],
      [3, 17, 2], [5, 15, 1],
      [6, 14, 1], [7, 17, 1], [8, 22, 1],
      [9, 19, 3],
      [12, 20, 1], [13, 19, 1], [14, 17, 1],
      [15, 15, 2], [17, 17, 1],
      [18, 14, 1], [19, 11, 1], [20, 14, 1],
      [21, 12, 3],
    ],
  },
};

export function createScore(ctx, out, noise) {
  const bus = ctx.createGain();
  bus.gain.value = 0.9;
  const glue = ctx.createDynamicsCompressor();
  glue.threshold.value = -16;
  glue.ratio.value = 3;
  const room = ctx.createConvolver();
  room.buffer = impulse(ctx, 2.2, 2.6);
  const wet = ctx.createGain();
  wet.gain.value = 0.32;
  bus.connect(glue);
  bus.connect(room).connect(wet).connect(glue);
  glue.connect(out);

  let target = null;
  let timer = null;
  let song = null, transpose = 0, tempo = 120;
  let beat = 0, at = 0;

  const env = (g, when, peak, attack, decay) => {
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(peak, when + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, when + attack + decay);
    return when + attack + decay + 0.05;
  };
  const voice = () => {
    const g = ctx.createGain();
    g.connect(target);
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

  // ———————————————— the instruments

  /** A plucked string, bass or banjo: a bright saw dying quickly through a closing filter. */
  const pluck = (note, when, length, gain = 0.2, bright = 2400) => {
    const g = voice();
    const f = filtered('lowpass', bright, 2, g);
    f.frequency.setValueAtTime(bright, when);
    f.frequency.exponentialRampToValueAtTime(220, when + length);
    const end = env(g, when, gain, 0.004, length);
    osc('sawtooth', NOTE(note), when, end, f);
    osc('triangle', NOTE(note - 12), when, end, f);
  };
  /** A harpsichord: two thin detuned squares, a hard attack, gone fast. */
  const harpsichord = (note, when, gain = 0.05) => {
    const g = voice();
    const f = filtered('highpass', 300, 0.7, g);
    const end = env(g, when, gain, 0.002, 0.35);
    osc('square', NOTE(note), when, end, f, -4);
    osc('square', NOTE(note + 12), when, end, f, 5);
  };
  /** The theremin: a pure tone sliding up to each note, with a wide slow vibrato. */
  let thereminFreq = null;
  const theremin = (note, when, length, gain = 0.09) => {
    const g = voice();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain, when + 0.08);
    g.gain.setValueAtTime(gain, when + Math.max(0.09, length - 0.08));
    g.gain.exponentialRampToValueAtTime(0.0001, when + length + 0.06);
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(thereminFreq ?? NOTE(note), when);
    o.frequency.exponentialRampToValueAtTime(NOTE(note), when + 0.09);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5.5;
    const depth = ctx.createGain();
    depth.gain.setValueAtTime(0, when);
    depth.gain.linearRampToValueAtTime(NOTE(note) * 0.012, when + Math.min(0.4, length));
    lfo.connect(depth).connect(o.frequency);
    o.connect(g);
    o.start(when); lfo.start(when);
    o.stop(when + length + 0.1); lfo.stop(when + length + 0.1);
    thereminFreq = NOTE(note);
  };
  /** The fiddle: a saw with a little vibrato and a bow-like swell. */
  const fiddle = (note, when, length, gain = 0.06) => {
    const g = voice();
    const f = filtered('bandpass', 1800, 0.8, g);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain, when + 0.04);
    g.gain.setValueAtTime(gain, when + Math.max(0.05, length - 0.05));
    g.gain.exponentialRampToValueAtTime(0.0001, when + length + 0.08);
    const o = osc('sawtooth', NOTE(note), when, when + length + 0.12, f);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 6;
    const depth = ctx.createGain();
    depth.gain.value = 6;
    lfo.connect(depth).connect(o.detune);
    lfo.start(when); lfo.stop(when + length + 0.12);
  };
  /** The music box: a sine and its bright overtone, struck and ringing. */
  const musicbox = (note, when, length, gain = 0.09) => {
    const g = voice();
    const end = env(g, when, gain, 0.003, Math.min(1.6, length + 0.8));
    osc('sine', NOTE(note + 12), when, end, g);
    const h = ctx.createGain();
    h.gain.value = 0.25;
    h.connect(g);
    osc('sine', NOTE(note + 12) * 4.07, when, end, h);
  };
  /** A soft pad of the chord, for the waltz. */
  const pad = (notes, when, length, gain = 0.025) => {
    const g = voice();
    const f = filtered('lowpass', 900, 0.5, g);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain, when + 0.3);
    g.gain.setValueAtTime(gain, when + length - 0.2);
    g.gain.exponentialRampToValueAtTime(0.0001, when + length + 0.4);
    for (const n of notes) {
      osc('sawtooth', NOTE(n), when, when + length + 0.5, f, -7);
      osc('sawtooth', NOTE(n), when, when + length + 0.5, f, 7);
    }
  };
  /** Noise percussion: a brush tick, a tambourine shake, sleigh bells, a soft thump. */
  const hit = (kind, when, gain = 0.1) => {
    const s = ctx.createBufferSource();
    s.buffer = noise;
    const g = voice();
    const freq = { tick: 7000, tamb: 9000, bells: 7500, thump: 140 }[kind];
    const f = filtered(kind === 'thump' ? 'lowpass' : kind === 'bells' ? 'bandpass' : 'highpass', freq, kind === 'bells' ? 8 : 0.8, g);
    const length = { tick: 0.04, tamb: 0.12, bells: 0.18, thump: 0.18 }[kind];
    env(g, when, gain, 0.002, length);
    s.connect(f);
    s.start(when, Math.random());
    s.stop(when + length + 0.05);
    if (kind === 'thump') {
      const og = voice();
      env(og, when, gain * 1.6, 0.003, 0.16);
      const o = osc('sine', 120, when, when + 0.2, og);
      o.frequency.exponentialRampToValueAtTime(48, when + 0.15);
    }
  };

  /** Everything that sounds on one beat. */
  function play(b, when) {
    const s = song, bar = Math.floor(b / s.beats) % s.bars.length, inBar = b % s.beats;
    const spb = 60 / tempo;
    const [root, shape] = s.bars[bar];
    const key = s.key + transpose;
    const chord = shape.map((n) => key + root + n);
    const loopBeat = b % (s.bars.length * s.beats);
    const tune = s.tune.filter(([t]) => t >= loopBeat && t < loopBeat + 1);
    if (s === SONGS.halloween) {
      // Bass walking up and back, a harpsichord in eighths, the theremin, the brushes.
      const walk = [0, 7, 12, 7][inBar];
      pluck(key + root + walk - 24, when, spb * 0.5, 0.2, 900);
      for (const half of [0, 0.5]) harpsichord(chord[(inBar * 2 + half * 2) % chord.length] + 12, when + half * spb, 0.035);
      for (const [t, n, len] of tune) theremin(key + n, when + (t - loopBeat) * spb, len * spb * 0.95);
      hit('tick', when + spb * 0.5, 0.05);
      if (inBar === 0) hit('thump', when, 0.12);
    } else if (s === SONGS.harvest) {
      // Oom-pah, the banjo rolling the chord, the fiddle on top, the tambourine.
      pluck(key + root + (inBar % 2 ? 7 : 0) - 24, when, spb * 0.4, 0.22, 700);
      for (const q of [0, 0.5]) pluck(chord[(inBar * 2 + q * 2) % chord.length] + 12, when + q * spb, spb * 0.3, 0.05, 3200);
      for (const [t, n, len] of tune) fiddle(key + n + 12, when + (t - loopBeat) * spb, len * spb * 0.9);
      hit('tamb', when + spb * 0.5, 0.05);
      if (inBar % 2 === 0) hit('thump', when, 0.1);
    } else {
      // The waltz: bass on the one, the pad, the music box, bells on two and three.
      if (inBar === 0) {
        pluck(key + root - 24, when, spb * 1.2, 0.16, 500);
        pad(chord, when, spb * s.beats * 0.95);
      } else {
        hit('bells', when, 0.05);
      }
      for (const [t, n, len] of tune) musicbox(key + n, when + (t - loopBeat) * spb, len * spb);
    }
  }

  function schedule() {
    const ahead = ctx.currentTime + 0.15;
    while (at < ahead) {
      play(beat, at);
      at += 60 / tempo;
      beat += 1;
    }
  }

  return {
    get playing() { return timer !== null; },
    /** Starts the season's tune, `night` steps up. */
    start(season, night = 0) {
      if (timer) return;
      song = SONGS[season] ?? SONGS.halloween;
      transpose = night % 4;
      tempo = song.tempo + (night % 4) * 3;
      target = ctx.createGain();
      target.gain.value = 1;
      target.connect(bus);
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
      const g = target;
      g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.15);
      setTimeout(() => g.disconnect(), 1200);
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

