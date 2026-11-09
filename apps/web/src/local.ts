import { deserializeCampaign, type Campaign } from "@storyteller/engine";

/**
 * The bridge to the desktop app. When the game is served by Storyteller.exe
 * (or the Linux/Mac build), these endpoints exist on the same origin; on the
 * hosted site they do not, and every call here resolves to "not local".
 */

export interface JobState {
  kind: "login" | "install" | "logout" | "none";
  running: boolean;
  ok?: boolean;
  url?: string;
  needsCode: boolean;
  output: string;
}

export interface LocalHealth {
  app: "storyteller";
  version: string;
  claude: { found: boolean; path?: string; version?: string; error?: string };
  auth: { loggedIn: boolean; authMethod?: string; email?: string; subscription?: string; error?: string };
  job: JobState;
  savesDir: string;
}

export async function localHealth(refresh = false): Promise<LocalHealth | undefined> {
  try {
    const r = await fetch(`/api/health${refresh ? "?refresh=1" : ""}`, { cache: "no-store" });
    if (!r.ok) return undefined;
    const j = (await r.json()) as LocalHealth;
    return j.app === "storyteller" ? j : undefined;
  } catch {
    return undefined;
  }
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const j = (await r.json()) as T & { error?: string };
  if (!r.ok) throw new Error(j.error ?? `request failed (${r.status})`);
  return j;
}

export const account = {
  login: () => post<JobState>("/api/account/login"),
  logout: () => post<JobState>("/api/account/logout"),
  install: () => post<JobState>("/api/account/install"),
  cancel: () => post<JobState>("/api/account/cancel"),
  code: (code: string) => post<JobState>("/api/account/code", { code }),
  job: async () => (await fetch("/api/account/job", { cache: "no-store" })).json() as Promise<JobState>,
};

export async function remoteSaves(): Promise<Campaign[]> {
  const r = await fetch("/api/campaigns", { cache: "no-store" });
  if (!r.ok) return [];
  const list = (await r.json()) as { id: string; text: string }[];
  const out: Campaign[] = [];
  for (const f of list) {
    try {
      out.push(deserializeCampaign(f.text));
    } catch {
      // skip unreadable files
    }
  }
  return out;
}

export function putRemote(id: string, text: string) {
  void fetch(`/api/campaigns/${id}`, { method: "PUT", body: text }).catch(() => undefined);
}

export function deleteRemote(id: string) {
  void fetch(`/api/campaigns/${id}`, { method: "DELETE" }).catch(() => undefined);
}

export interface NarrateResponse {
  proposal: unknown;
  model?: string;
  costUsd?: number;
  ms: number;
}

export async function narrateLocally(system: string, user: string, model?: string): Promise<NarrateResponse> {
  return post<NarrateResponse>("/api/narrate", { system, user, ...(model ? { model } : {}) });
}
