import { describe, expect, it } from "vitest";
import { fixtureWorld as world } from "./fixture";
import {
  SceneProposalSchema,
  applyAction,
  createCampaign,
  createCharacter,
  offlineNarrator,
  runTurn,
  sceneProposalJsonSchema,
  validateProposal,
  type Campaign,
  type Narrator,
} from "../src";

function fresh(): Campaign {
  let c = createCampaign(world, { id: "camp", name: "Test", eraId: "era-one", mode: "solo", players: [{ id: "p1", name: "One" }], seed: 9, now: "2026-01-01T00:00:00.000Z" });
  const hero = createCharacter(world, { id: "hero", name: "Hero", speciesId: "human", archetypeId: "fighter", controller: { kind: "player", playerId: "p1" } });
  return applyAction(world, c, { type: "recruit", character: hero }).campaign;
}

describe("the scene contract", () => {
  it("parses a well-formed proposal and renders a JSON schema", () => {
    const parsed = SceneProposalSchema.safeParse({
      prose: "The inn is quiet.",
      choices: [{ id: "a", label: "Go to the well", actions: [{ type: "travel", to: "well" }] }],
      stateChanges: [{ type: "grant_xp", amount: 10, reason: "a quiet start" }],
    });
    expect(parsed.success).toBe(true);
    const schema = sceneProposalJsonSchema();
    expect(JSON.stringify(schema)).toContain("stateChanges");
  });

  it("rejects engine-only actions in a proposal", () => {
    const parsed = SceneProposalSchema.safeParse({ prose: "x", choices: [{ id: "a", label: "A", actions: [{ type: "scene", prose: "y", choices: [] }] }], stateChanges: [] });
    expect(parsed.success).toBe(false);
  });

  it("drops illegal choices, skips illegal state changes, and reports both", () => {
    const v = validateProposal(world, fresh(), {
      prose: "A scene.",
      choices: [
        { id: "ok", label: "Walk to the well", actions: [{ type: "travel", to: "well" }] },
        { id: "bad", label: "Fly to the secret place", actions: [{ type: "travel", to: "secret" }] },
        { id: "ok", label: "Duplicate id", actions: [] },
      ],
      stateChanges: [
        { type: "grant_gold", amount: 3, reason: "found coins" },
        { type: "grant_item", characterId: "hero", itemId: "blue-stones" },
      ],
      gmNote: "The sage is watching.",
    });
    expect(v.campaign.party.gold).toBe(13);
    expect(v.campaign.gmNotes).toEqual(["The sage is watching."]);
    expect(v.scene.choices.map((c) => c.id)).toEqual(["ok"]);
    expect(v.problems.length).toBe(3);
    expect(v.campaign.journal.length).toBe(1);
  });

  it("falls back to the engine's choices when none survive", () => {
    const v = validateProposal(world, fresh(), { prose: "x", choices: [{ id: "a", label: "A", actions: [{ type: "travel", to: "nowhere" }] }], stateChanges: [] });
    expect(v.scene.choices.length).toBeGreaterThan(0);
    expect(v.problems.some((p) => p.includes("engine's own"))).toBe(true);
  });
});

describe("running turns", () => {
  it("opens with the offline narrator, then follows a chosen choice", async () => {
    const opening = await runTurn(world, fresh(), offlineNarrator, {});
    expect(opening.campaign.journal.length).toBe(1);
    const choice = opening.campaign.journal[0]!.choices.find((c) => c.actions[0]?.type === "travel")!;
    const next = await runTurn(world, opening.campaign, offlineNarrator, { choiceId: choice.id, playerId: "p1" });
    expect(next.campaign.journal.length).toBe(2);
    expect(next.events.some((e) => e.type === "choice_made")).toBe(true);
    expect(next.eventText.length).toBeGreaterThan(0);
  });

  it("falls back to offline when a narrator throws", async () => {
    const broken: Narrator = { name: "broken", narrate: async () => { throw new Error("no network"); } };
    const r = await runTurn(world, fresh(), broken, { freeText: "look around" });
    expect(r.narrator).toBe("offline");
    expect(r.problems[0]).toContain("no network");
    expect(r.campaign.journal[0]!.freeText).toBe("look around");
  });

  it("recruits a companion by species and archetype through recruit_new", () => {
    const r = applyAction(world, fresh(), { type: "recruit_new", id: "sage-friend", name: "Wren", speciesId: "elf", archetypeId: "adept", background: "A quiet one." });
    expect(r.campaign.party.memberIds).toContain("sage-friend");
    expect(r.campaign.characters["sage-friend"]!.controller.kind).toBe("ai");
  });
});
