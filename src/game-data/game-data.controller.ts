import { Controller, Get } from '@nestjs/common';
import { GameDataService } from './game-data.service';
import { OverlayResult } from './types';

@Controller('api')
export class GameDataController {
  constructor(private readonly gameData: GameDataService) {}

  /** REST snapshot / polling fallback for the overlay. */
  @Get('gamedata')
  getGameData(): OverlayResult {
    return this.gameData.getLatest();
  }
}
