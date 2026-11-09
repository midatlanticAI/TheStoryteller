import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  GM_INSTRUCTIONS,
  SceneProposalSchema,
  buildNarratorPrompt,
  sceneWeight,
  type Campaign,
  type GameEvent,
  type Narrator,
  type NarratorInput,
  type SceneProposal,
  type SceneWeight,
  type World,
} from "@storyteller/engine";

/** "auto" lets each scene pick its model by how much it matters. */
export type ModelChoice = "auto" | string;

export interface ModelTiers {
  light: string;
  standard: string;
  epic: string;
}

export const DEFAULT_TIERS: ModelTiers = {
  light: "claude-haiku-5-5",
  standard: "claude-sonnet-5-5",
  epic: "claude-opus-5-5",
};

export interface TurnUsage {
  input: number;
  cached: number;
  output: number;
  model: string;
  weight?: SceneWeight;
  reason?: string;
}

export interface AnthropicNarratorOptions {
  /** Pass a key for a browser build; omit to let the SDK read the environment. */
  apiKey?: string;
  /** A model id, or "auto" for smart selection per scene. */
  model?: ModelChoice;
  tiers?: Partial<ModelTiers>;
  /** Required in a browser, where the key lives in the player's own storage. */
  inBrowser?: boolean;
  /** Called with usage after each turn, for a cost readout. */
  onUsage?: (usage: TurnUsage) => void;
}

export const DEFAULT_MODEL = "auto";

const EFFORT: Record<SceneWeight, "low" | "medium"> = { light: "low", standard: "medium", epic: "medium" };

function supportsDefaultFallback(model: string): boolean {
  return model.startsWith("claude-opus-5") || model.startsWith("claude-sonnet-5-5") || model.startsWith("claude-fable-5");
}

/**
 * Claude as narrator through the Anthropic SDK.
 *
 * GM instructions and the standing canon go in cached system blocks, so across
 * turns on one model only the state block and the player's input are new
 * tokens. The response is parsed against the engine's scene contract; the
 * engine validates every proposed action afterwards.
 */
export class AnthropicNarrator implements Narrator {
  readonly name = "claude";
  private readonly client: Anthropic;
  private readonly model: ModelChoice;
  private readonly tiers: ModelTiers;
  private readonly onUsage?: AnthropicNarratorOptions["onUsage"];
  private note?: string;

  constructor(opts: AnthropicNarratorOptions = {}) {
    this.client = new Anthropic({
      ...(opts.apiKey ? { apiKey: opts.apiKey } : {}),
      ...(opts.inBrowser ? { dangerouslyAllowBrowser: true } : {}),
      maxRetries: 2,
    });
    this.model = opts.model || DEFAULT_MODEL;
    this.tiers = { ...DEFAULT_TIERS, ...opts.tiers };
    this.onUsage = opts.onUsage;
  }

  lastNote(): string | undefined {
    return this.note;
  }

  /** The model this scene will use, and why. */
  pick(world: World, campaign: Campaign, input: NarratorInput, events: GameEvent[]): { model: string; weight: SceneWeight; reason: string } {
    const verdict = sceneWeight(world, campaign, events, input.freeText ? { freeText: input.freeText } : {});
    if (this.model !== "auto") return { model: this.model, weight: verdict.weight, reason: "chosen in settings" };
    return { model: this.tiers[verdict.weight], weight: verdict.weight, reason: verdict.reason };
  }

  async narrate(world: World, campaign: Campaign, input: NarratorInput, events: GameEvent[]): Promise<SceneProposal> {
    const prompt = buildNarratorPrompt(world, campaign, input);
    const canon = prompt.system.slice(GM_INSTRUCTIONS.length).trimStart();
    const pick = this.pick(world, campaign, input, events);
    const fallback = supportsDefaultFallback(pick.model);

    const response = await this.client.beta.messages.parse({
      model: pick.model,
      max_tokens: 8000,
      ...(fallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
      output_config: { effort: EFFORT[pick.weight], format: zodOutputFormat(SceneProposalSchema) },
      system: [
        { type: "text", text: GM_INSTRUCTIONS, cache_control: { type: "ephemeral" } },
        { type: "text", text: canon, cache_control: { type: "ephemeral", ttl: "1h" } },
      ],
      messages: [{ role: "user", content: prompt.user }],
    });

    this.note = `${shortName(response.model)}: ${pick.reason}`;
    this.onUsage?.({
      input: response.usage.input_tokens,
      cached: response.usage.cache_read_input_tokens ?? 0,
      output: response.usage.output_tokens,
      model: response.model,
      weight: pick.weight,
      reason: pick.reason,
    });

    if (response.stop_reason === "refusal") {
      throw new Error(`The narrator declined this turn${response.stop_details?.explanation ? `: ${response.stop_details.explanation}` : ""}`);
    }
    if (!response.parsed_output) throw new Error("The narrator's reply did not match the scene contract");
    return response.parsed_output;
  }
}

export function shortName(model: string): string {
  if (model.includes("haiku")) return "Haiku";
  if (model.includes("sonnet")) return "Sonnet";
  if (model.includes("opus")) return "Opus";
  if (model.includes("fable")) return "Fable";
  return model;
}

/** True when the error is the SDK telling us the key is wrong. */
export function isAuthError(err: unknown): boolean {
  return err instanceof Anthropic.AuthenticationError;
}
