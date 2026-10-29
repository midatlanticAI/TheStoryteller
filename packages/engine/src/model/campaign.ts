import type { Character } from "./character";
import type { RngState } from "../rng";
import { createRng } from "../rng";
import type { World } from "../world";

export const SAVE_VERSION = 1;

export interface Player {
  id: string;
  name: string;
}

export type PartyMode = "solo" | "hotseat" | "async";

export interface Combatant {
  id: string;
  creatureId: string;
  name: string;
  vitality: { current: number; max: number };
  defense: number;
  alive: boolean;
}

export interface Encounter {
  id: string;
  enemies: Combatant[];
  round: number;
  /** Character and combatant ids in initiative order. */
  order: string[];
  turnIndex: number;
  status: "active" | "won" | "fled" | "lost";
  surprise: "party" | "enemies" | "none";
}

export interface Travel {
  fromLocationId: string;
  toLocationId: string;
  route: string;
  daysTotal: number;
  daysLeft: number;
}

export interface Quest {
  id: string;
  title: string;
  summary: string;
  status: "open" | "done" | "failed";
  steps: { text: string; done: boolean }[];
}

export interface Choice {
  id: string;
  label: string;
  /** The engine actions this choice performs, in order. */
  actions: Action[];
  hint?: string;
}

export interface Scene {
  seq: number;
  turn: number;
  prose: string;
  choices: Choice[];
  chosenChoiceId?: string;
  /** Free-form player input the narrator answered, when not a listed choice. */
  freeText?: string;
  at: string;
}

export interface ActionRecord {
  seq: number;
  turn: number;
  playerId?: string;
  action: Action;
  events: GameEvent[];
  at: string;
}

export interface PendingRound {
  /** Players who still have to submit. */
  waitingFor: string[];
  submitted: Record<string, Action[]>;
}

export interface Campaign {
  version: number;
  id: string;
  name: string;
  worldId: string;
  eraId: string;
  mode: PartyMode;
  players: Player[];
  createdAt: string;
  updatedAt: string;
  rng: RngState;
  turn: number;
  day: number;
  /** 0 dawn, 1 day, 2 dusk, 3 night. */
  watch: number;
  party: {
    memberIds: string[];
    locationId: string;
    travel?: Travel;
    gold: number;
    provisions: number;
  };
  characters: Record<string, Character>;
  /** World-level heat from magic use and notorious deeds. */
  attention: number;
  flags: Record<string, string | number | boolean>;
  quests: Quest[];
  knownBookIds: string[];
  codex: { discoveredIds: string[] };
  journal: Scene[];
  log: ActionRecord[];
  encounter?: Encounter;
  pending?: PendingRound;
  /** Per-campaign narrator notes the GM keeps for itself (threads, promises). */
  gmNotes: string[];
}

export interface NewCampaignInput {
  id: string;
  name: string;
  eraId: string;
  mode: PartyMode;
  players: Player[];
  seed?: number | string;
  knownBookIds?: string[];
  startLocationId?: string;
  now?: string;
}

export function createCampaign(world: World, input: NewCampaignInput): Campaign {
  const era = world.eras.get(input.eraId);
  if (!era) throw new Error(`Unknown era "${input.eraId}"`);
  if (!era.playable) throw new Error(`Era "${era.name}" is not playable yet`);
  const start = input.startLocationId ?? era.startLocationId;
  if (!start || !world.locations.has(start)) throw new Error(`No start location for era "${era.name}"`);
  if (input.players.length === 0) throw new Error("A campaign needs at least one player");
  const now = input.now ?? new Date().toISOString();
  return {
    version: SAVE_VERSION,
    id: input.id,
    name: input.name,
    worldId: world.pack.id,
    eraId: era.id,
    mode: input.mode,
    players: input.players,
    createdAt: now,
    updatedAt: now,
    rng: createRng(input.seed ?? input.id),
    turn: 0,
    day: 1,
    watch: 1,
    party: { memberIds: [], locationId: start, gold: 10, provisions: 6 },
    characters: {},
    attention: 0,
    flags: {},
    quests: [],
    knownBookIds: input.knownBookIds ?? era.bookIds.slice(0, 1),
    codex: { discoveredIds: [start] },
    journal: [],
    log: [],
    gmNotes: [],
  };
}

// Re-exported here so model files can reference them without a cycle.
import type { Action, GameEvent } from "../actions/types";
export type { Action, GameEvent };
