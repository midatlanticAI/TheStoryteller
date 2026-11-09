import { DurableObject } from "cloudflare:workers";
import type { Env, User } from "./env";

export interface CampaignMeta {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  invite: string;
  members: User[];
  updatedAt: string;
  turn: number;
}

/** The one place that knows every shared campaign, its invite code, and today's turn count. */
export class Lobby extends DurableObject<Env> {
  async create(meta: Omit<CampaignMeta, "invite">): Promise<CampaignMeta> {
    let invite = "";
    for (let i = 0; i < 10 && !invite; i++) {
      const code = inviteCode();
      if (!(await this.ctx.storage.get(`i:${code}`))) invite = code;
    }
    const full: CampaignMeta = { ...meta, invite };
    await this.ctx.storage.put({ [`c:${meta.id}`]: full, [`i:${invite}`]: meta.id });
    return full;
  }

  async get(id: string): Promise<CampaignMeta | undefined> {
    return this.ctx.storage.get<CampaignMeta>(`c:${id}`);
  }

  async resolve(code: string): Promise<CampaignMeta | undefined> {
    const id = await this.ctx.storage.get<string>(`i:${code.trim().toUpperCase()}`);
    return id ? this.get(id) : undefined;
  }

  async addMember(id: string, user: User): Promise<CampaignMeta | undefined> {
    const meta = await this.get(id);
    if (!meta) return undefined;
    if (!meta.members.some((m) => m.id === user.id)) meta.members.push(user);
    await this.ctx.storage.put(`c:${id}`, meta);
    return meta;
  }

  async touch(id: string, updatedAt: string, turn: number): Promise<void> {
    const meta = await this.get(id);
    if (!meta) return;
    meta.updatedAt = updatedAt;
    meta.turn = turn;
    await this.ctx.storage.put(`c:${id}`, meta);
  }

  async remove(id: string): Promise<void> {
    const meta = await this.get(id);
    if (!meta) return;
    await this.ctx.storage.delete([`c:${id}`, `i:${meta.invite}`]);
  }

  async mine(userId: string): Promise<CampaignMeta[]> {
    const all = await this.ctx.storage.list<CampaignMeta>({ prefix: "c:" });
    return [...all.values()].filter((m) => m.members.some((x) => x.id === userId)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  /** Counts a narrated turn against the table's daily limit. */
  async countTurn(limit: number): Promise<{ ok: boolean; used: number; limit: number }> {
    const day = new Date().toISOString().slice(0, 10);
    const key = `t:${day}`;
    const used = ((await this.ctx.storage.get<number>(key)) ?? 0) + 1;
    if (used > limit) return { ok: false, used: used - 1, limit };
    await this.ctx.storage.put(key, used);
    return { ok: true, used, limit };
  }
}

function inviteCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
}
