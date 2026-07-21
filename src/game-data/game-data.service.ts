import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import * as https from 'https';
import { BehaviorSubject } from 'rxjs';
import {
  Objectives,
  OverlayPlayer,
  OverlayResult,
  RawAllGameData,
  RawPlayer,
  Team,
} from './types';

const LIVE_CLIENT_URL =
  'https://127.0.0.1:2999/liveclientdata/allgamedata';
const POLL_INTERVAL_MS = 1000;

@Injectable()
export class GameDataService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GameDataService.name);
  private timer?: NodeJS.Timeout;
  private wasInGame = false;

  /** Latest simplified snapshot; starts as "not in game" until a poll succeeds. */
  private readonly subject = new BehaviorSubject<OverlayResult>({
    inGame: false,
  });

  /** Observable stream of every tick, for the WebSocket gateway. */
  readonly data$ = this.subject.asObservable();

  onModuleInit(): void {
    this.tick();
    this.timer = setInterval(() => this.tick(), POLL_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  getLatest(): OverlayResult {
    return this.subject.value;
  }

  private async tick(): Promise<void> {
    try {
      const raw = await this.fetchAllGameData();
      const data = this.simplify(raw);
      if (!this.wasInGame) {
        this.logger.log('Live Client Data connected — in game.');
        this.wasInGame = true;
      }
      this.subject.next(data);
    } catch (err) {
      // Game closed / not in a match / API not ready. Expected — don't crash.
      if (this.wasInGame) {
        this.logger.log('Live Client Data unavailable — left game.');
        this.wasInGame = false;
      }
      this.subject.next({ inGame: false });
    }
  }

  /** GET the raw payload, ignoring the game's self-signed cert. */
  private fetchAllGameData(): Promise<RawAllGameData> {
    return new Promise((resolve, reject) => {
      const req = https.get(
        LIVE_CLIENT_URL,
        { rejectUnauthorized: false, timeout: 2000 },
        (res) => {
          if (res.statusCode !== 200) {
            res.resume();
            reject(new Error(`status ${res.statusCode}`));
            return;
          }
          let body = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            try {
              resolve(JSON.parse(body) as RawAllGameData);
            } catch (e) {
              reject(e);
            }
          });
        },
      );
      req.on('timeout', () => req.destroy(new Error('timeout')));
      req.on('error', reject);
    });
  }

  private simplify(raw: RawAllGameData): OverlayResult {
    const gameTime = raw.gameData?.gameTime ?? 0;
    const activeGold = raw.activePlayer?.currentGold ?? null;
    const activeId =
      raw.activePlayer?.riotId ?? raw.activePlayer?.summonerName ?? null;

    const players: OverlayPlayer[] = (raw.allPlayers ?? []).map((p) =>
      this.simplifyPlayer(p, gameTime, activeId, activeGold),
    );

    return {
      inGame: true,
      gameTime,
      gameMode: raw.gameData?.gameMode ?? 'UNKNOWN',
      players,
      objectives: this.computeObjectives(raw),
      localTeam: players.find((p) => p.isLocal)?.team ?? null,
    };
  }

  private simplifyPlayer(
    p: RawPlayer,
    gameTime: number,
    activeId: string | null,
    activeGold: number | null,
  ): OverlayPlayer {
    const riotId = p.riotId ?? p.summonerName ?? p.championName;
    const isLocal = !!activeId && riotId === activeId;
    const cs = p.scores?.creepScore ?? 0;
    const minutes = gameTime / 60;
    const csPerMin = minutes > 0 ? Number((cs / minutes).toFixed(1)) : 0;

    return {
      riotId,
      team: p.team,
      championName: p.championName,
      level: p.level,
      kills: p.scores?.kills ?? 0,
      deaths: p.scores?.deaths ?? 0,
      assists: p.scores?.assists ?? 0,
      cs,
      csPerMin,
      // ponytail: API only exposes gold for the local player; others are null.
      // Upgrade path: none client-side — Riot doesn't broadcast enemy gold.
      gold: isLocal ? activeGold : null,
      items: (p.items ?? []).map((it) => ({ id: it.itemID, slot: it.slot })),
      isDead: p.isDead,
      isLocal,
    };
  }

  /**
   * Dragons/towers per team, tallied from the events log.
   * - DragonKill: credited to the killer's team.
   * - TurretKilled: a destroyed "Turret_T1_*" (ORDER's) scores for CHAOS, and
   *   a "Turret_T2_*" (CHAOS's) scores for ORDER.
   */
  private computeObjectives(raw: RawAllGameData): Objectives {
    const obj: Objectives = {
      order: { dragons: 0, towers: 0 },
      chaos: { dragons: 0, towers: 0 },
    };

    const teamOf = new Map<string, Team>();
    for (const p of raw.allPlayers ?? []) {
      if (p.riotId) teamOf.set(p.riotId, p.team);
      if (p.summonerName) teamOf.set(p.summonerName, p.team);
    }

    for (const e of raw.events?.Events ?? []) {
      if (e.EventName === 'DragonKill' && e.KillerName) {
        const t = teamOf.get(e.KillerName);
        if (t === 'ORDER') obj.order.dragons++;
        else if (t === 'CHAOS') obj.chaos.dragons++;
      } else if (e.EventName === 'TurretKilled') {
        const s = e.TurretKilled ?? '';
        if (s.includes('_T1_')) obj.chaos.towers++;
        else if (s.includes('_T2_')) obj.order.towers++;
      }
    }

    return obj;
  }
}
