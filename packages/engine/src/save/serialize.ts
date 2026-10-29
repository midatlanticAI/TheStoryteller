import { SAVE_VERSION, type Campaign } from "../model/campaign";

export interface SaveFile {
  format: "storyteller-campaign";
  version: number;
  campaign: Campaign;
}

export function serializeCampaign(c: Campaign): string {
  const file: SaveFile = { format: "storyteller-campaign", version: SAVE_VERSION, campaign: c };
  return JSON.stringify(file, null, 2);
}

export function deserializeCampaign(text: string): Campaign {
  const parsed = JSON.parse(text) as Partial<SaveFile>;
  if (parsed.format !== "storyteller-campaign" || !parsed.campaign) throw new Error("Not a Storyteller campaign file");
  if (typeof parsed.version !== "number" || parsed.version > SAVE_VERSION) {
    throw new Error(`Campaign file version ${parsed.version} is newer than this engine (${SAVE_VERSION})`);
  }
  return migrate(parsed.campaign, parsed.version);
}

function migrate(c: Campaign, from: number): Campaign {
  // Future save versions add steps here, each bumping `from`.
  if (from < SAVE_VERSION) c.version = SAVE_VERSION;
  return c;
}
