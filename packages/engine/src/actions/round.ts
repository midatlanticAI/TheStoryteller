import type { World } from "../world";
import type { Campaign } from "../model/campaign";
import type { Action, GameEvent } from "./types";
import { applyActions, clone } from "./apply";

/**
 * Asynchronous party play. Each human player submits their actions; when every
 * player has, the round resolves in player order. Solo and hotseat campaigns
 * never use a pending round and apply actions directly.
 */
export function openRound(c: Campaign): Campaign {
  const next = clone(c);
  next.pending = { waitingFor: c.players.map((p) => p.id), submitted: {} };
  return next;
}

export interface SubmitResult {
  campaign: Campaign;
  resolved: boolean;
  events: GameEvent[];
}

export function submitActions(world: World, c: Campaign, playerId: string, actions: Action[]): SubmitResult {
  if (c.mode !== "async") throw new Error("submitActions is only for async campaigns");
  if (!c.players.some((p) => p.id === playerId)) throw new Error(`unknown player "${playerId}"`);
  const current = c.pending ? clone(c) : openRound(c);
  const pending = current.pending!;
  if (!pending.waitingFor.includes(playerId)) throw new Error(`${playerId} already submitted this round`);
  pending.submitted[playerId] = actions;
  pending.waitingFor = pending.waitingFor.filter((id) => id !== playerId);
  if (pending.waitingFor.length > 0) return { campaign: current, resolved: false, events: [] };

  let resolved = current;
  delete resolved.pending;
  const events: GameEvent[] = [];
  for (const player of c.players) {
    const queued = pending.submitted[player.id] ?? [];
    const r = applyActions(world, resolved, queued, { playerId: player.id });
    resolved = r.campaign;
    events.push(...r.events);
  }
  return { campaign: resolved, resolved: true, events };
}
