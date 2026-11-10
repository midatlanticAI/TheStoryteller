import type { CampaignRoom } from "./room";
import type { Lobby } from "./lobby";
import type { GameMaster } from "./gm";

export interface Env {
  ROOMS: DurableObjectNamespace<CampaignRoom>;
  LOBBY: DurableObjectNamespace<Lobby>;
  /** The hosted Game Master container (Claude Code on the owner's subscription). Absent on plans without containers. */
  GM?: DurableObjectNamespace<GameMaster>;
  /** Unlocks managing the Claude sign-in. A secret, separate from the table passphrase. */
  OWNER_PASSPHRASE?: string;
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
