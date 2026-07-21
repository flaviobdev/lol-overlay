import { Module } from '@nestjs/common';
import { GameDataController } from './game-data.controller';
import { GameDataGateway } from './game-data.gateway';
import { GameDataService } from './game-data.service';

@Module({
  controllers: [GameDataController],
  providers: [GameDataService, GameDataGateway],
})
export class GameDataModule {}
