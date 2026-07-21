/* Overlay client — pure JS. Prefers the WebSocket, falls back to REST polling. */
(function () {
  "use strict";

  // ponytail: hardcoded Data Dragon patch for item/champion icons. Bump on new patch.
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

  var statusEl = document.getElementById("status");
  var boardEl = document.getElementById("scoreboard");
  var clockEl = document.getElementById("clock");
  var modeEl = document.getElementById("mode");
  var orderPlayers = document.querySelector("#team-order .players");
  var chaosPlayers = document.querySelector("#team-chaos .players");

  function fmtTime(seconds) {
    var s = Math.max(0, Math.floor(seconds || 0));
    var m = Math.floor(s / 60);
    var r = s % 60;
    return (m < 10 ? "0" : "") + m + ":" + (r < 10 ? "0" : "") + r;
  }

  function itemsHtml(items) {
    // 6 item slots + trinket; keep to first 7, skip empties.
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
    el.className =
      "player " + (p.team === "CHAOS" ? "chaos" : "order") + (p.isDead ? " dead" : "");
    var goldTxt = p.gold != null ? '<span class="gold">' + p.gold + "g</span>" : "";
    el.innerHTML =
      '<div class="champ">' +
      '<img src="' +
      CHAMP_IMG(p.championName) +
      '" alt="' +
      p.championName +
      '" onerror="this.style.opacity=0.2"/>' +
      '<span class="level">' +
      p.level +
      "</span>" +
      "</div>" +
      '<div class="info">' +
      '<div class="name">' +
      escapeHtml(p.riotId) +
      "</div>" +
      '<div class="substats">' +
      '<span class="kda"><b>' +
      p.kills +
      "</b>/<b>" +
      p.deaths +
      "</b>/<b>" +
      p.assists +
      "</b></span>" +
      "<span>CS " +
      p.cs +
      " (" +
      p.csPerMin +
      "/m)</span>" +
      goldTxt +
      "</div>" +
      "</div>" +
      '<div class="items">' +
      itemsHtml(p.items || []) +
      "</div>";
    return el;
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

  function render(data) {
    if (!data || !data.inGame) {
      statusEl.classList.remove("hidden");
      statusEl.textContent = "Waiting for game…";
      boardEl.classList.add("hidden");
      return;
    }
    statusEl.classList.add("hidden");
    boardEl.classList.remove("hidden");
    clockEl.textContent = fmtTime(data.gameTime);
    modeEl.textContent = data.gameMode || "";

    orderPlayers.innerHTML = "";
    chaosPlayers.innerHTML = "";
    (data.players || []).forEach(function (p) {
      var row = playerRow(p);
      (p.team === "CHAOS" ? chaosPlayers : orderPlayers).appendChild(row);
    });
  }

  // --- transport: WebSocket first, REST polling as fallback ---
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
