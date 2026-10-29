import type { World } from "../world";
import type { Campaign, Choice } from "../model/campaign";
import type { GameEvent } from "../actions/types";
import { availableActions } from "../actions/available";
import { describeEvents } from "./context";
import type { SceneProposal, NarratorInput } from "./types";
import { watchName } from "../rules/travel";

/**
 * A narrator that needs no model. It writes plain scene text from the engine's
 * events and offers every legal action as a choice. Used for tests, for play
 * without any AI, and as the fallback when a model call fails.
 */
export function offlineNarrate(world: World, c: Campaign, input: NarratorInput, events: GameEvent[]): SceneProposal {
  const loc = world.locations.get(c.party.locationId)!;
  const lines: string[] = [];
  const told = describeEvents(world, c, events);
  if (told.length) lines.push(told.join(" "));
  if (c.encounter?.status === "active") {
    const e = c.encounter;
    const standing = e.enemies.filter((x) => x.alive).map((x) => `${x.name} (${x.vitality.current}/${x.vitality.max})`);
    lines.push(`Round ${e.round}. Still standing: ${standing.join(", ")}.`);
  } else if (c.party.travel) {
    const dest = world.locations.get(c.party.travel.toLocationId)!;
    lines.push(`The road to ${dest.name} runs on. ${c.party.travel.daysLeft} day(s) remain. It is ${watchName(c.watch)} on day ${c.day}.`);
  } else {
    lines.push(`${loc.name}. ${loc.summary} It is ${watchName(c.watch)} on day ${c.day}.`);
  }
  if (input.playerInput && !told.length) lines.unshift(`You consider: "${input.playerInput}".`);

  const legal = availableActions(world, c);
  const choices: Choice[] = legal.slice(0, 8).map((a, i) => ({ id: `c${i + 1}`, label: a.label, actions: [a.action] }));
  return { prose: lines.join("\n\n"), choices, stateChanges: [] };
}
