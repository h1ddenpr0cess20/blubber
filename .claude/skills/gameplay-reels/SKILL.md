---
name: gameplay-reels
description: Make vertical gameplay reels (9:16, 1080x1920, 30 fps, H.264/AAC) for TikTok, Instagram Reels and YouTube Shorts from a browser game. The game is filmed as it looks on a phone (touch HUD, on-screen buttons, a thumb steering) and played by its own autopilot, with the game's own Web Audio music and sound. Each reel ends on a card with the game's website ("play free in your browser", phone and desktop). It runs headless on a CPU with no GPU. Use when asked for gameplay videos, reels, shorts, trailers, clips or social posts of a WebGL/WebGPU + Web Audio browser game, in particular the rolling games built on the Madness / Dungeon Roller engine (Rock 'n' Roller, Dungeon Roller, Blubber, Catroller and their siblings), or to add reels to another such game.
---

# Gameplay reels

Reels of a browser game, made without a GPU or a screen recorder. The game is
stepped one frame at a time in headless Chromium under a phone profile. Each
frame is drawn (WebGL on SwiftShader), screenshotted and piped to ffmpeg. The
game's own Web Audio is rendered in an `OfflineAudioContext` in lock-step with
the frames. Slow rendering (about 1–1.5 s a frame) therefore doesn't matter:
every frame still lasts 1/30 s on film, and the sound stays in sync.

How a reel is put together:

- **Played by the autopilot.** The game's test autopilot is split into a
  stepwise `createPilot()`, and the game consults it at its physics step
  through `debug.pilot`.
- **Scouted first.** Each level is played through once, undrawn, logging every
  sound the game makes (each one is an event: a smash, a coin, a fight's grade,
  a spook) and the ball's speed each frame. Stretches are scored with per-game
  weights (`WORTH`), and the best are filmed.
- **Deterministic.** The film pass replays the same run: fixed `dt`, a virtual
  clock for timers, a pinned `Date.now`, models baked before the first step,
  microtasks settled between frames. The driver checks that the ball is where
  the scouting run had it at every cut.
- **Phone, upright.** The viewport is 405x720 at DPR 8/3, which gives exactly
  1080x1920, with `isMobile` and `hasTouch`, so `(pointer: coarse)` layouts and
  touch buttons appear.
- **Words over it.** A hook line (first 2.4 s), an address pill (from 2.7 s), a
  thumb where a finger would steer, a thumb on the game's button (REV, SPOOK,
  CONTINUE) while it is pressed, and an end card: the game's own logo, "Play
  free in your browser", the URL, "Phone · Desktop", "no download · no
  sign-up".
- **Cut on the beat.** A soundtrack (the game's own music, started at film
  time 0) plays throughout, and clips are cut on its bar lines.
- **Delivered ready to post.** Audio is normalised to -14 LUFS, faded out under
  the card, and video bitrate is capped at 7 Mbps, which keeps a 30 s reel
  under 30 MiB.

## Files (templates/)

| File | Goes to | Changes per game? |
|---|---|---|
| `core.js` | `src/reel/core.js` | No. The filming, as `globalThis.recorder`. |
| `reel.css` | `src/reel/reel.css` | No. Overlays, themed by `--reel-*` variables. |
| `reel.js` | `scripts/reel.js` | No. The driver: Vite, Playwright, scoring, ffmpeg. |
| `recorder.example.js` | `src/reel/recorder.js` | Yes. The adapter (Dungeon Roller's, as an example). |
| `reels.example.js` | `scripts/reels.js` | Yes. Which reels, soundtrack, `WORTH` weights. |
| (none) | `reel.html` | Yes. A copy of `index.html` (see below). |

Keep `core.js`, `reel.css` and `reel.js` identical across games. Fix bugs in all
copies.

## Adding reels to a game

1. **Find the website.** It's the repo's homepage field on GitHub (for
   example `rocknroller.vercel.app`, `dungeon-roller.vercel.app`,
   `blubber-green.vercel.app`). Ask if there is none. The card and the pill
   both carry it.
2. **Split the autopilot** (`test/helpers/autopilot.js`) into
   `createPilot(state)`. It should return `{ next() -> { push: [x, z], ...extras },
   saw(out), stuck }`, with `drive()` (or whatever the tests call) rewritten
   as a loop over it. **Prove nothing changed:** copy the old file to
   `autopilot.old.js`, run old and new over every level, compare a JSON
   signature of the results (finished, hits or fights, damage, losses, final
   state), and delete both scratch files. Then run `npm test`.
3. **Hook the game** (`src/game.js`). Where the fixed-step loop calls the
   physics:
   ```js
   // Steered by the autopilot (the reels), if one is aboard; by the controls if not.
   const auto = state === 'play' && debug.pilot ? debug.pilot.next() : null;
   const out = stepXxx(state, state === 'play' ? auto?.push ?? push : [0, 0], STEP, { ... });
   if (auto) debug.pilot.saw(out);
   ```
   Add `pilot: null` to the `debug` object and document it.
4. **Copy the templates** and write the adapter (`src/reel/recorder.js`) from
   `main.js`. Build the hud, stage and game exactly as `main.js` does, but with
   a stub input (`stick`, `view`, `take`, plus whatever else the game calls on
   it) and no animation loop. The adapter interface is documented at the top
   of `createRecorder()` in `core.js`. The game-specific parts are:
   - `ready()`: bake every model every level needs (`preload()`, then await
     `ready(name, detail)` for each) and load fonts. Nothing may still be
     baking once the clock is virtual.
   - `start(game, level)`: start the level. **Reset anything that carries over
     between levels and affects play.** Dungeon Roller's die orientation decides
     its fights, so the scouting run, which plays levels in order, would
     otherwise disagree with the film, which jumps between them.
   - `phase(game)`: `'live'` (worth watching: play, and a battle screen),
     `'wait'`, or `'end'` (cleared or over).
   - `presses(game, since)`: one-shot presses, e.g. `'start'` to carry on from
     a battle screen once it has been up long enough to read (about 2.2 s).
   - `notes(game)`: extra events no sound reveals (e.g. a boss fight, read from
     the battle screen's DOM).
   - `steering(game)` and `button: { selector, held(game, move, since) }` for
     the thumbs.
   - `music(audio, m)`: `audio.startMusic(...m.args)`. Choose a song section
     with energy from bar 0, or start the band mid-song if the game allows it.
   - `card: { logo, url }` and `theme` (`display`, `body`, `accent`,
     `accent-dark`, `accent-2`, `cool`, `dim`, `pill-top`, `pill-size`,
     `url-size`, `cta-size`).
5. **`reel.html`**: copy `index.html`, change the title, swap the module script
   to `/src/reel/recorder.js`, and add `<link rel="stylesheet"
   href="/src/reel/reel.css">` plus a `<style>` block containing:
   - `body.hooked #banner { visibility: hidden; }` (no game banner under the
     hook);
   - the title logo's CSS copied and re-scoped to `#card` (the game's is usually
     scoped to `#title`);
   - per-game fixes, such as hiding the pill over modal screens
     (`#battle:not([hidden]) ~ #film #pill { visibility: hidden; }`), or moving
     a HUD element the phone layout overlaps.
6. **`scripts/reels.js`**: `REELS` (hook line and sub-line, `music: { args,
   tempo, lead }`, `clips`), `WORTH` (sound name → points, or a function of its
   first argument), and `CARD`, `HOOK`, `PILL`. There are three kinds of
   `clips`:
   - a list: `[{ level, bars }]`;
   - the best of many: `{ from: [levels], take, keep: [levels], bars }`, kept
     in level order;
   - several stretches of one level: `{ level, count, bars }`.

   A reel can have its own `worth` on top of `WORTH`, e.g. `{ boss: 120 }`.
   Aim for 22–30 s before the 4.6 s card: 5–6 clips of 2 bars, or 2–3 of 4.
7. **Dependencies:** `npm i -D --save-exact playwright-core@<version whose
   Chromium is installed>` (check `ls $PLAYWRIGHT_BROWSERS_PATH`;
   chromium-1194 goes with 1.56.1). Add `reels/` to `.gitignore`, and a line
   about `node scripts/reel.js` to the README's tooling section.
8. **Look before rendering.** Write a small Playwright probe against `npx vite
   --port N` that loads `reel.html` under the phone profile, calls
   `recorder.scout(i)` on a level or two (print event counts, whether it ended,
   and how long it took), then films a few frames with `start`, `cut`, `hook`,
   `pill`, `frame` and `card`, and screenshots them. Check that:
   - the pill and the URL fit the width, since wide display fonts overflow
     (set `pill-size` and `url-size`);
   - nothing sits on top of a modal;
   - the thumb isn't covering the ball;
   - the card is fully drawn;
   - the cut reports the same position as the scouting run.

   Then run `node scripts/reel.js <name> --frames 90` for a 3 s end-to-end
   check of picture and sound.
9. **Render one reel at a time**: `node scripts/reel.js` (all of them) or by
   name, in the background, then queue the next. On 4 cores, three at once ran
   at 3–8 s a frame each, against about 1.3 s alone.
10. **Review before sending.** Check each reel with `ffprobe` (1080x1920, h264,
    aac, duration), with `ebur128` (about -14 LUFS), and with
    `silencedetect=noise=-45dB:d=0.3` (no gaps). Make a contact sheet with
    `select='eq(n\,N)+...',scale=270:480,tile=4x2`. Pull extra frames at the
    exact moments the scouting data says matter (a boss going down), because
    evenly spaced samples miss them. Send with `SendUserFile` (30 MiB limit).
    The cover frame `reels/<name>.jpg` is written as well.

## Pitfalls (each one cost real time)

- **Never `pause()` a CSS animation through the Web Animations API.** Chrome
  then cuts it loose from its CSS, and when the class changes the old
  animation (with `fill: forwards`) stays on top, so a hook that should fade
  out stays up. Freeze with `playbackRate = 0` and set `currentTime` from the
  virtual clock instead.
- **Keep your own list of frozen animations.** An animation frozen in its
  `animation-delay` stops being "current", drops out of
  `document.getAnimations()`, and the card's delayed parts never appear.
  (`core.js` handles this.)
- **Ids become window globals.** `<div id="reel">` made `window.reel` exist
  before the API did, so name the API differently (`globalThis.recorder`).
- **Don't run renders in parallel.** It is slower overall.
- **`pkill -f pattern` / `pgrep -f pattern` match your own shell** when the
  pattern appears in the command line, and kill it (exit 144). Find
  processes by port or by exact argv fields:
  `ps -eo pid,args | awk '$2=="node" && $3=="scripts/reel.js"'`.
- **Things seeded from `Date.now()`** (Dungeon Roller's fight dice) differ run
  to run. `core.js` pins `Date.now`.
- **Promise-driven state changes** (a battle screen's `show().then(...)`) need
  microtasks settled between frames. `core.js` yields a `MessageChannel` turn
  each tick.
- **A game that waits on bakes before play** (`baking` and `readyAll`) must
  have every model baked before the clock goes virtual, or its timeout never
  fires.
- **Fonts the game names but doesn't ship** fall back to whatever the machine
  has (DejaVu Serif here). For the film, a reel-only Fontsource import of the
  design's named face (Cinzel, for Dungeon Roller) looks as intended. Say so to
  the user.
- **Phone-layout bugs show up on film** (Rock 'n' Roller's speech bubble over
  its meters and behind its corner buttons). Fix them with reel-only CSS in
  `reel.html`, and tell the user the game itself has the problem.
- **Each game's music API differs**: `startMusic(depth, { boss })`,
  `startMusic(season, night)`, or `startMusic(venue, { gig })`. Some songs open
  quietly (Dungeon Roller's normal themes start with four bars of pads; its
  boss theme starts at full tilt), so pick one that hits from bar 0.
- **The game's own calls to start, stop or mute the music are dropped** (the
  proxy's `NOWHERE` set). The reel's soundtrack runs on through fights and
  level changes. Methods whose return value the game reads (a beat clock) go in
  `through`.
- **Headless Chromium:** launch with `--use-angle=swiftshader
  --enable-unsafe-swiftshader --ignore-gpu-blocklist`. WebGPU has no adapter, so
  the games fall back to WebGL2 by themselves. `page.screenshot` at DPR 8/3
  takes about 1 s. CDP `captureScreenshot` with `optimizeForSpeed` was no
  faster at full size.
- **An autopilot made for tests may cheat.** Catroller's runs with
  `quiet: true`, so the cats never see the yarn. In the live game it will be
  seen and caught, which is fine for footage but means it may not finish a
  level. Scouting copes, because the driver only needs good stretches.

## Rock 'n' Roller

Rock 'n' Roller had the first, standalone version: `src/reel/recorder.js`
without `core.js`, game-time clips, and its band started mid-song so cuts land
on downbeats. If you touch it, port it onto `core.js` and the shared driver
(its adapter needs `through: ['beat']`, the REV button thumb, and
`#say { bottom: 172px }` in `reel.html`).
