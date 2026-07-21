# lol-overlay

Overlay em tempo real de partidas de **League of Legends** para **OBS / Streamlabs**, feito com NestJS.

Ele consulta a **Live Client Data API** local do jogo (`https://127.0.0.1:2999/liveclientdata/allgamedata`) uma vez por segundo, simplifica o payload e serve um overlay HTML transparente que você adiciona como **Browser Source**.

## O que mostra

Por jogador (10 jogadores, 2 times — ORDER/azul, CHAOS/vermelho):

- Riot ID + campeão + nível
- KDA (kills / deaths / assists)
- CS e CS por minuto
- Itens (ícones)
- Gold — _apenas do jogador local/streamer; a API da Riot não transmite o gold dos inimigos_
- Cronômetro da partida + modo de jogo

## Rodar (desenvolvimento)

```bash
npm install
npm run start      # http://localhost:3000
```

Abra o League of Legends e entre em uma partida — o overlay é preenchido automaticamente. Fora de partida ele mostra "Aguardando partida…".

Endpoints:

- `GET /api/gamedata` — snapshot JSON simplificado (também é o fallback por polling)
- WebSocket (`socket.io`) — emite o evento `gameData` a cada segundo
- `/` — a página do overlay (`public/`)

## Gerar o `.exe` standalone (para streamers, sem precisar de Node.js)

```bash
npm run build:exe
```

Isso compila o TypeScript (`npm run build`) e empacota um único executável Windows **`lol-overlay.exe`** (`pkg`, target `node18-win-x64`).

> Na primeira execução o `pkg` baixa um binário base do Node 18, então esse passo precisa de conexão com a internet.

## Como usar (streamer)

1. Dê dois cliques em **`lol-overlay.exe`** — abre uma janela de console e o servidor sobe na porta 3000.
2. Abra o **League of Legends** e entre em uma partida.
3. No **OBS / Streamlabs**, adicione uma **Browser Source (Fonte de Navegador)**:
   - URL: `http://localhost:3000`
   - Largura `1920`, Altura `1080`
   - (O fundo é transparente por padrão.)
4. Mantenha o `.exe` rodando enquanto faz a live. Feche a janela do console para parar.

## Estrutura do projeto

```
src/
  main.ts                     bootstrap, porta 3000
  app.module.ts               serve /public, monta o GameDataModule
  game-data/
    game-data.module.ts
    game-data.service.ts      polling de 1s da Live Client Data (ignora o certificado autoassinado)
    game-data.controller.ts   GET /api/gamedata
    game-data.gateway.ts      WebSocket, emite "gameData"
    types.ts                  tipos da API bruta + do overlay simplificado
public/                       overlay (index.html, style.css, app.js)
```

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

## Licença

MIT
