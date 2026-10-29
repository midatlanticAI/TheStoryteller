export type StorytellerView = {
  campaignId?: string;
  name: string;
  where: string;
  when: string;
  attention: number;
  gold: number;
  provisions: number;
  party: { id: string; name: string; vitality: number; vitalityMax: number; strain: number; strainMax: number; conditions: string[]; alive: boolean }[];
  fight?: { round: number; enemies: { name: string; vitality: number; max: number; alive: boolean }[]; turn: string };
  prose: string;
  choices: { id: string; label: string }[];
  chosen?: string;
  notice: string;
};

declare module "claude-code" {
  interface PluginState {
    storyteller: { view: Shaped<StorytellerView> };
  }
}
