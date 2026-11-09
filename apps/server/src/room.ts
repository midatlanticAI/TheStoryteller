import { DurableObject } from "cloudflare:workers";
import {
  applyAction,
  deserializeCampaign,
  offlineNarrator,
  runTurn,
  SKILLS,
  type Campaign,
  type Narrator,
  type Scene,
  type ActionRecord,
} from "@storyteller/engine";
import { AnthropicNarrator, shortName } from "@storyteller/narrator";
import { loadShannara } from "@storyteller/world-shannara";
import type { Env, User } from "./env";

export type TurnMode = "free" | "rotate";

export interface RoomMeta {
  id: string;
  ownerId: string;
  turnMode: TurnMode;
  activeIndex: number;
  model: string;
}

export interface RoomView {
  campaign: Campaign;
  room: {
    ownerId: string;
    turnMode: TurnMode;
    activePlayerId?: string;
    model: string;
    narrating?: { by: string; since: string };
    online: User[];
    lastNote?: string;
    lastEvents: string[];
    lastProblems: string[];
    narrator: "claude" | "offline";
  };
}

const world = loadShannara();
const pad = (n: number) => String(n).padStart(8, "0");

/**
 * One shared campaign. The engine runs here, so every player sees the same
 * state and no browser can change it except through the engine's actions.
 */
export class CampaignRoom extends DurableObject<Env> {
  private campaign?: Campaign;
  private meta?: RoomMeta;
  private savedJournal = 0;
  private savedLog = 0;
  private narrating?: { by: string; since: string };
  private lastNote?: string;
  private lastEvents: string[] = [];
  private lastProblems: string[] = [];

  private async load(): Promise<boolean> {
    if (this.campaign && this.meta) return true;
    const meta = await this.ctx.storage.get<RoomMeta>("meta");
    const state = await this.ctx.storage.get<Campaign>("state");
    if (!meta || !state) return false;
    const journal = [...(await this.ctx.storage.list<Scene>({ prefix: "j:" })).values()];
    const log = [...(await this.ctx.storage.list<ActionRecord>({ prefix: "l:" })).values()];
    this.campaign = { ...state, journal, log };
    this.meta = meta;
    this.savedJournal = journal.length;
    this.savedLog = log.length;
    return true;
  }

  private async persist() {
    const c = this.campaign!;
    const { journal, log, ...state } = c;
    const writes: Record<string, unknown> = { state, meta: this.meta };
    for (let i = Math.max(0, this.savedJournal - 1); i < journal.length; i++) writes[`j:${pad(i)}`] = journal[i];
    for (let i = this.savedLog; i < log.length; i++) writes[`l:${pad(i)}`] = log[i];
    const entries = Object.entries(writes);
    for (let i = 0; i < entries.length; i += 100) await this.ctx.storage.put(Object.fromEntries(entries.slice(i, i + 100)));
    this.savedJournal = journal.length;
    this.savedLog = log.length;
  }

  private online(): User[] {
    const seen = new Map<string, User>();
    for (const ws of this.ctx.getWebSockets()) {
      const u = ws.deserializeAttachment() as User | null;
      if (u) seen.set(u.id, u);
    }
    return [...seen.values()];
  }

  private view(): RoomView {
    const c = this.campaign!;
    const m = this.meta!;
    const active = m.turnMode === "rotate" && c.players.length ? c.players[m.activeIndex % c.players.length]?.id : undefined;
    return {
      campaign: c,
      room: {
        ownerId: m.ownerId,
        turnMode: m.turnMode,
        ...(active ? { activePlayerId: active } : {}),
        model: m.model,
        ...(this.narrating ? { narrating: this.narrating } : {}),
        online: this.online(),
        ...(this.lastNote ? { lastNote: this.lastNote } : {}),
        lastEvents: this.lastEvents,
        lastProblems: this.lastProblems,
        narrator: this.env.ANTHROPIC_API_KEY ? "claude" : "offline",
      },
    };
  }

  private broadcast() {
    const msg = JSON.stringify({ t: "state", ...this.view() });
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(msg);
      } catch {
        // a closed socket; the runtime drops it
      }
    }
  }

  private narrator(): Narrator {
    if (!this.env.ANTHROPIC_API_KEY) return offlineNarrator;
    return new AnthropicNarrator({ apiKey: this.env.ANTHROPIC_API_KEY, model: this.meta!.model || "auto" });
  }

  private isMember(user: User): boolean {
    return this.campaign!.players.some((p) => p.id === user.id);
  }

  private async narrate(user: User | undefined, input: { choiceId?: string; freeText?: string }) {
    this.narrating = { by: user?.name ?? "the table", since: new Date().toISOString() };
    this.broadcast();
    try {
      const limit = Number(this.env.DAILY_TURN_LIMIT ?? "400") || 400;
      const quota = this.env.ANTHROPIC_API_KEY ? await this.env.LOBBY.get(this.env.LOBBY.idFromName("lobby")).countTurn(limit) : { ok: true };
      const narrator = quota.ok ? this.narrator() : offlineNarrator;
      const r = await runTurn(world, this.campaign!, narrator, {
        ...(input.choiceId ? { choiceId: input.choiceId } : {}),
        ...(input.freeText ? { freeText: user ? `${user.name}: ${input.freeText}` : input.freeText } : {}),
        ...(user ? { playerId: user.id } : {}),
      });
      this.campaign = r.campaign;
      this.lastEvents = r.eventText;
      this.lastProblems = r.problems;
      this.lastNote = !quota.ok ? "Offline: the table's daily narration limit is reached" : r.narrator === "offline" && narrator.name !== "offline" ? "Offline: Claude did not answer this turn" : r.note;
      if (this.meta!.turnMode === "rotate" && user) this.meta!.activeIndex += 1;
      await this.persist();
      await this.env.LOBBY.get(this.env.LOBBY.idFromName("lobby")).touch(this.campaign.id, this.campaign.updatedAt, this.campaign.turn);
    } catch (err) {
      this.lastProblems = [err instanceof Error ? err.message : String(err)];
    } finally {
      this.narrating = undefined;
      this.broadcast();
    }
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const userHeader = req.headers.get("x-st-user");
    const user = userHeader ? (JSON.parse(userHeader) as User) : undefined;
    const json = (body: unknown, status = 200) => Response.json(body, { status });

    if (url.pathname === "/init" && req.method === "POST") {
      if (await this.load()) return json({ error: "this campaign already exists" }, 409);
      const body = (await req.json()) as { campaign: string };
      const c = deserializeCampaign(body.campaign);
      this.campaign = c;
      this.meta = { id: c.id, ownerId: user!.id, turnMode: "free", activeIndex: 0, model: "auto" };
      await this.persist();
      this.ctx.waitUntil(this.narrate(undefined, {}));
      return json({ ok: true });
    }

    if (!(await this.load())) return json({ error: "no such campaign" }, 404);
    if (!user) return json({ error: "sign in first" }, 401);

    if (url.pathname === "/join" && req.method === "POST") {
      if (!this.isMember(user)) {
        this.campaign = applyAction(world, this.campaign!, { type: "add_player", id: user.id, name: user.name }).campaign;
        await this.persist();
        this.broadcast();
      }
      return json({ ok: true });
    }

    if (!this.isMember(user)) return json({ error: "you are not at this table; join with its invite code" }, 403);

    if (url.pathname === "/live") {
      if (req.headers.get("upgrade") !== "websocket") return json({ error: "expected a websocket" }, 426);
      const pair = new WebSocketPair();
      this.ctx.acceptWebSocket(pair[1]);
      pair[1].serializeAttachment(user);
      pair[1].send(JSON.stringify({ t: "state", ...this.view() }));
      this.broadcast();
      return new Response(null, { status: 101, webSocket: pair[0] });
    }

    if (url.pathname === "/state" && req.method === "GET") return json(this.view());

    if (url.pathname === "/export" && req.method === "GET") {
      return new Response(JSON.stringify({ format: "storyteller-campaign", version: this.campaign!.version, campaign: this.campaign }, null, 2), {
        headers: { "content-type": "application/json", "content-disposition": `attachment; filename="${this.campaign!.id}.json"` },
      });
    }

    if (url.pathname === "/turn" && req.method === "POST") {
      const body = (await req.json()) as { choiceId?: string; freeText?: string };
      if (this.narrating) return json({ error: `the narrator is still writing (for ${this.narrating.by})` }, 409);
      const m = this.meta!;
      const c = this.campaign!;
      if (m.turnMode === "rotate" && user.id !== m.ownerId) {
        const active = c.players[m.activeIndex % c.players.length];
        if (active && active.id !== user.id) return json({ error: `it is ${active.name}'s turn` }, 409);
      }
      const free = typeof body.freeText === "string" ? body.freeText.trim().slice(0, 600) : "";
      if (!body.choiceId && !free) return json({ error: "choose something or say what you do" }, 400);
      if (body.choiceId) {
        const scene = c.journal[c.journal.length - 1];
        if (!scene || scene.chosenChoiceId || !scene.choices.some((x) => x.id === body.choiceId)) return json({ error: "that choice is no longer open" }, 409);
      }
      this.ctx.waitUntil(this.narrate(user, body.choiceId ? { choiceId: body.choiceId } : { freeText: free }));
      return json({ ok: true }, 202);
    }

    if (url.pathname === "/seat" && req.method === "POST") {
      const body = (await req.json()) as { characterId: string; playerId?: string | null };
      const ch = this.campaign!.characters[body.characterId];
      if (!ch) return json({ error: "no such character" }, 404);
      const isOwner = user.id === this.meta!.ownerId;
      const target = body.playerId ?? undefined;
      const holder = ch.controller.kind === "player" ? ch.controller.playerId : undefined;
      const allowed = isOwner || (target === user.id && !holder) || (!target && holder === user.id);
      if (!allowed) return json({ error: "only the table's owner can move someone else's seat" }, 403);
      this.campaign = applyAction(world, this.campaign!, { type: "assign_controller", characterId: body.characterId, ...(target ? { playerId: target } : {}) }).campaign;
      await this.persist();
      this.broadcast();
      return json({ ok: true });
    }

    if (url.pathname === "/sheet" && req.method === "POST") {
      const body = (await req.json()) as { characterId: string; skill?: string; equip?: string };
      const ch = this.campaign!.characters[body.characterId];
      if (!ch) return json({ error: "no such character" }, 404);
      const controls = (ch.controller.kind === "player" && ch.controller.playerId === user.id) || user.id === this.meta!.ownerId;
      if (!controls) return json({ error: "that is not your character" }, 403);
      try {
        if (body.skill && (SKILLS as readonly string[]).includes(body.skill)) {
          this.campaign = applyAction(world, this.campaign!, { type: "improve_skill", characterId: ch.id, skill: body.skill as (typeof SKILLS)[number] }).campaign;
        } else if (body.equip) {
          this.campaign = applyAction(world, this.campaign!, { type: "equip", characterId: ch.id, instanceId: body.equip }).campaign;
        } else return json({ error: "nothing to change" }, 400);
      } catch (err) {
        return json({ error: err instanceof Error ? err.message : String(err) }, 409);
      }
      await this.persist();
      this.broadcast();
      return json({ ok: true });
    }

    if (url.pathname === "/settings" && req.method === "POST") {
      if (user.id !== this.meta!.ownerId) return json({ error: "only the table's owner changes its settings" }, 403);
      const body = (await req.json()) as { turnMode?: TurnMode; model?: string };
      if (body.turnMode === "free" || body.turnMode === "rotate") this.meta!.turnMode = body.turnMode;
      if (typeof body.model === "string" && /^(auto|claude-[a-z0-9-]{3,40})$/.test(body.model)) this.meta!.model = body.model;
      await this.persist();
      this.broadcast();
      return json({ ok: true });
    }

    return json({ error: "not found" }, 404);
  }

  async webSocketClose(ws: WebSocket) {
    ws.close();
    this.broadcast();
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (message === "ping") ws.send("pong");
  }
}

export { shortName };
