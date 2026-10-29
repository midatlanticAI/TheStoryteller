/**
 * The world-pack contract.
 *
 * A story world (Shannara is the first) is a data pack that satisfies this
 * schema. The engine never knows a world by name: everything it needs about
 * races, lands, magic, creatures, items and canon figures comes from here.
 *
 * Entries are paraphrased fact, never quoted text. Each entry carries the id of
 * the source book that first reveals it so a campaign can hide what a reader has
 * not reached yet (see world/gating.ts).
 */
import { z } from "zod";

export const ATTRIBUTES = ["might", "agility", "vigor", "wits", "will", "presence"] as const;
export type AttributeId = (typeof ATTRIBUTES)[number];

export const SKILLS = [
  "melee",
  "archery",
  "stealth",
  "survival",
  "lore",
  "persuasion",
  "perception",
  "athletics",
  "healing",
  "arcana",
  "thievery",
  "command",
] as const;
export type SkillId = (typeof SKILLS)[number];

export const SKILL_ATTRIBUTE: Record<SkillId, AttributeId> = {
  melee: "might",
  archery: "agility",
  stealth: "agility",
  survival: "vigor",
  lore: "wits",
  persuasion: "presence",
  perception: "wits",
  athletics: "might",
  healing: "wits",
  arcana: "will",
  thievery: "agility",
  command: "presence",
};

const Id = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "ids are lowercase kebab-case");

export const AttributeBlock = z.object({
  might: z.number().int().min(1).max(12),
  agility: z.number().int().min(1).max(12),
  vigor: z.number().int().min(1).max(12),
  wits: z.number().int().min(1).max(12),
  will: z.number().int().min(1).max(12),
  presence: z.number().int().min(1).max(12),
});
export type AttributeBlock = z.infer<typeof AttributeBlock>;

export const AttributeMods = AttributeBlock.partial().extend({
  might: z.number().int().min(-3).max(3).optional(),
  agility: z.number().int().min(-3).max(3).optional(),
  vigor: z.number().int().min(-3).max(3).optional(),
  wits: z.number().int().min(-3).max(3).optional(),
  will: z.number().int().min(-3).max(3).optional(),
  presence: z.number().int().min(-3).max(3).optional(),
});
export type AttributeMods = z.infer<typeof AttributeMods>;

export const Book = z.object({
  id: Id,
  title: z.string(),
  /** Reading order across the whole world, 1-based. */
  order: z.number().int().min(1),
  eraId: Id,
  year: z.number().int().optional(),
});
export type Book = z.infer<typeof Book>;

export const Era = z.object({
  id: Id,
  name: z.string(),
  /** Chronological order inside the world, 1-based. */
  order: z.number().int().min(1),
  summary: z.string(),
  /** What the narrator should know about the state of the world in this era. */
  situation: z.string(),
  playable: z.boolean(),
  /** Where a new party begins. */
  startLocationId: Id.optional(),
  /** Books set in this era, in reading order. */
  bookIds: z.array(Id),
});
export type Era = z.infer<typeof Era>;

export const Species = z.object({
  id: Id,
  name: z.string(),
  plural: z.string(),
  summary: z.string(),
  attributeMods: AttributeMods.default({}),
  /** Magic sources this species can reach at all. */
  magicAffinity: z.array(Id).default([]),
  homelandRegionIds: z.array(Id).default([]),
  playable: z.boolean().default(true),
  traits: z.array(z.string()).default([]),
  revealedIn: Id,
});
export type Species = z.infer<typeof Species>;

export const Archetype = z.object({
  id: Id,
  name: z.string(),
  summary: z.string(),
  /** Starting skill ranks, each 0-3. */
  skills: z.partialRecord(z.enum(SKILLS), z.number().int().min(0).max(3)),
  startingItemIds: z.array(Id).default([]),
  speciesAllowed: z.array(Id).optional(),
  magicSourceIds: z.array(Id).default([]),
  revealedIn: Id,
});
export type Archetype = z.infer<typeof Archetype>;

export const Region = z.object({
  id: Id,
  name: z.string(),
  summary: z.string(),
  parentId: Id.optional(),
  /** Whether the pack has enough depth here to play, or only a sketch. */
  status: z.enum(["playable", "sketched"]),
  eraIds: z.array(Id).default([]),
  revealedIn: Id,
});
export type Region = z.infer<typeof Region>;

export const LOCATION_KINDS = [
  "village",
  "town",
  "city",
  "fortress",
  "ruin",
  "wilderness",
  "forest",
  "mountain",
  "river",
  "lake",
  "marsh",
  "plain",
  "landmark",
  "otherworld",
] as const;

export const Exit = z.object({
  to: Id,
  /** Whole days of travel on foot. */
  days: z.number().int().min(0).max(60),
  route: z.string(),
  hazards: z.array(z.string()).default([]),
});
export type Exit = z.infer<typeof Exit>;

export const EncounterEntry = z.object({
  creatureId: Id,
  weight: z.number().min(0),
  /** How many appear, as a dice expression. */
  count: z.string().default("1"),
  /** Only rolled when the party's attention is at or above this. */
  minAttention: z.number().int().min(0).default(0),
});
export type EncounterEntry = z.infer<typeof EncounterEntry>;

export const Location = z.object({
  id: Id,
  name: z.string(),
  regionId: Id,
  kind: z.enum(LOCATION_KINDS),
  summary: z.string(),
  /** Longer notes for the narrator: sights, people, mood, what is true here. */
  description: z.string(),
  /** 0 is safe, 5 is lethal. Drives the chance of an encounter per day. */
  dangerTier: z.number().int().min(0).max(5),
  exits: z.array(Exit).default([]),
  factionIds: z.array(Id).default([]),
  services: z.array(z.enum(["inn", "market", "healer", "smith", "stable", "boat", "temple", "library"])).default([]),
  encounters: z.array(EncounterEntry).default([]),
  tags: z.array(z.string()).default([]),
  eraIds: z.array(Id).default([]),
  revealedIn: Id,
});
export type Location = z.infer<typeof Location>;

export const Faction = z.object({
  id: Id,
  name: z.string(),
  summary: z.string(),
  seatLocationId: Id.optional(),
  stance: z.enum(["ally", "neutral", "hostile", "varies"]),
  eraIds: z.array(Id).default([]),
  revealedIn: Id,
});
export type Faction = z.infer<typeof Faction>;

export const CreatureAttack = z.object({
  name: z.string(),
  /** Bonus added to d20. */
  bonus: z.number().int(),
  damage: z.string(),
  traits: z.array(z.string()).default([]),
});

export const Creature = z.object({
  id: Id,
  name: z.string(),
  plural: z.string().optional(),
  kind: z.enum(["beast", "humanoid", "undead", "spirit", "demon", "construct", "faerie"]),
  summary: z.string(),
  /** 1 trivial, 10 campaign-ending. */
  tier: z.number().int().min(1).max(10),
  vitality: z.number().int().min(1),
  defense: z.number().int().min(5),
  agility: z.number().int().min(1).max(12),
  attacks: z.array(CreatureAttack).min(1),
  traits: z.array(z.string()).default([]),
  /** Facing this creature raises the party's attention by this much. */
  attention: z.number().int().min(0).default(0),
  xp: z.number().int().min(0),
  lootItemIds: z.array(Id).default([]),
  eraIds: z.array(Id).default([]),
  revealedIn: Id,
});
export type Creature = z.infer<typeof Creature>;

export const Item = z.object({
  id: Id,
  name: z.string(),
  kind: z.enum(["weapon", "armor", "shield", "tool", "consumable", "talisman", "relic", "trade", "provision"]),
  summary: z.string(),
  /** Weapons: dice. */
  damage: z.string().optional(),
  /** Weapons: which skill attacks with it. */
  skill: z.enum(["melee", "archery"]).optional(),
  /** Armor and shields: defense bonus. */
  defense: z.number().int().min(0).optional(),
  /** Consumables: vitality healed. */
  heal: z.number().int().optional(),
  value: z.number().int().min(0).default(0),
  magicSourceId: Id.optional(),
  /** A unique canon object the engine will not hand out casually. */
  unique: z.boolean().default(false),
  traits: z.array(z.string()).default([]),
  revealedIn: Id,
});
export type Item = z.infer<typeof Item>;

export const MagicEffect = z.object({
  id: Id,
  name: z.string(),
  summary: z.string(),
  kind: z.enum(["attack", "ward", "seek", "heal", "veil", "command", "reveal", "bind", "travel"]),
  /** Check target: d20 + will + arcana*2 must meet it. */
  difficulty: z.number().int().min(5).max(40),
  strain: z.number().int().min(0),
  attention: z.number().int().min(0),
  damage: z.string().optional(),
  heal: z.number().int().optional(),
});
export type MagicEffect = z.infer<typeof MagicEffect>;

export const MagicSource = z.object({
  id: Id,
  name: z.string(),
  summary: z.string(),
  kind: z.enum(["innate", "learned", "bound-to-item", "faerie", "dark"]),
  /** What the source does to the wielder. */
  cost: z.string(),
  requires: z
    .object({
      speciesIds: z.array(Id).optional(),
      bloodline: z.string().optional(),
      training: z.boolean().optional(),
      itemId: Id.optional(),
    })
    .default({}),
  effects: z.array(MagicEffect).min(1),
  revealedIn: Id,
});
export type MagicSource = z.infer<typeof MagicSource>;

export const CanonFigure = z.object({
  id: Id,
  name: z.string(),
  speciesId: Id,
  summary: z.string(),
  role: z.string(),
  /** Per era: where this figure can plausibly be met. */
  whereabouts: z.array(z.object({ eraId: Id, locationIds: z.array(Id), note: z.string().optional() })),
  /** What this figure knows and will say, in this era. Engine-enforced. */
  knows: z.array(z.string()).default([]),
  /** Hard lines the narrator may not cross with this figure. */
  willNot: z.array(z.string()).default([]),
  /** Voice and manner notes for the narrator. */
  manner: z.string(),
  alive: z.array(Id).default([]),
  revealedIn: Id,
});
export type CanonFigure = z.infer<typeof CanonFigure>;

export const Lore = z.object({
  id: Id,
  title: z.string(),
  body: z.string(),
  tags: z.array(z.string()).default([]),
  eraIds: z.array(Id).default([]),
  revealedIn: Id,
});
export type Lore = z.infer<typeof Lore>;

export const NarratorStyle = z.object({
  voice: z.string(),
  conventions: z.array(z.string()),
  forbidden: z.array(z.string()),
});
export type NarratorStyle = z.infer<typeof NarratorStyle>;

export const WorldPack = z.object({
  id: Id,
  name: z.string(),
  /** The world as a reader would describe it, one paragraph. */
  summary: z.string(),
  attribution: z.string(),
  books: z.array(Book).min(1),
  eras: z.array(Era).min(1),
  species: z.array(Species).min(1),
  archetypes: z.array(Archetype).min(1),
  regions: z.array(Region).min(1),
  locations: z.array(Location).min(1),
  factions: z.array(Faction).default([]),
  creatures: z.array(Creature).min(1),
  items: z.array(Item).min(1),
  magicSources: z.array(MagicSource).default([]),
  canonFigures: z.array(CanonFigure).default([]),
  lore: z.array(Lore).default([]),
  narratorStyle: NarratorStyle,
});
export type WorldPack = z.infer<typeof WorldPack>;

/** The loose input shape authors write (defaults not yet applied). */
export type WorldPackInput = z.input<typeof WorldPack>;
