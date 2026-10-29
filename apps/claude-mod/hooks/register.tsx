import { atom, read, update } from "claude-code";
import type { Register } from "claude-code";
import type { StorytellerView } from "../types";
import * as ST from "./storyteller.js";

const PANE = "storyteller";
const SAVE_DIR = "storyteller-campaigns";
const STORE_KEY = "storyteller:current";

const EMPTY_VIEW: StorytellerView = {
  name: "No campaign",
  where: "",
  when: "",
  attention: 0,
  gold: 0,
  provisions: 0,
  party: [],
  prose: "Run /storyteller new to begin, or /storyteller load <file>.",
  choices: [],
  notice: "",
};

const view = atom({ plugin: "storyteller", key: "view" } as const, EMPTY_VIEW, { shape: "view-1" });

type EngineInterface = Parameters<Parameters<Register>[0]>[2] extends (...args: infer A) => unknown ? A[0] : never;
type Dollar = Parameters<Parameters<Parameters<Register>[0]>[2]>[0];

interface Session {
  world: ST.World;
  campaign: ST.Campaign;
  path: string;
}

let session: Session | undefined;

function world(): ST.World {
  return ST.loadShannara();
}

function text(s: string, isError = false) {
  return { result: { content: [{ type: "text", text: s }], isError } };
}

function err(s: string) {
  return text(`Storyteller error: ${s}`, true);
}

function viewOf(s: Session | undefined, notice = ""): StorytellerView {
  if (!s) return { ...EMPTY_VIEW, notice };
  const { world: w, campaign: c } = s;
  const loc = w.locations.get(c.party.locationId);
  const scene = c.journal[c.journal.length - 1];
  const fight = c.encounter?.status === "active" ? c.encounter : undefined;
  return {
    campaignId: c.id,
    name: c.name,
    where: c.party.travel ? `On the road to ${w.locations.get(c.party.travel.toLocationId)?.name ?? "?"} (${c.party.travel.daysLeft}d)` : (loc?.name ?? c.party.locationId),
    when: `Day ${c.day}, ${ST.watchName(c.watch)}`,
    attention: c.attention,
    gold: c.party.gold,
    provisions: c.party.provisions,
    party: c.party.memberIds.map((id) => {
      const ch = c.characters[id]!;
      return { id, name: ch.name, vitality: ch.vitality.current, vitalityMax: ch.vitality.max, strain: ch.strain.current, strainMax: ch.strain.max, conditions: ch.conditions, alive: ch.alive };
    }),
    ...(fight
      ? {
          fight: {
            round: fight.round,
            enemies: fight.enemies.map((e) => ({ name: e.name, vitality: e.vitality.current, max: e.vitality.max, alive: e.alive })),
            turn: (() => {
              const id = fight.order[fight.turnIndex];
              return id && c.characters[id] ? c.characters[id]!.name : (fight.enemies.find((e) => e.id === id)?.name ?? "?");
            })(),
          },
        }
      : {}),
    prose: scene?.prose ?? "The campaign is open. Ask the Game Master to begin.",
    choices: scene && !scene.chosenChoiceId ? scene.choices.map((ch) => ({ id: ch.id, label: ch.label })) : [],
    ...(scene?.chosenChoiceId ? { chosen: scene.choices.find((ch) => ch.id === scene.chosenChoiceId)?.label ?? scene.chosenChoiceId } : {}),
    notice,
  };
}

/**
 * Starts a Game Master turn. The engine may drop a plugin's prompt (the reason
 * otherwise goes only to the debug log), so on a drop the text is placed in
 * the prompt box instead and the reason is returned for the person to see.
 */
let pendingKickoff: string | undefined;

/**
 * A command hook holds the turn, so it cannot submit a prompt itself (the
 * engine refuses it). The command puts the kickoff in the prompt box at once,
 * so one Enter starts the Game Master, and leaves it for `turn.complete` to
 * submit on its own; a successful submit then clears the box again.
 */
async function deferKickoff($: Dollar, text: string): Promise<void> {
  pendingKickoff = text;
  await $.prompt.fill({ text, mode: "replace" }).catch(() => undefined);
}

async function kickoff($: Dollar, text: string): Promise<string> {
  try {
    const sent = await $.prompt.submit({ text });
    if (!sent.drop) return "";
    await $.prompt.fill({ text, mode: "replace" }).catch(() => undefined);
    return `The Game Master's turn was not started (${sent.drop}). The kickoff is in your prompt box: press Enter to begin.`;
  } catch (error) {
    await $.prompt.fill({ text, mode: "replace" }).catch(() => undefined);
    return `The Game Master's turn could not be started (${error instanceof Error ? error.message : String(error)}). The kickoff is in your prompt box: press Enter to begin.`;
  }
}

async function save($: Dollar, s: Session) {
  await $.fs.write(s.path, ST.serializeCampaign(s.campaign));
  await $.store.set(STORE_KEY, s.path);
}

async function refresh($: Dollar, notice = "") {
  await update($, view, () => viewOf(session, notice));
}

async function loadFile($: Dollar, path: string): Promise<Session> {
  const raw = await $.fs.read(path);
  const campaign = ST.deserializeCampaign(typeof raw === "string" ? raw : "");
  const w = world();
  if (campaign.worldId !== w.pack.id) throw new Error(`campaign is for world "${campaign.worldId}"`);
  return { world: w, campaign, path };
}

function status(s: Session): string {
  const ctx = ST.buildNarratorContext(s.world, s.campaign);
  const legal = ctx.legal.map((a) => `- ${a.label}: ${JSON.stringify(a.action)}`).join("\n");
  return `${ctx.dynamic}\n\n## Legal engine actions right now\n${legal || "(none)"}`;
}

function canon(s: Session): string {
  const w = s.world;
  const gate = ST.gateFromBooks(w, s.campaign.knownBookIds);
  const species = ST.revealed(w, gate, w.species.values()).filter((x) => x.playable).map((x) => `${x.id} (${x.name})`).join(", ");
  const archetypes = ST.revealed(w, gate, w.archetypes.values()).map((x) => `${x.id} (${x.name}${x.speciesAllowed ? `, ${x.speciesAllowed.join("/")} only` : ""})`).join(", ");
  return `${ST.stableBlock(w, s.campaign)}\n\n## Ids for building characters\nSpecies: ${species}\nArchetypes: ${archetypes}`;
}

const TOOLS = [
  {
    name: "storyteller_new_campaign",
    description: "Start a new Storyteller campaign and open the pane. Give it a name, the party (each member: id, name, speciesId, archetypeId, optional background, optional playerId for a human-controlled character; omit playerId for an engine-run companion), and optionally players, eraId, mode, knownBookIds. Returns the standing canon and the current state.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        eraId: { type: "string", description: "Defaults to the world's first playable era." },
        mode: { type: "string", enum: ["solo", "hotseat", "async"] },
        players: { type: "array", items: { type: "object", properties: { id: { type: "string" }, name: { type: "string" } }, required: ["id", "name"] } },
        knownBookIds: { type: "array", items: { type: "string" }, description: "Books the players have read, for spoiler gating. Defaults to the era's first book. ['*'] means all." },
        party: {
          type: "array",
          items: {
            type: "object",
            properties: { id: { type: "string" }, name: { type: "string" }, speciesId: { type: "string" }, archetypeId: { type: "string" }, background: { type: "string" }, playerId: { type: "string" } },
            required: ["id", "name", "speciesId", "archetypeId"],
          },
        },
      },
      required: ["name", "party"],
    },
  },
  { name: "storyteller_list", description: "List saved Storyteller campaign files in storyteller-campaigns/.", inputSchema: { type: "object", properties: {} } },
  { name: "storyteller_load", description: "Load a saved campaign file by path and open the pane.", inputSchema: { type: "object", properties: { file: { type: "string" } }, required: ["file"] } },
  { name: "storyteller_canon", description: "The standing canon for the current campaign: world, era, peoples, magic, factions, canon figures, lore, rules, and the ids usable when building characters. Call once per session, and again if the reading gate changes.", inputSchema: { type: "object", properties: {} } },
  { name: "storyteller_status", description: "The current state of the campaign (place, roads, party, fight, quests, flags, recent scenes) and the legal engine actions right now. Call at the start of every turn.", inputSchema: { type: "object", properties: {} } },
  {
    name: "storyteller_act",
    description: "Apply engine actions in order (skill checks, fights, rewards, flags, recruits...). Stops at the first illegal action and reports it; earlier ones stay applied. Returns the events as plain sentences and the new state.",
    inputSchema: { type: "object", properties: { actions: { type: "array", items: { type: "object" } }, playerId: { type: "string" } }, required: ["actions"] },
  },
  {
    name: "storyteller_scene",
    description: "Record the scene for this turn: prose, 2 to 5 choices (each with id, label, and the engine actions it performs), optional stateChanges to apply first, optional gmNote. The engine validates everything, drops illegal choices, and reports problems. Call this last every turn.",
    inputSchema: { type: "object", properties: { prose: { type: "string" }, choices: { type: "array", items: { type: "object" } }, stateChanges: { type: "array", items: { type: "object" } }, gmNote: { type: "string" } }, required: ["prose", "choices"] },
  },
  { name: "storyteller_save", description: "Save the current campaign to its file now (it is also saved after every change).", inputSchema: { type: "object", properties: {} } },
];

export const register: Register = (on) => {
  on("session.start", async ($, e, next) => {
    for (const t of TOOLS) await $.tool.register(t);
    await $.command.register({ name: "storyteller", description: "Play Storyteller: /storyteller [new | load <file> | list | pane]" });
    const stored = await $.store.get(STORE_KEY);
    if (typeof stored === "string") {
      try {
        session = await loadFile($, stored);
        await refresh($, "Campaign restored.");
        void $.ui.open({ id: PANE, title: "Storyteller" });
      } catch {
        session = undefined;
      }
    }
    return next(e);
  });

  on("turn.complete", async ($, e, next) => {
    const done = await next(e);
    if (pendingKickoff && !e.agentId) {
      const text = pendingKickoff;
      pendingKickoff = undefined;
      try {
        const sent = await $.prompt.submit({ text });
        if (!sent.drop) await $.prompt.fill({ text: "", mode: "replace" }).catch(() => undefined);
      } catch {
        // The kickoff stays in the prompt box for the person to send.
      }
    }
    return done;
  });

  on("prompt.compose", async ($, e, next) => {
    const base = await next(e);
    if (!session) return base;
    const protocol = `${ST.GM_INSTRUCTIONS}

You are running this campaign inside Claude Code through the storyteller tools. Every turn:
1. Call storyteller_status (and storyteller_canon once per session).
2. Resolve mechanics with storyteller_act: skill checks, fights, rewards, flags, recruits. Narrate only what the events say happened.
3. Call storyteller_scene with the prose and the choices. The pane shows it to the player.
4. In chat, reply with the prose and the numbered choices so the transcript carries the story.
When a message begins with "[Storyteller]" it comes from the pane: the player pressed a choice or typed free text. Continue the campaign from it. Never edit campaign files directly; the tools own them.`;
    return { sections: [...base.sections, { id: "storyteller:gm", text: protocol, scope: "session" }] };
  });

  on("command.run", { command: "storyteller" }, async ($, e) => {
    const [verb, ...rest] = e.args.trim().split(/\s+/);
    const arg = rest.join(" ");
    await $.ui.open({ id: PANE, title: "Storyteller" });
    if (verb === "new") {
      await deferKickoff($, `[Storyteller] Set up a new campaign${arg ? ` called "${arg}"` : ""}. No campaign is loaded yet, so first ask me, in one short message, for: a campaign name, how many human players, and for each party member a name, species, and archetype (the playable species are Human, Elf, Half-Elf, Dwarf, Gnome, Rock Troll; the archetypes are Valeman, Highlander, Borderman, Warrior of the Anar, Elven Hunter, Tracker, Thief, Healer of Storlock, Loremaster, Troll Soldier). Offer to fill in two engine-run companions. Then call storyteller_new_campaign and open with the first scene via storyteller_scene.`);
      return {
        text: "Setting up a new campaign. The Game Master will ask for a name and a party: press Enter if the kickoff is waiting in your prompt box.",
        context: [`The person ran /storyteller new${arg ? ` with the name "${arg}"` : ""}. If no "[Storyteller]" setup message follows this, do the setup yourself now: ask in one short message for a campaign name, how many human players, and each party member's name, species, and archetype; offer two engine-run companions; then call storyteller_new_campaign and open with the first scene via storyteller_scene.`],
      };
    }
    if (verb === "load") {
      if (!arg) return { text: "Usage: /storyteller load <file>" };
      try {
        session = await loadFile($, arg.startsWith(SAVE_DIR) || arg.startsWith("/") ? arg : `${SAVE_DIR}/${arg}`);
        await refresh($, "Loaded.");
        await deferKickoff($, `[Storyteller] The campaign "${session.campaign.name}" is loaded. Call storyteller_canon and storyteller_status, then continue from the latest scene (write a short recap first).`);
        return { text: `Loaded ${session.campaign.name}. Press Enter if the kickoff is waiting in your prompt box.`, context: [`The person loaded the campaign "${session.campaign.name}". If no "[Storyteller]" message follows this, call storyteller_canon and storyteller_status now and continue from the latest scene with a short recap.`] };
      } catch (error) {
        return { text: `Could not load: ${error instanceof Error ? error.message : String(error)}` };
      }
    }
    if (verb === "list") {
      try {
        const entries = await $.fs.list(SAVE_DIR);
        const files = entries.filter((x) => x.kind === "file" && x.name.endsWith(".json")).map((x) => `- ${SAVE_DIR}/${x.name}`);
        return { text: files.length ? files.join("\n") : "No saved campaigns yet." };
      } catch {
        return { text: "No saved campaigns yet." };
      }
    }
    return { text: "Storyteller pane opened. /storyteller new | load <file> | list" };
  });

  on("tool.call", { tool: "mcp__storyteller__storyteller_new_campaign" }, async ($, e) => {
    const input = e as unknown as { name: string; eraId?: string; mode?: ST.PartyMode; players?: ST.Player[]; knownBookIds?: string[]; party: { id: string; name: string; speciesId: string; archetypeId: string; background?: string; playerId?: string }[] };
    try {
      const w = world();
      const era = input.eraId ?? w.pack.eras.find((x) => x.playable)!.id;
      const players = input.players?.length ? input.players : [{ id: "p1", name: "Player" }];
      const id = `${input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "campaign"}-${Date.now().toString(36)}`;
      let campaign = ST.createCampaign(w, { id, name: input.name, eraId: era, mode: input.mode ?? (players.length > 1 ? "hotseat" : "solo"), players, ...(input.knownBookIds ? { knownBookIds: input.knownBookIds } : {}) });
      for (const m of input.party) {
        campaign = ST.applyAction(w, campaign, { type: "recruit_new", id: m.id, name: m.name, speciesId: m.speciesId, archetypeId: m.archetypeId, background: m.background ?? "", ...(m.playerId ? { playerId: m.playerId } : {}) }).campaign;
      }
      session = { world: w, campaign, path: `${SAVE_DIR}/${id}.json` };
      await save($, session);
      await refresh($, "New campaign.");
      void $.ui.open({ id: PANE, title: "Storyteller" });
      return text(`Campaign "${campaign.name}" created and saved to ${session.path}.\n\n${canon(session)}\n\n${status(session)}`);
    } catch (error) {
      return err(error instanceof Error ? error.message : String(error));
    }
  }).catch(() => err("the storyteller tool failed"));

  on("tool.call", { tool: "mcp__storyteller__storyteller_list" }, async ($) => {
    try {
      const entries = await $.fs.list(SAVE_DIR);
      const files = entries.filter((x) => x.kind === "file" && x.name.endsWith(".json")).map((x) => `${SAVE_DIR}/${x.name}`);
      return text(files.length ? files.join("\n") : "No saved campaigns.");
    } catch {
      return text("No saved campaigns.");
    }
  }).catch(() => err("the storyteller tool failed"));

  on("tool.call", { tool: "mcp__storyteller__storyteller_load" }, async ($, e) => {
    const { file } = e as unknown as { file: string };
    try {
      session = await loadFile($, file);
      await save($, session);
      await refresh($, "Loaded.");
      void $.ui.open({ id: PANE, title: "Storyteller" });
      return text(`Loaded "${session.campaign.name}".\n\n${canon(session)}\n\n${status(session)}`);
    } catch (error) {
      return err(error instanceof Error ? error.message : String(error));
    }
  }).catch(() => err("the storyteller tool failed"));

  on("tool.call", { tool: "mcp__storyteller__storyteller_canon" }, async () => (session ? text(canon(session)) : err("no campaign is loaded"))).catch(() => err("the storyteller tool failed"));
  on("tool.call", { tool: "mcp__storyteller__storyteller_status" }, async () => (session ? text(status(session)) : err("no campaign is loaded"))).catch(() => err("the storyteller tool failed"));
  on("tool.call", { tool: "mcp__storyteller__storyteller_save" }, async ($) => {
    if (!session) return err("no campaign is loaded");
    await save($, session);
    return text(`Saved to ${session.path}.`);
  }).catch(() => err("the storyteller tool failed"));

  on("tool.call", { tool: "mcp__storyteller__storyteller_act" }, async ($, e) => {
    if (!session) return err("no campaign is loaded");
    const { actions, playerId } = e as unknown as { actions: unknown[]; playerId?: string };
    const lines: string[] = [];
    let failed: string | undefined;
    for (const raw of actions ?? []) {
      const parsed = ST.ProposedActionSchema.safeParse(raw);
      if (!parsed.success) {
        failed = `action ${JSON.stringify(raw)} is not a known engine action: ${parsed.error.issues.map((i) => i.message).join("; ")}`;
        break;
      }
      try {
        const r = ST.applyAction(session.world, session.campaign, parsed.data as ST.Action, playerId ? { playerId } : {});
        session.campaign = r.campaign;
        lines.push(...ST.describeEvents(session.world, session.campaign, r.events));
      } catch (error) {
        failed = error instanceof Error ? error.message : String(error);
        break;
      }
    }
    await save($, session);
    await refresh($, failed ? `Refused: ${failed}` : "");
    const body = `${lines.length ? `Events:\n${lines.map((l) => `- ${l}`).join("\n")}` : "No events."}${failed ? `\n\nStopped: ${failed}` : ""}\n\n${status(session)}`;
    return text(body, Boolean(failed) && lines.length === 0);
  }).catch(() => err("the storyteller tool failed"));

  on("tool.call", { tool: "mcp__storyteller__storyteller_scene" }, async ($, e) => {
    if (!session) return err("no campaign is loaded");
    const parsed = ST.SceneProposalSchema.safeParse({ stateChanges: [], ...(e as unknown as Record<string, unknown>) });
    if (!parsed.success) return err(`the scene does not match the contract: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
    const latest = session.campaign.journal[session.campaign.journal.length - 1];
    const freeText = latest && !latest.chosenChoiceId && latest.freeText ? undefined : undefined;
    const v = ST.validateProposal(session.world, session.campaign, parsed.data, freeText);
    session.campaign = v.campaign;
    await save($, session);
    await refresh($, v.problems.length ? v.problems.join(" ") : "");
    return text(`Scene ${v.campaign.journal.length} recorded with ${v.scene.choices.length} choice(s).${v.problems.length ? `\nProblems:\n${v.problems.map((p) => `- ${p}`).join("\n")}` : ""}`);
  }).catch(() => err("the storyteller tool failed"));

  on("ui.render", { component: "Pane", requestId: PANE }, async ($, e) => {
    const els = $.ui.resolve(e) as unknown as Record<string, unknown>;
    const Box = els["Box"] as never;
    const Text = els["Text"] as never;
    const Button = els["Button"] as never;
    const Input = els["Input"] as never;
    const Markdown = (els["Markdown"] ?? els["Text"]) as never;
    const v = await read($, view);
    const choose = async (id: string, label: string) => {
      if (!session) return;
      try {
        const r = ST.applyAction(session.world, session.campaign, { type: "choose", choiceId: id });
        session.campaign = r.campaign;
        await save($, session);
        const events = ST.describeEvents(session.world, session.campaign, r.events);
        await refresh($, "Waiting for the Game Master.");
        const note = await kickoff($, `[Storyteller] The player chose: "${label}".${events.length ? ` Engine events:\n${events.map((x) => `- ${x}`).join("\n")}` : ""}\nCall storyteller_status, resolve anything still needed with storyteller_act, then write the next scene with storyteller_scene.`);
        if (note) await refresh($, note);
      } catch (error) {
        await refresh($, `Could not choose: ${error instanceof Error ? error.message : String(error)}`);
      }
    };
    const say = (value: string) => {
      const t = value.trim();
      if (!t || !session) return;
      void (async () => {
        await refresh($, "Waiting for the Game Master.");
        const note = await kickoff($, `[Storyteller] The player says: "${t}". Call storyteller_status, resolve it with storyteller_act where the rules apply, then write the next scene with storyteller_scene.`);
        if (note) await refresh($, note);
      })();
    };
    const H = h as unknown as (...args: unknown[]) => unknown;
    const party = v.party.map((m) =>
      H(Text, { key: `m-${m.id}`, dimColor: !m.alive }, `${m.name} ${m.alive ? `${m.vitality}/${m.vitalityMax}` : "fallen"}${m.strain > 0 ? ` strain ${m.strain}/${m.strainMax}` : ""}${m.conditions.length ? ` (${m.conditions.join(", ")})` : ""}`),
    );
    const fight = v.fight
      ? [H(Text, { bold: true }, `Fight, round ${v.fight.round}. ${v.fight.turn}'s turn.`), ...v.fight.enemies.map((x, i) => H(Text, { key: `e-${i}`, dimColor: !x.alive }, `${x.name} ${x.alive ? `${x.vitality}/${x.max}` : "down"}`))]
      : [];
    const choices = v.choices.map((c, i) => H(Button, { key: `c-${c.id}`, hotkey: String((i + 1) % 10), onPress: () => void choose(c.id, c.label) }, `${c.label}`));
    return H(
      Box,
      { flexDirection: "column", gap: 1 },
      H(Text, { bold: true }, `${v.name}${v.where ? ` · ${v.where}` : ""}${v.when ? ` · ${v.when}` : ""}`),
      v.party.length ? H(Box, { flexDirection: "column" }, ...party, H(Text, { dimColor: true }, `gold ${v.gold} · provisions ${v.provisions} · attention ${v.attention}`)) : null,
      fight.length ? H(Box, { flexDirection: "column" }, ...fight) : null,
      H(Markdown, { text: v.prose }),
      v.chosen ? H(Text, { dimColor: true }, `Chosen: ${v.chosen}`) : null,
      choices.length ? H(Box, { flexDirection: "column" }, ...choices) : null,
      session ? H(Input, { key: "say", placeholder: "Or say what you do…", submitLabel: "act", onSubmit: say }) : null,
      v.notice ? H(Text, { dimColor: true }, v.notice) : null,
    );
  });
};
