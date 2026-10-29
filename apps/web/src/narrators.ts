import { offlineNarrator, type Narrator } from "@storyteller/engine";
import { AnthropicNarrator } from "@storyteller/narrator";
import type { Settings } from "./store";

export interface UsageTotals {
  turns: number;
  input: number;
  cached: number;
  output: number;
}

export const usage: UsageTotals = { turns: 0, input: 0, cached: 0, output: 0 };

export function narratorFor(settings: Settings): Narrator {
  if (settings.narrator === "claude" && settings.apiKey) {
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
  return offlineNarrator;
}
