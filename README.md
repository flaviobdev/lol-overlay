# lol-overlay

Overlay em tempo real de partidas de **League of Legends** para **OBS / Streamlabs**, feito com NestJS.

Ele consulta a **Live Client Data API** local do jogo (`https://127.0.0.1:2999/liveclientdata/allgamedata`) uma vez por segundo, simplifica o payload e serve um overlay HTML transparente que você adiciona como **Browser Source**.

## O que mostra

HUD compacto do **seu** campeão (o jogador local), para não poluir a tela:

- Riot ID + campeão + nível
- KDA (kills / deaths / assists)
- CS e CS por minuto
- Itens (ícones)
- Ouro (arredondado)
- Cronômetro da partida + modo de jogo
- Placar de objetivos: **dragões** e **torres** do seu time × inimigo (contados dos eventos da partida)

## Rodar (desenvolvimento)

```bash
npm install
npm run start      # http://localhost:3000
```

Abra o League of Legends e entre em uma partida — o overlay é preenchido automaticamente. Fora de partida ele mostra "Procurando fila…".

Endpoints:

- `GET /api/gamedata` — snapshot JSON simplificado (também é o fallback por polling)
- WebSocket (`socket.io`) — emite o evento `gameData` a cada segundo
- `/` — a página do overlay (`public/`)

## Gerar o `.exe` standalone (para streamers, sem precisar de Node.js)

```bash
npm run build:exe
```

O `build:exe` gera o ícone (`build:icon`), compila o TypeScript, empacota um único executável Windows **`lol-overlay.exe`** (`pkg`, target `node18-win-x64`) e aplica o ícone ao `.exe` (via `rcedit`).

> **Builde no Windows.** Duas capacidades dependem de rodar o build no Windows:
> - **esconder o console** usa `node-hide-console-window`, que é uma dependência **opcional** só de `win32` — no Linux ela nem é instalada, então o `.exe` empacotado fora do Windows abre com console visível;
> - **ícone do `.exe`** usa `rcedit` (nativo no Windows).
>
> Na primeira execução o `pkg` baixa um binário base do Node 18, então esse passo precisa de internet.

## Roda oculto na bandeja do sistema (Windows)

A partir do `.exe`, o app **não abre janela de terminal** — ele roda em segundo plano e coloca um **ícone na bandeja do sistema** (system tray).

**Onde achar o ícone:** ao lado do relógio, na barra de tarefas. Se não aparecer, clique na setinha **"Mostrar ícones ocultos"** (`^`) — o Windows costuma esconder ícones novos ali. Arraste o ícone para fora para fixá-lo.

**Menu do ícone (clique com o botão direito / esquerdo):**

- **Abrir Overlay** — abre `http://localhost:3000` no navegador padrão
- **Status: Em partida / Fora de partida** — atualiza sozinho conforme o jogo
- **Reiniciar servidor** — reinicia o servidor sem fechar o app
- **Sair** — encerra tudo (servidor + processo)

> **Saia sempre pelo "Sair"** do menu, não pelo Gerenciador de Tarefas. O "Sair" para o polling e fecha o servidor de forma limpa, sem deixar processo do Node "zumbi".

Se você der dois cliques no `.exe` uma segunda vez sem querer, ele **não sobe outro servidor**: detecta que a porta 3000 já está em uso, abre o overlay no navegador e sai.

## Como usar (streamer)

1. Dê dois cliques em **`lol-overlay.exe`** — nada de janela de terminal; aparece só o ícone na bandeja.
2. Abra o **League of Legends** e entre em uma partida.
3. No **OBS / Streamlabs**, adicione uma **Browser Source (Fonte de Navegador)**:
   - URL: `http://localhost:3000`
   - Largura `1920`, Altura `1080`
   - (O fundo é transparente por padrão.)
4. Ao terminar a live, feche pelo menu da bandeja → **Sair**.

## Estrutura do projeto

```
src/
  main.ts                     bootstrap, porta 3000, esconde console, instância única, saída limpa
  tray.ts                     ícone da bandeja (Windows) via systray2
  app.module.ts               serve /public, monta o GameDataModule
  game-data/
    game-data.module.ts
    game-data.service.ts      polling de 1s da Live Client Data (ignora o certificado autoassinado)
    game-data.controller.ts   GET /api/gamedata
    game-data.gateway.ts      WebSocket, emite "gameData"
    types.ts                  tipos da API bruta + do overlay simplificado
public/                       overlay (index.html, style.css, app.js)
assets/icon.ico               ícone (gerado de lol-overlay-icon.png por scripts/png-to-ico.js)
scripts/
  png-to-ico.js               converte o PNG em .ico multi-tamanho (16/32/48/256)
  set-exe-icon.js             aplica o ícone ao lol-overlay.exe (rcedit)
```

O ícone da bandeja e o do `.exe` vêm de **`lol-overlay-icon.png`**. Trocou o PNG? Rode `npm run build:icon` para regenerar `assets/icon.ico`.

## Contribuindo

A branch `main` é protegida: **não é permitido dar push direto**. Toda alteração entra por **Pull Request** (o dono pode aprovar/mergear o próprio PR).

```bash
git checkout -b minha-mudanca
# ... edite, commite ...
git push -u origin minha-mudanca
gh pr create --fill      # abra o PR; precisa de 1 aprovação para dar merge
```

## Notas

- A Live Client Data API usa um **certificado autoassinado**; o serviço define `rejectUnauthorized: false`. O tráfego é só de loopback (`127.0.0.1`).
- Com o jogo fechado ou fora de partida, a API fica inacessível — isso é tratado de forma graciosa e a aplicação retorna `{ "inGame": false }`.
- Ícones de itens/campeões vêm do Data Dragon. Atualize `DDRAGON_VERSION` em `public/app.js` após um novo patch.
- A bandeja usa `systray2`, que executa um binário auxiliar. Ele é embutido no `.exe` (assets do `pkg`) e, em runtime, copiado do snapshot para uma pasta real (`copyDir`) antes de ser executado — necessário porque não dá para executar direto de dentro do pacote do `pkg`.

## Licença

MIT
