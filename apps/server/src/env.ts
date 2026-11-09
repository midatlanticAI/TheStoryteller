import type { CampaignRoom } from "./room";
import type { Lobby } from "./lobby";

export interface Env {
  ROOMS: DurableObjectNamespace<CampaignRoom>;
  LOBBY: DurableObjectNamespace<Lobby>;
  /** The passphrase the table shares. A secret. */
  TABLE_PASSPHRASE?: string;
  /** Signs session cookies. A secret. */
  SESSION_SECRET?: string;
  /** Claude for narration. A secret; without it scenes come from the offline narrator. */
  ANTHROPIC_API_KEY?: string;
  DAILY_TURN_LIMIT?: string;
  /** Optional Cloudflare Access in front of the site: team domain and the application's AUD tag. */
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
}

export interface User {
  id: string;
  name: string;
}
