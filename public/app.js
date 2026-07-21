/* Cliente do overlay — JS puro. Prefere o WebSocket, com polling REST como fallback.
   Mostra só o campeão do jogador local + placar de objetivos. Atualiza no lugar
   (sem recriar o DOM a cada tick) para não piscar. */
(function () {
  "use strict";

  // ponytail: patch do Data Dragon fixado (ícones de campeão/item). Atualize a cada patch.
  var DDRAGON_VERSION = "15.1.1";
  var CHAMP_IMG = function (name) {
    return (
      "https://ddragon.leagueoflegends.com/cdn/" +
      DDRAGON_VERSION +
      "/img/champion/" +
      encodeURIComponent(name) +
      ".png"
    );
  };
  var ITEM_IMG = function (id) {
    return (
      "https://ddragon.leagueoflegends.com/cdn/" +
      DDRAGON_VERSION +
      "/img/item/" +
      id +
      ".png"
    );
  };

  var MODOS = {
    CLASSIC: "Clássico",
    ARAM: "ARAM",
    URF: "URF",
    ARURF: "ARURF",
    ONEFORALL: "Um Por Todos",
    NEXUSBLITZ: "Nexus Blitz",
    TUTORIAL: "Tutorial",
    PRACTICETOOL: "Ferramenta de Treino",
    CHERRY: "Arena",
    SWIFTPLAY: "Partida Rápida",
  };

  var statusEl = document.getElementById("status");
  var hudEl = document.getElementById("hud");
  var clockEl = document.getElementById("clock");
  var modeEl = document.getElementById("mode");
  var playerEl = document.getElementById("player");
  var el = {
    dragMine: document.getElementById("drag-mine"),
    dragEnemy: document.getElementById("drag-enemy"),
    towerMine: document.getElementById("tower-mine"),
    towerEnemy: document.getElementById("tower-enemy"),
  };

  var card = null; // card do jogador local, criado uma única vez

  function fmtTime(seconds) {
    var s = Math.max(0, Math.floor(seconds || 0));
    var m = Math.floor(s / 60);
    var r = s % 60;
    return (m < 10 ? "0" : "") + m + ":" + (r < 10 ? "0" : "") + r;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c];
    });
  }

  function itemsHtml(items) {
    var html = "";
    var count = 0;
    for (var i = 0; i < items.length && count < 7; i++) {
      var id = items[i].id;
      if (!id) continue;
      html +=
        '<div class="item"><img src="' +
        ITEM_IMG(id) +
        '" alt="' +
        id +
        '" onerror="this.style.display=\'none\'"/></div>';
      count++;
    }
    return html;
  }

  function itemSig(items) {
    var ids = [];
    for (var i = 0; i < items.length; i++) if (items[i].id) ids.push(items[i].id);
    return ids.join(",");
  }

  function createCard(p) {
    var node = document.createElement("div");
    node.className = "player";
    node.innerHTML =
      '<div class="portrait">' +
      '<img alt="" onerror="this.style.opacity=0.15"/>' +
      '<span class="level"></span>' +
      "</div>" +
      '<div class="info">' +
      '<div class="line1"><span class="name"></span><span class="champ"></span></div>' +
      '<div class="stats">' +
      '<div class="stat"><b class="kda"></b><span class="k">KDA</span></div>' +
      '<div class="stat"><b class="cs"></b><span class="k cslabel"></span></div>' +
      '<div class="stat gold"><b class="goldv"></b><span class="k">Ouro</span></div>' +
      "</div>" +
      "</div>" +
      '<div class="items"></div>';

    node._refs = {
      img: node.querySelector(".portrait img"),
      level: node.querySelector(".level"),
      name: node.querySelector(".name"),
      champ: node.querySelector(".champ"),
      kda: node.querySelector(".kda"),
      cs: node.querySelector(".cs"),
      cslabel: node.querySelector(".cslabel"),
      goldStat: node.querySelector(".stat.gold"),
      goldv: node.querySelector(".goldv"),
      items: node.querySelector(".items"),
    };
    node._champ = null;
    node._itemSig = null;
    return node;
  }

  function updateCard(node, p) {
    var r = node._refs;

    node.classList.toggle("dead", !!p.isDead);
    node.classList.toggle("chaos", p.team === "CHAOS");

    if (node._champ !== p.championName) {
      r.img.src = CHAMP_IMG(p.championName);
      setText(r.champ, p.championName);
      setText(r.name, p.riotId);
      node._champ = p.championName;
    }

    setText(r.level, p.level);
    r.kda.innerHTML =
      p.kills + '<span class="sep">/</span>' + p.deaths + '<span class="sep">/</span>' + p.assists;
    setText(r.cs, p.cs);
    setText(r.cslabel, "CS · " + p.csPerMin + "/min");

    if (p.gold != null) {
      r.goldStat.style.display = "";
      setText(r.goldv, Math.round(p.gold)); // API manda float; arredonda p/ inteiro
    } else {
      r.goldStat.style.display = "none";
    }

    var sig = itemSig(p.items || []);
    if (sig !== node._itemSig) {
      r.items.innerHTML = itemsHtml(p.items || []);
      node._itemSig = sig;
    }
  }

  function setText(node, value) {
    var s = String(value);
    if (node.textContent !== s) node.textContent = s;
  }

  function render(data) {
    if (!data || !data.inGame) {
      statusEl.classList.remove("hidden");
      hudEl.classList.add("hidden");
      playerEl.innerHTML = "";
      card = null;
      return;
    }

    var players = data.players || [];
    var me = players.filter(function (p) {
      return p.isLocal;
    })[0] || players[0];
    if (!me) return;

    statusEl.classList.add("hidden");
    hudEl.classList.remove("hidden");
    setText(clockEl, fmtTime(data.gameTime));
    setText(modeEl, MODOS[data.gameMode] || data.gameMode || "Partida");

    if (!card) {
      card = createCard(me);
      playerEl.appendChild(card);
    }
    updateCard(card, me);

    // objetivos: meu time × inimigo
    var mine = (data.localTeam || me.team) === "CHAOS" ? "chaos" : "order";
    var enemy = mine === "order" ? "chaos" : "order";
    var obj = data.objectives || { order: {}, chaos: {} };
    hudEl.classList.toggle("me-chaos", mine === "chaos");
    setText(el.dragMine, obj[mine].dragons || 0);
    setText(el.dragEnemy, obj[enemy].dragons || 0);
    setText(el.towerMine, obj[mine].towers || 0);
    setText(el.towerEnemy, obj[enemy].towers || 0);
  }

  // --- transporte: WebSocket primeiro, polling REST como fallback ---
  var pollTimer = null;
  function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(function () {
      fetch("/api/gamedata")
        .then(function (r) {
          return r.json();
        })
        .then(render)
        .catch(function () {});
    }, 1000);
  }
  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  if (typeof io === "function") {
    var socket = io();
    socket.on("gameData", render);
    socket.on("connect", stopPolling);
    socket.on("disconnect", startPolling);
    socket.on("connect_error", startPolling);
  } else {
    startPolling();
  }
})();
