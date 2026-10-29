import type { World, CanonFigure, Location } from "../world";
import { gateFromBooks, inEra, revealed } from "../world/gating";
import type { Campaign } from "../model/campaign";
import type { Character } from "../model/character";
import type { GameEvent } from "../actions/types";
import { availableActions } from "../actions/available";
import { watchName } from "../rules/travel";
import { difficultyName } from "../rules/checks";
import { ATTENTION } from "../rules/magic";
import { xpToNext } from "../rules/progression";

/**
 * Two blocks of text for a narrator: a stable one that only changes when the
 * era or the reading gate changes (cacheable), and a small per-turn one.
 */
export interface NarratorContext {
  stable: string;
  dynamic: string;
  /** The legal engine actions right now, for the narrator to build choices from. */
  legal: ReturnType<typeof availableActions>;
}

export function buildNarratorContext(world: World, c: Campaign): NarratorContext {
  return { stable: stableBlock(world, c), dynamic: dynamicBlock(world, c), legal: availableActions(world, c) };
}

export function stableBlock(world: World, c: Campaign): string {
  const gate = gateFromBooks(world, c.knownBookIds);
  const era = world.eras.get(c.eraId)!;
  const style = world.pack.narratorStyle;
  const lines: string[] = [];
  lines.push(`# World: ${world.pack.name}`);
  lines.push(world.pack.summary);
  lines.push("");
  lines.push(`# Era: ${era.name}`);
  lines.push(era.summary);
  lines.push("");
  lines.push("## The state of the world in this era");
  lines.push(era.situation);
  lines.push("");
  lines.push("## Narrator voice");
  lines.push(style.voice);
  lines.push("Conventions:");
  for (const s of style.conventions) lines.push(`- ${s}`);
  lines.push("Never:");
  for (const s of style.forbidden) lines.push(`- ${s}`);
  lines.push("");
  lines.push("## Reading gate");
  const known = c.knownBookIds.includes("*")
    ? "every book"
    : c.knownBookIds.map((id) => world.books.get(id)?.title ?? id).join(", ");
  lines.push(`The players know: ${known}. Everything below is what they may learn. Never reveal, hint at, or foreshadow anything from later books.`);
  lines.push("");
  lines.push("## Peoples");
  for (const s of revealed(world, gate, world.species.values())) {
    lines.push(`- ${s.name} (${s.plural}): ${s.summary}${s.traits.length ? ` Traits: ${s.traits.join("; ")}.` : ""}`);
  }
  lines.push("");
  lines.push("## Regions");
  for (const r of revealed(world, gate, inEra(c.eraId, [...world.regions.values()]))) {
    lines.push(`- ${r.name}${r.status === "sketched" ? " (only sketched: keep the party out of it)" : ""}: ${r.summary}`);
  }
  lines.push("");
  lines.push("## Magic and its cost");
  for (const m of revealed(world, gate, world.magicSources.values())) {
    lines.push(`- ${m.name} (${m.kind}): ${m.summary} Cost: ${m.cost}`);
    for (const e of m.effects) lines.push(`  - ${e.name} [${e.id}]: ${e.summary} (${difficultyName(e.difficulty)}, strain ${e.strain}, attention ${e.attention})`);
  }
  lines.push("");
  lines.push("## Factions");
  for (const f of revealed(world, gate, inEra(c.eraId, [...world.factions.values()]))) {
    lines.push(`- ${f.name} (${f.stance}): ${f.summary}`);
  }
  lines.push("");
  lines.push("## Canon figures alive in this era (untouchable)");
  lines.push("These people exist independently of the party. Voice them, never change them. They do only what their entry allows, know only what it lists, and are met only where it says.");
  for (const cf of revealed(world, gate, world.canonFigures.values())) {
    if (cf.alive.length && !cf.alive.includes(c.eraId)) continue;
    const where = cf.whereabouts.find((w) => w.eraId === c.eraId);
    if (!where) continue;
    lines.push(`- ${cf.name} (${world.species.get(cf.speciesId)?.name ?? cf.speciesId}), ${cf.role}: ${cf.summary}`);
    lines.push(`  Manner: ${cf.manner}`);
    lines.push(`  Can be met at: ${where.locationIds.map((id) => world.locations.get(id)?.name ?? id).join(", ")}${where.note ? ` (${where.note})` : ""}`);
    if (cf.knows.length) lines.push(`  Knows: ${cf.knows.join("; ")}`);
    if (cf.willNot.length) lines.push(`  Will not: ${cf.willNot.join("; ")}`);
  }
  lines.push("");
  lines.push("## Lore");
  for (const l of revealed(world, gate, inEra(c.eraId, [...world.lore.values()]))) {
    lines.push(`### ${l.title}`);
    lines.push(l.body);
  }
  lines.push("");
  lines.push("## Rules the engine enforces");
  lines.push(`- Checks are d20 + attribute modifier + 2 x skill rank against a difficulty: trivial 8, easy 12, moderate 16, hard 20, heroic 25, legendary 30.`);
  lines.push(`- Magic costs strain; at full strain a character collapses. Magic and notorious deeds raise attention; past ${ATTENTION.noticed} the party is noticed, past ${ATTENTION.hunted} hunted, past ${ATTENTION.marked} marked by the enemy.`);
  lines.push("- Unique canon objects cannot be handed out unless the engine's canon flag for them is set, and only once.");
  lines.push("- A day has four watches: dawn, day, dusk, night. Travel costs provisions; hunger stops healing.");
  return lines.join("\n");
}

export function dynamicBlock(world: World, c: Campaign): string {
  const gate = gateFromBooks(world, c.knownBookIds);
  const lines: string[] = [];
  const loc = world.locations.get(c.party.locationId)!;
  lines.push(`# Now`);
  lines.push(`Day ${c.day}, ${watchName(c.watch)}. Turn ${c.turn}. Attention ${c.attention}${attentionWord(c.attention)}. Gold ${c.party.gold}. Provisions ${c.party.provisions}.`);
  if (c.party.travel) {
    const dest = world.locations.get(c.party.travel.toLocationId)!;
    lines.push(`The party is on the road from ${loc.name} to ${dest.name} by ${c.party.travel.route}, ${c.party.travel.daysLeft} day(s) left.`);
  }
  lines.push("");
  lines.push(`## Here: ${loc.name} (${loc.kind}, danger ${loc.dangerTier})`);
  lines.push(loc.description);
  if (loc.services.length) lines.push(`Services: ${loc.services.join(", ")}.`);
  if (loc.factionIds.length) lines.push(`Present: ${loc.factionIds.map((id) => world.factions.get(id)?.name ?? id).join(", ")}.`);
  lines.push("Roads out:");
  for (const x of loc.exits) {
    const dest = world.locations.get(x.to);
    if (!dest) continue;
    lines.push(`- ${dest.name} [${dest.id}]: ${x.days} day(s) by ${x.route}${x.hazards.length ? `; hazards: ${x.hazards.join(", ")}` : ""}. ${dest.summary}`);
  }
  const figuresHere = revealed(world, gate, world.canonFigures.values()).filter((f) => figureHere(f, c.eraId, loc));
  if (figuresHere.length) lines.push(`Canon figures who could be here: ${figuresHere.map((f) => f.name).join(", ")}.`);
  const threats = loc.encounters.filter((e) => c.attention >= e.minAttention).map((e) => world.creatures.get(e.creatureId)).filter(Boolean);
  if (threats.length) lines.push(`Known threats around here: ${threats.map((t) => `${t!.name} [${t!.id}]`).join(", ")}.`);
  lines.push("");
  lines.push("## Party");
  for (const id of c.party.memberIds) {
    const ch = c.characters[id];
    if (ch) lines.push(describeCharacter(world, ch));
  }
  if (c.encounter?.status === "active") {
    const e = c.encounter;
    lines.push("");
    lines.push(`## Fight, round ${e.round}`);
    for (const en of e.enemies) {
      const creature = world.creatures.get(en.creatureId)!;
      lines.push(`- ${en.name} [${en.id}] ${en.alive ? `${en.vitality.current}/${en.vitality.max}` : "down"}: ${creature.summary}`);
    }
    const current = e.order[e.turnIndex];
    lines.push(`It is ${current && c.characters[current] ? c.characters[current]!.name : current}'s turn.`);
  }
  if (c.quests.length) {
    lines.push("");
    lines.push("## Quests");
    for (const q of c.quests) {
      lines.push(`- [${q.status}] ${q.title} (${q.id}): ${q.summary}`);
      q.steps.forEach((s, i) => lines.push(`  ${s.done ? "x" : " "} ${i}. ${s.text}`));
    }
  }
  const flags = Object.entries(c.flags);
  if (flags.length) {
    lines.push("");
    lines.push("## Flags");
    lines.push(flags.map(([k, v]) => `${k}=${String(v)}`).join(", "));
  }
  if (c.gmNotes.length) {
    lines.push("");
    lines.push("## Your private notes");
    for (const n of c.gmNotes.slice(-8)) lines.push(`- ${n}`);
  }
  const recent = c.journal.slice(-3);
  if (recent.length) {
    lines.push("");
    lines.push("## Recent scenes");
    for (const s of recent) {
      lines.push(`### Turn ${s.turn}`);
      lines.push(s.prose);
      if (s.chosenChoiceId) {
        const ch = s.choices.find((x) => x.id === s.chosenChoiceId);
        lines.push(`> Chosen: ${ch?.label ?? s.chosenChoiceId}`);
      } else if (s.freeText) {
        lines.push(`> Player said: ${s.freeText}`);
      }
    }
  }
  return lines.join("\n");
}

function attentionWord(a: number): string {
  if (a >= ATTENTION.marked) return " (marked)";
  if (a >= ATTENTION.hunted) return " (hunted)";
  if (a >= ATTENTION.noticed) return " (noticed)";
  return "";
}

function figureHere(f: CanonFigure, eraId: string, loc: Location): boolean {
  const w = f.whereabouts.find((x) => x.eraId === eraId);
  return !!w && w.locationIds.includes(loc.id) && (f.alive.length === 0 || f.alive.includes(eraId));
}

export function describeCharacter(world: World, ch: Character): string {
  const species = world.species.get(ch.speciesId)?.name ?? ch.speciesId;
  const arch = world.archetypes.get(ch.archetypeId)?.name ?? ch.archetypeId;
  const who = ch.controller.kind === "ai" ? "companion" : `player ${ch.controller.playerId}`;
  const skills = Object.entries(ch.skills)
    .filter(([, r]) => r > 0)
    .map(([s, r]) => `${s} ${r}`)
    .join(", ");
  const gear = ch.inventory.map((i) => `${world.items.get(i.itemId)?.name ?? i.itemId}${i.qty > 1 ? ` x${i.qty}` : ""} [${i.instanceId}]`).join(", ");
  const magic = ch.magicSourceIds.map((id) => world.magicSources.get(id)?.name ?? id).join(", ");
  const next = xpToNext(ch.xp);
  return [
    `- ${ch.name} [${ch.id}] (${species} ${arch}, ${who}, level ${ch.level}${next !== undefined ? `, ${next} xp to next` : ""})${ch.alive ? "" : " DEAD"}`,
    `  vitality ${ch.vitality.current}/${ch.vitality.max}, strain ${ch.strain.current}/${ch.strain.max}${ch.conditions.length ? `, ${ch.conditions.join(", ")}` : ""}`,
    `  attributes: ${Object.entries(ch.attributes).map(([k, v]) => `${k} ${v}`).join(", ")}`,
    `  skills: ${skills || "none"}${magic ? `; magic: ${magic}` : ""}`,
    `  carries: ${gear || "nothing"}`,
    ch.background ? `  background: ${ch.background}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Plain sentences for a list of events, for prose generation and logs. */
export function describeEvents(world: World, c: Campaign, events: GameEvent[]): string[] {
  const name = (id: string) => c.characters[id]?.name ?? c.encounter?.enemies.find((e) => e.id === id)?.name ?? id;
  const out: string[] = [];
  for (const e of events) {
    switch (e.type) {
      case "roll":
        out.push(`${e.label}: rolled ${e.roll.total}${e.bonus >= 0 ? "+" : ""}${e.bonus} = ${e.total} vs ${e.target}, ${e.critical === "hit" ? "critical success" : e.critical === "miss" ? "critical failure" : e.success ? "success" : "failure"}${e.margin !== 0 ? ` by ${Math.abs(e.margin)}` : ""}.`);
        break;
      case "travel_started":
        out.push(`The party sets out for ${world.locations.get(e.to)?.name ?? e.to} by ${e.route} (${e.days} day(s)).`);
        break;
      case "travel_progress":
        out.push(`${e.daysLeft} day(s) remain to ${world.locations.get(e.to)?.name ?? e.to}.`);
        break;
      case "arrived":
        out.push(`The party arrives at ${world.locations.get(e.locationId)?.name ?? e.locationId}.`);
        break;
      case "time_passed":
        out.push(`Time passes: day ${e.day}, ${watchName(e.watch)}.`);
        break;
      case "rested":
        if (e.vitality > 0 || e.strain > 0) out.push(`${name(e.characterId)} rests, recovering ${e.vitality} vitality and ${e.strain} strain.`);
        break;
      case "provisions_used":
        out.push(`Provisions left: ${e.remaining}.`);
        break;
      case "starving":
        out.push(`There is no food. ${e.characterIds.map(name).join(", ")} go hungry.`);
        break;
      case "encounter_started":
        out.push(`A fight begins against ${e.enemies.map((x) => x.name).join(", ")}${e.surprise !== "none" ? ` (${e.surprise} surprised)` : ""}.`);
        break;
      case "initiative":
        out.push(`Order: ${e.order.map((o) => `${o.name} ${o.value}`).join(", ")}.`);
        break;
      case "damage":
        out.push(`${e.targetName} takes ${e.amount} from ${e.source} (${e.remaining} left).`);
        break;
      case "healed":
        out.push(`${e.targetName} recovers ${e.amount} from ${e.source}.`);
        break;
      case "fell":
        out.push(e.kind === "enemy" ? `${e.targetName} goes down.` : `${e.targetName} falls.`);
        break;
      case "fled":
        out.push(e.success ? `${name(e.characterId)} gets the party clear.` : `${name(e.characterId)} fails to break away.`);
        break;
      case "defended":
        out.push(`${name(e.characterId)} braces.`);
        break;
      case "encounter_ended":
        out.push(`The fight ends: ${e.outcome}.`);
        break;
      case "cast":
        out.push(`${name(e.characterId)} calls on ${e.sourceName} (${e.effectName}): ${e.success ? "it answers" : "it slips away"}.`);
        break;
      case "strain_gained":
        out.push(`${name(e.characterId)} strains (${e.current}/${e.max}).`);
        break;
      case "collapsed":
        out.push(`${name(e.characterId)} collapses under the magic's weight.`);
        break;
      case "attention_rose":
        out.push(`Attention rises by ${e.amount} to ${e.total}: ${e.reason}.${e.threshold ? ` The party is now ${e.threshold}.` : ""}`);
        break;
      case "item_gained":
        out.push(`${name(e.characterId)} gains ${world.items.get(e.itemId)?.name ?? e.itemId}${e.qty > 1 ? ` x${e.qty}` : ""}${e.reason ? ` (${e.reason})` : ""}.`);
        break;
      case "item_lost":
        out.push(`${name(e.characterId)} loses ${world.items.get(e.itemId)?.name ?? e.itemId}${e.qty > 1 ? ` x${e.qty}` : ""}.`);
        break;
      case "item_used":
        out.push(`${name(e.characterId)} uses ${world.items.get(e.itemId)?.name ?? e.itemId}.`);
        break;
      case "equipped":
        out.push(`${name(e.characterId)} readies ${world.items.get(e.itemId)?.name ?? e.itemId}.`);
        break;
      case "gold_changed":
        out.push(`Gold ${e.delta >= 0 ? "+" : ""}${e.delta} (${e.total})${e.reason ? `: ${e.reason}` : ""}.`);
        break;
      case "xp_gained":
        out.push(`${name(e.characterId)} earns ${e.amount} xp for ${e.reason}.`);
        break;
      case "level_up":
        out.push(`${name(e.characterId)} reaches level ${e.level}.`);
        break;
      case "skill_improved":
        out.push(`${name(e.characterId)} improves ${e.skill} to ${e.rank}.`);
        break;
      case "condition_added":
        out.push(`${name(e.characterId)} is now ${e.condition}.`);
        break;
      case "condition_removed":
        out.push(`${name(e.characterId)} is no longer ${e.condition}.`);
        break;
      case "flag_set":
        out.push(`[${e.key}=${String(e.value)}]`);
        break;
      case "quest_added":
        out.push(`New quest: ${e.title}.`);
        break;
      case "quest_updated":
        out.push(`Quest ${e.id} is ${e.status}.`);
        break;
      case "discovered":
        out.push(`Codex: ${e.entryId} discovered.`);
        break;
      case "recruited":
        out.push(`${e.name} joins the party.`);
        break;
      case "dismissed":
        out.push(`${name(e.characterId)} leaves the party.`);
        break;
      case "choice_made":
        out.push(`Chosen: ${e.label}.`);
        break;
      case "party_wiped":
        out.push("The whole party has fallen.");
        break;
      case "scene_recorded":
      case "gm_note":
        break;
    }
  }
  return out;
}
