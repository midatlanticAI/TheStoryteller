import type { SkillId } from "../world/schema";
import type { Character } from "../model/character";
import type { Choice } from "../model/campaign";
import type { DiceRoll } from "../dice";

/**
 * Every change to a campaign is one of these. The narrator may only propose
 * them; the engine validates and applies them. Anything the narrator wants to
 * happen that is not expressible here does not happen.
 */
export type Action =
  | { type: "travel"; to: string }
  | { type: "continue_travel" }
  | { type: "rest"; watches?: number }
  | { type: "advance_time"; watches: number }
  | {
      type: "skill_check";
      characterId: string;
      skill: SkillId;
      difficulty: number;
      purpose: string;
      /** Flag set to "success" | "failure" so later scenes can branch on it. */
      flag?: string;
    }
  | { type: "start_encounter"; creatureIds: string[]; surprise?: "party" | "enemies" | "none" }
  | { type: "attack"; attackerId: string; targetId: string }
  | { type: "defend"; characterId: string }
  | { type: "flee"; characterId: string }
  | { type: "enemy_turn"; combatantId: string }
  | { type: "end_encounter"; outcome: "won" | "fled" | "lost" | "talked" }
  | { type: "cast"; characterId: string; sourceId: string; effectId: string; targetId?: string }
  | { type: "use_item"; characterId: string; instanceId: string; targetId?: string }
  | { type: "equip"; characterId: string; instanceId: string }
  | { type: "grant_item"; characterId: string; itemId: string; qty?: number; reason?: string }
  | { type: "remove_item"; characterId: string; instanceId: string; qty?: number }
  | { type: "grant_gold"; amount: number; reason?: string }
  | { type: "spend_gold"; amount: number; reason?: string }
  | { type: "grant_provisions"; amount: number }
  | { type: "grant_xp"; characterId?: string; amount: number; reason: string }
  | { type: "improve_skill"; characterId: string; skill: SkillId }
  | { type: "damage"; targetId: string; amount: number; source: string }
  | { type: "heal"; targetId: string; amount: number; source: string }
  | { type: "add_condition"; characterId: string; condition: string }
  | { type: "remove_condition"; characterId: string; condition: string }
  | { type: "set_flag"; key: string; value: string | number | boolean }
  | { type: "add_quest"; id: string; title: string; summary: string; steps?: string[] }
  | { type: "update_quest"; id: string; status?: "open" | "done" | "failed"; completeStep?: number; addStep?: string }
  | { type: "discover"; entryId: string }
  | { type: "recruit"; character: Character }
  | { type: "dismiss"; characterId: string }
  | { type: "raise_attention"; amount: number; reason: string }
  | { type: "gm_note"; text: string }
  | { type: "scene"; prose: string; choices: Choice[]; freeText?: string }
  | { type: "choose"; choiceId: string };

export type ActionType = Action["type"];

export interface RollEvent {
  type: "roll";
  characterId: string;
  label: string;
  roll: DiceRoll;
  bonus: number;
  total: number;
  target: number;
  success: boolean;
  margin: number;
  critical?: "hit" | "miss";
}

export type GameEvent =
  | RollEvent
  | { type: "travel_started"; to: string; route: string; days: number }
  | { type: "travel_progress"; to: string; daysLeft: number }
  | { type: "arrived"; locationId: string }
  | { type: "time_passed"; watches: number; day: number; watch: number }
  | { type: "rested"; characterId: string; vitality: number; strain: number }
  | { type: "provisions_used"; remaining: number }
  | { type: "starving"; characterIds: string[] }
  | { type: "encounter_started"; encounterId: string; enemies: { id: string; name: string }[]; surprise: string }
  | { type: "encounter_ended"; outcome: string }
  | { type: "initiative"; order: { id: string; name: string; value: number }[] }
  | { type: "damage"; targetId: string; targetName: string; amount: number; source: string; remaining: number }
  | { type: "healed"; targetId: string; targetName: string; amount: number; source: string }
  | { type: "fell"; targetId: string; targetName: string; kind: "character" | "enemy" }
  | { type: "fled"; characterId: string; success: boolean }
  | { type: "defended"; characterId: string }
  | { type: "cast"; characterId: string; sourceName: string; effectName: string; success: boolean; strain: number; attention: number }
  | { type: "strain_gained"; characterId: string; amount: number; current: number; max: number }
  | { type: "collapsed"; characterId: string }
  | { type: "attention_rose"; amount: number; total: number; reason: string; threshold?: "noticed" | "hunted" | "marked" }
  | { type: "item_gained"; characterId: string; itemId: string; qty: number; reason?: string }
  | { type: "item_lost"; characterId: string; itemId: string; qty: number }
  | { type: "item_used"; characterId: string; itemId: string }
  | { type: "equipped"; characterId: string; itemId: string }
  | { type: "gold_changed"; delta: number; total: number; reason?: string }
  | { type: "xp_gained"; characterId: string; amount: number; total: number; reason: string }
  | { type: "level_up"; characterId: string; level: number }
  | { type: "skill_improved"; characterId: string; skill: string; rank: number }
  | { type: "condition_added"; characterId: string; condition: string }
  | { type: "condition_removed"; characterId: string; condition: string }
  | { type: "flag_set"; key: string; value: string | number | boolean }
  | { type: "quest_added"; id: string; title: string }
  | { type: "quest_updated"; id: string; status: string }
  | { type: "discovered"; entryId: string }
  | { type: "recruited"; characterId: string; name: string }
  | { type: "dismissed"; characterId: string }
  | { type: "scene_recorded"; seq: number }
  | { type: "choice_made"; choiceId: string; label: string }
  | { type: "gm_note"; text: string }
  | { type: "party_wiped" };

export interface ValidationProblem {
  action: Action;
  reason: string;
}

export class ActionError extends Error {
  constructor(public readonly action: Action, reason: string) {
    super(`${action.type}: ${reason}`);
    this.name = "ActionError";
  }
}
