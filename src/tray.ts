/* Ícone na bandeja do sistema (Windows) via systray2.
   Só é instanciado em win32 — em outros SOs o app roda normal, sem bandeja.
   Sob pkg, o binário auxiliar do systray2 é copiado do snapshot para um dir
   real (opção copyDir) antes de ser executado. */
import { Logger } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Subscription } from 'rxjs';
import { GameDataService } from './game-data/game-data.service';

// índices dos itens no menu (a ordem abaixo precisa bater com estes)
const IDX_OPEN = 0;
const IDX_STATUS = 1;
// IDX 2 = separador
const IDX_RESTART = 3;
const IDX_QUIT = 4;

export interface TrayActions {
  port: number;
  openOverlay: () => void;
  onRestart: () => void | Promise<void>;
  onQuit: () => void | Promise<void>;
}

export class Tray {
  private readonly logger = new Logger('Tray');
  private systray: any;
  private statusItem: any;
  private sub?: Subscription;

  constructor(private readonly actions: TrayActions) {}

  async start(): Promise<void> {
    // require tardio: só carrega a lib quando realmente vamos usar a bandeja
    const SysTray = require('systray2').default;

    const iconPath = join(__dirname, '..', 'assets', 'icon.ico');
    const icon = readFileSync(iconPath).toString('base64');

    const openItem = { title: 'Abrir Overlay', tooltip: '', enabled: true };
    this.statusItem = {
      title: 'Status: Fora de partida',
      tooltip: '',
      enabled: false,
    };
    const restartItem = { title: 'Reiniciar servidor', tooltip: '', enabled: true };
    const quitItem = { title: 'Sair', tooltip: '', enabled: true };

    this.systray = new SysTray({
      menu: {
        icon,
        isTemplateIcon: false,
        title: 'LoL Overlay',
        tooltip: 'LoL Overlay',
        items: [
          openItem,
          this.statusItem,
          SysTray.separator,
          restartItem,
          quitItem,
        ],
      },
      debug: false,
      copyDir: true, // essencial p/ pkg: copia o binário do snapshot p/ dir real
    });

    this.systray.onClick((action: any) => {
      switch (action.seq_id) {
        case IDX_OPEN:
          this.actions.openOverlay();
          break;
        case IDX_RESTART:
          Promise.resolve(this.actions.onRestart()).catch((e) =>
            this.logger.error('Falha ao reiniciar: ' + e),
          );
          break;
        case IDX_QUIT:
          Promise.resolve(this.actions.onQuit()).catch(() => process.exit(0));
          break;
        default:
          break;
      }
    });

    await this.systray.ready();
    this.logger.log('Ícone da bandeja ativo.');
  }

  /** (Re)liga o texto de status ao GameDataService atual. */
  bindStatus(service: GameDataService): void {
    this.sub?.unsubscribe();
    this.sub = service.data$.subscribe((d) => this.setStatus(d.inGame));
  }

  private setStatus(inGame: boolean): void {
    const title = inGame ? 'Status: Em partida' : 'Status: Fora de partida';
    if (this.statusItem.title === title || !this.systray) return;
    this.statusItem.title = title;
    this.systray.sendAction({
      type: 'update-item',
      item: this.statusItem,
      seq_id: IDX_STATUS,
    });
  }

  async destroy(): Promise<void> {
    this.sub?.unsubscribe();
    try {
      await this.systray?.kill(false); // encerra o processo auxiliar da bandeja
    } catch {
      /* ignora — vamos sair de qualquer forma */
    }
  }
}
