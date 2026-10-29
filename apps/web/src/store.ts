import { deserializeCampaign, serializeCampaign, type Campaign } from "@storyteller/engine";

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

export interface Settings {
  apiKey: string;
  model: string;
  narrator: "claude" | "offline";
  showRolls: boolean;
  textSize: "small" | "medium" | "large";
  theme: "system" | "dark" | "light";
}

export const DEFAULT_SETTINGS: Settings = { apiKey: "", model: "claude-opus-5-5", narrator: "offline", showRolls: true, textSize: "medium", theme: "system" };

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

export function saveCampaign(c: Campaign) {
  safe(() => {
    localStorage.setItem(`storyteller:campaign:${c.id}`, serializeCampaign(c));
    const index = listCampaigns().filter((x) => x.id !== c.id);
    index.push({ id: c.id, name: c.name, updatedAt: c.updatedAt, turn: c.turn });
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
  }, undefined);
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
