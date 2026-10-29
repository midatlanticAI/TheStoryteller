import { describe, expect, it } from "vitest";
import { fixturePack, fixtureWorld as world } from "./fixture";
import {
  ActionError,
  applyAction,
  applyActions,
  availableActions,
  buildNarratorContext,
  createCampaign,
  createCharacter,
  createRng,
  deserializeCampaign,
  gateFromBooks,
  isRevealed,
  loadWorld,
  offlineNarrate,
  parseDice,
  rollDice,
  serializeCampaign,
  submitActions,
  validateAction,
  WorldValidationError,
  type Campaign,
} from "../src";

function fresh(mode: "solo" | "hotseat" | "async" = "solo", players = [{ id: "p1", name: "One" }]): Campaign {
  let c = createCampaign(world, { id: "camp", name: "Test", eraId: "era-one", mode, players, seed: 42, now: "2026-01-01T00:00:00.000Z" });
  const hero = createCharacter(world, { id: "hero", name: "Hero", speciesId: "human", archetypeId: "fighter", controller: { kind: "player", playerId: "p1" } });
  const adept = createCharacter(world, { id: "adept", name: "Adept", speciesId: "elf", archetypeId: "adept", controller: { kind: "ai" } });
  c = applyAction(world, c, { type: "recruit", character: hero }).campaign;
  c = applyAction(world, c, { type: "recruit", character: adept }).campaign;
  return c;
}

describe("world loading", () => {
  it("validates references", () => {
    expect(() => loadWorld({ ...fixturePack, locations: [{ ...fixturePack.locations[0]!, exits: [{ to: "nowhere", days: 1, route: "x" }] }] })).toThrow(WorldValidationError);
  });
  it("indexes entries", () => {
    expect(world.locations.get("hamlet")?.name).toBe("Hamlet");
    expect(world.creatures.size).toBe(2);
  });
});

describe("dice", () => {
  it("parses expressions", () => {
    expect(parseDice("2d6+2")).toEqual({ count: 2, sides: 6, modifier: 2 });
    expect(parseDice("d20")).toEqual({ count: 1, sides: 20, modifier: 0 });
    expect(parseDice("3")).toEqual({ count: 0, sides: 0, modifier: 3 });
    expect(() => parseDice("abc")).toThrow();
  });
  it("is deterministic from a seed", () => {
    const a = rollDice(createRng(7), "3d6");
    const b = rollDice(createRng(7), "3d6");
    expect(a.roll).toEqual(b.roll);
    expect(a.rng.draws).toBe(3);
    for (const r of a.roll.rolls) expect(r).toBeGreaterThanOrEqual(1);
  });
});

describe("characters", () => {
  it("applies species mods and archetype gear", () => {
    const c = fresh();
    const adept = c.characters["adept"]!;
    expect(adept.attributes.agility).toBe(6);
    expect(adept.attributes.vigor).toBe(4);
    expect(adept.inventory.map((i) => i.itemId)).toEqual(["staff", "salve"]);
    expect(adept.equipped.weapon).toBeDefined();
    expect(adept.magicSourceIds).toEqual(["spark"]);
    expect(c.characters["hero"]!.vitality.max).toBe(20);
  });
  it("refuses archetypes closed to a species", () => {
    const w = loadWorld({ ...fixturePack, archetypes: [{ ...fixturePack.archetypes[0]!, speciesAllowed: ["elf"] }, fixturePack.archetypes[1]!] });
    expect(() => createCharacter(w, { id: "x", name: "X", speciesId: "human", archetypeId: "fighter", controller: { kind: "ai" } })).toThrow();
  });
});

describe("travel and time", () => {
  it("arrives immediately on a zero-day road and discovers the place", () => {
    const r = applyAction(world, fresh(), { type: "travel", to: "well" });
    expect(r.campaign.party.locationId).toBe("well");
    expect(r.campaign.codex.discoveredIds).toContain("well");
    expect(r.events.some((e) => e.type === "arrived")).toBe(true);
  });
  it("refuses roads that do not exist", () => {
    expect(() => applyAction(world, fresh(), { type: "travel", to: "secret" })).toThrow(ActionError);
    expect(validateAction(world, fresh(), { type: "travel", to: "secret" }).ok).toBe(false);
  });
  it("spends a day and provisions on a one-day road", () => {
    const r = applyAction(world, fresh(), { type: "travel", to: "woods" });
    expect(r.campaign.day).toBe(2);
    expect(r.campaign.party.provisions).toBe(4);
    const arrived = r.events.some((e) => e.type === "arrived");
    const fight = r.events.some((e) => e.type === "encounter_started");
    expect(arrived).toBe(true);
    // Danger tier 5 is a 60% chance; with seed 42 we just assert consistency.
    expect(fight).toBe(r.campaign.encounter?.status === "active");
  });
  it("rest heals and clears strain", () => {
    let c = fresh();
    c = applyAction(world, c, { type: "damage", targetId: "hero", amount: 10, source: "test" }).campaign;
    expect(c.characters["hero"]!.vitality.current).toBe(10);
    c = applyAction(world, c, { type: "rest", watches: 2 }).campaign;
    expect(c.characters["hero"]!.vitality.current).toBe(15);
    expect(c.watch).toBe(3);
  });
});

describe("combat", () => {
  it("runs a full fight to a result", () => {
    let c = fresh();
    c = applyAction(world, c, { type: "start_encounter", creatureIds: ["wolf"] }).campaign;
    expect(c.encounter?.status).toBe("active");
    let guard = 0;
    while (c.encounter?.status === "active" && guard++ < 40) {
      const legal = availableActions(world, c).filter((a) => a.action.type === "attack");
      expect(legal.length).toBeGreaterThan(0);
      c = applyAction(world, c, legal[0]!.action).campaign;
    }
    expect(["won", "lost"]).toContain(c.encounter?.status);
    if (c.encounter?.status === "won") {
      expect(c.characters["hero"]!.xp).toBe(20);
      expect(c.log.at(-1)!.events.some((e) => e.type === "encounter_ended")).toBe(true);
    }
  });
  it("refuses acting out of turn and outside a fight", () => {
    const c = fresh();
    expect(() => applyAction(world, c, { type: "attack", attackerId: "hero", targetId: "enemy-1" })).toThrow(/no fight/);
    const f = applyAction(world, c, { type: "start_encounter", creatureIds: ["wolf", "wolf"] }).campaign;
    const current = f.encounter!.order[f.encounter!.turnIndex]!;
    const other = current === "hero" ? "adept" : "hero";
    expect(() => applyAction(world, f, { type: "attack", attackerId: other, targetId: "enemy-1" })).toThrow(/turn/);
  });
  it("raises attention for creatures that remember", () => {
    const r = applyAction(world, fresh(), { type: "start_encounter", creatureIds: ["wraith"] });
    expect(r.campaign.attention).toBe(5);
    expect(r.events.some((e) => e.type === "attention_rose")).toBe(true);
  });
});

describe("magic", () => {
  it("costs strain and attention, and collapses at the limit", () => {
    let c = fresh();
    const r = applyAction(world, c, { type: "cast", characterId: "adept", sourceId: "spark", effectId: "mend", targetId: "hero" });
    c = r.campaign;
    expect(c.characters["adept"]!.strain.current).toBe(3);
    const big = applyAction(world, c, { type: "cast", characterId: "adept", sourceId: "spark", effectId: "big" });
    expect(big.campaign.characters["adept"]!.conditions).toContain("collapsed");
    expect(big.campaign.attention).toBe(10);
    expect(big.events.some((e) => e.type === "attention_rose" && e.threshold === "noticed")).toBe(true);
    expect(() => applyAction(world, big.campaign, { type: "cast", characterId: "adept", sourceId: "spark", effectId: "mend" })).toThrow(/collapsed/);
  });
  it("refuses sources the character cannot reach", () => {
    const c = fresh();
    expect(() => applyAction(world, c, { type: "cast", characterId: "hero", sourceId: "stones", effectId: "seek" })).toThrow();
    expect(() => applyAction(world, c, { type: "cast", characterId: "adept", sourceId: "stones", effectId: "seek" })).toThrow(/needs/);
  });
  it("guards unique canon items behind an explicit flag", () => {
    let c = fresh();
    expect(() => applyAction(world, c, { type: "grant_item", characterId: "adept", itemId: "blue-stones" })).toThrow(/canon:blue-stones/);
    c = applyAction(world, c, { type: "set_flag", key: "canon:blue-stones", value: true }).campaign;
    c = applyAction(world, c, { type: "grant_item", characterId: "adept", itemId: "blue-stones" }).campaign;
    expect(() => applyAction(world, c, { type: "grant_item", characterId: "hero", itemId: "blue-stones" })).toThrow(/already/);
    const cast = applyAction(world, c, { type: "cast", characterId: "adept", sourceId: "stones", effectId: "seek" });
    expect(cast.events.some((e) => e.type === "cast")).toBe(true);
  });
});

describe("progression", () => {
  it("levels up and grants a skill point", () => {
    let c = fresh();
    c = applyAction(world, c, { type: "grant_xp", characterId: "hero", amount: 120, reason: "test" }).campaign;
    expect(c.characters["hero"]!.level).toBe(2);
    expect(c.characters["hero"]!.unspentSkillPoints).toBe(1);
    expect(c.characters["hero"]!.vitality.max).toBe(23);
    c = applyAction(world, c, { type: "improve_skill", characterId: "hero", skill: "melee" }).campaign;
    expect(c.characters["hero"]!.skills.melee).toBe(3);
    expect(() => applyAction(world, c, { type: "improve_skill", characterId: "hero", skill: "melee" })).toThrow(/no skill points/);
  });
});

describe("spoiler gating", () => {
  it("hides later-book entries from the narrator context", () => {
    const c = fresh();
    const gate = gateFromBooks(world, c.knownBookIds);
    expect(isRevealed(world, gate, world.locations.get("secret")!)).toBe(false);
    const ctx = buildNarratorContext(world, c);
    expect(ctx.stable).toContain("The Sage");
    expect(ctx.stable).not.toContain("The Villain");
    expect(ctx.dynamic).toContain("Hamlet");
  });
  it("hides and refuses roads to places beyond the gate, and opens them once read", () => {
    let c = applyAction(world, fresh(), { type: "travel", to: "well" }).campaign;
    expect(availableActions(world, c).some((a) => a.action.type === "travel" && a.action.to === "secret")).toBe(false);
    expect(buildNarratorContext(world, c).dynamic).not.toContain("Secret Place");
    expect(() => applyAction(world, c, { type: "travel", to: "secret" })).toThrow(/not part of/);
    c = { ...c, knownBookIds: ["book-one", "book-two"] };
    expect(availableActions(world, c).some((a) => a.action.type === "travel" && a.action.to === "secret")).toBe(true);
    expect(applyAction(world, c, { type: "travel", to: "secret" }).campaign.party.locationId).toBe("secret");
  });
  it("reveals everything with the wildcard", () => {
    const gate = gateFromBooks(world, ["*"]);
    expect(isRevealed(world, gate, world.canonFigures.get("villain")!)).toBe(true);
  });
});

describe("scenes and choices", () => {
  it("records a scene, applies the chosen choice, and refuses a second choice", () => {
    let c = fresh();
    const scene = offlineNarrate(world, c, { playerInput: "", recentEvents: [] }, []);
    expect(scene.choices.length).toBeGreaterThan(0);
    c = applyAction(world, c, { type: "scene", prose: scene.prose, choices: scene.choices }).campaign;
    expect(c.turn).toBe(1);
    const travel = scene.choices.find((ch) => ch.actions[0]?.type === "travel" && (ch.actions[0] as { to: string }).to === "well")!;
    c = applyAction(world, c, { type: "choose", choiceId: travel.id }).campaign;
    expect(c.party.locationId).toBe("well");
    expect(() => applyAction(world, c, { type: "choose", choiceId: travel.id })).toThrow(/already/);
  });
  it("refuses nested scenes inside choices", () => {
    expect(() =>
      applyAction(world, fresh(), { type: "scene", prose: "x", choices: [{ id: "a", label: "A", actions: [{ type: "scene", prose: "y", choices: [] }] }] }),
    ).toThrow();
  });
});

describe("persistence", () => {
  it("round-trips through the save format and keeps the log", () => {
    const c = applyActions(world, fresh(), [{ type: "travel", to: "well" }, { type: "grant_gold", amount: 5 }]).campaign;
    const back = deserializeCampaign(serializeCampaign(c));
    expect(back).toEqual(c);
    expect(back.log.length).toBe(4);
    expect(() => deserializeCampaign("{}")).toThrow();
  });
  it("replays identically from the seed and log", () => {
    const c = applyActions(world, fresh(), [{ type: "travel", to: "woods" }]).campaign;
    let replay = fresh();
    for (const rec of c.log.slice(2)) replay = applyAction(world, replay, rec.action, { now: rec.at }).campaign;
    expect(replay.rng).toEqual(c.rng);
    expect(replay.party).toEqual(c.party);
  });
});

describe("async party rounds", () => {
  it("waits for every player, then resolves in order", () => {
    let c = fresh("async", [{ id: "p1", name: "One" }, { id: "p2", name: "Two" }]);
    const first = submitActions(world, c, "p1", [{ type: "grant_gold", amount: 1 }]);
    expect(first.resolved).toBe(false);
    expect(first.campaign.pending?.waitingFor).toEqual(["p2"]);
    expect(() => submitActions(world, first.campaign, "p1", [])).toThrow(/already/);
    const second = submitActions(world, first.campaign, "p2", [{ type: "grant_gold", amount: 2 }]);
    expect(second.resolved).toBe(true);
    expect(second.campaign.party.gold).toBe(13);
    expect(second.campaign.pending).toBeUndefined();
    expect(second.campaign.log.map((l) => l.playerId)).toEqual([undefined, undefined, "p1", "p2"]);
  });
});
