import { Container, getContainer } from "@cloudflare/containers";
import { buildNarratorPrompt, sceneWeight, SceneProposalSchema, type Narrator, type SceneWeight } from "@storyteller/engine";
import type { Env } from "./env";

/**
 * The hosted Game Master: a container running the unmodified Claude Code,
 * signed in with the table owner's own Claude subscription through Claude
 * Code's own login. The Worker never sees the token; it only asks the
 * container for scenes and starts or stops Claude Code's sign-in.
 */
export class GameMaster extends Container<Env> {
  defaultPort = 8080;
  sleepAfter = "7d";
}

export interface GmHealth {
  claude: { found: boolean; version?: string };
  auth: { loggedIn: boolean; email?: string; subscription?: string };
  job: { kind: string; running: boolean; ok?: boolean; url?: string; needsCode: boolean; output: string };
}

function gm(env: Env) {
  if (!env.GM) throw new Error("the hosted Game Master is not deployed");
  return getContainer(env.GM, "game-master");
}

export async function gmCall(env: Env, path: string, init?: RequestInit): Promise<Response> {
  return gm(env).fetch(new Request(`http://gm${path}`, init));
}

export async function gmHealth(env: Env): Promise<GmHealth | undefined> {
  if (!env.GM) return undefined;
  try {
    const r = await gmCall(env, "/health");
    return r.ok ? ((await r.json()) as GmHealth) : undefined;
  } catch {
    return undefined;
  }
}

const ALIAS: Record<SceneWeight, string> = { light: "haiku", standard: "sonnet", epic: "opus" };

/** Narrates through Claude Code in the container, picking the model by how much the scene matters. */
export function subscriptionNarrator(env: Env, fixedModel: string): Narrator {
  let note: string | undefined;
  return {
    name: "claude-code",
    lastNote: () => note,
    async narrate(world, campaign, input, events) {
      const verdict = sceneWeight(world, campaign, events, input.freeText ? { freeText: input.freeText } : {});
      const model = fixedModel && fixedModel !== "auto" ? fixedModel : ALIAS[verdict.weight];
      const prompt = buildNarratorPrompt(world, campaign, input);
      const r = await gmCall(env, "/narrate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...prompt, model }) });
      const body = (await r.json()) as { proposal?: unknown; model?: string; error?: string };
      if (!r.ok) throw new Error(body.error ?? `the Game Master answered ${r.status}`);
      const parsed = SceneProposalSchema.safeParse(body.proposal);
      if (!parsed.success) throw new Error("the Game Master's scene did not fit the contract");
      const used = body.model ?? model;
      const label = used.includes("haiku") ? "Haiku" : used.includes("sonnet") ? "Sonnet" : used.includes("opus") ? "Opus" : used;
      note = `${label} on your Claude subscription: ${fixedModel && fixedModel !== "auto" ? "chosen in settings" : verdict.reason}`;
      return parsed.data;
    },
  };
}
