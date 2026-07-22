import { Logger, INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { exec } from 'child_process';
import * as net from 'net';
import { AppModule } from './app.module';
import { GameDataService } from './game-data/game-data.service';
import { Tray } from './tray';

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const isWin = process.platform === 'win32';
const isPacked = !!(process as { pkg?: unknown }).pkg; // true dentro do .exe do pkg
const logger = new Logger('Bootstrap');

let app: INestApplication | undefined;
let tray: Tray | undefined;

/** Abre o overlay no navegador padrão (também usado para "focar" 2ª instância). */
function openOverlay(): void {
  const url = `http://localhost:${PORT}`;
  const cmd = isWin ? `start "" "${url}"` : `xdg-open "${url}"`;
  exec(cmd, () => {
    /* silencioso */
  });
}

/** Já existe algo escutando na porta? (proxy para "já estou rodando"). */
function portInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = net.createConnection({ port, host: '127.0.0.1' });
    sock.once('connect', () => {
      sock.destroy();
      resolve(true);
    });
    sock.once('error', () => resolve(false));
  });
}

async function createApp(): Promise<void> {
  app = await NestFactory.create(AppModule, {
    logger: isPacked ? ['error', 'warn', 'log'] : undefined,
  });
  app.enableShutdownHooks(); // garante onModuleDestroy (para o polling) no close()
  await app.listen(PORT);
}

async function restart(): Promise<void> {
  logger.log('Reiniciando servidor…');
  if (app) await app.close();
  await createApp();
  if (tray && app) tray.bindStatus(app.get(GameDataService));
  logger.log('Servidor reiniciado.');
}

async function quit(): Promise<void> {
  logger.log('Encerrando…');
  try {
    await tray?.destroy();
  } catch {
    /* ignore */
  }
  try {
    await app?.close(); // dispara onModuleDestroy -> limpa o setInterval do polling
  } catch {
    /* ignore */
  }
  process.exit(0);
}

async function bootstrap(): Promise<void> {
  // esconde a janela de console só no .exe empacotado (mantém logs no dev)
  if (isWin && isPacked) {
    try {
      require('node-hide-console-window').hideConsole();
    } catch {
      /* dep opcional ausente (build fora do Windows) — segue com console visível */
    }
  }

  // instância única: se a porta já responde, foca a existente e sai
  if (await portInUse(PORT)) {
    logger.warn(`Já há uma instância na porta ${PORT}. Abrindo o overlay e saindo.`);
    openOverlay();
    process.exit(0);
  }

  await createApp();
  logger.log(`LoL Overlay em http://localhost:${PORT}`);

  if (isWin) {
    tray = new Tray({ port: PORT, openOverlay, onRestart: restart, onQuit: quit });
    try {
      await tray.start();
      if (app) tray.bindStatus(app.get(GameDataService));
    } catch (e) {
      logger.error('Não foi possível iniciar a bandeja: ' + e);
      tray = undefined;
    }
  }

  // saída limpa por sinais (Ctrl+C no dev, fechamento do sistema)
  process.on('SIGINT', () => void quit());
  process.on('SIGTERM', () => void quit());
}

void bootstrap();
