/* Cliente do overlay — JS puro. Prefere o WebSocket, com polling REST como fallback. */
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

  // Rótulos dos modos de jogo em pt-BR (chave = gameMode da API).
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
  var statusText = statusEl.querySelector(".status-text");
  var boardEl = document.getElementById("scoreboard");
  var clockEl = document.getElementById("clock");
  var modeEl = document.getElementById("mode");
  var orderEl = document.getElementById("players-order");
  var chaosEl = document.getElementById("players-chaos");

  function fmtTime(seconds) {
    var s = Math.max(0, Math.floor(seconds || 0));
    var m = Math.floor(s / 60);
    var r = s % 60;
    return (m < 10 ? "0" : "") + m + ":" + (r < 10 ? "0" : "") + r;
  }

  function escapeHtml(s) {
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
    // 6 slots de item + berloque; primeiros 7 não-vazios.
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

  function playerRow(p) {
    var el = document.createElement("div");
    var cls = "player";
    if (p.isDead) cls += " dead";
    if (p.gold != null) cls += " is-local";
    el.className = cls;

    // barra de ouro apenas para o jogador local (único exposto pela API)
    var goldHtml =
      p.gold != null
        ? '<div class="stat gold"><b>' +
          p.gold +
          '</b><span class="k">Ouro</span></div>'
        : "";

    el.innerHTML =
      '<div class="portrait">' +
      '<img src="' +
      CHAMP_IMG(p.championName) +
      '" alt="' +
      escapeHtml(p.championName) +
      '" onerror="this.style.opacity=0.15"/>' +
      '<span class="level">' +
      p.level +
      "</span>" +
      "</div>" +
      '<div class="info">' +
      '<div class="line1">' +
      '<span class="name">' +
      escapeHtml(p.riotId) +
      "</span>" +
      '<span class="champ">' +
      escapeHtml(p.championName) +
      "</span>" +
      "</div>" +
      '<div class="stats">' +
      '<div class="stat"><b>' +
      p.kills +
      '<span class="sep">/</span>' +
      p.deaths +
      '<span class="sep">/</span>' +
      p.assists +
      '</b><span class="k">KDA</span></div>' +
      '<div class="stat"><b>' +
      p.cs +
      '</b><span class="k">CS · ' +
      p.csPerMin +
      "/min</span></div>" +
      goldHtml +
      "</div>" +
      "</div>" +
      '<div class="items">' +
      itemsHtml(p.items || []) +
      "</div>";
    return el;
  }

  function render(data) {
    if (!data || !data.inGame) {
      statusText.textContent = "Aguardando partida…";
      statusEl.classList.remove("hidden");
      boardEl.classList.add("hidden");
      return;
    }
    statusEl.classList.add("hidden");
    boardEl.classList.remove("hidden");
    clockEl.textContent = fmtTime(data.gameTime);
    modeEl.textContent = MODOS[data.gameMode] || data.gameMode || "Partida";

    orderEl.innerHTML = "";
    chaosEl.innerHTML = "";
    (data.players || []).forEach(function (p) {
      (p.team === "CHAOS" ? chaosEl : orderEl).appendChild(playerRow(p));
    });
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
