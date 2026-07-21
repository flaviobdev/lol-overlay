import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameDataService } from './game-data.service';

@WebSocketGateway({ cors: { origin: '*' } })
export class GameDataGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(GameDataGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly gameData: GameDataService) {}

  afterInit(): void {
    // Broadcast every polled tick to all connected clients.
    this.gameData.data$.subscribe((data) =>
      this.server.emit('gameData', data),
    );
  }

  handleConnection(client: Socket): void {
    // Send the current snapshot immediately so a fresh client isn't blank.
    client.emit('gameData', this.gameData.getLatest());
  }
}
