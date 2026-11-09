import type { Campaign } from "@storyteller/engine";

/** The hosted table's API, present when the Worker serves the app. */

export interface ServerUser {
  id: string;
  name: string;
}

export interface ServerHealth {
  app: "storyteller-server";
  version: string;
  auth: "access" | "passphrase" | "closed";
  user: ServerUser | null;
  narrator: "claude" | "offline";
}

export interface TableMeta {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  invite: string;
  members: ServerUser[];
  updatedAt: string;
  turn: number;
}

export interface RoomState {
  campaign: Campaign;
  room: {
    ownerId: string;
    turnMode: "free" | "rotate";
    activePlayerId?: string;
    model: string;
    narrating?: { by: string; since: string };
    online: ServerUser[];
    lastNote?: string;
    lastEvents: string[];
    lastProblems: string[];
    narrator: "claude" | "offline";
  };
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) }, credentials: "same-origin" });
  const text = await r.text();
  const body = text ? (JSON.parse(text) as T & { error?: string }) : ({} as T & { error?: string });
  if (!r.ok) throw new Error(body.error ?? `request failed (${r.status})`);
  return body;
}

export async function serverHealth(): Promise<ServerHealth | undefined> {
  try {
    const r = await fetch("/api/health", { cache: "no-store", credentials: "same-origin" });
    if (!r.ok) return undefined;
    const j = (await r.json()) as ServerHealth;
    return j.app === "storyteller-server" ? j : undefined;
  } catch {
    return undefined;
  }
}

export const table = {
  signIn: (name: string, passphrase: string) => call<{ user: ServerUser }>("/api/session", { method: "POST", body: JSON.stringify({ name, passphrase }) }),
  signOut: () => call<{ ok: true }>("/api/session", { method: "DELETE" }),
  list: () => call<TableMeta[]>("/api/campaigns"),
  create: (campaignJson: string) => call<TableMeta>("/api/campaigns", { method: "POST", body: campaignJson }),
  join: (code: string) => call<TableMeta>("/api/join", { method: "POST", body: JSON.stringify({ code }) }),
  meta: (id: string) => call<TableMeta>(`/api/campaigns/${id}/meta`),
  remove: (id: string) => call<{ ok: true }>(`/api/campaigns/${id}/delete`, { method: "POST", body: "{}" }),
  turn: (id: string, input: { choiceId?: string; freeText?: string }) => call<{ ok: true }>(`/api/campaigns/${id}/turn`, { method: "POST", body: JSON.stringify(input) }),
  seat: (id: string, characterId: string, playerId: string | null) => call<{ ok: true }>(`/api/campaigns/${id}/seat`, { method: "POST", body: JSON.stringify({ characterId, playerId }) }),
  sheet: (id: string, characterId: string, change: { skill?: string; equip?: string }) => call<{ ok: true }>(`/api/campaigns/${id}/sheet`, { method: "POST", body: JSON.stringify({ characterId, ...change }) }),
  settings: (id: string, change: { turnMode?: "free" | "rotate"; model?: string }) => call<{ ok: true }>(`/api/campaigns/${id}/settings`, { method: "POST", body: JSON.stringify(change) }),
  exportUrl: (id: string) => `/api/campaigns/${id}/export`,
};

/** Keeps a live connection to a room, reconnecting with backoff. */
export function connectRoom(id: string, onState: (s: RoomState) => void, onStatus: (online: boolean) => void): () => void {
  let ws: WebSocket | undefined;
  let closed = false;
  let delay = 1000;
  let ping: ReturnType<typeof setInterval> | undefined;
  const open = () => {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    ws = new WebSocket(`${proto}//${location.host}/api/campaigns/${id}/live`);
    ws.onopen = () => {
      delay = 1000;
      onStatus(true);
      ping = setInterval(() => ws?.readyState === WebSocket.OPEN && ws.send("ping"), 25_000);
    };
    ws.onmessage = (ev) => {
      if (ev.data === "pong") return;
      try {
        const msg = JSON.parse(String(ev.data)) as { t: string } & RoomState;
        if (msg.t === "state") onState(msg);
      } catch {
        // ignore malformed frames
      }
    };
    ws.onclose = () => {
      if (ping) clearInterval(ping);
      onStatus(false);
      if (!closed) setTimeout(open, (delay = Math.min(delay * 2, 15_000)));
    };
  };
  open();
  return () => {
    closed = true;
    if (ping) clearInterval(ping);
    ws?.close();
  };
}
