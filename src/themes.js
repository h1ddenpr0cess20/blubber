/**
 * How each kind of night looks: the colours of its ground and walls (sRGB;
 * the textures are near white and these tint them), what its surfaces are
 * painted with (textures.js), how tall its walls stand, the light it is
 * under, the sky round it, and the scenery scattered outside the maze, in
 * its rooms and in its dead ends (models: see `decor` in scenery.js).
 *
 * Three seasons, in the order the nights come: Halloween, the harvest, and
 * the winter at the end, when the walls are ice.
 */

const PUMPKINS = [{ kind: 'pumpkin', weight: 3 }, { kind: 'pumpkin', weight: 2, scale: 0.7 }];

export const THEMES = {
  hedge: {
    season: 'halloween',
    floor: ['#8aa45c', '#5e7a42'], wall: '#4a8040', top: '#62a050', earth: '#8a6a50',
    textures: { floor: 'grass', wall: 'hedge', top: 'hedge', earth: 'earth' }, uv: 'world', scale: 4,
    wallHeight: 1.25, ambient: [0.62, 0.62, 0.8],
    sky: { top: '#0b0b24', horizon: '#2a2050', glow: '#ff9a4a', haze: '#1a1430' },
    mist: '#9aa8d8',
    props: [...PUMPKINS, { kind: 'jack', weight: 0.9, glow: true }, { kind: 'haybale', weight: 1.4 }, { kind: 'deadtree', weight: 1.2 }, { kind: 'scarecrow', weight: 0.3 }],
    rooms: { room: 'pumpkinpile' },
    nooks: [{ kind: 'pumpkin' }, { kind: 'pumpkin', scale: 0.7 }],
    density: 0.5,
  },
  cemetery: {
    season: 'halloween',
    floor: ['#6e8450', '#627648'], wall: '#a8a498', top: '#b8b4a6', earth: '#7a6a58',
    textures: { floor: 'grass', wall: 'fieldstone', top: 'fieldstone', earth: 'earth' }, uv: 'world', scale: 4,
    wallHeight: 1.05, ambient: [0.58, 0.6, 0.82], candles: 0.08, candle: 'lamp',
    sky: { top: '#080a1e', horizon: '#232a52', glow: '#9ab0ff', haze: '#141a34' },
    mist: '#aab6e0',
    props: [{ kind: 'tombstone', weight: 3 }, { kind: 'cross', weight: 2 }, { kind: 'deadtree', weight: 1.2 }, ...PUMPKINS.slice(1), { kind: 'jack', weight: 0.6, glow: true }],
    rooms: { room: 'obelisk' },
    nooks: [{ kind: 'tombstone' }, { kind: 'cross' }],
    density: 0.7,
  },
  crypt: {
    season: 'halloween',
    floor: ['#9a958e', '#837d75'], wall: '#7a746c', top: '#6c6862', earth: '#5e5953',
    textures: { floor: 'flagstone', wall: 'brick', top: 'flagstone', earth: 'brick' }, uv: 'tile', checker: true,
    wallHeight: 1.45, ambient: [0.42, 0.4, 0.52], candles: 0.3, candle: 'candles', underground: true,
    sky: { top: '#000000', horizon: '#060508', glow: '#3a1408', haze: '#0d0708' },
    mist: '#6a6070',
    props: [{ kind: 'coffin', weight: 2 }, { kind: 'bones', weight: 2 }, { kind: 'tombstone', weight: 0.6 }],
    rooms: { room: 'coffin' },
    nooks: [{ kind: 'bones' }],
    density: 0.45,
  },
  wood: {
    season: 'halloween',
    floor: ['#5e7a4c', '#526c44'], wall: '#5a4878', top: '#725c94', earth: '#6a5644', bog: '#4aa830',
    textures: { floor: 'grass', wall: 'hedge', top: 'hedge', earth: 'earth' }, uv: 'world', scale: 4,
    wallHeight: 1.35, ambient: [0.55, 0.58, 0.78], moat: true,
    sky: { top: '#060a14', horizon: '#1a2a30', glow: '#7aff6a', haze: '#0c1814' },
    mist: '#8ad0a0',
    props: [{ kind: 'deadtree', weight: 3 }, { kind: 'mushrooms', weight: 2 }, ...PUMPKINS.slice(1), { kind: 'jack', weight: 0.5, glow: true }],
    rooms: { room: 'cauldron', bog: null },
    nooks: [{ kind: 'mushrooms' }],
    density: 0.7,
  },
  corn: {
    season: 'harvest',
    floor: ['#b89c6a', '#a08a5c'], wall: '#e0c070', top: '#f0d488', earth: '#8a6e50',
    textures: { floor: 'straw', wall: 'corn', top: 'corn', earth: 'earth' }, uv: 'world', scale: 4,
    wallHeight: 1.55, ambient: [0.74, 0.64, 0.6], light: { key: '#ffd8a8', sky: '#d8b8a0' },
    sky: { top: '#10102a', horizon: '#3a2a4a', glow: '#ffb060', haze: '#22182a' },
    mist: '#c0b0c8',
    props: [{ kind: 'haybale', weight: 2 }, { kind: 'cornshock', weight: 2 }, { kind: 'scarecrow', weight: 0.6 }, ...PUMPKINS, { kind: 'gourd', weight: 0.8, glow: true }],
    rooms: { room: 'scarecrow' },
    nooks: [{ kind: 'pumpkin', scale: 0.7 }, { kind: 'haybale', scale: 0.8 }],
    density: 0.6,
  },
  barn: {
    season: 'harvest',
    floor: ['#9c8a6a', '#8c7a5c'], wall: '#9a6a4a', top: '#b07c56', earth: '#7a5e44',
    textures: { floor: 'straw', wall: 'planks', top: 'planks', earth: 'earth' }, uv: 'world', scale: 4,
    wallHeight: 1.2, ambient: [0.74, 0.64, 0.6], candles: 0.1, candle: 'lamp', light: { key: '#ffd8a8', sky: '#d8b8a0' },
    sky: { top: '#0e0c22', horizon: '#3a2440', glow: '#ff9a50', haze: '#20142a' },
    mist: '#c8b0b8',
    props: [{ kind: 'haybale', weight: 2.5 }, { kind: 'barrel', weight: 1.5 }, { kind: 'cornshock', weight: 1 }, ...PUMPKINS.slice(0, 1), { kind: 'gourd', weight: 0.7, glow: true }],
    rooms: { room: 'haystack' },
    nooks: [{ kind: 'barrel' }, { kind: 'haybale', scale: 0.8 }],
    density: 0.55,
  },
  feast: {
    season: 'harvest',
    floor: ['#8a5a3a', '#7a4e32'], wall: '#e8d8c0', top: '#9a7050', earth: '#6a4a36',
    textures: { floor: 'planks', wall: 'panelling', top: 'planks', earth: 'planks' }, uv: 'tile',
    wallHeight: 1.5, ambient: [0.55, 0.46, 0.46], candles: 0.32, candle: 'candles', underground: true,
    sky: { top: '#000000', horizon: '#0a0604', glow: '#ff8a3a', haze: '#140a06' },
    mist: '#b09080',
    props: [{ kind: 'barrel', weight: 1 }, ...PUMPKINS],
    rooms: { room: 'table' },
    nooks: [{ kind: 'pumpkin', scale: 0.7 }],
    density: 0.35,
  },
  snow: {
    season: 'winter',
    floor: ['#d4dde8', '#c4cedc'], wall: '#4a6a5a', top: '#e8eef6', earth: '#8a8a98',
    textures: { floor: 'snow', wall: 'hedge', top: 'snow', earth: 'earth' }, uv: 'world', scale: 4, grain: 0.06,
    wallHeight: 1.3, ambient: [0.6, 0.64, 0.84],
    sky: { top: '#060a1c', horizon: '#20304e', glow: '#a0c8ff', haze: '#101c30' },
    mist: '#d8e4ff',
    props: [{ kind: 'pine', weight: 3 }, { kind: 'snowrock', weight: 1 }, { kind: 'crystals', weight: 0.6 }, { kind: 'snowlantern', weight: 0.8, glow: true }],
    rooms: { room: 'pine' },
    nooks: [{ kind: 'crystals' }],
    density: 0.7,
  },
  ice: {
    season: 'winter',
    floor: ['#cad8e6', '#bccad8'], wall: '#cad8e6', top: '#c2d0de', earth: '#8a96a8',
    textures: { floor: 'snow', wall: 'snow', top: 'snow', earth: 'earth' }, uv: 'world', scale: 4, grain: 0.06,
    wallHeight: 1, ambient: [0.6, 0.66, 0.86], ice: true,
    sky: { top: '#040818', horizon: '#18284a', glow: '#bfe6ff', haze: '#0c1428' },
    mist: '#e0ecff',
    props: [{ kind: 'pine', weight: 2 }, { kind: 'crystals', weight: 2 }, { kind: 'snowrock', weight: 1 }, { kind: 'snowlantern', weight: 0.8, glow: true }],
    rooms: { room: 'icecube' },
    nooks: [{ kind: 'crystals' }],
    density: 0.6,
  },
  aurora: {
    season: 'winter',
    floor: ['#c6d4e4', '#b4c4d6'], wall: '#c6d4e4', top: '#bccbdc', earth: '#7a8698',
    textures: { floor: 'snow', wall: 'snow', top: 'snow', earth: 'earth' }, uv: 'world', scale: 4, grain: 0.06,
    wallHeight: 1, ambient: [0.56, 0.7, 0.8], ice: true, aurora: true,
    sky: { top: '#020814', horizon: '#123848', glow: '#6affc8', haze: '#08202a' },
    mist: '#c8ffe8',
    props: [{ kind: 'pine', weight: 3 }, { kind: 'crystals', weight: 1.5 }, { kind: 'snowlantern', weight: 0.8, glow: true }],
    rooms: { room: 'icecube' },
    nooks: [{ kind: 'crystals' }],
    density: 0.65,
  },
};

/** What each season has in it: what chases, what rolls, what flies, what is lit, and the sweets. */
export const SEASONS = {
  halloween: {
    month: 'October', chaser: 'zombie', roller: 'bigpumpkin', flyer: 'bat', lantern: 'jack', dark: 'pumpkin',
    sweets: ['sweet', 'candycorn'], treat: 'lollipop', grabber: 'hand',
    colour: '#ff8a2a',
  },
  harvest: {
    month: 'November', chaser: 'turkey', roller: 'haybale', flyer: 'crow', lantern: 'gourd', dark: 'whitepumpkin',
    sweets: ['candycorn', 'sweet'], treat: 'caramelapple', grabber: null,
    colour: '#e0a040',
  },
  winter: {
    month: 'December', chaser: 'snowman', roller: 'snowball', flyer: 'bat', lantern: 'snowlantern', dark: 'snowheap',
    sweets: ['peppermint', 'gumdrop'], treat: 'candycane', grabber: null,
    colour: '#9fd8ff',
  },
};
