import { loadWorld, type World, type WorldPackInput } from "@storyteller/engine";
import { books } from "./data/books";
import { eras } from "./data/eras";
import { species } from "./data/species";
import { archetypes } from "./data/archetypes";
import { regions } from "./data/regions";
import { locations } from "./data/locations";
import { factions } from "./data/factions";
import { creatures } from "./data/creatures";
import { items } from "./data/items";
import { magicSources } from "./data/magic";
import { canonFigures } from "./data/figures";
import { lore } from "./data/lore";
import { narratorStyle } from "./data/style";

/**
 * The Shannara world pack: paraphrased canon from Terry Brooks' novels.
 * Fan work. Not licensed, not affiliated, not for sale.
 */
export const shannaraPack: WorldPackInput = {
  id: "shannara",
  name: "Shannara",
  summary:
    "Thousands of years after the Great Wars burned the Old World, the Four Lands are home to Humans, Elves, Dwarves, Gnomes, and Trolls. Magic is rare, old, and costly. The Druids of Paranor keep what knowledge survived, and against them, age after age, the dark things the magic made come back: the Warlock Lord, the demons of the Forbidding, the Mord Wraiths, the Shadowen, and worse.",
  attribution:
    "Based on the Shannara novels by Terry Brooks. This is unlicensed fan work for private play: every entry is a paraphrased summary, never quoted text, and no part of it is for sale.",
  books,
  eras,
  species,
  archetypes,
  regions,
  locations,
  factions,
  creatures,
  items,
  magicSources,
  canonFigures,
  lore,
  narratorStyle,
};

let cached: World | undefined;

/** Validates and indexes the pack once. */
export function loadShannara(): World {
  if (!cached) cached = loadWorld(shannaraPack);
  return cached;
}
