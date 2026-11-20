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
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
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
  var ALL = JSON.parse(document.getElementById("events").textContent);
  var RESUMES = { "/resume": "Big Tech", "/cv": "AI Labs", "/suraaj_resume": "Quant" };
  var GAMES = { "": "madfun home", "beerio": "Beerio", "beerio-2": "Beerio 2", "boomerang": "Ricochet", "bump-club": "Bump Club",
    "floor-is-trouble": "Floor Is Trouble", "simulator": "The Simulator", "jeopardy": "Eesha Lore Night", "codewords": "Codewords",
    "inside-ranks": "Inside Ranks", "controller": "Host remote" };
  var SITES = [["all", "All sites"], ["home", "Homepage"], ["resumes", "Resumes"], ["madfun", "madfun"], ["beerio", "Beerio"], ["other", "Other pages"]];
  var state = { days: 7, site: "all", mine: false };
  try { var saved = JSON.parse(localStorage.getItem("ss-internal") || "{}"); for (var k in saved) state[k] = saved[k]; } catch (e) {}

  function site(e) {
    var p = e.path;
    if (p === "/") return "home";
    if (RESUMES[p]) return "resumes";
    if (p === "/madfun" || p.indexOf("/madfun/") === 0) return "madfun";
    if (p === "/beerio" || p.indexOf("/beerio/") === 0) return "beerio";
    return "other";
  }
  function game(e) { var m = e.path.match(/^\\/madfun\\/?([^/]*)/); return m ? m[1] : ""; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function flag(cc) { return cc && cc.length === 2 ? String.fromCodePoint.apply(null, cc.toUpperCase().split("").map(function (c) { return 127397 + c.charCodeAt(0); })) : "🌐"; }
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
  function who(vid) { return "Visitor " + vid.replace(/[^a-z0-9]/gi, "").slice(0, 4).toUpperCase(); }
  function uniq(list, key) { var s = {}; list.forEach(function (e) { s[key(e)] = 1; }); return Object.keys(s).length; }
  function describe(e) {
    var r = RESUMES[e.path];
    if (r) return {
      resume_locked: "Opened the " + r + " resume login",
      resume_wrong: "Typed a wrong password on " + r,
      resume_unlocked: "Unlocked the " + r + " resume",
      resume_opened: "Viewed the " + r + " resume",
      resume_download: "Downloaded the " + r + " resume",
      view: "Visited " + r + " resume"
    }[e.kind];
    if (site(e) === "madfun") {
      var g = game(e), name = GAMES[g] || g;
      if (!g) return "Browsed madfun games";
      if (g === "controller") return "Opened the host remote";
      return e.q ? "Joined " + name + " as a player" : "Opened " + name;
    }
    if (e.path === "/") return "Visited the homepage";
    return "Visited " + e.path;
  }

  function scoped(ignoreSite) {
    var since = Date.now() - state.days * 864e5;
    return ALL.filter(function (e) {
      return e.t >= since && (state.mine || !e.owner) && (ignoreSite || state.site === "all" || site(e) === state.site);
    });
  }

  function tiles(list) {
    var t = [["Visitors", uniq(list, function (e) { return e.vid; })], ["Page views", list.filter(function (e) { return e.kind === "view" || e.kind === "resume_locked" || e.kind === "resume_opened"; }).length],
      ["Places", uniq(list.filter(function (e) { return e.city || e.country; }), place)]];
    if (state.site === "resumes") {
      var by = resumeRows(list);
      t = t.slice(0, 1).concat([["Unlocked", by.filter(function (r) { return r.unlocked; }).length, "good"],
        ["Wrong password only", by.filter(function (r) { return !r.unlocked && r.wrong; }).length, "bad"],
        ["Saw login, didn’t try", by.filter(function (r) { return !r.unlocked && !r.wrong; }).length],
        ["Downloads", list.filter(function (e) { return e.kind === "resume_download"; }).length]]);
    }
    if (state.site === "madfun") {
      var players = list.filter(function (e) { return e.q; });
      t = t.concat([["Game rooms joined", uniq(players, function (e) { return game(e) + e.q; })], ["Players", uniq(players, function (e) { return e.vid; })]]);
    }
    document.getElementById("tiles").innerHTML = t.map(function (x) {
      return '<div class="tile ' + (x[2] || "") + '"><span>' + x[0] + "</span><b>" + x[1].toLocaleString() + "</b></div>";
    }).join("");
  }

  var map, layer;
  function places(list) {
    var groups = {};
    list.forEach(function (e) {
      var key = place(e);
      var g = groups[key] || (groups[key] = { name: key, cc: e.country, lat: e.lat, lon: e.lon, vids: {}, views: 0, pages: {} });
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
        maxZoom: 12, attribution: "&copy; OpenStreetMap contributors" }).addTo(map);
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
    var rows = {};
    list.filter(function (e) { return RESUMES[e.path]; }).forEach(function (e) {
      var key = e.vid + e.path;
      var r = rows[key] || (rows[key] = { e: e, resume: RESUMES[e.path], last: 0, wrong: 0, unlocked: false, viewed: false, download: false });
      r.last = Math.max(r.last, e.t);
      if (e.kind === "resume_wrong") r.wrong++;
      if (e.kind === "resume_unlocked") r.unlocked = true;
      if (e.kind === "resume_opened") { r.viewed = true; r.unlocked = true; }
      if (e.kind === "resume_download") { r.download = true; r.unlocked = true; }
    });
    return Object.keys(rows).map(function (k) { return rows[k]; }).sort(function (a, b) { return b.last - a.last; });
  }

  function table(head, body, empty) {
    return '<div class="table"><table><thead><tr>' + head.map(function (h) { return "<th" + (h[1] ? ' class="num"' : "") + ">" + h[0] + "</th>"; }).join("") +
      "</tr></thead><tbody>" + (body.length ? body.join("") : '<tr><td class="empty" colspan="' + head.length + '">' + empty + "</td></tr>") + "</tbody></table></div>";
  }

  function detail(list) {
    var el = document.getElementById("detail"), html = "";
    if (state.site === "all") {
      var all = scoped(true);
      html = '<section class="card section"><h2>By site <span>this period</span></h2>' + table([["Site"], ["Visitors", 1], ["Page views", 1], ["Last visit", 1]],
        SITES.slice(1).map(function (s) {
          var l = all.filter(function (e) { return site(e) === s[0]; });
          if (!l.length) return "";
          return "<tr><td>" + s[1] + '</td><td class="num">' + uniq(l, function (e) { return e.vid; }) + '</td><td class="num">' + l.length + '</td><td class="num">' + ago(l[0].t) + "</td></tr>";
        }).filter(Boolean), "No visits in this period.") + "</section>";
    }
    if (state.site === "resumes") {
      html = '<section class="card section"><h2>Who opened a resume <span>one row per visitor per resume</span></h2>' +
        table([["Visitor"], ["Where"], ["Resume"], ["Password"], ["Last seen", 1]], resumeRows(list).map(function (r) {
          var pill = r.unlocked ? '<span class="pill good">Unlocked' + (r.wrong ? " after " + r.wrong + " wrong" : "") + "</span>"
            : r.wrong ? '<span class="pill bad">Wrong password × ' + r.wrong + "</span>" : '<span class="pill mute">Didn’t type one</span>';
          if (r.download) pill += ' <span class="pill warn">Downloaded</span>';
          return "<tr><td>" + who(r.e.vid) + '<span class="sub">' + esc(r.e.browser) + "</span></td><td>" + flag(r.e.country) + " " + esc(place(r.e)) +
            "</td><td>" + r.resume + "</td><td>" + pill + '</td><td class="num">' + ago(r.last) + '<span class="sub">' + when(r.last) + "</span></td></tr>";
        }), "Nobody has opened a resume link in this period.") + "</section>";
    }
    if (state.site === "madfun") {
      var games = {};
      list.forEach(function (e) {
        var g = game(e), x = games[g] || (games[g] = { name: GAMES[g] || g, vids: {}, players: {}, rooms: {}, opens: 0, last: 0 });
        x.vids[e.vid] = 1; x.last = Math.max(x.last, e.t);
        if (e.q) { x.players[e.vid] = 1; x.rooms[e.q] = 1; } else x.opens++;
      });
      html = '<section class="card section"><h2>Games <span>players = people who joined from a phone</span></h2>' +
        table([["Game"], ["Visitors", 1], ["Opened", 1], ["Players", 1], ["Rooms", 1], ["Last activity", 1]],
          Object.keys(games).map(function (k) { return games[k]; }).sort(function (a, b) { return b.last - a.last; }).map(function (x) {
            return "<tr><td>" + esc(x.name) + '</td><td class="num">' + Object.keys(x.vids).length + '</td><td class="num">' + x.opens + '</td><td class="num">' +
              Object.keys(x.players).length + '</td><td class="num">' + Object.keys(x.rooms).length + '</td><td class="num">' + ago(x.last) + "</td></tr>";
          }), "No madfun visits in this period.") + "</section>";
    }
    el.innerHTML = html;
  }

  function recent(list) {
    var rows = list.slice(0, 150);
    document.getElementById("recentnote").textContent = list.length > 150 ? "latest 150 of " + list.length : list.length + " events";
    document.getElementById("recent").innerHTML = table([["When"], ["Visitor"], ["Where"], ["What"], ["Device"], ["Came from"]], rows.map(function (e) {
      var bad = e.kind === "resume_wrong", good = e.kind === "resume_unlocked";
      return '<tr><td style="white-space:nowrap">' + ago(e.t) + '<span class="sub">' + when(e.t) + "</span></td><td>" + who(e.vid) + (e.owner ? ' <span class="pill mute">you</span>' : "") +
        "</td><td>" + flag(e.country) + " " + esc(place(e)) + "</td><td>" + (bad ? '<span class="pill bad">' : good ? '<span class="pill good">' : "<span>") + esc(describe(e)) + "</span>" +
        "</td><td>" + esc(e.device) + '<span class="sub">' + esc(e.browser) + "</span></td><td>" + esc(e.ref || "Direct") + "</td></tr>";
    }), "No activity in this period.");
  }

  function render() {
    try { localStorage.setItem("ss-internal", JSON.stringify(state)); } catch (e) {}
    var base = scoped(true);
    document.getElementById("tabs").innerHTML = SITES.map(function (s) {
      return '<button data-s="' + s[0] + '" class="' + (state.site === s[0] ? "on" : "") + '">' + s[1] + "<b>" + uniq(base.filter(function (e) { return s[0] === "all" || site(e) === s[0]; }), function (e) { return e.vid; }) + "</b></button>";
    }).join("");
    document.querySelectorAll("#tabs button").forEach(function (b) { b.onclick = function () { state.site = b.dataset.s; render(); }; });
    document.querySelectorAll("#range button").forEach(function (b) { b.classList.toggle("on", Number(b.dataset.d) === state.days); });
    document.getElementById("mine").checked = state.mine;
    var list = scoped(false);
    tiles(list); places(list); detail(list); recent(list);
  }
  document.querySelectorAll("#range button").forEach(function (b) { b.onclick = function () { state.days = Number(b.dataset.d); render(); }; });
  document.getElementById("mine").onchange = function (e) { state.mine = e.target.checked; render(); };
  render();
})();
</script></body></html>`;
}
