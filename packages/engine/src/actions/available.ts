import type { World } from "../world";
import type { Campaign } from "../model/campaign";
import type { Action } from "./types";
import { canCast } from "../rules/magic";

export interface AvailableAction {
  action: Action;
  label: string;
  group: "travel" | "rest" | "combat" | "magic" | "item" | "party";
}

/**
 * The actions a player could take right now, with labels. The offline narrator
 * turns these into choices; the UI can offer them directly; the GM sees them
 * in its context so it never offers something the engine will refuse.
 */
export function availableActions(world: World, c: Campaign): AvailableAction[] {
  const out: AvailableAction[] = [];
  const members = c.party.memberIds.map((id) => c.characters[id]!).filter((m) => m && m.alive);
  const fight = c.encounter?.status === "active" ? c.encounter : undefined;

  if (fight) {
    const currentId = fight.order[fight.turnIndex];
    const actor = currentId ? c.characters[currentId] : undefined;
    if (actor && actor.alive) {
      const living = fight.enemies.filter((e) => e.alive);
      for (const en of living) {
        out.push({ action: { type: "attack", attackerId: actor.id, targetId: en.id }, label: `${actor.name} attacks ${en.name}`, group: "combat" });
      }
      out.push({ action: { type: "defend", characterId: actor.id }, label: `${actor.name} holds and defends`, group: "combat" });
      out.push({ action: { type: "flee", characterId: actor.id }, label: `${actor.name} leads a retreat`, group: "combat" });
      pushMagic(world, c, actor.id, living[0]?.id, out);
      pushItems(world, c, actor.id, out);
    }
    return out;
  }

  const loc = world.locations.get(c.party.locationId);
  if (c.party.travel) {
    out.push({ action: { type: "continue_travel" }, label: `Press on toward ${world.locations.get(c.party.travel.toLocationId)?.name ?? "the destination"}`, group: "travel" });
    out.push({ action: { type: "rest", watches: 2 }, label: "Make camp for the night", group: "rest" });
  } else if (loc) {
    for (const exit of loc.exits) {
      const dest = world.locations.get(exit.to);
      if (!dest) continue;
      const days = exit.days === 0 ? "nearby" : exit.days === 1 ? "a day" : `${exit.days} days`;
      out.push({ action: { type: "travel", to: exit.to }, label: `Travel to ${dest.name} (${days}, ${exit.route})`, group: "travel" });
    }
    out.push({ action: { type: "rest", watches: 2 }, label: loc.services.includes("inn") ? "Rest at the inn" : "Rest and make camp", group: "rest" });
  }
  for (const m of members) {
    pushMagic(world, c, m.id, undefined, out);
    pushItems(world, c, m.id, out);
  }
  return out;
}

function pushMagic(world: World, c: Campaign, characterId: string, defaultTarget: string | undefined, out: AvailableAction[]) {
  const ch = c.characters[characterId]!;
  const sources = new Set<string>(ch.magicSourceIds);
  for (const inst of ch.inventory) {
    const item = world.items.get(inst.itemId);
    if (item?.magicSourceId) sources.add(item.magicSourceId);
  }
  for (const sourceId of sources) {
    const source = world.magicSources.get(sourceId);
    if (!source) continue;
    for (const effect of source.effects) {
      if (!canCast(world, ch, sourceId, effect.id).allowed) continue;
      if (effect.kind === "attack" && !defaultTarget) continue;
      out.push({
        action: { type: "cast", characterId, sourceId, effectId: effect.id, ...(defaultTarget && effect.kind === "attack" ? { targetId: defaultTarget } : {}) },
        label: `${ch.name}: ${source.name}, ${effect.name}`,
        group: "magic",
      });
    }
  }
}

function pushItems(world: World, c: Campaign, characterId: string, out: AvailableAction[]) {
  const ch = c.characters[characterId]!;
  for (const inst of ch.inventory) {
    const item = world.items.get(inst.itemId);
    if (!item) continue;
    if ((item.kind === "consumable" && item.heal) || item.kind === "provision") {
      out.push({ action: { type: "use_item", characterId, instanceId: inst.instanceId }, label: `${ch.name} uses ${item.name}`, group: "item" });
    }
  }
}
