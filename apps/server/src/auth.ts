import type { Env, User } from "./env";

const COOKIE = "st_session";
const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data))));
}

function constantTimeEqual(a: string, b: string): boolean {
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export function slugName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32);
}

export function authMode(env: Env): "access" | "passphrase" | "closed" {
  if (env.ACCESS_TEAM_DOMAIN && env.ACCESS_AUD) return "access";
  if (env.TABLE_PASSPHRASE && env.SESSION_SECRET) return "passphrase";
  return "closed";
}

export async function issueSession(env: Env, name: string, passphrase: string): Promise<{ user: User; cookie: string } | { error: string }> {
  if (authMode(env) !== "passphrase") return { error: "this table does not use a passphrase" };
  const clean = name.trim().replace(/\s+/g, " ").slice(0, 40);
  const slug = slugName(clean);
  if (!slug) return { error: "choose a name" };
  if (!constantTimeEqual(passphrase.trim(), env.TABLE_PASSPHRASE!.trim())) return { error: "that is not the table's passphrase" };
  const user: User = { id: `n-${slug}`, name: clean };
  const payload = b64url(enc.encode(JSON.stringify({ ...user, exp: Date.now() + 180 * 86400_000 })));
  const sig = await hmac(env.SESSION_SECRET!, payload);
  const cookie = `${COOKIE}=${payload}.${sig}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${180 * 86400}`;
  return { user, cookie };
}

export function clearSession(): string {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

async function sessionUser(env: Env, req: Request): Promise<User | undefined> {
  if (!env.SESSION_SECRET) return undefined;
  const raw = (req.headers.get("cookie") ?? "").split(/;\s*/).find((c) => c.startsWith(`${COOKIE}=`));
  if (!raw) return undefined;
  const [payload, sig] = raw.slice(COOKIE.length + 1).split(".");
  if (!payload || !sig) return undefined;
  if (!constantTimeEqual(sig, await hmac(env.SESSION_SECRET, payload))) return undefined;
  try {
    const data = JSON.parse(new TextDecoder().decode(fromB64url(payload))) as User & { exp: number };
    if (data.exp < Date.now()) return undefined;
    return { id: data.id, name: data.name };
  } catch {
    return undefined;
  }
}

let certs: { keys: (JsonWebKey & { kid: string })[]; at: number } | undefined;

async function accessUser(env: Env, req: Request): Promise<User | undefined> {
  const jwt = req.headers.get("cf-access-jwt-assertion");
  if (!jwt) return undefined;
  const [h, p, s] = jwt.split(".");
  if (!h || !p || !s) return undefined;
  const header = JSON.parse(new TextDecoder().decode(fromB64url(h))) as { kid: string; alg: string };
  if (header.alg !== "RS256") return undefined;
  if (!certs || Date.now() - certs.at > 3600_000) {
    const r = await fetch(`https://${env.ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`);
    certs = { keys: ((await r.json()) as { keys: (JsonWebKey & { kid: string })[] }).keys, at: Date.now() };
  }
  const jwk = certs.keys.find((k) => k.kid === header.kid);
  if (!jwk) return undefined;
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, fromB64url(s), enc.encode(`${h}.${p}`));
  if (!ok) return undefined;
  const claims = JSON.parse(new TextDecoder().decode(fromB64url(p))) as { aud: string | string[]; exp: number; email?: string; iss?: string };
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.includes(env.ACCESS_AUD!) || claims.exp * 1000 < Date.now() || !claims.email) return undefined;
  const local = claims.email.split("@")[0] ?? claims.email;
  return { id: `e-${slugName(claims.email)}`, name: local };
}

export async function currentUser(env: Env, req: Request): Promise<User | undefined> {
  const mode = authMode(env);
  if (mode === "access") return accessUser(env, req);
  if (mode === "passphrase") return sessionUser(env, req);
  return undefined;
}
