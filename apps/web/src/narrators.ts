import { buildNarratorPrompt, offlineNarrator, SceneProposalSchema, type Narrator } from "@storyteller/engine";
import { AnthropicNarrator } from "@storyteller/narrator";
import { narrateLocally, type LocalHealth } from "./local";
import type { Settings } from "./store";

export interface UsageTotals {
  turns: number;
  input: number;
  cached: number;
  output: number;
  seconds: number;
}

export const usage: UsageTotals = { turns: 0, input: 0, cached: 0, output: 0, seconds: 0 };

/** Claude through the player's own Claude Code sign-in, via the desktop app. */
function claudeCodeNarrator(settings: Settings): Narrator {
  return {
    name: "claude-code",
    async narrate(world, campaign, input) {
      const prompt = buildNarratorPrompt(world, campaign, input);
      const r = await narrateLocally(prompt.system, prompt.user, settings.codeModel || undefined);
      usage.turns += 1;
      usage.seconds += r.ms / 1000;
      const parsed = SceneProposalSchema.safeParse(r.proposal);
      if (!parsed.success) throw new Error("the narrator's reply did not fit the scene contract");
      return parsed.data;
    },
  };
}

function apiNarrator(settings: Settings): Narrator {
  return new AnthropicNarrator({
    apiKey: settings.apiKey,
    model: settings.model,
    inBrowser: true,
    onUsage: (u) => {
      usage.turns += 1;
      usage.input += u.input;
      usage.cached += u.cached;
      usage.output += u.output;
    },
  });
}

/** Which narrator a setting resolves to, given what this device has. */
export function resolveNarrator(settings: Settings, local: LocalHealth | undefined): "claude-code" | "claude" | "offline" {
  const codeReady = !!local?.claude.found && !!local.auth.loggedIn;
  if (settings.narrator === "claude-code") return codeReady ? "claude-code" : "offline";
  if (settings.narrator === "claude") return settings.apiKey ? "claude" : "offline";
  if (settings.narrator === "offline") return "offline";
  if (codeReady) return "claude-code";
  if (settings.apiKey) return "claude";
  return "offline";
}

export function narratorFor(settings: Settings, local: LocalHealth | undefined): Narrator {
  const which = resolveNarrator(settings, local);
  if (which === "claude-code") return claudeCodeNarrator(settings);
  if (which === "claude") return apiNarrator(settings);
  return offlineNarrator;
}

export const NARRATOR_LABEL: Record<string, string> = {
  "claude-code": "Claude (your subscription)",
  claude: "Claude (API key)",
  offline: "Offline",
};
