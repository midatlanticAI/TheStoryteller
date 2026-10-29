import type { World } from "../world";
import type { Campaign } from "../model/campaign";
import type { Action, GameEvent } from "../actions/types";
import { applyAction } from "../actions/apply";
import { describeEvents } from "./context";
import { offlineNarrate } from "./offline";
import { validateProposal } from "./contract";
import type { NarratorInput, SceneProposal } from "./types";

/** Anything that can write a scene for a campaign state. */
export interface Narrator {
  readonly name: string;
  narrate(world: World, campaign: Campaign, input: NarratorInput, events: GameEvent[]): Promise<SceneProposal>;
}

export const offlineNarrator: Narrator = {
  name: "offline",
  async narrate(world, campaign, input, events) {
    return offlineNarrate(world, campaign, input, events);
  },
};

export interface TurnInput {
  /** The id of a choice from the latest scene, or undefined for free text or the opening scene. */
  choiceId?: string;
  /** Free text the player typed instead of a choice. */
  freeText?: string;
  playerId?: string;
}

export interface TurnResult {
  campaign: Campaign;
  events: GameEvent[];
  eventText: string[];
  problems: string[];
  narrator: string;
}

/**
 * One full turn: apply the player's choice, ask the narrator, validate what it
 * proposes, record the scene. Falls back to the offline narrator if the
 * narrator throws, so a network failure never loses a turn.
 */
export async function runTurn(world: World, campaign: Campaign, narrator: Narrator, input: TurnInput): Promise<TurnResult> {
  let current = campaign;
  const events: GameEvent[] = [];
  let playerInput = input.freeText ?? "";
  if (input.choiceId) {
    const r = applyAction(world, current, { type: "choose", choiceId: input.choiceId }, { playerId: input.playerId });
    current = r.campaign;
    events.push(...r.events);
    const scene = current.journal[current.journal.length - 1];
    playerInput = scene?.choices.find((c) => c.id === input.choiceId)?.label ?? input.choiceId;
  }
  const eventText = describeEvents(world, current, events);
  let proposal: SceneProposal;
  let used = narrator.name;
  const problems: string[] = [];
  try {
    proposal = await narrator.narrate(world, current, { playerInput, recentEvents: eventText }, events);
  } catch (err) {
    problems.push(`${narrator.name} failed: ${err instanceof Error ? err.message : String(err)}`);
    proposal = offlineNarrate(world, current, { playerInput, recentEvents: eventText }, events);
    used = "offline";
  }
  const validated = validateProposal(world, current, proposal, input.freeText);
  problems.push(...validated.problems);
  return { campaign: validated.campaign, events, eventText, problems, narrator: used };
}

/** The actions a narrator proposed and the engine accepted, for logs. */
export function acceptedActions(c: Campaign): Action[] {
  return c.log.map((l) => l.action);
}
