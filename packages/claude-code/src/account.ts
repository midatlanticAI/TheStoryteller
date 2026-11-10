import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { findClaude } from "./claude";

/**
 * The Claude account, managed from inside the app. Sign-in runs Claude Code's
 * own `claude auth login`, so the login is Anthropic's official flow for the
 * person's subscription; the app only starts it, relays its link and any code
 * it asks for, and reports the result.
 */

export interface AuthStatus {
  loggedIn: boolean;
  authMethod?: string;
  email?: string;
  subscription?: string;
  error?: string;
}

export interface JobState {
  kind: "login" | "install" | "logout" | "none";
  running: boolean;
  ok?: boolean;
  url?: string;
  needsCode: boolean;
  output: string;
}

let job: { state: JobState; child?: ChildProcessWithoutNullStreams } = { state: { kind: "none", running: false, needsCode: false, output: "" } };

export function jobState(): JobState {
  return job.state;
}

function capture(text: string) {
  const s = job.state;
  s.output = (s.output + text).slice(-6000);
  const url = /(https:\/\/[^\s"'<>]+)/.exec(text);
  if (url && !s.url) s.url = url[1];
  if (/paste|enter (the )?code|authorization code/i.test(text)) s.needsCode = true;
}

function startJob(kind: JobState["kind"], cmd: string, args: string[]) {
  if (job.state.running) throw new Error(`a ${job.state.kind} is already running`);
  const child = spawn(cmd, args, { windowsHide: true, env: { ...process.env, BROWSER: process.env.BROWSER ?? "" } });
  job = { state: { kind, running: true, needsCode: false, output: "" }, child };
  child.stdout.on("data", (d) => capture(String(d)));
  child.stderr.on("data", (d) => capture(String(d)));
  child.on("error", (err) => {
    job.state.running = false;
    job.state.ok = false;
    capture(`\n${err.message}\n`);
  });
  child.on("close", (code) => {
    job.state.running = false;
    job.state.ok = code === 0;
    job.state.needsCode = false;
    job.child = undefined;
    void findClaude(true);
  });
}

async function claudePath(): Promise<string> {
  const info = await findClaude(true);
  if (!info.found || !info.path) throw new Error(info.error ?? "Claude Code is not installed");
  return info.path;
}

function claudeCommand(path: string, args: string[]): [string, string[]] {
  if (process.platform === "win32" && path.toLowerCase().endsWith(".cmd")) return [process.env.ComSpec ?? "cmd.exe", ["/d", "/c", path, ...args]];
  return [path, args];
}

export async function authStatus(): Promise<AuthStatus> {
  const info = await findClaude();
  if (!info.found || !info.path) return { loggedIn: false, error: info.error };
  return new Promise((resolve) => {
    const [cmd, args] = claudeCommand(info.path!, ["auth", "status", "--json"]);
    const child = spawn(cmd, args, { windowsHide: true });
    let out = "";
    const timer = setTimeout(() => child.kill(), 20_000);
    child.stdout.on("data", (d) => (out += d));
    child.on("error", (e) => {
      clearTimeout(timer);
      resolve({ loggedIn: false, error: e.message });
    });
    child.on("close", () => {
      clearTimeout(timer);
      try {
        const j = JSON.parse(out) as Record<string, unknown>;
        resolve({
          loggedIn: j.loggedIn === true,
          ...(typeof j.authMethod === "string" ? { authMethod: j.authMethod } : {}),
          ...(typeof j.email === "string" ? { email: j.email } : {}),
          ...(typeof j.subscriptionType === "string" ? { subscription: j.subscriptionType } : {}),
        });
      } catch {
        resolve({ loggedIn: false, error: "could not read Claude Code's sign-in status" });
      }
    });
  });
}

export async function startLogin(): Promise<JobState> {
  const [cmd, args] = claudeCommand(await claudePath(), ["auth", "login", "--claudeai"]);
  startJob("login", cmd, args);
  return job.state;
}

export async function startLogout(): Promise<JobState> {
  const [cmd, args] = claudeCommand(await claudePath(), ["auth", "logout"]);
  startJob("logout", cmd, args);
  return job.state;
}

/** Runs Anthropic's official Claude Code installer for this platform. */
export function startInstall(): JobState {
  if (process.platform === "win32") {
    startJob("install", "powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "irm https://claude.ai/install.ps1 | iex"]);
  } else {
    startJob("install", "bash", ["-c", "curl -fsSL https://claude.ai/install.sh | bash"]);
  }
  return job.state;
}

export function sendCode(code: string): JobState {
  if (!job.child || !job.state.running) throw new Error("no sign-in is waiting for a code");
  const clean = code.trim();
  if (!clean || clean.length > 4000 || /[\r\n]/.test(clean)) throw new Error("that does not look like a sign-in code");
  job.child.stdin.write(`${clean}\n`);
  job.state.needsCode = false;
  return job.state;
}

export function cancelJob(): JobState {
  job.child?.kill();
  return job.state;
}
