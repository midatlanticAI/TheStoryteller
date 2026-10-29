import type { Character } from "../model/character";
import type { World, MagicEffect, MagicSource } from "../world";
import { equippedItemId } from "../model/character";

/** Attention thresholds: past each one the world starts to react. */
export const ATTENTION = { noticed: 10, hunted: 25, marked: 50 } as const;

export function attentionThreshold(before: number, after: number): "noticed" | "hunted" | "marked" | undefined {
  if (before < ATTENTION.marked && after >= ATTENTION.marked) return "marked";
  if (before < ATTENTION.hunted && after >= ATTENTION.hunted) return "hunted";
  if (before < ATTENTION.noticed && after >= ATTENTION.noticed) return "noticed";
  return undefined;
}

export interface CastPermission {
  allowed: boolean;
  reason?: string;
  source?: MagicSource;
  effect?: MagicEffect;
}

/** Can this character use this source and effect right now? */
export function canCast(world: World, c: Character, sourceId: string, effectId: string): CastPermission {
  const source = world.magicSources.get(sourceId);
  if (!source) return { allowed: false, reason: `unknown magic source "${sourceId}"` };
  const effect = source.effects.find((e) => e.id === effectId);
  if (!effect) return { allowed: false, reason: `${source.name} has no effect "${effectId}"` };
  const species = world.species.get(c.speciesId);
  if (species && !species.magicAffinity.includes(source.id)) {
    return { allowed: false, reason: `${species.plural} cannot wield ${source.name}` };
  }
  if (source.requires.speciesIds && !source.requires.speciesIds.includes(c.speciesId)) {
    return { allowed: false, reason: `${source.name} answers only to certain bloods` };
  }
  if (source.requires.itemId) {
    const holds = c.inventory.some((i) => i.itemId === source.requires.itemId);
    const talisman = equippedItemId(c, "talisman");
    if (!holds && talisman !== source.requires.itemId) {
      return { allowed: false, reason: `${source.name} needs ${world.items.get(source.requires.itemId)?.name ?? "its focus"}` };
    }
  }
  if ((source.kind === "innate" || source.kind === "learned") && !c.magicSourceIds.includes(source.id)) {
    return { allowed: false, reason: `${c.name} does not have ${source.name}` };
  }
  if (c.conditions.includes("collapsed")) return { allowed: false, reason: `${c.name} has collapsed and cannot reach the magic` };
  return { allowed: true, source, effect };
}
