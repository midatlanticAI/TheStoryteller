import type { World } from "../world";
import type { Campaign, Combatant, Encounter, Scene } from "../model/campaign";
import type { Character } from "../model/character";
import { maxStrain, maxVitality } from "../model/character";
import { ActionError, type Action, type GameEvent } from "./types";
import { makeCheck } from "../rules/checks";
import {
  characterDefense,
  characterWeapon,
  damageBonus,
  makeCombatant,
  pickTarget,
  rollDamage,
  rollInitiative,
} from "../rules/combat";
import { attentionThreshold, canCast } from "../rules/magic";
import { levelForXp } from "../rules/progression";
import { advanceWatches, rollEncounter, WATCHES_PER_DAY } from "../rules/travel";
import { rollD20, rollDice } from "../dice";
import { attributeMod } from "../model/character";
import { SKILLS } from "../world/schema";
import { gateFromBooks, isRevealed } from "../world/gating";

export interface ApplyResult {
  campaign: Campaign;
  events: GameEvent[];
}

export interface ApplyOptions {
  playerId?: string;
  now?: string;
}

export const MAX_PARTY = 6;

/**
 * Applies one action to a campaign and returns the new campaign plus the
 * events it produced. The input campaign is never mutated. Throws ActionError
 * when the action is not legal in the current state.
 */
export function applyAction(world: World, campaign: Campaign, action: Action, opts: ApplyOptions = {}): ApplyResult {
  const c: Campaign = structuredClone(campaign);
  const events: GameEvent[] = [];
  const ctx = new Ctx(world, c, events, action);
  ctx.run(action);
  c.updatedAt = opts.now ?? new Date().toISOString();
  c.log.push({
    seq: c.log.length + 1,
    turn: c.turn,
    ...(opts.playerId ? { playerId: opts.playerId } : {}),
    action,
    events,
    at: c.updatedAt,
  });
  return { campaign: c, events };
}

/** Applies several actions in order; stops at the first illegal one. */
export function applyActions(world: World, campaign: Campaign, actions: Action[], opts: ApplyOptions = {}): ApplyResult {
  let current = campaign;
  const events: GameEvent[] = [];
  for (const a of actions) {
    const r = applyAction(world, current, a, opts);
    current = r.campaign;
    events.push(...r.events);
  }
  return { campaign: current, events };
}

/** Checks legality without keeping the result. */
export function validateAction(world: World, campaign: Campaign, action: Action): { ok: true } | { ok: false; reason: string } {
  try {
    applyAction(world, campaign, action);
    return { ok: true };
  } catch (err) {
    if (err instanceof ActionError) return { ok: false, reason: err.message };
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

/** A location the party may travel to: revealed by the reading gate and present in the era. */
export function locationOpen(world: World, c: Campaign, loc: { revealedIn: string; eraIds: string[] }): boolean {
  const gate = gateFromBooks(world, c.knownBookIds);
  if (!isRevealed(world, gate, loc)) return false;
  return loc.eraIds.length === 0 || loc.eraIds.includes(c.eraId);
}

class Ctx {
  constructor(
    readonly world: World,
    readonly c: Campaign,
    readonly events: GameEvent[],
    readonly root: Action,
  ) {}

  fail(reason: string): never {
    throw new ActionError(this.root, reason);
  }

  emit(e: GameEvent) {
    this.events.push(e);
  }

  party(): Character[] {
    return this.c.party.memberIds.map((id) => this.c.characters[id]!).filter(Boolean);
  }

  member(id: string): Character {
    const ch = this.c.characters[id];
    if (!ch || !this.c.party.memberIds.includes(id)) this.fail(`"${id}" is not in the party`);
    return ch;
  }

  livingMember(id: string): Character {
    const ch = this.member(id);
    if (!ch.alive) this.fail(`${ch.name} is dead`);
    return ch;
  }

  encounter(): Encounter {
    const e = this.c.encounter;
    if (!e || e.status !== "active") this.fail("there is no fight going on");
    return e;
  }

  enemy(id: string): Combatant {
    const e = this.encounter();
    const en = e.enemies.find((x) => x.id === id);
    if (!en) this.fail(`no enemy "${id}" in this fight`);
    if (!en.alive) this.fail(`${en.name} is already down`);
    return en;
  }

  noFight() {
    if (this.c.encounter?.status === "active") this.fail("not while there is a fight going on");
  }

  run(a: Action): void {
    switch (a.type) {
      case "travel":
        return this.travel(a.to);
      case "continue_travel":
        return this.continueTravel();
      case "rest":
        return this.rest(a.watches ?? 2);
      case "advance_time":
        return this.advanceTime(a.watches);
      case "skill_check":
        return this.skillCheck(a);
      case "start_encounter":
        return this.startEncounter(a.creatureIds, a.surprise ?? "none");
      case "attack":
        return this.attack(a.attackerId, a.targetId);
      case "defend":
        return this.defend(a.characterId);
      case "flee":
        return this.flee(a.characterId);
      case "enemy_turn":
        return this.enemyTurn(a.combatantId);
      case "end_encounter":
        return this.endEncounter(a.outcome);
      case "cast":
        return this.cast(a.characterId, a.sourceId, a.effectId, a.targetId);
      case "use_item":
        return this.useItem(a.characterId, a.instanceId, a.targetId);
      case "equip":
        return this.equip(a.characterId, a.instanceId);
      case "grant_item":
        return this.grantItem(a.characterId, a.itemId, a.qty ?? 1, a.reason);
      case "remove_item":
        return this.removeItem(a.characterId, a.instanceId, a.qty ?? 1);
      case "grant_gold":
        return this.gold(a.amount, a.reason);
      case "spend_gold":
        return this.gold(-a.amount, a.reason);
      case "grant_provisions":
        this.c.party.provisions = Math.max(0, this.c.party.provisions + a.amount);
        this.emit({ type: "provisions_used", remaining: this.c.party.provisions });
        return;
      case "grant_xp":
        return this.grantXp(a.characterId, a.amount, a.reason);
      case "improve_skill":
        return this.improveSkill(a.characterId, a.skill);
      case "damage":
        return this.damage(a.targetId, a.amount, a.source);
      case "heal":
        return this.heal(a.targetId, a.amount, a.source);
      case "add_condition":
        return this.addCondition(a.characterId, a.condition);
      case "remove_condition":
        return this.removeCondition(a.characterId, a.condition);
      case "set_flag":
        this.c.flags[a.key] = a.value;
        this.emit({ type: "flag_set", key: a.key, value: a.value });
        return;
      case "add_quest":
        return this.addQuest(a);
      case "update_quest":
        return this.updateQuest(a);
      case "discover":
        return this.discover(a.entryId);
      case "recruit":
        return this.recruit(a.character);
      case "dismiss":
        return this.dismiss(a.characterId);
      case "raise_attention":
        return this.raiseAttention(a.amount, a.reason);
      case "gm_note":
        this.c.gmNotes.push(a.text);
        this.emit({ type: "gm_note", text: a.text });
        return;
      case "scene":
        return this.scene(a.prose, a.choices, a.freeText);
      case "choose":
        return this.choose(a.choiceId);
      default: {
        const never: never = a;
        this.fail(`unknown action ${JSON.stringify(never)}`);
      }
    }
  }

  // ---- time, travel, rest -------------------------------------------------

  advanceTime(watches: number) {
    if (watches < 1 || watches > 40) this.fail("advance between 1 and 40 watches");
    const { day, watch } = advanceWatches(this.c, watches);
    this.c.day = day;
    this.c.watch = watch;
    this.emit({ type: "time_passed", watches, day, watch });
  }

  travel(to: string) {
    this.noFight();
    if (this.c.party.travel) this.fail(`already on the road to ${this.c.party.travel.toLocationId}`);
    if (this.party().filter((m) => m.alive).length === 0) this.fail("nobody in the party can walk");
    const from = this.world.locations.get(this.c.party.locationId)!;
    const exit = from.exits.find((x) => x.to === to);
    if (!exit) this.fail(`no known road from ${from.name} to "${to}"`);
    const dest = this.world.locations.get(to)!;
    if (!locationOpen(this.world, this.c, dest)) this.fail(`${dest.name} is not part of this campaign's world yet`);
    this.emit({ type: "travel_started", to, route: exit.route, days: exit.days });
    if (exit.days === 0) return this.arrive(dest.id);
    this.c.party.travel = { fromLocationId: from.id, toLocationId: to, route: exit.route, daysTotal: exit.days, daysLeft: exit.days };
    this.travelDay();
  }

  continueTravel() {
    this.noFight();
    if (!this.c.party.travel) this.fail("the party is not travelling");
    this.travelDay();
  }

  private travelDay() {
    const t = this.c.party.travel!;
    this.advanceTime(WATCHES_PER_DAY);
    this.eat();
    t.daysLeft -= 1;
    const from = this.world.locations.get(t.fromLocationId)!;
    const dest = this.world.locations.get(t.toLocationId)!;
    const road = from.dangerTier >= dest.dangerTier ? from : dest;
    const enc = rollEncounter(this.c.rng, this.world, road, this.c.attention);
    this.c.rng = enc.rng;
    if (t.daysLeft <= 0) {
      this.arrive(dest.id);
    } else {
      this.emit({ type: "travel_progress", to: dest.id, daysLeft: t.daysLeft });
    }
    if (enc.creatureIds.length) this.startEncounter(enc.creatureIds, "none");
  }

  private arrive(locationId: string) {
    this.c.party.locationId = locationId;
    delete this.c.party.travel;
    this.emit({ type: "arrived", locationId });
    this.discover(locationId);
  }

  private eat() {
    const mouths = this.party().filter((m) => m.alive).length;
    if (this.c.party.provisions >= mouths) {
      this.c.party.provisions -= mouths;
      this.emit({ type: "provisions_used", remaining: this.c.party.provisions });
    } else {
      this.c.party.provisions = 0;
      const hungry = this.party().filter((m) => m.alive);
      for (const m of hungry) if (!m.conditions.includes("hungry")) m.conditions.push("hungry");
      this.emit({ type: "starving", characterIds: hungry.map((m) => m.id) });
    }
  }

  rest(watches: number) {
    this.noFight();
    if (watches < 1 || watches > 8) this.fail("rest between 1 and 8 watches");
    this.advanceTime(watches);
    const fullNight = watches >= 2;
    if (fullNight) this.eat();
    for (const m of this.party()) {
      if (!m.alive) continue;
      const starving = m.conditions.includes("hungry");
      const vit = fullNight && !starving ? Math.max(1, Math.floor(m.vitality.max / 4) + attributeMod(m.attributes.vigor)) : 0;
      const strain = fullNight ? 3 : 1;
      m.vitality.current = Math.min(m.vitality.max, m.vitality.current + vit);
      m.strain.current = Math.max(0, m.strain.current - strain);
      if (m.strain.current < m.strain.max) this.dropCondition(m, "collapsed");
      if (fullNight) {
        this.dropCondition(m, "exhausted");
        this.dropCondition(m, "defending");
      }
      if (this.c.party.provisions > 0) this.dropCondition(m, "hungry");
      this.emit({ type: "rested", characterId: m.id, vitality: vit, strain });
    }
  }

  // ---- checks --------------------------------------------------------------

  skillCheck(a: Extract<Action, { type: "skill_check" }>) {
    const ch = this.livingMember(a.characterId);
    if (!SKILLS.includes(a.skill)) this.fail(`unknown skill "${a.skill}"`);
    if (a.difficulty < 5 || a.difficulty > 40) this.fail("difficulty must be between 5 and 40");
    const r = makeCheck(this.c.rng, ch, a.skill, a.difficulty, a.purpose);
    this.c.rng = r.rng;
    this.emit(r.event);
    if (a.flag) {
      this.c.flags[a.flag] = r.event.success ? "success" : "failure";
      this.emit({ type: "flag_set", key: a.flag, value: this.c.flags[a.flag]! });
    }
  }

  // ---- encounters ------------------------------------------------------------

  startEncounter(creatureIds: string[], surprise: Encounter["surprise"]) {
    if (this.c.encounter?.status === "active") this.fail("a fight is already going on");
    if (creatureIds.length === 0 || creatureIds.length > 8) this.fail("between 1 and 8 enemies");
    const enemies = creatureIds.map((id, i) => makeCombatant(this.world, id, i + 1));
    const party = this.party().filter((m) => m.alive);
    if (party.length === 0) this.fail("nobody in the party can fight");
    const init = rollInitiative(this.c.rng, this.world, party, enemies, surprise);
    this.c.rng = init.rng;
    const id = `enc-${this.c.log.length + 1}`;
    this.c.encounter = { id, enemies, round: 1, order: init.order.map((o) => o.id), turnIndex: 0, status: "active", surprise };
    let attention = 0;
    for (const e of enemies) attention += this.world.creatures.get(e.creatureId)!.attention;
    this.emit({ type: "encounter_started", encounterId: id, enemies: enemies.map((e) => ({ id: e.id, name: e.name })), surprise });
    this.emit({ type: "initiative", order: init.order });
    if (attention > 0) this.raiseAttention(attention, "faced something that remembers");
    this.runEnemyTurnsUntilParty();
  }

  private isPartyTurn(): boolean {
    const e = this.c.encounter;
    if (!e || e.status !== "active") return false;
    const id = e.order[e.turnIndex];
    return id !== undefined && id in this.c.characters;
  }

  private advanceTurn() {
    const e = this.c.encounter;
    if (!e || e.status !== "active") return;
    e.turnIndex += 1;
    if (e.turnIndex >= e.order.length) {
      e.turnIndex = 0;
      e.round += 1;
      for (const m of this.party()) this.dropCondition(m, "defending");
    }
  }

  private checkEncounterEnd(): boolean {
    const e = this.c.encounter;
    if (!e || e.status !== "active") return true;
    if (e.enemies.every((x) => !x.alive)) {
      this.finishEncounter("won");
      return true;
    }
    const standing = this.party().filter((m) => m.alive && !m.conditions.includes("collapsed"));
    if (standing.length === 0) {
      this.finishEncounter("lost");
      if (this.party().every((m) => !m.alive)) this.emit({ type: "party_wiped" });
      return true;
    }
    return false;
  }

  /** Enemies act automatically until a living party member's turn comes up. */
  private runEnemyTurnsUntilParty() {
    let guard = 0;
    while (!this.checkEncounterEnd() && guard++ < 50) {
      const e = this.c.encounter!;
      const id = e.order[e.turnIndex]!;
      if (id in this.c.characters) {
        const ch = this.c.characters[id]!;
        if (ch.alive && !ch.conditions.includes("collapsed")) return;
        this.advanceTurn();
        continue;
      }
      const en = e.enemies.find((x) => x.id === id);
      if (en && en.alive) this.enemyAct(en);
      this.advanceTurn();
    }
  }

  private requirePartyTurn(ch: Character) {
    const e = this.encounter();
    const current = e.order[e.turnIndex];
    if (current !== ch.id) {
      const who = current && current in this.c.characters ? this.c.characters[current]!.name : "an enemy";
      this.fail(`it is ${who}'s turn, not ${ch.name}'s`);
    }
  }

  private afterPartyAction() {
    this.advanceTurn();
    this.runEnemyTurnsUntilParty();
  }

  attack(attackerId: string, targetId: string) {
    const ch = this.livingMember(attackerId);
    this.requirePartyTurn(ch);
    const en = this.enemy(targetId);
    const weapon = characterWeapon(this.world, ch);
    const r = makeCheck(this.c.rng, ch, weapon.skill, en.defense, `${ch.name} attacks ${en.name} with ${weapon.name}`);
    this.c.rng = r.rng;
    this.emit(r.event);
    if (r.event.success) {
      const dmg = rollDamage(this.c.rng, weapon.damage, damageBonus(ch, weapon.skill) + (r.event.critical === "hit" ? 4 : 0));
      this.c.rng = dmg.rng;
      this.hurtEnemy(en, dmg.amount, weapon.name);
    }
    this.afterPartyAction();
  }

  defend(characterId: string) {
    const ch = this.livingMember(characterId);
    this.requirePartyTurn(ch);
    if (!ch.conditions.includes("defending")) ch.conditions.push("defending");
    this.emit({ type: "defended", characterId: ch.id });
    this.afterPartyAction();
  }

  flee(characterId: string) {
    const ch = this.livingMember(characterId);
    this.requirePartyTurn(ch);
    const e = this.encounter();
    const hardest = Math.max(...e.enemies.filter((x) => x.alive).map((x) => this.world.creatures.get(x.creatureId)!.tier));
    const r = makeCheck(this.c.rng, ch, "athletics", 10 + hardest * 2, `${ch.name} leads the party in flight`);
    this.c.rng = r.rng;
    this.emit(r.event);
    this.emit({ type: "fled", characterId: ch.id, success: r.event.success });
    if (r.event.success) {
      this.finishEncounter("fled");
      return;
    }
    this.afterPartyAction();
  }

  enemyTurn(combatantId: string) {
    const e = this.encounter();
    const en = e.enemies.find((x) => x.id === combatantId);
    if (!en || !en.alive) this.fail(`no living enemy "${combatantId}"`);
    if (e.order[e.turnIndex] !== combatantId) this.fail(`it is not ${en.name}'s turn`);
    this.enemyAct(en);
    this.advanceTurn();
    this.runEnemyTurnsUntilParty();
  }

  private enemyAct(en: Combatant) {
    const creature = this.world.creatures.get(en.creatureId)!;
    const pick = pickTarget(this.c.rng, this.party());
    this.c.rng = pick.rng;
    const target = pick.target;
    if (!target) return;
    const which = rollD20(this.c.rng);
    this.c.rng = which.rng;
    const attack = creature.attacks[which.value % creature.attacks.length]!;
    const d = rollD20(this.c.rng);
    this.c.rng = d.rng;
    const defense = characterDefense(this.world, target);
    const total = d.value + attack.bonus;
    const success = d.value === 20 || (d.value !== 1 && total >= defense);
    this.emit({
      type: "roll",
      characterId: en.id,
      label: `${en.name} uses ${attack.name} on ${target.name}`,
      roll: { expression: "1d20", rolls: [d.value], modifier: 0, total: d.value },
      bonus: attack.bonus,
      total,
      target: defense,
      success,
      margin: total - defense,
      ...(d.value === 20 ? { critical: "hit" as const } : d.value === 1 ? { critical: "miss" as const } : {}),
    });
    if (success) {
      const dmg = rollDamage(this.c.rng, attack.damage, d.value === 20 ? 4 : 0);
      this.c.rng = dmg.rng;
      this.hurtCharacter(target, dmg.amount, `${en.name}'s ${attack.name}`);
    }
  }

  private hurtEnemy(en: Combatant, amount: number, source: string) {
    en.vitality.current = Math.max(0, en.vitality.current - amount);
    this.emit({ type: "damage", targetId: en.id, targetName: en.name, amount, source, remaining: en.vitality.current });
    if (en.vitality.current === 0) {
      en.alive = false;
      this.emit({ type: "fell", targetId: en.id, targetName: en.name, kind: "enemy" });
      const creature = this.world.creatures.get(en.creatureId)!;
      if (creature.xp > 0) this.grantXp(undefined, creature.xp, `defeated ${en.name}`);
    }
  }

  private hurtCharacter(ch: Character, amount: number, source: string) {
    ch.vitality.current = Math.max(0, ch.vitality.current - amount);
    this.emit({ type: "damage", targetId: ch.id, targetName: ch.name, amount, source, remaining: ch.vitality.current });
    if (ch.vitality.current <= Math.floor(ch.vitality.max / 4) && !ch.conditions.includes("wounded")) {
      ch.conditions.push("wounded");
      this.emit({ type: "condition_added", characterId: ch.id, condition: "wounded" });
    }
    if (ch.vitality.current === 0) {
      ch.alive = false;
      this.emit({ type: "fell", targetId: ch.id, targetName: ch.name, kind: "character" });
    }
  }

  endEncounter(outcome: "won" | "fled" | "lost" | "talked") {
    this.encounter();
    this.finishEncounter(outcome === "talked" ? "fled" : outcome, outcome);
  }

  private finishEncounter(status: Encounter["status"], label?: string) {
    const e = this.c.encounter!;
    e.status = status;
    for (const m of this.party()) this.dropCondition(m, "defending");
    this.emit({ type: "encounter_ended", outcome: label ?? status });
  }

  // ---- magic ---------------------------------------------------------------

  cast(characterId: string, sourceId: string, effectId: string, targetId?: string) {
    const ch = this.livingMember(characterId);
    const perm = canCast(this.world, ch, sourceId, effectId);
    if (!perm.allowed) this.fail(perm.reason ?? "cannot cast");
    const source = perm.source!;
    const effect = perm.effect!;
    const inFight = this.c.encounter?.status === "active";
    if (inFight) this.requirePartyTurn(ch);
    if (effect.kind === "attack" && !inFight) this.fail("an attack needs a fight to land in");
    const r = makeCheck(this.c.rng, ch, "arcana", effect.difficulty, `${ch.name} calls on ${source.name}: ${effect.name}`);
    this.c.rng = r.rng;
    this.emit(r.event);
    const strain = effect.strain * (r.event.critical === "miss" ? 2 : 1);
    this.emit({ type: "cast", characterId: ch.id, sourceName: source.name, effectName: effect.name, success: r.event.success, strain, attention: effect.attention });
    if (strain > 0) this.gainStrain(ch, strain);
    if (effect.attention > 0) this.raiseAttention(effect.attention, `${source.name} was used`);
    if (r.event.success) {
      if (effect.kind === "attack" && effect.damage) {
        const en = this.enemy(targetId ?? this.c.encounter!.enemies.find((x) => x.alive)!.id);
        const dmg = rollDamage(this.c.rng, effect.damage, r.event.critical === "hit" ? 6 : 0);
        this.c.rng = dmg.rng;
        this.hurtEnemy(en, dmg.amount, `${source.name} (${effect.name})`);
      } else if (effect.kind === "heal") {
        const target = targetId ? this.member(targetId) : ch;
        this.healCharacter(target, effect.heal ?? 6, `${source.name}`);
      } else if (effect.kind === "ward") {
        const target = targetId ? this.member(targetId) : ch;
        if (!target.conditions.includes("warded")) target.conditions.push("warded");
        this.emit({ type: "condition_added", characterId: target.id, condition: "warded" });
      }
      this.c.flags[`magic:${effect.id}`] = "success";
    } else {
      this.c.flags[`magic:${effect.id}`] = "failure";
    }
    if (inFight && this.c.encounter?.status === "active") this.afterPartyAction();
  }

  private gainStrain(ch: Character, amount: number) {
    ch.strain.current = Math.min(ch.strain.max, ch.strain.current + amount);
    this.emit({ type: "strain_gained", characterId: ch.id, amount, current: ch.strain.current, max: ch.strain.max });
    if (ch.strain.current >= ch.strain.max && !ch.conditions.includes("collapsed")) {
      ch.conditions.push("collapsed");
      this.emit({ type: "collapsed", characterId: ch.id });
    }
  }

  raiseAttention(amount: number, reason: string) {
    if (amount <= 0) return;
    const before = this.c.attention;
    this.c.attention += amount;
    const threshold = attentionThreshold(before, this.c.attention);
    this.emit({ type: "attention_rose", amount, total: this.c.attention, reason, ...(threshold ? { threshold } : {}) });
  }

  // ---- items & gold ----------------------------------------------------------

  useItem(characterId: string, instanceId: string, targetId?: string) {
    const ch = this.livingMember(characterId);
    const inst = ch.inventory.find((i) => i.instanceId === instanceId);
    if (!inst) this.fail(`${ch.name} does not carry "${instanceId}"`);
    const item = this.world.items.get(inst.itemId)!;
    const inFight = this.c.encounter?.status === "active";
    if (inFight) this.requirePartyTurn(ch);
    if (item.kind === "consumable" && item.heal) {
      const target = targetId ? this.member(targetId) : ch;
      this.healCharacter(target, item.heal, item.name);
    } else if (item.kind === "provision") {
      this.c.party.provisions += 2;
      this.emit({ type: "provisions_used", remaining: this.c.party.provisions });
    } else {
      this.fail(`${item.name} is not something you use up; equip it or let the story use it`);
    }
    this.emit({ type: "item_used", characterId: ch.id, itemId: item.id });
    inst.qty -= 1;
    if (inst.qty <= 0) ch.inventory = ch.inventory.filter((i) => i.instanceId !== instanceId);
    if (inFight && this.c.encounter?.status === "active") this.afterPartyAction();
  }

  equip(characterId: string, instanceId: string) {
    const ch = this.livingMember(characterId);
    const inst = ch.inventory.find((i) => i.instanceId === instanceId);
    if (!inst) this.fail(`${ch.name} does not carry "${instanceId}"`);
    const item = this.world.items.get(inst.itemId)!;
    const slot = item.kind === "weapon" ? "weapon" : item.kind === "armor" ? "armor" : item.kind === "shield" ? "shield" : item.kind === "talisman" || item.kind === "relic" ? "talisman" : undefined;
    if (!slot) this.fail(`${item.name} cannot be equipped`);
    ch.equipped[slot] = instanceId;
    this.emit({ type: "equipped", characterId: ch.id, itemId: item.id });
  }

  grantItem(characterId: string, itemId: string, qty: number, reason?: string) {
    const ch = this.member(characterId);
    const item = this.world.items.get(itemId);
    if (!item) this.fail(`unknown item "${itemId}"`);
    if (qty < 1 || qty > 99) this.fail("quantity must be 1 to 99");
    if (item.unique) {
      if (this.c.flags[`canon:${itemId}`] !== true) {
        this.fail(`${item.name} is a unique canon object; set flag canon:${itemId} first to show it was earned`);
      }
      const held = Object.values(this.c.characters).some((x) => x.inventory.some((i) => i.itemId === itemId));
      if (held) this.fail(`${item.name} is already in the party`);
      qty = 1;
    }
    const existing = ch.inventory.find((i) => i.itemId === itemId && !item.unique && item.kind !== "weapon" && item.kind !== "armor");
    if (existing) existing.qty += qty;
    else ch.inventory.push({ instanceId: `${ch.id}-item-${this.c.log.length + 1}-${ch.inventory.length + 1}`, itemId, qty });
    this.emit({ type: "item_gained", characterId: ch.id, itemId, qty, ...(reason ? { reason } : {}) });
  }

  removeItem(characterId: string, instanceId: string, qty: number) {
    const ch = this.member(characterId);
    const inst = ch.inventory.find((i) => i.instanceId === instanceId);
    if (!inst) this.fail(`${ch.name} does not carry "${instanceId}"`);
    const taken = Math.min(qty, inst.qty);
    inst.qty -= taken;
    if (inst.qty <= 0) {
      ch.inventory = ch.inventory.filter((i) => i.instanceId !== instanceId);
      for (const slot of Object.keys(ch.equipped) as (keyof Character["equipped"])[]) {
        if (ch.equipped[slot] === instanceId) delete ch.equipped[slot];
      }
    }
    this.emit({ type: "item_lost", characterId: ch.id, itemId: inst.itemId, qty: taken });
  }

  gold(delta: number, reason?: string) {
    if (!Number.isFinite(delta) || Math.abs(delta) > 100000) this.fail("gold change out of range");
    if (this.c.party.gold + delta < 0) this.fail(`the party has only ${this.c.party.gold} gold`);
    this.c.party.gold += delta;
    this.emit({ type: "gold_changed", delta, total: this.c.party.gold, ...(reason ? { reason } : {}) });
  }

  // ---- progression -----------------------------------------------------------

  grantXp(characterId: string | undefined, amount: number, reason: string) {
    if (amount < 0 || amount > 5000) this.fail("xp must be between 0 and 5000");
    const targets = characterId ? [this.member(characterId)] : this.party().filter((m) => m.alive);
    for (const ch of targets) {
      ch.xp += amount;
      this.emit({ type: "xp_gained", characterId: ch.id, amount, total: ch.xp, reason });
      const level = levelForXp(ch.xp);
      while (ch.level < level) {
        ch.level += 1;
        const vit = maxVitality(ch.attributes, ch.level);
        ch.vitality.current += vit - ch.vitality.max;
        ch.vitality.max = vit;
        ch.strain.max = maxStrain(ch.attributes, ch.level);
        ch.unspentSkillPoints += 1;
        this.emit({ type: "level_up", characterId: ch.id, level: ch.level });
      }
    }
  }

  improveSkill(characterId: string, skill: Extract<Action, { type: "improve_skill" }>["skill"]) {
    const ch = this.member(characterId);
    if (!SKILLS.includes(skill)) this.fail(`unknown skill "${skill}"`);
    if (ch.unspentSkillPoints < 1) this.fail(`${ch.name} has no skill points to spend`);
    if (ch.skills[skill] >= 5) this.fail(`${skill} is already at its peak`);
    ch.unspentSkillPoints -= 1;
    ch.skills[skill] += 1;
    this.emit({ type: "skill_improved", characterId: ch.id, skill, rank: ch.skills[skill] });
  }

  // ---- health & conditions ---------------------------------------------------

  damage(targetId: string, amount: number, source: string) {
    if (amount < 1 || amount > 200) this.fail("damage must be 1 to 200");
    if (this.c.encounter?.status === "active") {
      const en = this.c.encounter.enemies.find((x) => x.id === targetId);
      if (en) {
        if (!en.alive) this.fail(`${en.name} is already down`);
        this.hurtEnemy(en, amount, source);
        this.checkEncounterEnd();
        return;
      }
    }
    const ch = this.livingMember(targetId);
    this.hurtCharacter(ch, amount, source);
    this.checkEncounterEnd();
  }

  heal(targetId: string, amount: number, source: string) {
    if (amount < 1 || amount > 200) this.fail("healing must be 1 to 200");
    this.healCharacter(this.member(targetId), amount, source);
  }

  private healCharacter(ch: Character, amount: number, source: string) {
    if (!ch.alive) this.fail(`${ch.name} is beyond healing`);
    const before = ch.vitality.current;
    ch.vitality.current = Math.min(ch.vitality.max, ch.vitality.current + amount);
    const healed = ch.vitality.current - before;
    if (ch.vitality.current > Math.floor(ch.vitality.max / 4)) this.dropCondition(ch, "wounded");
    this.emit({ type: "healed", targetId: ch.id, targetName: ch.name, amount: healed, source });
  }

  addCondition(characterId: string, condition: string) {
    const ch = this.member(characterId);
    const key = condition.trim().toLowerCase();
    if (!key || key.length > 40) this.fail("a condition is a short word or phrase");
    if (!ch.conditions.includes(key)) ch.conditions.push(key);
    this.emit({ type: "condition_added", characterId: ch.id, condition: key });
  }

  removeCondition(characterId: string, condition: string) {
    const ch = this.member(characterId);
    this.dropCondition(ch, condition.trim().toLowerCase());
  }

  private dropCondition(ch: Character, condition: string) {
    if (!ch.conditions.includes(condition)) return;
    ch.conditions = ch.conditions.filter((x) => x !== condition);
    this.emit({ type: "condition_removed", characterId: ch.id, condition });
  }

  // ---- quests, codex, party --------------------------------------------------

  addQuest(a: Extract<Action, { type: "add_quest" }>) {
    if (this.c.quests.some((q) => q.id === a.id)) this.fail(`quest "${a.id}" already exists`);
    this.c.quests.push({ id: a.id, title: a.title, summary: a.summary, status: "open", steps: (a.steps ?? []).map((text) => ({ text, done: false })) });
    this.emit({ type: "quest_added", id: a.id, title: a.title });
  }

  updateQuest(a: Extract<Action, { type: "update_quest" }>) {
    const q = this.c.quests.find((x) => x.id === a.id);
    if (!q) this.fail(`no quest "${a.id}"`);
    if (a.addStep) q.steps.push({ text: a.addStep, done: false });
    if (a.completeStep !== undefined) {
      const step = q.steps[a.completeStep];
      if (!step) this.fail(`quest "${a.id}" has no step ${a.completeStep}`);
      step.done = true;
    }
    if (a.status) q.status = a.status;
    this.emit({ type: "quest_updated", id: q.id, status: q.status });
  }

  discover(entryId: string) {
    const known =
      this.world.locations.has(entryId) ||
      this.world.creatures.has(entryId) ||
      this.world.canonFigures.has(entryId) ||
      this.world.items.has(entryId) ||
      this.world.factions.has(entryId) ||
      this.world.lore.has(entryId) ||
      this.world.magicSources.has(entryId) ||
      this.world.regions.has(entryId);
    if (!known) this.fail(`nothing in this world is called "${entryId}"`);
    if (this.c.codex.discoveredIds.includes(entryId)) return;
    this.c.codex.discoveredIds.push(entryId);
    this.emit({ type: "discovered", entryId });
  }

  recruit(character: Character) {
    if (this.c.party.memberIds.length >= MAX_PARTY) this.fail(`the party is full (${MAX_PARTY})`);
    if (this.c.characters[character.id] && this.c.party.memberIds.includes(character.id)) this.fail(`${character.name} is already in the party`);
    if (!this.world.species.has(character.speciesId)) this.fail(`unknown species "${character.speciesId}"`);
    if (!this.world.archetypes.has(character.archetypeId)) this.fail(`unknown archetype "${character.archetypeId}"`);
    for (const i of character.inventory) if (!this.world.items.has(i.itemId)) this.fail(`unknown item "${i.itemId}"`);
    this.c.characters[character.id] = structuredClone(character);
    this.c.party.memberIds.push(character.id);
    this.emit({ type: "recruited", characterId: character.id, name: character.name });
  }

  dismiss(characterId: string) {
    this.noFight();
    this.member(characterId);
    this.c.party.memberIds = this.c.party.memberIds.filter((id) => id !== characterId);
    this.emit({ type: "dismissed", characterId });
  }

  // ---- narration -------------------------------------------------------------

  scene(prose: string, choices: Scene["choices"], freeText?: string) {
    if (!prose.trim()) this.fail("a scene needs prose");
    if (choices.length > 8) this.fail("at most 8 choices");
    const ids = new Set<string>();
    for (const ch of choices) {
      if (!ch.id || ids.has(ch.id)) this.fail(`choice ids must be unique ("${ch.id}")`);
      ids.add(ch.id);
      if (!ch.label.trim()) this.fail("every choice needs a label");
      for (const a of ch.actions) {
        if (a.type === "scene" || a.type === "choose") this.fail("a choice cannot contain a scene or another choice");
      }
    }
    this.c.turn += 1;
    const seq = this.c.journal.length + 1;
    this.c.journal.push({ seq, turn: this.c.turn, prose, choices, ...(freeText ? { freeText } : {}), at: this.c.updatedAt });
    this.emit({ type: "scene_recorded", seq });
  }

  choose(choiceId: string) {
    const scene = this.c.journal[this.c.journal.length - 1];
    if (!scene) this.fail("there is no scene to choose from");
    if (scene.chosenChoiceId) this.fail("a choice was already made for this scene");
    const choice = scene.choices.find((x) => x.id === choiceId);
    if (!choice) this.fail(`no choice "${choiceId}" in the current scene`);
    scene.chosenChoiceId = choiceId;
    this.emit({ type: "choice_made", choiceId, label: choice.label });
    for (const a of choice.actions) this.run(a);
  }
}
