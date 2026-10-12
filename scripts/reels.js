/**
 * The reels scripts/reel.js makes. Each is a soundtrack (the arguments to
 * the game's startMusic, and its tempo), a line to open on, and clips cut on
 * its bar lines: from a night (they count from 0), so many bars long, the
 * best stretch of it the autopilot played. Every one ends on the card with
 * the address.
 */

const HALLOWEEN = { args: ['halloween', 0], tempo: 124, lead: 0.1 };

export const REELS = {
  nights: {
    hook: ['A ghost made of blueberry', 'ten haunted mazes · halloween to midwinter'],
    music: HALLOWEEN,
    // Six of the ten, the best each has to show, in order through the year; the last palace of ice to finish.
    clips: { from: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], take: 6, keep: [9], bars: 2 },
  },
  spooks: {
    hook: ['Boo.', 'spook off whatever shambles after you'],
    music: { args: ['harvest', 0], tempo: 128, lead: 0.1 },
    // The three nights with the best scares in them, the spooks counting most.
    worth: { spook: (scared) => 40 + 25 * (scared || 0), caught: 20 },
    clips: { from: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], take: 3, bars: 4 },
  },
};

/**
 * What each sound the game makes is worth to a reel: a number, or a
 * function of what it was called with.
 */
export const WORTH = {
  candy: 1.5,
  lantern: 15,
  gate: 20,
  spook: (scared) => 8 + 6 * (scared || 0),
  caught: 10,
  escape: 25,
  midnight: 3,
  bump: 0.3,
};

/**
 * The sound, before it goes out: the score's low end is heavy on a phone, so
 * the bottom is cut and the top lifted, to about the balance of the other
 * games' reels.
 */
export const MIX = 'highpass=f=45,bass=g=-12:f=120:w=0.7,treble=g=5:f=3000:w=0.6';

/** How long the card to end on stays up, in seconds. */
export const CARD = 4.6;

/** How long the opening line stays up, and when the address comes in under the HUD. */
export const HOOK = 2.4;
export const PILL = 2.7;
