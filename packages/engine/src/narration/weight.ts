import type { World } from "../world";
import type { Campaign } from "../model/campaign";
import type { GameEvent } from "../actions/types";
import { gateFromBooks, revealed } from "../world/gating";

export type SceneWeight = "light" | "standard" | "epic";

export interface WeightVerdict {
  weight: SceneWeight;
  reason: string;
}

/**
 * How much a scene matters, so a narrator can spend its best model where the
 * story turns and a quick one where the party walks another day of road.
 */
export function sceneWeight(world: World, c: Campaign, events: GameEvent[], input: { freeText?: string }): WeightVerdict {
  if (c.journal.length === 0) return { weight: "epic", reason: "the opening scene" };
  for (const e of events) {
    if (e.type === "party_wiped") return { weight: "epic", reason: "the party has fallen" };
    if (e.type === "fell" && e.kind === "character") return { weight: "epic", reason: `${e.targetName} fell` };
    if (e.type === "collapsed") return { weight: "epic", reason: "magic overwhelmed someone" };
    if (e.type === "encounter_started") return { weight: "epic", reason: "a fight begins" };
    if (e.type === "encounter_ended") return { weight: "epic", reason: "a fight ends" };
    if (e.type === "attention_rose" && e.threshold) return { weight: "epic", reason: `the party is now ${e.threshold}` };
    if (e.type === "level_up") return { weight: "epic", reason: "someone grew stronger" };
    if (e.type === "quest_added" || (e.type === "quest_updated" && e.status !== "open")) return { weight: "epic", reason: "a quest turns" };
    if (e.type === "roll" && e.critical) return { weight: "epic", reason: `a critical ${e.critical === "hit" ? "success" : "failure"}` };
  }
  const gate = gateFromBooks(world, c.knownBookIds);
  const here = c.party.travel ? undefined : c.party.locationId;
  if (here) {
    const figures = revealed(world, gate, world.canonFigures.values()).filter((f) =>
      f.whereabouts.some((w) => w.eraId === c.eraId && w.locationIds.includes(here)),
    );
    const arrived = events.some((e) => e.type === "arrived");
    if (arrived && figures.length) return { weight: "epic", reason: `${figures[0]!.name} may be near` };
    const loc = world.locations.get(here);
    if (arrived && loc && loc.dangerTier >= 4) return { weight: "epic", reason: `arriving at ${loc.name}` };
  }
  if (input.freeText) return { weight: "standard", reason: "reading what a player wrote" };
  if (events.some((e) => e.type === "arrived" || e.type === "discovered" || e.type === "recruited" || e.type === "player_joined")) {
    return { weight: "standard", reason: "somewhere or someone new" };
  }
  if (events.some((e) => e.type === "roll" && e.characterId in c.characters && !c.encounter)) return { weight: "standard", reason: "a check outside a fight" };
  const routine = events.every((e) =>
    ["choice_made", "travel_started", "travel_progress", "time_passed", "provisions_used", "rested", "roll", "damage", "defended", "item_used", "equipped", "healed", "strain_gained", "flag_set", "initiative", "gm_note", "scene_recorded"].includes(e.type),
  );
  if (routine) return { weight: "light", reason: c.encounter?.status === "active" ? "another exchange of blows" : "the road goes on" };
  return { weight: "standard", reason: "an ordinary turn" };
}
