import { describe, expect, it } from "vitest";
import { loadShannara, shannaraPack } from "../src";
import { applyAction, availableActions, buildNarratorContext, createCampaign, createCharacter, gateFromBooks, revealed } from "@storyteller/engine";

const world = loadShannara();

describe("the Shannara pack", () => {
  it("validates with every reference resolved", () => {
    expect(world.pack.id).toBe("shannara");
    expect(world.locations.size).toBeGreaterThanOrEqual(30);
    expect(world.canonFigures.size).toBeGreaterThanOrEqual(30);
  });

  it("has exactly one playable era, with a start in Shady Vale", () => {
    const playable = shannaraPack.eras.filter((e) => e.playable);
    expect(playable.map((e) => e.id)).toEqual(["sword"]);
    expect(playable[0]!.startLocationId).toBe("shady-vale");
  });

  it("keeps every playable-region location reachable by road from Shady Vale within the Sword era", () => {
    const seen = new Set<string>(["shady-vale"]);
    const queue = ["shady-vale"];
    while (queue.length) {
      const id = queue.shift()!;
      for (const exit of world.locations.get(id)!.exits) {
        if (!seen.has(exit.to)) {
          seen.add(exit.to);
          queue.push(exit.to);
        }
      }
    }
    const swordRoads = [...world.locations.values()].filter((l) => l.eraIds.includes("sword") && world.regions.get(l.regionId)!.status === "playable");
    for (const loc of swordRoads) expect(seen.has(loc.id), `${loc.id} is not reachable`).toBe(true);
  });

  it("makes every road two-way", () => {
    for (const loc of world.locations.values()) {
      for (const exit of loc.exits) {
        const back = world.locations.get(exit.to)!.exits.find((x) => x.to === loc.id);
        expect(back, `${exit.to} has no road back to ${loc.id}`).toBeDefined();
      }
    }
  });

  it("hides later books behind the reading gate", () => {
    const gate = gateFromBooks(world, ["sword"]);
    const figures = revealed(world, gate, world.canonFigures.values()).map((f) => f.id);
    expect(figures).toContain("allanon");
    expect(figures).not.toContain("wil-ohmsford");
    expect(revealed(world, gate, world.magicSources.values()).map((m) => m.id)).not.toContain("wishsong");
    const regions = revealed(world, gate, world.regions.values()).map((r) => r.id);
    expect(regions).not.toContain("forbidding");
  });

  it("builds a narrator context for a fresh Sword-era campaign", () => {
    let c = createCampaign(world, { id: "t", name: "Test", eraId: "sword", mode: "solo", players: [{ id: "p1", name: "P" }], seed: 1 });
    const hero = createCharacter(world, { id: "hero", name: "Jace", speciesId: "half-elf", archetypeId: "valeman", controller: { kind: "player", playerId: "p1" } });
    c = applyAction(world, c, { type: "recruit", character: hero }).campaign;
    const ctx = buildNarratorContext(world, c);
    expect(ctx.stable).toContain("Allanon");
    expect(ctx.stable).not.toContain("Ellcrys");
    expect(ctx.dynamic).toContain("Shady Vale");
    expect(ctx.legal.some((a) => a.action.type === "travel")).toBe(true);
    expect(availableActions(world, c).length).toBeGreaterThan(0);
  });

  it("lets a half-Elf Valeman draw the Elfstones once the canon flag is set", () => {
    let c = createCampaign(world, { id: "t", name: "Test", eraId: "sword", mode: "solo", players: [{ id: "p1", name: "P" }], seed: 2 });
    const hero = createCharacter(world, { id: "hero", name: "Jace", speciesId: "half-elf", archetypeId: "valeman", controller: { kind: "player", playerId: "p1" } });
    c = applyAction(world, c, { type: "recruit", character: hero }).campaign;
    expect(() => applyAction(world, c, { type: "grant_item", characterId: "hero", itemId: "blue-elfstones" })).toThrow();
    c = applyAction(world, c, { type: "set_flag", key: "canon:blue-elfstones", value: true }).campaign;
    c = applyAction(world, c, { type: "grant_item", characterId: "hero", itemId: "blue-elfstones", reason: "Allanon's gift" }).campaign;
    const r = applyAction(world, c, { type: "cast", characterId: "hero", sourceId: "elfstones-blue", effectId: "seek" });
    expect(r.events.some((e) => e.type === "attention_rose")).toBe(true);
  });

  it("never lets a player reach the Skull magic", () => {
    const c = createCampaign(world, { id: "t", name: "Test", eraId: "sword", mode: "solo", players: [{ id: "p1", name: "P" }], seed: 3 });
    const troll = createCharacter(world, { id: "k", name: "K", speciesId: "rock-troll", archetypeId: "troll-soldier", controller: { kind: "ai" } });
    const c2 = applyAction(world, c, { type: "recruit", character: troll }).campaign;
    expect(() => applyAction(world, c2, { type: "cast", characterId: "k", sourceId: "skull-magic", effectId: "black-fire" })).toThrow();
  });
});
