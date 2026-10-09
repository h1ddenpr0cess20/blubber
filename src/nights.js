import { SEASONS, THEMES } from './themes.js';

/**
 * The nights, in order: four in October, three in November, three in
 * December. Each is a recipe for `buildNight` (night.js): the maze (its
 * size in cells, its seed, how loopy it is, and any rooms), how it looks
 * (themes.js), how many lanterns have to be lit before the moon gate opens,
 * and what is in there with Blubber. `par` is the seconds before midnight
 * strikes: escape before it for the third moon.
 */

const night = (theme, recipe) => {
  const look = THEMES[theme];
  const season = SEASONS[look.season];
  return {
    theme,
    look,
    season: look.season,
    sweets: season.sweets,
    treat: season.treat,
    lantern: season.lantern,
    dark: season.dark,
    ...recipe,
    chasers: (recipe.chasers ?? []).map((c) => ({ kind: season.chaser, ...c })),
    rollers: recipe.rollers ? { kind: season.roller, ...recipe.rollers } : null,
    flyers: recipe.flyers ? { kind: season.flyer, ...recipe.flyers } : null,
    hands: season.grabber ? recipe.hands ?? 0 : 0,
  };
};

export const NIGHTS = [
  night('hedge', {
    name: 'The Pumpkin Patch',
    intro: 'Light every jack-o\'-lantern and the moon gate opens.',
    maze: { cols: 7, rows: 6, seed: 1031, braid: 0.55, rooms: [{ i: 3, j: 2, w: 2, h: 2, name: 'room' }] },
    lanterns: 3, treats: 3, hills: 0.35, par: 90,
    chasers: [{ count: 1, speed: 1.1, sight: 5 }],
  }),
  night('cemetery', {
    name: 'Hollow Hill',
    intro: 'Hands in the graves. Press SPACE to spook the dead away.',
    maze: { cols: 9, rows: 7, seed: 2209, braid: 0.45, rooms: [{ i: 4, j: 2, w: 2, h: 2, name: 'room' }] },
    lanterns: 4, treats: 4, hills: 0.6, hands: 4, par: 160,
    chasers: [{ count: 2, speed: 1.3, sight: 6 }],
    flyers: { count: 1 },
  }),
  night('crypt', {
    name: 'The Crypt',
    intro: 'Pumpkins roll down the long halls. Duck into the side passages.',
    maze: { cols: 9, rows: 9, seed: 3307, braid: 0.4, rooms: [{ i: 3, j: 3, w: 2, h: 2, name: 'room' }] },
    lanterns: 5, treats: 4, hands: 3, par: 200,
    chasers: [{ count: 2, speed: 1.4, sight: 7 }],
    rollers: { count: 2, speed: 2.6 },
    flyers: { count: 2 },
  }),
  night('wood', {
    name: 'The Witch\'s Wood',
    intro: 'Something is brewing in the clearings.',
    maze: { cols: 10, rows: 9, seed: 4421, braid: 0.4, rooms: [{ i: 2, j: 2, w: 2, h: 2, name: 'room' }, { i: 6, j: 4, w: 2, h: 2, name: 'bog' }] },
    lanterns: 5, treats: 5, hills: 0.5, hands: 3, par: 210,
    chasers: [{ count: 3, speed: 1.45, sight: 7 }],
    rollers: { count: 2, speed: 2.8 },
    flyers: { count: 2 },
  }),
  night('corn', {
    name: 'The Corn Maze',
    intro: 'November. The turkeys are loose, and cross.',
    maze: { cols: 10, rows: 9, seed: 5501, braid: 0.4, rooms: [{ i: 4, j: 3, w: 2, h: 2, name: 'room' }] },
    lanterns: 5, treats: 5, hills: 0.3, par: 185,
    chasers: [{ count: 3, speed: 1.75, sight: 6 }],
    rollers: { count: 2, speed: 2.8 },
    flyers: { count: 2 },
  }),
  night('barn', {
    name: 'Gobbler\'s Barnyard',
    intro: 'Hay bales roll. Turkeys gobble. Blubber floats.',
    maze: { cols: 11, rows: 9, seed: 6607, braid: 0.38, rooms: [{ i: 5, j: 3, w: 2, h: 2, name: 'room' }] },
    lanterns: 6, treats: 5, hills: 0.25, par: 265,
    chasers: [{ count: 4, speed: 1.8, sight: 7 }],
    rollers: { count: 3, speed: 3 },
    flyers: { count: 2 },
  }),
  night('feast', {
    name: 'The Harvest Hall',
    intro: 'The feast is laid. The guests have feathers.',
    maze: { cols: 11, rows: 10, seed: 7703, braid: 0.35, rooms: [{ i: 4, j: 4, w: 2, h: 2, name: 'room' }] },
    lanterns: 6, treats: 6, par: 290,
    chasers: [{ count: 5, speed: 1.85, sight: 7 }],
    rollers: { count: 2, speed: 3 },
  }),
  night('snow', {
    name: 'Frostbite Hollow',
    intro: 'December. The snowmen have been waiting all year.',
    maze: { cols: 11, rows: 10, seed: 8803, braid: 0.38, rooms: [{ i: 5, j: 4, w: 2, h: 2, name: 'room' }] },
    lanterns: 6, treats: 6, hills: 0.4, par: 260,
    chasers: [{ count: 4, speed: 1.6, sight: 7 }],
    rollers: { count: 3, speed: 3.1 },
    flyers: { count: 2 },
  }),
  night('ice', {
    name: 'The Ice Palace',
    intro: 'Walls of ice, and the snowmen know the way round them.',
    maze: { cols: 12, rows: 10, seed: 9907, braid: 0.3, rooms: [{ i: 5, j: 4, w: 2, h: 2, name: 'room' }] },
    lanterns: 7, treats: 6, hills: 0.15, par: 295,
    chasers: [{ count: 4, speed: 1.7, sight: 8 }],
    rollers: { count: 3, speed: 3.2 },
    flyers: { count: 2 },
  }),
  night('aurora', {
    name: 'The Longest Night',
    intro: 'Under the northern lights, the last gate home.',
    maze: { cols: 13, rows: 11, seed: 11003, braid: 0.32, rooms: [{ i: 3, j: 3, w: 2, h: 2, name: 'room' }, { i: 8, j: 5, w: 2, h: 2, name: 'room' }] },
    lanterns: 8, treats: 7, hills: 0.3, par: 410,
    chasers: [{ count: 5, speed: 1.8, sight: 8 }],
    rollers: { count: 4, speed: 3.3 },
    flyers: { count: 3 },
  }),
];
