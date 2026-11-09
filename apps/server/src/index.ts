import { deserializeCampaign, serializeCampaign } from "@storyteller/engine";
import { authMode, clearSession, currentUser, issueSession } from "./auth";
import type { Env, User } from "./env";

export { CampaignRoom } from "./room";
export { Lobby } from "./lobby";

const VERSION = "0.3.0";

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });

function lobby(env: Env) {
  return env.LOBBY.get(env.LOBBY.idFromName("lobby"));
}

function room(env: Env, id: string) {
  return env.ROOMS.get(env.ROOMS.idFromName(id));
}

async function forward(env: Env, id: string, path: string, req: Request, user: User, body?: BodyInit | null) {
  const headers = new Headers({ "x-st-user": JSON.stringify(user) });
  const upgrade = req.headers.get("upgrade");
  if (upgrade) headers.set("upgrade", upgrade);
  if (req.headers.get("content-type")) headers.set("content-type", req.headers.get("content-type")!);
  return room(env, id).fetch(`https://room${path}`, { method: req.method, headers, body: body === undefined ? (req.method === "GET" ? null : req.body) : body });
}

/** Refuses cross-site writes: only the app's own pages may change anything. */
function sameSite(req: Request): boolean {
  if (req.method === "GET" || req.method === "HEAD") return true;
  const origin = req.headers.get("origin");
  if (!origin) return true;
  return origin === new URL(req.url).origin;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(req);
    if (!sameSite(req)) return json({ error: "forbidden" }, 403);

    const mode = authMode(env);
    const user = await currentUser(env, req);

    if (url.pathname === "/api/health") {
      return json({ app: "storyteller-server", version: VERSION, auth: mode, user: user ?? null, narrator: env.ANTHROPIC_API_KEY ? "claude" : "offline" });
    }
    if (url.pathname === "/api/session" && req.method === "POST") {
      const body = (await req.json().catch(() => ({}))) as { name?: string; passphrase?: string };
      const r = await issueSession(env, String(body.name ?? ""), String(body.passphrase ?? ""));
      if ("error" in r) return json({ error: r.error }, 401);
      return json({ user: r.user }, 200, { "set-cookie": r.cookie });
    }
    if (url.pathname === "/api/session" && req.method === "DELETE") return json({ ok: true }, 200, { "set-cookie": clearSession() });

    if (mode === "closed") return json({ error: "this table is not set up yet: the owner needs to set TABLE_PASSPHRASE and SESSION_SECRET" }, 503);
    if (!user) return json({ error: "sign in first" }, 401);

    if (url.pathname === "/api/campaigns" && req.method === "GET") {
      return json(await lobby(env).mine(user.id));
    }
    if (url.pathname === "/api/campaigns" && req.method === "POST") {
      const text = await req.text();
      if (text.length > 2_000_000) return json({ error: "campaign too large" }, 413);
      let c;
      try {
        c = deserializeCampaign(text);
      } catch (err) {
        return json({ error: err instanceof Error ? err.message : "not a campaign" }, 400);
      }
      if (c.worldId !== "shannara") return json({ error: "unknown world" }, 400);
      c.id = `${c.id.replace(/[^a-z0-9-]/g, "").slice(0, 40)}-${crypto.randomUUID().slice(0, 8)}`;
      c.players = [{ id: user.id, name: user.name }];
      for (const ch of Object.values(c.characters)) if (ch.controller.kind === "player") ch.controller = { kind: "player", playerId: user.id };
      const meta = await lobby(env).create({ id: c.id, name: c.name, ownerId: user.id, ownerName: user.name, members: [user], updatedAt: c.updatedAt, turn: c.turn });
      const init = await forward(env, c.id, "/init", new Request(req.url, { method: "POST" }), user, JSON.stringify({ campaign: serializeCampaign(c) }));
      if (!init.ok) return init;
      return json(meta, 201);
    }
    if (url.pathname === "/api/join" && req.method === "POST") {
      const body = (await req.json().catch(() => ({}))) as { code?: string };
      const meta = await lobby(env).resolve(String(body.code ?? ""));
      if (!meta) return json({ error: "no table has that invite code" }, 404);
      const r = await forward(env, meta.id, "/join", new Request(req.url, { method: "POST" }), user, "{}");
      if (!r.ok) return r;
      return json(await lobby(env).addMember(meta.id, user));
    }

    const m = /^\/api\/campaigns\/([a-z0-9-]+)(\/[a-z]+)?$/.exec(url.pathname);
    if (m) {
      const id = m[1]!;
      const sub = m[2] ?? "/state";
      if (sub === "/leave" && req.method === "POST") return json({ error: "not yet" }, 501);
      if (sub === "/delete" && req.method === "POST") {
        const meta = await lobby(env).get(id);
        if (!meta || meta.ownerId !== user.id) return json({ error: "only the owner can delete a table" }, 403);
        await lobby(env).remove(id);
        return json({ ok: true });
      }
      if (sub === "/meta") {
        const meta = await lobby(env).get(id);
        if (!meta || !meta.members.some((x) => x.id === user.id)) return json({ error: "not found" }, 404);
        return json(meta);
      }
      return forward(env, id, sub, req, user);
    }
    return json({ error: "not found" }, 404);
  },
} satisfies ExportedHandler<Env>;
