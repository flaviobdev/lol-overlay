import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { GameDataModule } from './game-data/game-data.module';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      // dist/ at runtime (and /snapshot/.../dist under pkg) -> ../public
      rootPath: join(__dirname, '..', 'public'),
    }),
    GameDataModule,
  ],
})
export class AppModule {}
