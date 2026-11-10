import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { authStatus, cancelJob, findClaude, jobState, narrateWithClaude, sendCode, startLogin, startLogout } from "@storyteller/claude-code";

/**
 * Runs inside the container next to Claude Code. Only the Storyteller Worker
 * can reach it (through its container binding); it is never exposed publicly.
 * It never reads or returns Claude credentials: sign-in is Claude Code's own
 * `claude auth login`, and Claude Code keeps its own token.
 */

const PORT = Number(process.env.PORT ?? 8080);
/** Shared with the Storyteller Worker; every request must carry it. */
const GM_TOKEN = process.env.GM_TOKEN ?? "";

function authorized(req: IncomingMessage): boolean {
  if (!GM_TOKEN) return false;
  const got = String(req.headers.authorization ?? "");
  const want = `Bearer ${GM_TOKEN}`;
  if (got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= got.charCodeAt(i) ^ want.charCodeAt(i);
  return diff === 0;
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > 4 * 1024 * 1024) req.destroy();
      else chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const MODEL_ALIAS = /^(haiku|sonnet|opus|claude-[a-z0-9-]{3,40})$/;

createServer(async (req, res) => {
  const path = new URL(req.url ?? "/", "http://gm").pathname;
  if (path === "/ping") return send(res, 200, { ok: true });
  if (!authorized(req)) return send(res, 401, { error: GM_TOKEN ? "unauthorized" : "GM_TOKEN is not set on the Game Master" });
  try {
    if (path === "/health" && req.method === "GET") {
      const claude = await findClaude(true);
      const auth = claude.found ? await authStatus() : { loggedIn: false };
      return send(res, 200, { claude: { found: claude.found, version: claude.version }, auth: { loggedIn: auth.loggedIn, ...(auth.email ? { email: auth.email } : {}), ...(auth.subscription ? { subscription: auth.subscription } : {}) }, job: jobState() });
    }
    if (path === "/narrate" && req.method === "POST") {
      const body = JSON.parse(await readBody(req)) as { system?: string; user?: string; model?: string };
      if (typeof body.system !== "string" || typeof body.user !== "string") return send(res, 400, { error: "system and user are required" });
      const model = typeof body.model === "string" && MODEL_ALIAS.test(body.model) ? body.model : undefined;
      return send(res, 200, await narrateWithClaude({ system: body.system, user: body.user, ...(model ? { model } : {}) }));
    }
    if (path === "/account/job" && req.method === "GET") return send(res, 200, jobState());
    if (path === "/account/login" && req.method === "POST") return send(res, 200, await startLogin());
    if (path === "/account/logout" && req.method === "POST") return send(res, 200, await startLogout());
    if (path === "/account/cancel" && req.method === "POST") return send(res, 200, cancelJob());
    if (path === "/account/code" && req.method === "POST") {
      const body = JSON.parse(await readBody(req)) as { code?: string };
      return send(res, 200, sendCode(String(body.code ?? "")));
    }
    return send(res, 404, { error: "not found" });
  } catch (err) {
    return send(res, 500, { error: err instanceof Error ? err.message : String(err) });
  }
}).listen(PORT, "0.0.0.0", () => console.log(`Storyteller GM listening on ${PORT}`));
