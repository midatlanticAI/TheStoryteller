import type { WorldPackInput } from "@storyteller/engine";

export const species: WorldPackInput["species"] = [
  {
    id: "human",
    name: "Human",
    plural: "Humans",
    summary:
      "The most numerous people of the Four Lands, descended from the survivors of the Great Wars. Southlanders farm, trade, and build cities; Bordermen of Callahorn soldier; Valemen keep to their small towns. Most have never seen magic and do not believe in it.",
    attributeMods: {},
    magicAffinity: ["druid-lore", "wishsong"],
    homelandRegionIds: ["southland", "callahorn"],
    traits: ["Adaptable: no attribute penalties, no bonuses.", "Few Humans have any gift for magic; those who do were usually taught by Druids."],
    revealedIn: "sword",
  },
  {
    id: "elf",
    name: "Elf",
    plural: "Elves",
    summary:
      "The oldest people, who alone predate the Great Wars and were never Human. Slender, quick, with pointed ears and slanted brows, they keep the Westland and the forest city of Arborlon under the Elessedil kings. Their magic is mostly forgotten but their blood still answers to it.",
    attributeMods: { agility: 1, vigor: -1 },
    magicAffinity: ["elfstones-blue", "druid-lore", "faerie-ellcrys"],
    homelandRegionIds: ["westland"],
    traits: ["Quick and keen-eyed; weaker in body than Trolls or Dwarves.", "Elven blood is required to wield the Elfstones."],
    revealedIn: "sword",
  },
  {
    id: "half-elf",
    name: "Half-Elf",
    plural: "Half-Elves",
    summary:
      "People of mixed Elven and Human descent, rare and often unaware of what their blood carries. The house of Shannara, the Elven kings' line, was diluted by Human marriage into families like the Ohmsfords of Shady Vale.",
    attributeMods: { agility: 1 },
    magicAffinity: ["elfstones-blue", "sword-of-shannara", "wishsong", "druid-lore"],
    homelandRegionIds: ["southland", "westland"],
    traits: ["Elven enough for the Elfstones to answer.", "A descendant of Jerle Shannara may draw the Sword of Shannara."],
    revealedIn: "sword",
  },
  {
    id: "dwarf",
    name: "Dwarf",
    plural: "Dwarves",
    summary:
      "Short, broad, enduring folk of the Eastland forests, descended from Humans who hid underground through the Great Wars and came up changed. They are builders, engineers, and the steadiest allies of the Elves. Culhaven on the Silver River is their chief town.",
    attributeMods: { vigor: 1, might: 1, agility: -1 },
    magicAffinity: ["druid-lore"],
    homelandRegionIds: ["eastland"],
    traits: ["Tireless on the march and strong at the wall.", "No love for the open sky, less for Gnomes."],
    revealedIn: "sword",
  },
  {
    id: "gnome",
    name: "Gnome",
    plural: "Gnomes",
    summary:
      "Small, wiry, yellow-skinned tribal people of the Eastland hills and the Northland's edges, descended from Humans who went wild in the Great Wars. Superstitious, fierce in numbers, and easily led by fear, most tribes serve the Warlock Lord in this age, though not all do.",
    attributeMods: { agility: 1, might: -1, presence: -1 },
    magicAffinity: ["druid-lore"],
    homelandRegionIds: ["eastland", "northland"],
    traits: ["Trackers without equal in the hills.", "Distrusted everywhere in the Four Lands; a Gnome traveller is watched."],
    playable: true,
    revealedIn: "sword",
  },
  {
    id: "rock-troll",
    name: "Rock Troll",
    plural: "Rock Trolls",
    summary:
      "Huge, bark-skinned, nearly expressionless people of the Northland mountains, descended from Humans hardened by the Great Wars' poisons. They are disciplined, honourable within their own law, and formidable soldiers. In this age most Troll nations march for the Warlock Lord, by fear or oath.",
    attributeMods: { might: 2, vigor: 1, agility: -1, presence: -1 },
    magicAffinity: ["druid-lore"],
    homelandRegionIds: ["northland"],
    traits: ["Strong enough to carry a Human under one arm.", "Speaks little; some Trolls never speak at all.", "Cast out of their nation, a Troll is alone in the world."],
    revealedIn: "sword",
  },
  {
    id: "skaar",
    name: "Skaar",
    plural: "Skaar",
    summary:
      "Human invaders from Skaarsland across the sea, pale and disciplined, whose warriors can turn invisible at will. Their homeland is freezing to death, and they have come to take the Four Lands.",
    attributeMods: { agility: 1, will: 1 },
    magicAffinity: [],
    homelandRegionIds: ["skaarsland"],
    traits: ["Can fade from sight; the engine treats this as a stealth gift.", "Not playable in this age."],
    playable: false,
    revealedIn: "black-elfstone",
  },
];
