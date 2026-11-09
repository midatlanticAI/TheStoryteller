import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { delimiter, join } from "node:path";
import { SceneProposalSchema, sceneProposalModelSchema, type SceneProposal } from "@storyteller/engine";

/**
 * Narration through the player's own Claude Code install, so scenes run on
 * their Claude subscription with no API key. Each scene is one headless call
 * with every tool, plugin, MCP server, and user setting switched off.
 */

export interface ClaudeInfo {
  found: boolean;
  path?: string;
  version?: string;
  error?: string;
}

function candidates(): string[] {
  const names = process.platform === "win32" ? ["claude.exe", "claude.cmd"] : ["claude"];
  const dirs = (process.env.PATH ?? "").split(delimiter).filter(Boolean);
  const home = homedir();
  dirs.push(join(home, ".local", "bin"), join(home, ".claude", "local"), join(home, ".npm-global", "bin"));
  if (process.platform === "win32") {
    if (process.env.APPDATA) dirs.push(join(process.env.APPDATA, "npm"));
    if (process.env.LOCALAPPDATA) dirs.push(join(process.env.LOCALAPPDATA, "Programs", "claude"));
  } else {
    dirs.push("/usr/local/bin", "/opt/homebrew/bin");
  }
  const out: string[] = [];
  for (const dir of dirs) for (const name of names) out.push(join(dir, name));
  return out;
}

let cached: ClaudeInfo | undefined;

export async function findClaude(refresh = false): Promise<ClaudeInfo> {
  if (cached && !refresh) return cached;
  const path = candidates().find((p) => existsSync(p));
  if (!path) {
    cached = { found: false, error: "Claude Code was not found. Install it from claude.com/code and sign in once, or pick another narrator in Settings." };
    return cached;
  }
  try {
    const { stdout } = await run(path, ["--version"], "", 20_000);
    cached = { found: true, path, version: stdout.trim().split("\n")[0] ?? "" };
  } catch (err) {
    cached = { found: false, path, error: `Claude Code is installed but did not start: ${err instanceof Error ? err.message : String(err)}` };
  }
  return cached;
}

interface RunResult {
  stdout: string;
  stderr: string;
}

function quoteForCmd(arg: string): string {
  if (arg === "") return '""';
  if (!/[\s"&|<>^%]/.test(arg)) return arg;
  return `"${arg.replace(/"/g, '""')}"`;
}

function run(path: string, args: string[], stdin: string, timeoutMs: number): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const isCmd = process.platform === "win32" && path.toLowerCase().endsWith(".cmd");
    const child = isCmd
      ? spawn(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", `"${[quoteForCmd(path), ...args.map(quoteForCmd)].join(" ")}"`], { windowsVerbatimArguments: true, windowsHide: true })
      : spawn(path, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Claude Code took longer than ${Math.round(timeoutMs / 1000)} seconds`));
    }, timeoutMs);
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`Claude Code exited with code ${code}: ${(stderr || stdout).trim().slice(0, 400)}`));
    });
    child.stdin.end(stdin);
  });
}

export interface NarrateRequest {
  system: string;
  user: string;
  model?: string;
}

export interface NarrateResult {
  proposal: SceneProposal;
  model?: string;
  costUsd?: number;
  ms: number;
}

const SCHEMA = JSON.stringify(sceneProposalModelSchema());

export async function narrateWithClaude(req: NarrateRequest): Promise<NarrateResult> {
  const info = await findClaude();
  if (!info.found || !info.path) throw new Error(info.error ?? "Claude Code was not found");
  const dir = mkdtempSync(join(tmpdir(), "storyteller-"));
  const started = Date.now();
  try {
    const systemFile = join(dir, "system.txt");
    writeFileSync(systemFile, req.system, "utf8");
    const args = [
      "-p",
      "--output-format",
      "json",
      "--tools",
      "",
      "--strict-mcp-config",
      "--setting-sources",
      "project",
      "--no-session-persistence",
      "--system-prompt-file",
      systemFile,
      "--json-schema",
      SCHEMA,
      ...(req.model ? ["--model", req.model] : []),
    ];
    let lastProblem = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      const user = attempt === 0 ? req.user : `${req.user}\n\nYour previous reply did not fit the scene contract (${lastProblem}). Reply again, following it exactly.`;
      const { stdout } = await run(info.path, args, user, 240_000);
      const out = JSON.parse(stdout) as { is_error?: boolean; result?: string; structured_output?: unknown; total_cost_usd?: number; modelUsage?: Record<string, unknown> };
      if (out.is_error) throw new Error(`Claude Code reported an error: ${String(out.result ?? "").slice(0, 400)}`);
      const raw = out.structured_output ?? extractJson(out.result ?? "");
      const parsed = SceneProposalSchema.safeParse(raw);
      if (parsed.success) {
        return { proposal: parsed.data, model: Object.keys(out.modelUsage ?? {})[0], costUsd: out.total_cost_usd, ms: Date.now() - started };
      }
      lastProblem = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    }
    throw new Error(`the narrator's reply did not fit the scene contract: ${lastProblem}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const body = fenced ? fenced[1]! : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) return undefined;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return undefined;
  }
}
