import type { Action } from "../actions/types";
import type { Choice } from "../model/campaign";

/**
 * What a narrator returns for one turn. The engine turns this into a `scene`
 * action (prose + choices) after validating every proposed action.
 */
export interface SceneProposal {
  prose: string;
  choices: Choice[];
  /** Changes the narrator wants applied before the scene is shown. */
  stateChanges: Action[];
  /** A private note the GM keeps for later turns. */
  gmNote?: string;
}

export interface NarratorInput {
  /** The player's free-text intent for this turn, or the chosen choice's label. */
  playerInput: string;
  /** Events produced by the actions applied just before narration. */
  recentEvents: string[];
}
