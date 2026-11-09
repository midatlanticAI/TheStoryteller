import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  GM_INSTRUCTIONS,
  SceneProposalSchema,
  buildNarratorPrompt,
  type Campaign,
  type GameEvent,
  type Narrator,
  type NarratorInput,
  type SceneProposal,
  type World,
} from "@storyteller/engine";

export interface AnthropicNarratorOptions {
  /** Pass a key for a browser build; omit to let the SDK read the environment. */
  apiKey?: string;
  model?: string;
  /** Required in a browser, where the key lives in the player's own storage. */
  inBrowser?: boolean;
  effort?: "low" | "medium" | "high";
  /** Called with usage after each turn, for a cost readout. */
  onUsage?: (usage: { input: number; cached: number; output: number; model: string }) => void;
}

export const DEFAULT_MODEL = "claude-opus-5-5";

/**
 * Claude as narrator through the Anthropic SDK.
 *
 * The standing canon block is sent as a cached system block, so across turns
 * only the small state block and the player's input are new tokens. The
 * response is parsed against the engine's scene contract; the engine validates
 * every proposed action afterwards.
 */
export class AnthropicNarrator implements Narrator {
  readonly name = "claude";
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly effort: "low" | "medium" | "high";
  private readonly onUsage?: AnthropicNarratorOptions["onUsage"];

  constructor(opts: AnthropicNarratorOptions = {}) {
    this.client = new Anthropic({
      ...(opts.apiKey ? { apiKey: opts.apiKey } : {}),
      ...(opts.inBrowser ? { dangerouslyAllowBrowser: true } : {}),
      maxRetries: 2,
    });
    this.model = opts.model ?? DEFAULT_MODEL;
    this.effort = opts.effort ?? "medium";
    this.onUsage = opts.onUsage;
  }

  async narrate(world: World, campaign: Campaign, input: NarratorInput, _events: GameEvent[]): Promise<SceneProposal> {
    const prompt = buildNarratorPrompt(world, campaign, input);
    const canon = prompt.system.slice(GM_INSTRUCTIONS.length).trimStart();

    const response = await this.client.beta.messages.parse({
      model: this.model,
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: this.effort, format: zodOutputFormat(SceneProposalSchema) },
      system: [
        { type: "text", text: GM_INSTRUCTIONS, cache_control: { type: "ephemeral" } },
        { type: "text", text: canon, cache_control: { type: "ephemeral", ttl: "1h" } },
      ],
      messages: [{ role: "user", content: prompt.user }],
    });

    this.onUsage?.({
      input: response.usage.input_tokens,
      cached: response.usage.cache_read_input_tokens ?? 0,
      output: response.usage.output_tokens,
      model: response.model,
    });

    if (response.stop_reason === "refusal") {
      throw new Error(`The narrator declined this turn${response.stop_details?.explanation ? `: ${response.stop_details.explanation}` : ""}`);
    }
    if (!response.parsed_output) throw new Error("The narrator's reply did not match the scene contract");
    return response.parsed_output;
  }
}

/** True when the error is the SDK telling us the key is wrong. */
export function isAuthError(err: unknown): boolean {
  return err instanceof Anthropic.AuthenticationError;
}
