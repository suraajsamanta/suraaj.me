// HTML for internal.suraaj.me. Events are embedded as JSON and summarised in
// the browser so switching site / time range is instant. The client script
// avoids template literals so it can live inside this TS template string.
import type { VisitEvent } from "./events";

const BASE_CSS = `
*{box-sizing:border-box}
:root{--bg:#f6f6f3;--card:#fff;--ink:#16181d;--mute:#6b7079;--line:#e6e6e1;--accent:#2457ff;--good:#0f8a4b;--good-bg:#e3f5ea;
  --bad:#c42b1c;--bad-bg:#fbe6e3;--warn:#8a6a00;--warn-bg:#fbf1cc;--chip:#f0f0ec}
@media (prefers-color-scheme:dark){:root{--bg:#0f1012;--card:#17191c;--ink:#ececea;--mute:#9a9ea6;--line:#2a2d32;--accent:#7a9bff;
  --good:#5fd394;--good-bg:#173323;--bad:#ff8a7a;--bad-bg:#3a1c18;--warn:#f0cf6a;--warn-bg:#352c10;--chip:#23262b}}
html{background:var(--bg)}
body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.45 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
button,input{font:inherit;color:inherit}
`;

export function adminLoginPage(error: boolean) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow">
<title>Internal · suraaj.me</title><style>${BASE_CSS}
body{min-height:100vh;display:grid;place-items:center;padding:16px}
form{width:100%;max-width:320px;display:grid;gap:12px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:24px}
h1{margin:0;font-size:18px}p{margin:0;color:var(--mute);font-size:13px}
input{padding:11px 12px;border-radius:9px;border:1px solid var(--line);background:var(--bg);outline:none}
input:focus{border-color:var(--accent)}
button{padding:11px;border:0;border-radius:9px;background:var(--ink);color:var(--bg);font-weight:600;cursor:pointer}
.err{color:var(--bad)}</style></head>
<body><form method="post"><h1>suraaj.me internal</h1><p>Visitor analytics. Owner only.</p>
<input type="password" name="password" placeholder="Password" aria-label="Password" autocomplete="current-password" required autofocus>
${error ? '<p class="err" role="alert">Wrong password.</p>' : ""}
<button type="submit">Log in</button></form></body></html>`;
}

export function dashboardPage(events: VisitEvent[], storeReady: boolean) {
  const data = JSON.stringify(events).replace(/</g, "\\u003c");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow">
<title>Visitors · suraaj.me</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="anonymous">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin="anonymous"></script>
<style>${BASE_CSS}
.wrap{max-width:1180px;margin:0 auto;padding:20px 16px 48px}
header{display:flex;flex-wrap:wrap;align-items:center;gap:12px 16px;margin-bottom:16px}
header h1{margin:0;font-size:20px;letter-spacing:-.01em;margin-right:auto}
header h1 small{display:block;font-size:12px;font-weight:400;color:var(--mute)}
.seg{display:inline-flex;background:var(--chip);border-radius:9px;padding:3px}
.seg button{border:0;background:none;padding:5px 11px;border-radius:7px;cursor:pointer;color:var(--mute);white-space:nowrap}
.seg button.on{background:var(--card);color:var(--ink);box-shadow:0 1px 2px rgba(0,0,0,.12)}
label.me{display:flex;align-items:center;gap:6px;color:var(--mute);font-size:13px;cursor:pointer}
.logout{border:1px solid var(--line);background:var(--card);border-radius:8px;padding:5px 11px;cursor:pointer;color:var(--mute)}
.tabs{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;margin-bottom:16px}
.tabs button{flex-shrink:0;border:1px solid var(--line);background:var(--card);border-radius:999px;padding:7px 14px;cursor:pointer;white-space:nowrap}
.tabs button b{font-weight:600;margin-left:6px;color:var(--mute)}
.tabs button.on{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.tabs button.on b{color:var(--bg);opacity:.75}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:16px}
.tile{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 14px}
.tile span{display:block;color:var(--mute);font-size:12px}
.tile b{display:block;font-size:26px;font-weight:650;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.tile.good b{color:var(--good)}.tile.bad b{color:var(--bad)}
.grid{display:grid;grid-template-columns:2fr 1fr;gap:12px;margin-bottom:16px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden;min-width:0}
.card h2{margin:0;padding:12px 14px;font-size:14px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;gap:8px}
.card h2 span{color:var(--mute);font-weight:400}
#map{height:380px;background:var(--chip)}
.places{list-style:none;margin:0;padding:4px 0;max-height:380px;overflow:auto}
.places li{display:grid;grid-template-columns:22px 1fr auto;gap:8px;align-items:center;padding:7px 14px;cursor:pointer}
.places li:hover{background:var(--chip)}
.places small{display:block;color:var(--mute);font-size:12px}
.bar{height:4px;border-radius:2px;background:var(--accent);opacity:.7;margin-top:3px}
.n{font-variant-numeric:tabular-nums;font-weight:600}
.table{overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;font-weight:500;color:var(--mute);padding:8px 14px;border-bottom:1px solid var(--line);white-space:nowrap}
td{padding:9px 14px;border-bottom:1px solid var(--line);vertical-align:top}
tr:last-child td{border-bottom:0}
td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}
.sub{display:block;color:var(--mute);font-size:12px}
.pill{display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px;font-weight:600;white-space:nowrap}
.pill.good{background:var(--good-bg);color:var(--good)}.pill.bad{background:var(--bad-bg);color:var(--bad)}
.pill.warn{background:var(--warn-bg);color:var(--warn)}.pill.mute{background:var(--chip);color:var(--mute)}
.empty{padding:28px 14px;color:var(--mute);text-align:center}
.notice{background:var(--warn-bg);color:var(--warn);border-radius:10px;padding:10px 14px;margin-bottom:16px}
.section{margin-bottom:16px}
.note{margin:0;padding:10px 14px;color:var(--mute);font-size:12px}
details.session{border-bottom:1px solid var(--line);padding:10px 14px}
details.session:last-child{border-bottom:0}
details.session summary{cursor:pointer;font-weight:550}
details.session ol{margin:8px 0 2px;padding-left:24px}
details.session li{padding:2px 0;overflow-wrap:anywhere}
.sessionmeta{color:var(--mute);font-weight:400;margin-left:6px}
.sessionpath{display:inline-block;color:var(--mute);font-variant-numeric:tabular-nums;margin-right:8px}

.leaflet-container{font:inherit}
.leaflet-tile-pane{filter:saturate(.35)}
@media (prefers-color-scheme:dark){.leaflet-tile-pane{filter:invert(1) hue-rotate(180deg) saturate(.3) brightness(.9)}}
@media (max-width:820px){.grid{grid-template-columns:1fr}#map{height:300px}.places{max-height:none}}
</style></head><body><div class="wrap">
<header>
  <h1>Visitors<small>suraaj.me internal</small></h1>
  <div class="seg" id="range"><button data-d="1">24 hours</button><button data-d="7" class="on">7 days</button><button data-d="30">30 days</button></div>
  <label class="me"><input type="checkbox" id="mine"> Include my visits</label>
  <form method="post"><input type="hidden" name="action" value="logout"><button class="logout">Log out</button></form>
</header>
${storeReady ? "" : '<div class="notice">Visit storage isn&rsquo;t connected yet, so nothing is being recorded.</div>'}
<nav class="tabs" id="tabs"></nav>
<div class="tiles" id="tiles"></div>
<div class="grid">
  <section class="card"><h2>Where visitors are <span id="mapnote"></span></h2><div id="map"></div></section>
  <section class="card"><h2>Top places <span>visitors</span></h2><ul class="places" id="places"></ul></section>
</div>
<div id="detail"></div>
<section class="card section"><h2>Recent activity <span id="recentnote"></span></h2><div id="recent"></div></section>
</div>
<script id="events" type="application/json">${data}</script>
<script>
(function () {
  var dedupe = new Set();
  var ALL = JSON.parse(document.getElementById("events").textContent).filter(function (e) {
    if (!e.eid) return true;
    var key = e.vid + ":" + e.eid;
    if (dedupe.has(key)) return false;
    dedupe.add(key); return true;
  }).sort(function (a, b) { return b.t - a.t; });
  var RESUMES = { "/resume": "Big Tech", "/cv": "AI Labs", "/suraaj_resume": "Quant" };
  var GAMES = { "": "madfun home", "beerio": "Beerio", "beerio-2": "Beerio 2", "boomerang": "Ricochet", "bump-club": "Bump Club",
    "floor-is-trouble": "Floor Is Trouble", "simulator": "The Simulator", "jeopardy": "Eesha Lore Night", "codewords": "Codewords",
    "inside-ranks": "Inside Ranks", "controller": "Host remote" };
  var SITES = [["all", "All sites"], ["home", "Homepage"], ["resumes", "Resumes"], ["madfun", "madfun"], ["beerio", "Beerio"], ["other", "Other pages"]];
  var state = { days: 7, site: "all", mine: false };
  try { var saved = JSON.parse(localStorage.getItem("ss-internal") || "{}"); for (var k in saved) state[k] = saved[k]; } catch (e) {}

  function site(e) {
    var p = e.path;
    if (isGame(e)) return "madfun";
    if (p === "/") return "home";
    if (RESUMES[p]) return "resumes";
    if (p === "/madfun" || p.indexOf("/madfun/") === 0) return "madfun";
    if (p === "/beerio" || p.indexOf("/beerio/") === 0) return "beerio";
    return "other";
  }
  function game(e) { if (isGame(e)) return e.game; if (site(e) === "beerio") return "beerio"; var m = e.path.match(/^\\/madfun\\/?([^/]*)/); return m ? m[1] : ""; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function flag(cc) { return /^[a-z]{2}$/i.test(cc || "") ? String.fromCodePoint.apply(null, cc.toUpperCase().split("").map(function (c) { return 127397 + c.charCodeAt(0); })) : "🌐"; }
  function place(e) {
    if (!e.city && !e.country) return "Unknown location";
    return [e.city, e.region && e.country === "US" ? e.region : null, e.country].filter(Boolean).join(", ");
  }
  function ago(t) {
    var s = (Date.now() - t) / 1000;
    if (s < 60) return "just now";
    if (s < 3600) return Math.floor(s / 60) + " min ago";
    if (s < 86400) return Math.floor(s / 3600) + " h ago";
    return Math.floor(s / 86400) + " d ago";
  }
  function when(t) { return new Date(t).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); }
  function who(vid) { return "Browser " + String(vid || "").replace(/[^a-z0-9]/gi, "").slice(0, 6).toUpperCase(); }
  function uniq(list, key) { return new Set(list.map(key)).size; }
  function isGame(e) { return typeof e.kind === "string" && e.kind.indexOf("game_") === 0 && typeof e.game === "string"; }
  function isPage(e) { return e.kind === "view" || e.kind === "resume_locked" || e.kind === "resume_opened"; }
  function ms(e) { return Number.isFinite(e.durationMs) && e.durationMs >= 0 ? e.durationMs : 0; }
  function duration(n) {
    if (n < 1000) return n > 0 ? "<1 s" : "0 s";
    var sec = Math.floor(n / 1000), h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60;
    return (h ? h + " h " : "") + (m ? m + " min " : "") + (sec % 60 || (!h && !m) ? sec % 60 + " s" : "");
  }
  function human(s) {
    var words = String(s || "").split(/[_-]+/).join(" ");
    return words ? words.charAt(0).toUpperCase() + words.slice(1) : "";
  }
  function describe(e) {
    var r = RESUMES[e.path];
    if (e.kind === "section_seen") return "Reached section: " + human(e.label);
    if (e.kind === "site_action") return "Selected: " + human(e.label);
    if (e.kind === "page_active") return (e.label === "viewer_active" ? "Resume viewer active" : "Page active") + " for " + duration(ms(e));
    if (isGame(e)) {
      var title = GAMES[game(e)] || human(game(e));
      return title + " · " + ({game_join:"Player joined",game_start:"Round started",game_end:"Round ended",game_player_duration:"Player time recorded"}[e.kind] || human(e.kind));
    }
    if (r) return {
      resume_locked: "Opened the " + r + " resume login",
      resume_wrong: "Typed a wrong password on " + r,
      resume_unlocked: "Unlocked the " + r + " resume",
      resume_opened: "Opened the " + r + " resume viewer",
      resume_pdf_loaded: "PDF served for " + r,
      resume_download: "Download response for " + r,
      view: "Visited " + r + " resume"
    }[e.kind] || "Visited " + r + " resume";
    if (site(e) === "madfun" || site(e) === "beerio") {
      var g = game(e), name = GAMES[g] || g;
      if (!g) return "Browsed madfun games";
      if (g === "controller") return "Opened the host remote";
      return e.q ? "Opened room link for " + name : "Opened " + name;
    }
    if (e.path === "/") return "Visited the homepage";
    return "Visited " + e.path;
  }

  function scoped(ignoreSite) {
    var since = Date.now() - state.days * 864e5;
    return ALL.filter(function (e) {
      return e.t >= since && (state.mine || !e.owner || isGame(e)) && (ignoreSite || state.site === "all" || site(e) === state.site);
    });
  }

  function tiles(list) {
    var t = [["Visitors", uniq(list.filter(function (e) { return !isGame(e); }), function (e) { return e.vid; })], ["Page views", list.filter(isPage).length],
      ["Places", uniq(list.filter(function (e) { return isPage(e) && (e.city || e.country); }), place)]];
    if (state.site === "resumes") {
      var by = resumeRows(list);
      t = t.slice(0, 1).concat([["Unlocked", by.filter(function (r) { return r.unlocked; }).length, "good"],
        ["Wrong password only", by.filter(function (r) { return !r.unlocked && r.wrong; }).length, "bad"],
        ["Login only", by.filter(function (r) { return r.gate && !r.unlocked && !r.wrong; }).length],
        ["PDF served", by.filter(function (r) { return r.pdf; }).length],
        ["Download responses", list.filter(function (e) { return e.kind === "resume_download"; }).length]]);
    }
    if (state.site === "madfun") {
      var data = gameStats(list);
      t = t.concat([["Guest room joins", data.joins.size], ["Rounds started", data.matches.filter(function (m) { return m.started; }).length]]);
    }
    if (["all", "home", "resumes", "madfun", "beerio"].includes(state.site)) {
      t.push(["Active page time", duration(list.filter(function (e) { return e.kind === "page_active"; }).reduce(function (n,e) { return n + ms(e); },0))]);
    }
    document.getElementById("tiles").innerHTML = t.map(function (x) {
      return '<div class="tile ' + (x[2] || "") + '"><span>' + x[0] + "</span><b>" + x[1].toLocaleString() + "</b></div>";
    }).join("");
  }

  var map, layer;
  function places(list) {
    var groups = Object.create(null);
    list.filter(isPage).forEach(function (e) {
      var key = place(e);
      var g = groups[key] || (groups[key] = { name: key, cc: e.country, lat: e.lat, lon: e.lon, vids: {}, views: 0, pages: Object.create(null) });
      g.vids[e.vid] = 1; g.views++; g.pages[describe(e)] = 1;
      if (g.lat == null && e.lat != null) { g.lat = e.lat; g.lon = e.lon; }
    });
    var rows = Object.keys(groups).map(function (k) { var g = groups[k]; g.visitors = Object.keys(g.vids).length; return g; })
      .sort(function (a, b) { return b.visitors - a.visitors || b.views - a.views; });
    var top = rows.length ? rows[0].visitors : 1;
    document.getElementById("places").innerHTML = rows.length ? rows.map(function (g, i) {
      return '<li data-i="' + i + '"><span>' + flag(g.cc) + "</span><div>" + esc(g.name) + "<small>" + g.views + " page view" + (g.views === 1 ? "" : "s") +
        '</small><div class="bar" style="width:' + Math.max(4, (g.visitors / top) * 100) + '%"></div></div><span class="n">' + g.visitors + "</span></li>";
    }).join("") : '<li class="empty" style="display:block">No visits in this period.</li>';

    if (!window.L) { document.getElementById("map").innerHTML = '<div class="empty">Map unavailable.</div>'; return; }
    if (!map) {
      map = L.map("map", { worldCopyJump: true, scrollWheelZoom: false }).setView([25, -30], 2);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 12, referrerPolicy: "strict-origin", attribution: "&copy; OpenStreetMap contributors" }).addTo(map);
    }
    if (layer) layer.remove();
    layer = L.layerGroup().addTo(map);
    var markers = [];
    rows.forEach(function (g, i) {
      if (g.lat == null) return;
      var m = L.circleMarker([g.lat, g.lon], { radius: 6 + Math.sqrt(g.visitors) * 5, color: "#2457ff", weight: 2, fillColor: "#2457ff", fillOpacity: .35 })
        .bindPopup("<b>" + flag(g.cc) + " " + esc(g.name) + "</b><br>" + g.visitors + " visitor" + (g.visitors === 1 ? "" : "s") + " · " + g.views + " views<br><small>" +
          Object.keys(g.pages).slice(0, 5).map(esc).join("<br>") + "</small>");
      m.addTo(layer); markers.push(m); g.marker = m;
    });
    var located = markers.length, missing = rows.filter(function (g) { return g.lat == null; }).length;
    document.getElementById("mapnote").textContent = located + " place" + (located === 1 ? "" : "s") + (missing ? " · " + missing + " without location" : "");
    if (markers.length) map.fitBounds(L.featureGroup(markers).getBounds().pad(0.3), { maxZoom: 6 });
    setTimeout(function () { map.invalidateSize(); }, 0);
    document.querySelectorAll("#places li[data-i]").forEach(function (li) {
      li.addEventListener("click", function () { var g = rows[li.dataset.i]; if (g.marker) { map.setView(g.marker.getLatLng(), 8); g.marker.openPopup(); } });
    });
  }

  function resumeRows(list) {
    var rows = Object.create(null);
    list.filter(function (e) { return RESUMES[e.path]; }).forEach(function (e) {
      var key = e.vid + ":" + e.path;
      var r = rows[key] || (rows[key] = { e: e, resume: RESUMES[e.path], last: 0, wrong: 0, gate: false, unlocked: false, viewed: false, pdf: false, download: false, active: 0 });
      r.last = Math.max(r.last, e.t);
      if (e.kind === "resume_locked") r.gate = true;
      if (e.kind === "resume_wrong") r.wrong++;
      if (e.kind === "resume_unlocked") r.unlocked = true;
      if (e.kind === "resume_opened") { r.viewed = true; r.unlocked = true; }
      if (e.kind === "resume_pdf_loaded") { r.pdf = true; r.unlocked = true; }
      if (e.kind === "resume_download") { r.download = true; r.unlocked = true; }
      if (e.kind === "page_active") r.active += ms(e);
    });
    return Object.keys(rows).map(function (k) { return rows[k]; }).sort(function (a, b) { return b.last - a.last; });
  }

  function table(head, body, empty) {
    return '<div class="table"><table><thead><tr>' + head.map(function (h) { return "<th" + (h[1] ? ' class="num"' : "") + ">" + h[0] + "</th>"; }).join("") +
      "</tr></thead><tbody>" + (body.length ? body.join("") : '<tr><td class="empty" colspan="' + head.length + '">' + empty + "</td></tr>") + "</tbody></table></div>";
  }

  function gameStats(list) {
    var joins = new Set(), matches = new Map(), games = new Map(), rooms = new Map();
    var gameRows = list.filter(isGame).sort(function (a,b) { return a.t-b.t; });
    gameRows.forEach(function (e) {
      var g = games.get(e.game);
      if (!g) { g = { joins: new Set(), matches: [], roomLinks: 0, visits: new Set(), last: 0 }; games.set(e.game, g); }
      g.last = Math.max(g.last, e.t);
      var room = e.roomId || e.matchId, matchKey = e.game + ":" + e.matchId;
      var r = null;
      if (e.roomId) {
        var roomKey = e.game + ":" + e.roomId;
        r = rooms.get(roomKey);
        if (!r) { r = { game:e.game, start:e.t, end:e.t, players:new Map(), matches:new Set() }; rooms.set(roomKey,r); }
        r.end = Math.max(r.end,e.t);
        if (e.kind === "game_start") r.matches.add(matchKey);
      }
      if (e.kind === "game_join" && e.playerId) {
        if (r && !r.players.has(e.playerId)) r.players.set(e.playerId, r.players.size + 1);
        var joinKey = e.game + ":" + room + ":" + e.playerId;
        joins.add(joinKey); g.joins.add(joinKey);
      }
      if (e.kind === "game_join" || !e.matchId) return;
      var m = matches.get(matchKey);
      if (!m) {
        m = { game: e.game, room: r, start: e.t, started: false, ended: false, duration: null, estimated: false, players: new Map(), outcome: "" };
        matches.set(matchKey, m); g.matches.push(m);
      }
      if (r && !m.room) m.room = r;
      if (e.kind === "game_start") { m.start = e.t; m.started = true; }
      if (e.kind === "game_end") {
        if (!m.ended || (m.outcome !== "completed" && e.outcome === "completed")) {
          m.duration = Number.isFinite(e.durationMs) ? ms(e) : null;
          m.outcome = e.outcome; m.estimated = !!e.estimated;
        }
        m.ended = true;
      }
      if (e.kind === "game_player_duration" && e.playerId && Number.isFinite(e.durationMs)) {
        var old = m.players.get(e.playerId);
        if (!old || ms(e) >= old.ms) m.players.set(e.playerId, { ms: ms(e), estimated: !!e.estimated });
      }
    });
    list.filter(isPage).forEach(function (e) {
      if (site(e) !== "madfun" && site(e) !== "beerio") return;
      var key = game(e);
      if (!key || key === "controller" || key === "share") return;
      var g = games.get(key);
      if (!g) { g = { joins: new Set(), matches: [], roomLinks: 0, visits: new Set(), last: 0 }; games.set(key, g); }
      g.visits.add(e.vid); g.last = Math.max(g.last, e.t); if (e.q) g.roomLinks++;
    });
    return { joins: joins, games: games, rooms: Array.from(rooms.values()).sort(function (a,b) { return b.end - a.end; }), matches: Array.from(matches.values()).sort(function (a,b) { return b.start - a.start; }) };
  }

  function timedCell(msValue, estimated) {
    return msValue == null ? "—" : (estimated ? "≈ " : "") + esc(duration(msValue));
  }

  function gamesDetail(list) {
    var data = gameStats(list);
    var rows = Array.from(data.games.entries()).sort(function (a,b) { return b[1].last - a[1].last; }).map(function (pair) {
      var name = GAMES[pair[0]] || human(pair[0]), g = pair[1];
      var rounds = g.matches.filter(function (m) { return m.started; });
      var completed = g.matches.filter(function (m) { return m.ended && m.outcome === "completed" && m.duration != null; });
      var mean = completed.length ? completed.reduce(function (n,m) { return n + m.duration; },0) / completed.length : null;
      return "<tr><td>" + esc(name) + '</td><td class="num">' + g.visits.size + '</td><td class="num">' + g.roomLinks +
        '</td><td class="num">' + g.joins.size + '</td><td class="num">' + rounds.length + '</td><td class="num">' + timedCell(mean, completed.some(function(m){return m.estimated;})) + "</td></tr>";
    });
    var matchRows = data.matches.slice(0,75).map(function (m) {
      var measured = Array.from(m.players.values());
      var breakdown = Array.from(m.players.entries()).map(function (entry,i) {
        var known = m.room && m.room.players.get(entry[0]);
        return (known ? "Guest " + known : "Timed guest " + (i + 1)) + ": " + timedCell(entry[1].ms, entry[1].estimated);
      }).join("<br>");
      var playerTime = measured.length ? measured.reduce(function (n,p) { return n + p.ms; },0) : null;
      var max = measured.length ? Math.max.apply(null, measured.map(function (p) { return p.ms; })) : null;
      var status = m.outcome === "completed" ? "Completed" : m.outcome === "abandoned" ? "Abandoned" : m.ended ? "End observed" : "No end recorded";
      if (!m.started) status += " · start not recorded";
      return "<tr><td>" + esc(GAMES[m.game] || human(m.game)) + '<span class="sub">' + esc(status) + '</span></td><td>' + esc(when(m.start)) +
        '</td><td class="num">' + timedCell(m.duration, m.estimated) + '</td><td class="num">' + measured.length +
        '</td><td class="num">' + timedCell(playerTime, measured.some(function (p) { return p.estimated; })) +
        '</td><td class="num">' + timedCell(max, measured.some(function (p) { return p.estimated; })) + "</td><td>" +
        (breakdown ? "<details><summary>Guest times</summary>" + breakdown + "</details>" : "—") + "</td></tr>";
    });
    var roomRows = data.rooms.slice(0,50).map(function (r) {
      return "<tr><td>" + esc(GAMES[r.game] || human(r.game)) + "</td><td>" + esc(when(r.start)) + '</td><td class="num">' +
        r.players.size + '</td><td class="num">' + r.matches.size + '</td><td class="num">' +
        timedCell(r.end > r.start ? r.end - r.start : null, true) + "</td></tr>";
    });
    return '<section class="card section"><h2>Games</h2><p class="note">Room link opens include visitors who never joined. Guest room joins are accepted guest slots, not unique people across rooms. Guest game activity includes games you hosted. New measurements only; earlier visits aren’t backfilled.</p>' +
      table([["Game"], ["Browsers",1], ["Link opens",1], ["Guest room joins",1], ["Rounds started",1], ["Avg. completed round",1]],rows,"No game activity in this period.") +
      '</section><section class="card section"><h2>Recent rooms <span>up to 50</span></h2><p class="note">Observed room span runs from the first to the last event received; it can include lobby time and gaps and does not measure the exact room lifetime.</p>' +
      table([["Game"],["First recorded"],["Guest joins",1],["Rounds started",1],["Observed span",1]],roomRows,"No rooms recorded yet.") +
      '</section><section class="card section"><h2>Recent rounds <span>up to 75</span></h2><p class="note">Player time adds up recorded guest times and can exceed round time. Missing end events stay unknown; ≈ marks estimates.</p>' +
      table([["Game"],["First recorded"],["Round time",1],["Guests timed",1],["Total guest time",1],["Longest guest time",1],["Details"]],matchRows,"No measured rounds yet.") + "</section>";
  }

  function sessionsDetail(list) {
    var byBrowser = new Map(), sessions = [];
    list.slice().reverse().forEach(function (e) {
      if (isGame(e)) return;
      var b = byBrowser.get(e.vid);
      if (!b) { b = { latest: null, tabs: new Map() }; byBrowser.set(e.vid, b); }
      var previous = e.sid ? b.tabs.get(e.sid) : b.latest;
      // Unkeyed page and gate events cannot tell tabs apart. Where possible,
      // attach them to the most recent plausible tab session from this browser.
      var r = previous;
      if (!r && e.sid && b.latest && !b.latest.sid) r = b.latest;
      if (!r || e.t - r.end > 30 * 60 * 1000) {
        r = { first: e.t, end: e.t, vid: e.vid, sid: e.sid, active: 0, viewerActive: 0, activity: [], pages: new Set(), activePages: new Map() };
        sessions.push(r);
      }
      if (e.sid) { r.sid = e.sid; b.tabs.set(e.sid, r); }
      b.latest = r; r.end = Math.max(r.end,e.t); r.pages.add(e.path);
      if (e.kind === "page_active") {
        r.active += ms(e);
        r.activePages.set(e.path,(r.activePages.get(e.path) || 0) + ms(e));
        if (e.label === "viewer_active") r.viewerActive += ms(e);
        return;
      }
      var last = r.activity[r.activity.length - 1];
      if (!last || last.path !== e.path || last.kind !== e.kind || last.label !== e.label || e.t - last.t > 1500) r.activity.push(e);
    });
    var rows = sessions.sort(function(a,b){return b.end-a.end;}).slice(0,100);
    return '<section class="card section"><h2>Browser sessions <span>' + rows.length + ' of ' + sessions.length + '</span></h2>' +
      '<p class="note">Events are grouped by browser, tab when available, and 30 minutes of inactivity. Active time is estimated from visible, non-idle activity; it is not time spent reading. “PDF served” and “download response” do not prove a PDF was read or saved. Older sessions may have no active time recorded.</p>' +
      (rows.length ? rows.map(function (r) {
        var time = r.active ? duration(r.active) + " active" : "no active time recorded";
        var pageTimes = Array.from(r.activePages.entries()).map(function (pair) { return pair[0] + " (" + duration(pair[1]) + " active)"; });
        var viewer = r.viewerActive ? " · " + duration(r.viewerActive) + " viewer active" : "";
        var subset = r.activity.slice(-60);
        var timeline = subset.map(function (e) {
          return '<li><span class="sessionpath">' + esc(when(e.t)) + "</span>" + esc(describe(e)) + "</li>";
        }).join("");
        if (r.activity.length > subset.length) timeline = "<li>Earlier events not shown</li>" + timeline;
        return '<details class="session"><summary>' + who(r.vid) + ' · ' + esc(when(r.first)) +
          '<span class="sessionmeta">' + esc(time + viewer) + " · " + r.pages.size + " page" + (r.pages.size !== 1 ? "s" : "") + "</span></summary>" +
          '<p class="note">' + esc(pageTimes.length ? pageTimes.join(" · ") : Array.from(r.pages).join(" · ")) + (r.end !== r.first ? " · observed span " + esc(duration(r.end-r.first)) : "") + '</p>' +
          (timeline ? "<ol>" + timeline + "</ol>" : '<p class="note">Only active time was recorded.</p>') + "</details>";
      }).join("") : '<p class="empty">No browser sessions in this period.</p>') + "</section>";
  }

  function detail(list) {
    var el = document.getElementById("detail"), html = "";
    if (state.site === "all") {
      var all = scoped(true);
      html = '<section class="card section"><h2>By site <span>this period</span></h2>' + table([["Site"], ["Visitors", 1], ["Page views", 1], ["Last visit", 1]],
        SITES.slice(1).map(function (s) {
          var l = all.filter(function (e) { return !isGame(e) && site(e) === s[0]; });
          if (!l.length) return "";
          return "<tr><td>" + s[1] + '</td><td class="num">' + uniq(l, function (e) { return e.vid; }) + '</td><td class="num">' + l.filter(isPage).length + '</td><td class="num">' + ago(l[0].t) + "</td></tr>";
        }).filter(Boolean), "No visits in this period.") + "</section>";
    }
    if (state.site === "resumes") {
      html = '<section class="card section"><h2>Resume progress <span>one row per browser and version</span></h2>' +
        table([["Visitor"], ["Where"], ["Resume"], ["Progress"], ["Active", 1], ["Last seen", 1]], resumeRows(list).map(function (r) {
          var pill = r.unlocked ? '<span class="pill good">Unlocked' + (r.wrong ? " · " + r.wrong + " failed" : "") + "</span>"
            : r.wrong ? '<span class="pill bad">Wrong password × ' + r.wrong + "</span>" : '<span class="pill mute">No unlock recorded</span>';
          if (r.viewed) pill += ' <span class="pill mute">Viewer opened</span>';
          if (r.pdf) pill += ' <span class="pill mute">PDF served</span>';
          if (r.download) pill += ' <span class="pill warn">Download response</span>';
          return "<tr><td>" + who(r.e.vid) + '<span class="sub">' + esc(r.e.browser) + "</span></td><td>" + flag(r.e.country) + " " + esc(place(r.e)) +
            "</td><td>" + r.resume + "</td><td>" + pill + '</td><td class="num">' + (r.active ? esc(duration(r.active)) : "—") + '</td><td class="num">' + ago(r.last) + '<span class="sub">' + when(r.last) + "</span></td></tr>";
        }), "Nobody has opened a resume link in this period.") + "</section>";
    }
    if (state.site === "madfun") html += gamesDetail(list);
    if (["all", "home", "resumes", "madfun", "beerio"].includes(state.site)) html += sessionsDetail(list);
    el.innerHTML = html;
  }

  function recent(list) {
    list = list.filter(function (e) { return e.kind !== "page_active" && e.kind !== "game_player_duration"; });
    var rows = list.slice(0, 150);
    document.getElementById("recentnote").textContent = list.length > 150 ? "latest 150 of " + list.length : list.length + " events";
    document.getElementById("recent").innerHTML = table([["When"], ["Visitor"], ["Where"], ["What"], ["Device"], ["Came from"]], rows.map(function (e) {
      var bad = e.kind === "resume_wrong", good = e.kind === "resume_unlocked";
      return '<tr><td style="white-space:nowrap">' + ago(e.t) + '<span class="sub">' + when(e.t) + "</span></td><td>" + (isGame(e) ? "Game telemetry" : who(e.vid)) + (e.owner && !isGame(e) ? ' <span class="pill mute">you</span>' : "") +
        "</td><td>" + flag(e.country) + " " + esc(place(e)) + "</td><td>" + (bad ? '<span class="pill bad">' : good ? '<span class="pill good">' : "<span>") + esc(describe(e)) + "</span>" +
        "</td><td>" + esc(e.device) + '<span class="sub">' + esc(e.browser) + "</span></td><td>" + esc(e.ref || "Direct") + "</td></tr>";
    }), "No activity in this period.");
  }

  function render() {
    try { localStorage.setItem("ss-internal", JSON.stringify(state)); } catch (e) {}
    var base = scoped(true);
    document.getElementById("tabs").innerHTML = SITES.map(function (s) {
      return '<button data-s="' + s[0] + '" class="' + (state.site === s[0] ? "on" : "") + '">' + s[1] + "<b>" + uniq(base.filter(function (e) { return !isGame(e) && (s[0] === "all" || site(e) === s[0] || (s[0] === "madfun" && site(e) === "beerio")); }), function (e) { return e.vid; }) + "</b></button>";
    }).join("");
    document.querySelectorAll("#tabs button").forEach(function (b) { b.onclick = function () { state.site = b.dataset.s; render(); }; });
    document.querySelectorAll("#range button").forEach(function (b) { b.classList.toggle("on", Number(b.dataset.d) === state.days); });
    document.getElementById("mine").checked = state.mine;
    var list = scoped(false);
    if (state.site === "madfun") {
      list = base.filter(function (e) { return site(e) === "madfun" || site(e) === "beerio"; });
    }
    tiles(list); places(list); detail(list); recent(list);
  }
  document.querySelectorAll("#range button").forEach(function (b) { b.onclick = function () { state.days = Number(b.dataset.d); render(); }; });
  document.getElementById("mine").onchange = function (e) { state.mine = e.target.checked; render(); };
  render();
})();
</script></body></html>`;
}
