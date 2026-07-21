/**
 * Types for the Riot Live Client Data API (subset we use) and the simplified
 * shape we expose to the overlay. Full raw schema:
 * https://developer.riotgames.com/docs/lol#game-client-api_live-client-data-api
 */

export type Team = 'ORDER' | 'CHAOS';

/** Raw player entry from GET /liveclientdata/allgamedata -> allPlayers[] */
export interface RawPlayer {
  riotId?: string; // "Name#TAG" (newer clients)
  summonerName?: string; // legacy field, still present as fallback
  championName: string;
  isBot: boolean;
  isDead: boolean;
  team: Team;
  level: number;
  scores: {
    kills: number;
    deaths: number;
    assists: number;
    creepScore: number;
    wardScore: number;
  };
  items: RawItem[];
}

export interface RawItem {
  itemID: number;
  slot: number;
  count: number;
  canUse: boolean;
}

/** Raw activePlayer block — the only place currentGold is exposed. */
export interface RawActivePlayer {
  riotId?: string;
  summonerName?: string;
  currentGold?: number;
}

/** Raw entry from allgamedata -> events.Events[] (we only read a few kinds). */
export interface RawEvent {
  EventName: string;
  KillerName?: string;
  TurretKilled?: string; // e.g. "Turret_T1_C_05_A" — T1 = ORDER's, T2 = CHAOS's
  DragonType?: string;
}

export interface RawAllGameData {
  activePlayer?: RawActivePlayer;
  allPlayers: RawPlayer[];
  events?: { Events: RawEvent[] };
  gameData: {
    gameTime: number;
    gameMode: string;
  };
}

/** Simplified per-player shape sent to the overlay. */
export interface OverlayPlayer {
  riotId: string;
  team: Team;
  championName: string;
  level: number;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  csPerMin: number;
  /** Only the local (active) player's gold is exposed by the API; null otherwise. */
  gold: number | null;
  items: { id: number; slot: number }[];
  isDead: boolean;
  /** True for the player running the client (the streamer). */
  isLocal: boolean;
}

/** Objective count for one team. */
export interface TeamObjectives {
  dragons: number;
  towers: number;
}

export interface Objectives {
  order: TeamObjectives;
  chaos: TeamObjectives;
}

export interface OverlayData {
  inGame: true;
  gameTime: number;
  gameMode: string;
  players: OverlayPlayer[];
  objectives: Objectives;
  /** Team of the local player (null if not found, e.g. spectating). */
  localTeam: Team | null;
}

export interface NotInGame {
  inGame: false;
}

export type OverlayResult = OverlayData | NotInGame;
