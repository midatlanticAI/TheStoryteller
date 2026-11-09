import { deserializeCampaign, serializeCampaign, type Campaign } from "@storyteller/engine";
import { deleteRemote, putRemote, remoteSaves } from "./local";

let remote = false;

/** Turns on write-through to Documents/Storyteller when the desktop app is serving the game. */
export async function enableRemoteSaves(): Promise<void> {
  remote = true;
  const files = await remoteSaves();
  const known = new Map(listCampaigns().map((c) => [c.id, c.updatedAt]));
  for (const c of files) {
    const local = known.get(c.id);
    if (!local || local < c.updatedAt) writeLocal(c);
  }
  for (const id of known.keys()) {
    if (!files.some((f) => f.id === id)) {
      const c = loadCampaign(id);
      if (c) putRemote(c.id, serializeCampaign(c));
    }
  }
}

/**
 * Local-first persistence. Campaigns live in localStorage as the same JSON the
 * Claude Code mod writes to disk, so a file can move between the two.
 */
const INDEX_KEY = "storyteller:campaigns";
const SETTINGS_KEY = "storyteller:settings";

export interface CampaignSummary {
  id: string;
  name: string;
  updatedAt: string;
  turn: number;
}

export type NarratorChoice = "auto" | "claude-code" | "claude" | "offline";

export interface Settings {
  apiKey: string;
  model: string;
  /** Model Claude Code uses for scenes; empty means Claude Code's own default. */
  codeModel: string;
  narrator: NarratorChoice;
  showRolls: boolean;
  textSize: "small" | "medium" | "large";
  theme: "system" | "dark" | "light";
}

export const DEFAULT_SETTINGS: Settings = { apiKey: "", model: "claude-opus-5-5", codeModel: "", narrator: "auto", showRolls: true, textSize: "medium", theme: "system" };

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export function loadSettings(): Settings {
  return safe(() => ({ ...DEFAULT_SETTINGS, ...(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") as Partial<Settings>) }), DEFAULT_SETTINGS);
}

export function saveSettings(s: Settings) {
  safe(() => localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)), undefined);
}

export function listCampaigns(): CampaignSummary[] {
  return safe(() => JSON.parse(localStorage.getItem(INDEX_KEY) ?? "[]") as CampaignSummary[], []).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function writeLocal(c: Campaign) {
  safe(() => {
    localStorage.setItem(`storyteller:campaign:${c.id}`, serializeCampaign(c));
    const index = listCampaigns().filter((x) => x.id !== c.id);
    index.push({ id: c.id, name: c.name, updatedAt: c.updatedAt, turn: c.turn });
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
  }, undefined);
}

export function saveCampaign(c: Campaign) {
  writeLocal(c);
  if (remote) putRemote(c.id, serializeCampaign(c));
}

export function loadCampaign(id: string): Campaign | undefined {
  return safe(() => {
    const raw = localStorage.getItem(`storyteller:campaign:${id}`);
    return raw ? deserializeCampaign(raw) : undefined;
  }, undefined);
}

export function deleteCampaign(id: string) {
  safe(() => {
    localStorage.removeItem(`storyteller:campaign:${id}`);
    localStorage.setItem(INDEX_KEY, JSON.stringify(listCampaigns().filter((x) => x.id !== id)));
  }, undefined);
  if (remote) deleteRemote(id);
}

export function exportCampaign(c: Campaign) {
  const blob = new Blob([serializeCampaign(c)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${c.id}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importCampaign(file: File): Promise<Campaign> {
  const c = deserializeCampaign(await file.text());
  saveCampaign(c);
  return c;
}
