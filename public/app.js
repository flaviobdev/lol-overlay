/* Cliente do overlay — JS puro. Prefere o WebSocket, com polling REST como fallback.
   Atualiza os cards no lugar (sem recriar o DOM a cada tick) para não piscar. */
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

  // Cache de cards por Riot ID, para atualizar no lugar em vez de recriar.
  var rows = {};

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

  function itemSig(items) {
    var ids = [];
    for (var i = 0; i < items.length; i++) if (items[i].id) ids.push(items[i].id);
    return ids.join(",");
  }

  // Cria o card uma única vez, guardando referências aos nós que mudam.
  function createRow(p) {
    var el = document.createElement("div");
    el.className = "player";
    el.innerHTML =
      '<div class="portrait">' +
      '<img src="' +
      CHAMP_IMG(p.championName) +
      '" alt="' +
      esc(p.championName) +
      '" onerror="this.style.opacity=0.15"/>' +
      '<span class="level"></span>' +
      "</div>" +
      '<div class="info">' +
      '<div class="line1">' +
      '<span class="name">' +
      esc(p.riotId) +
      "</span>" +
      '<span class="champ">' +
      esc(p.championName) +
      "</span>" +
      "</div>" +
      '<div class="stats">' +
      '<div class="stat"><b class="kda"></b><span class="k">KDA</span></div>' +
      '<div class="stat"><b class="cs"></b><span class="k cslabel"></span></div>' +
      '<div class="stat gold" style="display:none"><b class="goldv"></b><span class="k">Ouro</span></div>' +
      "</div>" +
      "</div>" +
      '<div class="items"></div>';

    el._refs = {
      level: el.querySelector(".level"),
      kda: el.querySelector(".kda"),
      cs: el.querySelector(".cs"),
      cslabel: el.querySelector(".cslabel"),
      goldStat: el.querySelector(".stat.gold"),
      goldv: el.querySelector(".goldv"),
      items: el.querySelector(".items"),
    };
    el._itemSig = null;
    return el;
  }

  // Atualiza só o que muda — sem recriar nós, então nada pisca.
  function updateRow(el, p) {
    var r = el._refs;

    el.classList.toggle("dead", !!p.isDead);
    el.classList.toggle("is-local", p.gold != null);

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
    if (sig !== el._itemSig) {
      r.items.innerHTML = itemsHtml(p.items || []);
      el._itemSig = sig;
    }
  }

  function setText(node, value) {
    var s = String(value);
    if (node.textContent !== s) node.textContent = s;
  }

  function render(data) {
    if (!data || !data.inGame) {
      statusEl.classList.remove("hidden");
      boardEl.classList.add("hidden");
      // zera o cache p/ reconstruir quando voltar à partida
      orderEl.innerHTML = "";
      chaosEl.innerHTML = "";
      rows = {};
      return;
    }
    statusEl.classList.add("hidden");
    boardEl.classList.remove("hidden");
    setText(clockEl, fmtTime(data.gameTime));
    setText(modeEl, MODOS[data.gameMode] || data.gameMode || "Partida");

    var seen = {};
    (data.players || []).forEach(function (p) {
      seen[p.riotId] = true;
      var el = rows[p.riotId];
      if (!el) {
        el = createRow(p);
        rows[p.riotId] = el;
        (p.team === "CHAOS" ? chaosEl : orderEl).appendChild(el);
      }
      updateRow(el, p);
    });

    // remove cards de jogadores que sumiram (raro)
    Object.keys(rows).forEach(function (id) {
      if (!seen[id]) {
        rows[id].remove();
        delete rows[id];
      }
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
