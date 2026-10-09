import { bones, cauldron, coffin, cross, deadtree, haybale, mushrooms, obelisk, scarecrow, tombstone } from './halloween.js';
import { barrel, cornshock, gourd, haystack, table, whitepumpkin } from './harvest.js';
import { bigpumpkin, jack, pumpkin, pumpkinpile } from './pumpkin.js';
import { candycane, candycorn, caramelapple, gumdrop, lollipop, peppermint, sweet } from './sweets.js';
import { crystals, pine, snowball, snowheap, snowlantern, snowrock } from './winter.js';

/** Everything still that is sculpted: the sweets, the lanterns, the scenery. One bone, no animation. */
export const PROPS = {
  pumpkin, jack, bigpumpkin, pumpkinpile,
  whitepumpkin, gourd, snowheap, snowlantern,
  sweet, candycorn, lollipop, caramelapple, peppermint, gumdrop, candycane,
  haybale, deadtree, scarecrow, tombstone, cross, obelisk, coffin, bones, mushrooms, cauldron,
  cornshock, barrel, haystack, table,
  snowball, pine, snowrock, crystals,
};
