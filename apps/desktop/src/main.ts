import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { ASSETS } from "./assets.generated";
import { findClaude, narrateWithClaude } from "@storyteller/claude-code";
import { authStatus, cancelJob, jobState, sendCode, startInstall, startLogin, startLogout } from "@storyteller/claude-code";
import { deleteSave, listSaves, savesDir, writeSave } from "./saves";

const VERSION = "0.2.0";
const PORTS = [4747, 4748, 4749, 4750, 4751];
const MAX_BODY = 8 * 1024 * 1024;

function send(res: ServerResponse, status: number, body: unknown, type = "application/json; charset=utf-8") {
  const data = typeof body === "string" || body instanceof Uint8Array ? body : JSON.stringify(body);
  res.writeHead(status, { "content-type": type, "cache-control": "no-store", "x-content-type-options": "nosniff" });
  res.end(data);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error("request too large"));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/** Only the app's own pages may call the API: a stray web page cannot drive Claude Code. */
function sameOrigin(req: IncomingMessage, port: number): boolean {
  const origin = req.headers.origin;
  const host = req.headers.host ?? "";
  const okHost = host === `localhost:${port}` || host === `127.0.0.1:${port}`;
  if (!okHost) return false;
  if (!origin) return true;
  return origin === `http://localhost:${port}` || origin === `http://127.0.0.1:${port}`;
}

async function handle(req: IncomingMessage, res: ServerResponse, port: number) {
  const url = new URL(req.url ?? "/", `http://localhost:${port}`);
  const path = url.pathname;
  if (path.startsWith("/api/")) {
    if (!sameOrigin(req, port)) return send(res, 403, { error: "forbidden" });
    try {
      if (path === "/api/health" && req.method === "GET") {
        const claude = await findClaude(url.searchParams.has("refresh"));
        const auth = claude.found ? await authStatus() : { loggedIn: false };
        return send(res, 200, { app: "storyteller", version: VERSION, claude, auth, job: jobState(), savesDir: savesDir() });
      }
      if (path === "/api/account/job" && req.method === "GET") return send(res, 200, jobState());
      if (path === "/api/account/login" && req.method === "POST") return send(res, 200, await startLogin());
      if (path === "/api/account/logout" && req.method === "POST") return send(res, 200, await startLogout());
      if (path === "/api/account/install" && req.method === "POST") return send(res, 200, startInstall());
      if (path === "/api/account/cancel" && req.method === "POST") return send(res, 200, cancelJob());
      if (path === "/api/account/code" && req.method === "POST") {
        const body = JSON.parse(await readBody(req)) as { code?: string };
        return send(res, 200, sendCode(String(body.code ?? "")));
      }
      if (path === "/api/narrate" && req.method === "POST") {
        const body = JSON.parse(await readBody(req)) as { system?: string; user?: string; model?: string };
        if (typeof body.system !== "string" || typeof body.user !== "string") return send(res, 400, { error: "system and user are required" });
        const model = typeof body.model === "string" && /^[a-z0-9.\-[\]]{1,60}$/i.test(body.model) ? body.model : undefined;
        const result = await narrateWithClaude({ system: body.system, user: body.user, ...(model ? { model } : {}) });
        return send(res, 200, result);
      }
      if (path === "/api/campaigns" && req.method === "GET") return send(res, 200, listSaves());
      const m = /^\/api\/campaigns\/([a-z0-9-]+)$/.exec(path);
      if (m && req.method === "PUT") {
        writeSave(m[1]!, await readBody(req));
        return send(res, 200, { ok: true });
      }
      if (m && req.method === "DELETE") {
        deleteSave(m[1]!);
        return send(res, 200, { ok: true });
      }
      return send(res, 404, { error: "not found" });
    } catch (err) {
      return send(res, 500, { error: err instanceof Error ? err.message : String(err) });
    }
  }
  const asset = ASSETS[path] ?? ASSETS["/index.html"];
  if (!asset) return send(res, 404, "not found", "text/plain");
  return send(res, 200, Buffer.from(asset.body, "base64"), asset.type);
}

async function alreadyRunning(port: number): Promise<boolean> {
  try {
    const r = await fetch(`http://localhost:${port}/api/health`, { signal: AbortSignal.timeout(1500) });
    const j = (await r.json()) as { app?: string };
    return j.app === "storyteller";
  } catch {
    return false;
  }
}

function listen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => void handle(req, res, port));
    server.once("error", () => resolve(false));
    server.listen(port, "127.0.0.1", () => resolve(true));
  });
}

function openWindow(url: string) {
  if (process.env.STORYTELLER_NO_BROWSER) return;
  try {
    if (process.platform === "win32") {
      const edges = [
        `${process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)"}\\Microsoft\\Edge\\Application\\msedge.exe`,
        `${process.env.ProgramFiles ?? "C:\\Program Files"}\\Microsoft\\Edge\\Application\\msedge.exe`,
      ];
      const edge = edges.find((p) => existsSync(p));
      if (edge) {
        spawn(edge, [`--app=${url}`, "--window-size=1100,900"], { detached: true, stdio: "ignore" }).unref();
        return;
      }
      spawn(process.env.ComSpec ?? "cmd.exe", ["/c", "start", "", url], { detached: true, stdio: "ignore", windowsHide: true }).unref();
    } else if (process.platform === "darwin") {
      spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
    } else {
      spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
    }
  } catch {
    // The URL is printed below; the person can open it by hand.
  }
}

async function main() {
  for (const port of PORTS) {
    if (await alreadyRunning(port)) {
      const url = `http://localhost:${port}/`;
      console.log(`Storyteller is already running at ${url}`);
      openWindow(url);
      return;
    }
  }
  for (const port of PORTS) {
    if (await listen(port)) {
      const url = `http://localhost:${port}/`;
      const claude = await findClaude();
      console.log("");
      console.log(`  Storyteller ${VERSION}`);
      console.log(`  Playing at   ${url}`);
      console.log(`  Saves in     ${savesDir()}`);
      const auth = claude.found ? await authStatus() : { loggedIn: false };
      console.log(`  Claude       ${!claude.found ? "Claude Code not installed: Settings in the app can install it" : auth.loggedIn ? `signed in (${claude.version})` : "not signed in: use Sign in with Claude in the app's Settings"}`);
      console.log("");
      console.log("  Close this window to quit.");
      openWindow(url);
      return;
    }
  }
  console.error(`Could not open a port between ${PORTS[0]} and ${PORTS[PORTS.length - 1]}.`);
  process.exit(1);
}

void main();
