import { createAudio } from '../audio.js';
import { createGame } from '../game.js';
import { createHud } from '../hud.js';
import { fontsFor, setLang } from '../lang.js';
import { decorDetailOf, detailOf, preload, ready, SCULPTED } from '../models/library.js';
import { PROPS } from '../models/props/index.js';
import { createStage } from '../stage.js';
import { createStorage } from '../storage.js';
import * as GFX from '../vendor/gfx/index.js';
import { createPilot } from '../../test/helpers/autopilot.js';
import { createRecorder } from './core.js';

/**
 * Blubber, for the reels (reel.html; the filming is core.js): the game built
 * as main.js builds it, in English, with nobody's hands on it and the
 * autopilot floating Blubber from lantern to lantern and out of the gate,
 * a thumb on SPOOK whenever it spooks.
 */

/** Frames the thumb stays on SPOOK after a spook. */
let spooking = 0;

createRecorder({
  async ready() {
    setLang('en', { keep: false });
    preload();
    const jobs = [
      ...Object.keys(SCULPTED).map((n) => [n, detailOf(n)]),
      ...Object.keys(PROPS).filter((n) => PROPS[n].decor).map((n) => [n, decorDetailOf(n)]),
    ];
    await Promise.all(jobs.map(([n, d]) => ready(n, d)));
    await fontsFor('en', 10_000);
  },

  createAudio,
  quiet: ['floating'],

  async build({ audio }) {
    const hud = createHud(document.body, { onStart() {}, onAgain() {}, onOnward() {} });
    hud.muted(false);
    const input = {
      stick: () => ({ x: 0, y: 0 }),
      view: () => ({ turn: 0, tilt: 0, zoom: 1 }),
      take: () => [],
      press() {},
      get pointing() { return false; },
    };
    const stage = await createStage(document.getElementById('view'));
    const game = createGame({ stage, hud, input, audio, storage: createStorage() });
    return { game, stage, GFX };
  },

  start: (game, night) => { spooking = 0; game.startRun(night); },
  pilot(game) {
    const pilot = createPilot(game.debug.haunt);
    return {
      next() {
        const move = pilot.next();
        if (move.spook) spooking = 8;
        return move;
      },
      saw() {},
      stuck: null,
    };
  },
  attach: (game, pilot) => { game.debug.pilot = pilot; },
  ball: (game) => game.debug.haunt.ghost,
  name: (game) => game.debug.night.recipe.name,
  state: (game) => game.debug.state,
  phase: (game) => ({ play: 'live', out: 'end', tally: 'end' })[game.debug.state] ?? 'wait',
  button: { selector: '#spook', held: () => spooking-- > 0 },
  music: (audio, m) => audio.startMusic(...m.args),

  card: {
    logo: '<h1 class="crest"><span class="word">Blubber</span></h1><p class="tag">a haunted maze</p>',
    url: 'blubber-green.vercel.app',
  },
  theme: {
    display: 'Creepster, cursive',
    body: 'Fredoka, system-ui, sans-serif',
    accent: '#5b4fd2',
    'accent-dark': '#1c1840',
    'accent-2': '#ffb040',
    cool: '#b9aeff',
    dim: '#9a94c0',
    'url-size': '27px',
  },
});
