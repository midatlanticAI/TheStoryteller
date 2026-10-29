import type { Book } from "@storyteller/engine";

/**
 * Reading order used for spoiler gating. The classic path starts with the
 * original trilogy; the prequels are placed where most readers meet them.
 */
export const books: Book[] = [
  { id: "sword", title: "The Sword of Shannara", order: 1, eraId: "sword" },
  { id: "elfstones", title: "The Elfstones of Shannara", order: 2, eraId: "elfstones" },
  { id: "wishsong", title: "The Wishsong of Shannara", order: 3, eraId: "wishsong" },
  { id: "scions", title: "The Scions of Shannara", order: 4, eraId: "heritage" },
  { id: "druid", title: "The Druid of Shannara", order: 5, eraId: "heritage" },
  { id: "elf-queen", title: "The Elf Queen of Shannara", order: 6, eraId: "heritage" },
  { id: "talismans", title: "The Talismans of Shannara", order: 7, eraId: "heritage" },
  { id: "first-king", title: "First King of Shannara", order: 8, eraId: "first-king" },
  { id: "ilse-witch", title: "Ilse Witch", order: 9, eraId: "voyage" },
  { id: "antrax", title: "Antrax", order: 10, eraId: "voyage" },
  { id: "morgawr", title: "Morgawr", order: 11, eraId: "voyage" },
  { id: "jarka-ruus", title: "Jarka Ruus", order: 12, eraId: "high-druid" },
  { id: "tanequil", title: "Tanequil", order: 13, eraId: "high-druid" },
  { id: "straken", title: "Straken", order: 14, eraId: "high-druid" },
  { id: "armageddons-children", title: "Armageddon's Children", order: 15, eraId: "genesis" },
  { id: "elves-of-cintra", title: "The Elves of Cintra", order: 16, eraId: "genesis" },
  { id: "gypsy-morph", title: "The Gypsy Morph", order: 17, eraId: "genesis" },
  { id: "bearers", title: "Bearers of the Black Staff", order: 18, eraId: "legends" },
  { id: "measure", title: "The Measure of the Magic", order: 19, eraId: "legends" },
  { id: "wards", title: "Wards of Faerie", order: 20, eraId: "dark-legacy" },
  { id: "bloodfire", title: "Bloodfire Quest", order: 21, eraId: "dark-legacy" },
  { id: "witch-wraith", title: "Witch Wraith", order: 22, eraId: "dark-legacy" },
  { id: "high-druids-blade", title: "The High Druid's Blade", order: 23, eraId: "defenders" },
  { id: "darkling-child", title: "The Darkling Child", order: 24, eraId: "defenders" },
  { id: "sorcerers-daughter", title: "The Sorcerer's Daughter", order: 25, eraId: "defenders" },
  { id: "black-elfstone", title: "The Black Elfstone", order: 26, eraId: "fall" },
  { id: "skaar-invasion", title: "The Skaar Invasion", order: 27, eraId: "fall" },
  { id: "stiehl-assassin", title: "The Stiehl Assassin", order: 28, eraId: "fall" },
  { id: "last-druid", title: "The Last Druid", order: 29, eraId: "fall" },
  { id: "running-with-the-demon", title: "Running with the Demon", order: 30, eraId: "word-and-void" },
  { id: "knight-of-the-word", title: "A Knight of the Word", order: 31, eraId: "word-and-void" },
  { id: "angel-fire-east", title: "Angel Fire East", order: 32, eraId: "word-and-void" },
];
