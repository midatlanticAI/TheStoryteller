import { WorldPack, type WorldPackInput } from "./schema";
import type {
  Archetype,
  Book,
  CanonFigure,
  Creature,
  Era,
  Faction,
  Item,
  Location,
  Lore,
  MagicSource,
  Region,
  Species,
} from "./schema";

export * from "./schema";
export * from "./gating";

/** A validated world pack with O(1) lookups. */
export interface World {
  pack: WorldPack;
  books: Map<string, Book>;
  eras: Map<string, Era>;
  species: Map<string, Species>;
  archetypes: Map<string, Archetype>;
  regions: Map<string, Region>;
  locations: Map<string, Location>;
  factions: Map<string, Faction>;
  creatures: Map<string, Creature>;
  items: Map<string, Item>;
  magicSources: Map<string, MagicSource>;
  canonFigures: Map<string, CanonFigure>;
  lore: Map<string, Lore>;
}

export class WorldValidationError extends Error {
  constructor(public readonly problems: string[]) {
    super(`World pack is invalid:\n- ${problems.join("\n- ")}`);
    this.name = "WorldValidationError";
  }
}

function index<T extends { id: string }>(list: T[], kind: string, problems: string[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const entry of list) {
    if (map.has(entry.id)) problems.push(`duplicate ${kind} id "${entry.id}"`);
    map.set(entry.id, entry);
  }
  return map;
}

/**
 * Parses and cross-checks a world pack. Every reference (exit targets,
 * encounter creatures, starting items, revealedIn books, …) must resolve.
 */
export function loadWorld(input: WorldPackInput): World {
  const parsed = WorldPack.safeParse(input);
  if (!parsed.success) {
    throw new WorldValidationError(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));
  }
  const pack = parsed.data;
  const problems: string[] = [];
  const world: World = {
    pack,
    books: index(pack.books, "book", problems),
    eras: index(pack.eras, "era", problems),
    species: index(pack.species, "species", problems),
    archetypes: index(pack.archetypes, "archetype", problems),
    regions: index(pack.regions, "region", problems),
    locations: index(pack.locations, "location", problems),
    factions: index(pack.factions, "faction", problems),
    creatures: index(pack.creatures, "creature", problems),
    items: index(pack.items, "item", problems),
    magicSources: index(pack.magicSources, "magic source", problems),
    canonFigures: index(pack.canonFigures, "canon figure", problems),
    lore: index(pack.lore, "lore", problems),
  };

  const ref = (map: Map<string, unknown>, id: string, from: string, kind: string) => {
    if (!map.has(id)) problems.push(`${from} refers to unknown ${kind} "${id}"`);
  };
  const refEras = (ids: string[], from: string) => ids.forEach((id) => ref(world.eras, id, from, "era"));

  for (const b of pack.books) ref(world.eras, b.eraId, `book ${b.id}`, "era");
  for (const e of pack.eras) {
    e.bookIds.forEach((id) => ref(world.books, id, `era ${e.id}`, "book"));
    if (e.startLocationId) ref(world.locations, e.startLocationId, `era ${e.id}`, "location");
    if (e.playable && !e.startLocationId) problems.push(`era ${e.id} is playable but has no startLocationId`);
  }
  const revealed = (entry: { id: string; revealedIn: string }, kind: string) =>
    ref(world.books, entry.revealedIn, `${kind} ${entry.id}`, "book");

  for (const s of pack.species) {
    revealed(s, "species");
    s.magicAffinity.forEach((id) => ref(world.magicSources, id, `species ${s.id}`, "magic source"));
    s.homelandRegionIds.forEach((id) => ref(world.regions, id, `species ${s.id}`, "region"));
  }
  for (const a of pack.archetypes) {
    revealed(a, "archetype");
    a.startingItemIds.forEach((id) => ref(world.items, id, `archetype ${a.id}`, "item"));
    a.speciesAllowed?.forEach((id) => ref(world.species, id, `archetype ${a.id}`, "species"));
    a.magicSourceIds.forEach((id) => ref(world.magicSources, id, `archetype ${a.id}`, "magic source"));
  }
  for (const r of pack.regions) {
    revealed(r, "region");
    if (r.parentId) ref(world.regions, r.parentId, `region ${r.id}`, "region");
    refEras(r.eraIds, `region ${r.id}`);
  }
  for (const l of pack.locations) {
    revealed(l, "location");
    ref(world.regions, l.regionId, `location ${l.id}`, "region");
    l.exits.forEach((x) => ref(world.locations, x.to, `location ${l.id} exit`, "location"));
    l.factionIds.forEach((id) => ref(world.factions, id, `location ${l.id}`, "faction"));
    l.encounters.forEach((e) => ref(world.creatures, e.creatureId, `location ${l.id} encounter`, "creature"));
    refEras(l.eraIds, `location ${l.id}`);
  }
  for (const f of pack.factions) {
    revealed(f, "faction");
    if (f.seatLocationId) ref(world.locations, f.seatLocationId, `faction ${f.id}`, "location");
    refEras(f.eraIds, `faction ${f.id}`);
  }
  for (const c of pack.creatures) {
    revealed(c, "creature");
    c.lootItemIds.forEach((id) => ref(world.items, id, `creature ${c.id}`, "item"));
    refEras(c.eraIds, `creature ${c.id}`);
  }
  for (const i of pack.items) {
    revealed(i, "item");
    if (i.magicSourceId) ref(world.magicSources, i.magicSourceId, `item ${i.id}`, "magic source");
    if (i.kind === "weapon" && !i.damage) problems.push(`weapon ${i.id} has no damage`);
  }
  for (const m of pack.magicSources) {
    revealed(m, "magic source");
    m.requires.speciesIds?.forEach((id) => ref(world.species, id, `magic source ${m.id}`, "species"));
    if (m.requires.itemId) ref(world.items, m.requires.itemId, `magic source ${m.id}`, "item");
    const effectIds = new Set<string>();
    for (const e of m.effects) {
      if (effectIds.has(e.id)) problems.push(`magic source ${m.id} has duplicate effect "${e.id}"`);
      effectIds.add(e.id);
    }
  }
  for (const c of pack.canonFigures) {
    revealed(c, "canon figure");
    ref(world.species, c.speciesId, `canon figure ${c.id}`, "species");
    c.whereabouts.forEach((w) => {
      ref(world.eras, w.eraId, `canon figure ${c.id}`, "era");
      w.locationIds.forEach((id) => ref(world.locations, id, `canon figure ${c.id}`, "location"));
    });
    refEras(c.alive, `canon figure ${c.id}`);
  }
  for (const l of pack.lore) {
    revealed(l, "lore");
    refEras(l.eraIds, `lore ${l.id}`);
  }

  if (problems.length) throw new WorldValidationError(problems);
  return world;
}

export function requireLocation(world: World, id: string): Location {
  const loc = world.locations.get(id);
  if (!loc) throw new Error(`Unknown location "${id}"`);
  return loc;
}

export function requireCreature(world: World, id: string): Creature {
  const c = world.creatures.get(id);
  if (!c) throw new Error(`Unknown creature "${id}"`);
  return c;
}

export function requireItem(world: World, id: string): Item {
  const i = world.items.get(id);
  if (!i) throw new Error(`Unknown item "${id}"`);
  return i;
}
