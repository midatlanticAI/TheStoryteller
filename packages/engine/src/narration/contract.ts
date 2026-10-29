/**
 * The narrator output contract and its validation.
 *
 * A narrator (Claude through the API, Claude Code as GM, or the offline
 * narrator) returns a SceneProposal. Nothing in it touches the campaign until
 * the engine has checked every action; illegal choices are dropped and
 * illegal state changes are skipped, and both are reported.
 */
import { z } from "zod";
import type { World } from "../world";
import { SKILLS } from "../world/schema";
import type { Campaign, Choice } from "../model/campaign";
import type { Action } from "../actions/types";
import { applyAction, applyActions, clone } from "../actions/apply";
import { ActionError } from "../actions/types";
import { availableActions } from "../actions/available";
import type { SceneProposal } from "./types";

const Id = z.string().min(1).max(64);
const Skill = z.enum(SKILLS);
const FlagValue = z.union([z.string(), z.number(), z.boolean()]);

/** Every action a narrator may propose. `scene`, `choose`, and raw `recruit` are engine-only. */
export const ProposedActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("travel"), to: Id }),
  z.object({ type: z.literal("continue_travel") }),
  z.object({ type: z.literal("rest"), watches: z.number().int().min(1).max(8).optional() }),
  z.object({ type: z.literal("advance_time"), watches: z.number().int().min(1).max(40) }),
  z.object({ type: z.literal("skill_check"), characterId: Id, skill: Skill, difficulty: z.number().int().min(5).max(40), purpose: z.string().min(1).max(200), flag: z.string().max(64).optional() }),
  z.object({ type: z.literal("start_encounter"), creatureIds: z.array(Id).min(1).max(8), surprise: z.enum(["party", "enemies", "none"]).optional() }),
  z.object({ type: z.literal("attack"), attackerId: Id, targetId: Id }),
  z.object({ type: z.literal("defend"), characterId: Id }),
  z.object({ type: z.literal("flee"), characterId: Id }),
  z.object({ type: z.literal("end_encounter"), outcome: z.enum(["won", "fled", "lost", "talked"]) }),
  z.object({ type: z.literal("cast"), characterId: Id, sourceId: Id, effectId: Id, targetId: Id.optional() }),
  z.object({ type: z.literal("use_item"), characterId: Id, instanceId: Id, targetId: Id.optional() }),
  z.object({ type: z.literal("equip"), characterId: Id, instanceId: Id }),
  z.object({ type: z.literal("grant_item"), characterId: Id, itemId: Id, qty: z.number().int().min(1).max(99).optional(), reason: z.string().max(200).optional() }),
  z.object({ type: z.literal("remove_item"), characterId: Id, instanceId: Id, qty: z.number().int().min(1).max(99).optional() }),
  z.object({ type: z.literal("grant_gold"), amount: z.number().int().min(0).max(100000), reason: z.string().max(200).optional() }),
  z.object({ type: z.literal("spend_gold"), amount: z.number().int().min(0).max(100000), reason: z.string().max(200).optional() }),
  z.object({ type: z.literal("grant_provisions"), amount: z.number().int().min(-99).max(99) }),
  z.object({ type: z.literal("grant_xp"), characterId: Id.optional(), amount: z.number().int().min(0).max(5000), reason: z.string().min(1).max(200) }),
  z.object({ type: z.literal("improve_skill"), characterId: Id, skill: Skill }),
  z.object({ type: z.literal("damage"), targetId: Id, amount: z.number().int().min(1).max(200), source: z.string().min(1).max(100) }),
  z.object({ type: z.literal("heal"), targetId: Id, amount: z.number().int().min(1).max(200), source: z.string().min(1).max(100) }),
  z.object({ type: z.literal("add_condition"), characterId: Id, condition: z.string().min(1).max(40) }),
  z.object({ type: z.literal("remove_condition"), characterId: Id, condition: z.string().min(1).max(40) }),
  z.object({ type: z.literal("set_flag"), key: z.string().min(1).max(64), value: FlagValue }),
  z.object({ type: z.literal("add_quest"), id: Id, title: z.string().min(1).max(100), summary: z.string().max(400), steps: z.array(z.string().max(200)).max(10).optional() }),
  z.object({ type: z.literal("update_quest"), id: Id, status: z.enum(["open", "done", "failed"]).optional(), completeStep: z.number().int().min(0).optional(), addStep: z.string().max(200).optional() }),
  z.object({ type: z.literal("discover"), entryId: Id }),
  z.object({ type: z.literal("recruit_new"), id: Id, name: z.string().min(1).max(60), speciesId: Id, archetypeId: Id, background: z.string().max(400).optional(), playerId: Id.optional() }),
  z.object({ type: z.literal("dismiss"), characterId: Id }),
  z.object({ type: z.literal("raise_attention"), amount: z.number().int().min(1).max(50), reason: z.string().min(1).max(200) }),
  z.object({ type: z.literal("gm_note"), text: z.string().min(1).max(500) }),
]);
export type ProposedAction = z.infer<typeof ProposedActionSchema>;

export const ChoiceSchema = z.object({
  id: Id,
  label: z.string().min(1).max(120),
  hint: z.string().max(200).optional(),
  actions: z.array(ProposedActionSchema).max(6),
});

export const SceneProposalSchema = z.object({
  prose: z.string().min(1).max(6000),
  choices: z.array(ChoiceSchema).min(1).max(6),
  stateChanges: z.array(ProposedActionSchema).max(12),
  gmNote: z.string().max(500).optional(),
});

/** A JSON-schema rendering of the contract, for tool definitions outside the SDK. */
export function sceneProposalJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(SceneProposalSchema) as Record<string, unknown>;
}

export interface ValidatedScene {
  campaign: Campaign;
  scene: Extract<Action, { type: "scene" }>;
  problems: string[];
  applied: Action[];
}

/**
 * Applies the legal state changes, drops illegal choices, and builds the
 * `scene` action. Falls back to the engine's own choices when none survive.
 */
export function validateProposal(world: World, campaign: Campaign, proposal: SceneProposal, freeText?: string): ValidatedScene {
  const problems: string[] = [];
  const applied: Action[] = [];
  let current = campaign;
  for (const change of proposal.stateChanges) {
    try {
      current = applyAction(world, current, change).campaign;
      applied.push(change);
    } catch (err) {
      problems.push(`state change ${describe(change)} skipped: ${reason(err)}`);
    }
  }
  if (proposal.gmNote) {
    current = applyAction(world, current, { type: "gm_note", text: proposal.gmNote }).campaign;
  }
  const choices: Choice[] = [];
  const ids = new Set<string>();
  for (const choice of proposal.choices) {
    if (ids.has(choice.id)) {
      problems.push(`choice "${choice.id}" duplicated; dropped`);
      continue;
    }
    try {
      applyActions(world, clone(current), choice.actions as Action[]);
      choices.push({ id: choice.id, label: choice.label, actions: choice.actions as Action[], ...(choice.hint ? { hint: choice.hint } : {}) });
      ids.add(choice.id);
    } catch (err) {
      problems.push(`choice "${choice.label}" dropped: ${reason(err)}`);
    }
  }
  if (choices.length === 0) {
    problems.push("no proposed choice was legal; offering the engine's own");
    for (const [i, a] of availableActions(world, current).slice(0, 6).entries()) {
      choices.push({ id: `e${i + 1}`, label: a.label, actions: [a.action] });
    }
  }
  const scene: Extract<Action, { type: "scene" }> = { type: "scene", prose: proposal.prose, choices, ...(freeText ? { freeText } : {}) };
  current = applyAction(world, current, scene).campaign;
  return { campaign: current, scene, problems, applied };
}

function describe(a: Action): string {
  return a.type;
}

function reason(err: unknown): string {
  if (err instanceof ActionError) return err.message;
  return err instanceof Error ? err.message : String(err);
}

/** The Game Master's standing orders, shared by every narrator. */
export const GM_INSTRUCTIONS = `You are the Game Master of a tabletop role-playing campaign. A rules engine owns the truth about the world and the party; you own the prose and the choices.

Each turn you receive the standing canon (world, era, peoples, magic, factions, canon figures, lore, rules) and the current state (place, roads, party, fight, quests, flags, recent scenes), plus what the player did and the engine events that resulted.

Return one scene:
- prose: 120 to 350 words of narration in the world's voice, continuing from the events. Never narrate dice outcomes the engine has not rolled; narrate the events you were given.
- choices: 2 to 5 options. Each has an id, a short label, and the engine actions it performs, in order. Use only characters, locations, items, creatures, magic sources, and effects named in the context by their ids. A choice may carry no actions when it is pure conversation; the engine will still record it.
- stateChanges: actions to apply before the scene is shown (a reward, a quest step, a flag, a discovered codex entry, a recruit). Keep them few and earned.
- gmNote: a private note to yourself for later turns (a thread, a promise, a secret).

Rules:
- Uncertain outcomes are skill_check actions with a purpose and a difficulty from the bands (trivial 8, easy 12, moderate 16, hard 20, heroic 25, legendary 30). Set a flag on checks that later scenes should branch on, and read the flag next turn.
- Fights are start_encounter with creature ids from the known threats; once a fight is active, offer only the legal combat actions listed.
- Experience: 10 to 50 for a milestone, never for routine.
- Unique canon objects need their canon flag set first, and are earned at the story's end, not its start.
- Canon figures appear only where their entry allows, know only what it lists, and never cross their lines. They are rare.
- Keep the party inside playable regions and the era. Never reveal anything beyond the reading gate.
- Companions controlled by the engine (marked "companion") speak and act; give them opinions.
- If the player writes free text, honour the intent with a legal action or explain in prose why the world resists.`;
