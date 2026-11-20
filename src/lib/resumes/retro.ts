// Late-90s desktop chrome for the resume routes: a boot + logon screen in front
// of the password form, and a desktop that opens the PDF in a window.
// Plain HTML strings; the client scripts avoid template literals on purpose.

const CHROME_CSS = `
*{box-sizing:border-box}
:root{--teal:#008080;--face:#c0c0c0;--hi:#fff;--lt:#dfdfdf;--lo:#808080;--dk:#0a0a0a;--navy:#000080}
html,body{height:100%}
body{margin:0;background:var(--teal);color:#000;overflow:hidden;
  font:12px/1.35 Tahoma,Verdana,Geneva,"Segoe UI",sans-serif;-webkit-font-smoothing:none;
  user-select:none;-webkit-user-select:none}
button,input{font:inherit;color:inherit}
.raised{background:var(--face);box-shadow:inset -1px -1px var(--dk),inset 1px 1px var(--hi),inset -2px -2px var(--lo),inset 2px 2px var(--lt)}
.sunken{box-shadow:inset -1px -1px var(--hi),inset 1px 1px var(--lo),inset -2px -2px var(--lt),inset 2px 2px var(--dk)}
.win{position:absolute;padding:3px;display:flex;flex-direction:column}
.title{display:flex;align-items:center;gap:4px;height:20px;padding:0 2px 0 4px;color:#fff;font-weight:700;
  background:linear-gradient(90deg,var(--navy),#1084d0);white-space:nowrap;overflow:hidden}
.title span{flex:1;overflow:hidden;text-overflow:ellipsis}
.title.idle{background:linear-gradient(90deg,var(--lo),#b5b5b5);color:var(--lt)}
.tbtn{width:16px;height:14px;padding:0;border:0;display:grid;place-items:center;cursor:pointer;flex-shrink:0}
.tbtn:active{box-shadow:inset 1px 1px var(--dk),inset -1px -1px var(--hi),inset 2px 2px var(--lo)}
.tbtn svg{display:block}
.btn{min-width:75px;height:23px;padding:0 10px;border:0;cursor:pointer}
.btn:active{box-shadow:inset 1px 1px var(--dk),inset -1px -1px var(--hi),inset 2px 2px var(--lo),inset -2px -2px var(--lt)}
.btn:focus-visible{outline:1px dotted #000;outline-offset:-5px}
.field{height:21px;padding:3px 4px;border:0;background:#fff;outline:none;width:100%}
`;

const CLOSE_SVG = '<svg width="8" height="7" viewBox="0 0 8 7"><path d="M0 0h2l2 2 2-2h2L5 3.5 8 7H6L4 5 2 7H0l3-3.5z"/></svg>';

const BRAND = `<div class="brand"><div class="mark"><i></i><i></i><i></i></div>
<div class="word">Suraaj<b>OS</b><sup>98</sup></div></div>`;

const BRAND_CSS = `
.brand{display:flex;align-items:center;gap:18px}
.mark{position:relative;width:64px;height:64px;flex-shrink:0}
.mark i{position:absolute;width:38px;height:38px;border:2px solid #000}
.mark i:nth-child(1){left:0;top:0;background:#ffd400}
.mark i:nth-child(2){left:13px;top:13px;background:#00a6a6}
.mark i:nth-child(3){left:26px;top:26px;background:#1a3fd6}
.word{font:italic 700 44px/1 "Arial Black",Arial,sans-serif;letter-spacing:-.03em;color:#fff}
.word b{color:#ff8a00;font-weight:900;margin-left:4px}
.word sup{font:700 18px/1 Arial,sans-serif;color:#9fd7ff;margin-left:4px;vertical-align:top}
`;

export function loginPage(error: boolean) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Suraaj Samanta · Log On</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=VT323&display=swap" rel="stylesheet">
<style>${CHROME_CSS}${BRAND_CSS}
.screen{position:fixed;inset:0;z-index:10;display:none;cursor:none}
body[data-phase=bios] #bios,body[data-phase=splash] #splash{display:block}
body[data-phase=bios] main,body[data-phase=splash] main{visibility:hidden}
#bios{background:#000;color:#bdbdbd;font:20px/1.25 VT323,"Courier New",monospace;padding:28px 32px;white-space:pre-wrap}
#bios .hd{display:flex;justify-content:space-between;gap:16px;color:#fff}
#bios .star{color:#55ff55}
#bios .foot{position:absolute;left:32px;right:32px;bottom:24px;color:#bdbdbd}
#bios .cur{display:inline-block;width:10px;height:3px;background:#bdbdbd;vertical-align:baseline;animation:blink .5s steps(1) infinite}
#splash{background:radial-gradient(ellipse at 50% 40%,#1b2a8a 0,#05071d 70%)}
#splash .center{position:absolute;inset:0;display:grid;place-items:center}
#splash .tag{color:#9fb3ff;font:13px Tahoma,sans-serif;letter-spacing:.2em;text-transform:uppercase;margin-top:18px;text-align:center}
#splash .bar{position:absolute;left:0;right:0;bottom:0;height:10px;overflow:hidden;background:#000}
#splash .bar i{position:absolute;inset:0;width:200%;
  background:repeating-linear-gradient(90deg,#000 0,#1a3fd6 25%,#9fd7ff 50%,#1a3fd6 75%,#000 100%);
  background-size:50% 100%;animation:slide 1.1s linear infinite}
@keyframes slide{to{transform:translateX(-50%)}}
@keyframes blink{50%{opacity:0}}
@keyframes pop{from{transform:translate(-50%,-50%) scale(.96);opacity:0}}
main{position:fixed;inset:0}
.dialog{left:50%;top:50%;transform:translate(-50%,-50%);width:min(420px,calc(100vw - 32px))}
body[data-phase=login] .dialog{animation:pop .12s steps(3)}
.body{display:grid;grid-template-columns:auto 1fr auto;gap:14px;padding:14px 10px 12px}
.key{width:42px;height:42px}
.copy p{margin:0 0 12px}
.copy label{display:grid;grid-template-columns:78px 1fr;align-items:center;margin-bottom:8px}
.copy .u{text-decoration:underline}
.actions{display:grid;gap:6px;align-content:start}
.msg{z-index:5;width:min(340px,calc(100vw - 48px))}
.msg .body{grid-template-columns:auto 1fr;align-items:center}
.msg .ok{grid-column:1/-1;justify-self:center}
.err{width:32px;height:32px;border-radius:50%;background:#e00;display:grid;place-items:center;border:1px solid #600}
.err svg{fill:#fff}
.hint{position:fixed;left:0;right:0;bottom:10px;text-align:center;color:#c8ffff;font-size:11px;opacity:.85}
body.wait,body.wait *{cursor:wait!important}
@media (max-width:420px){.body{grid-template-columns:1fr}.key{display:none}.actions{grid-auto-flow:column;justify-content:end}}
</style></head>
<body data-phase="login"${error ? ' data-error=""' : ""}>
<div id="bios" class="screen" aria-hidden="true">
  <div class="hd"><span>SuraajBIOS (C) 1998 Suraaj Samanta Systems, Inc.</span><span class="star">&#9733; ENERGY SAVER</span></div>
<div id="biosout"></div><span class="cur"></span>
  <div class="foot">Press DEL to enter SETUP &nbsp;&nbsp; 11/19/98-SS-RESUME-6A69KS4FC-00</div>
</div>
<div id="splash" class="screen" aria-hidden="true">
  <div class="center"><div>${BRAND}<div class="tag">Starting up&hellip;</div></div></div>
  <div class="bar"><i></i></div>
</div>
<main>
  <form id="logon" class="win raised dialog" method="post">
    <div class="title"><span>Welcome to SuraajOS</span>
      <button type="button" class="tbtn raised" aria-label="Close" data-clear>${CLOSE_SVG}</button></div>
    <div class="body">
      <svg class="key" viewBox="0 0 42 42" aria-hidden="true">
        <rect x="2" y="16" width="22" height="16" fill="#ffd400" stroke="#000" stroke-width="2"/>
        <rect x="7" y="21" width="12" height="6" fill="#806000"/>
        <circle cx="30" cy="12" r="8" fill="#ffd400" stroke="#000" stroke-width="2"/>
        <circle cx="30" cy="12" r="3" fill="#008080"/>
        <path d="M24 18l-6 6 3 3" fill="none" stroke="#000" stroke-width="2"/>
      </svg>
      <div class="copy">
        <p>Type a password to log on to Suraaj Samanta&rsquo;s resume.</p>
        <label><span><span class="u">U</span>ser name:</span>
          <input class="field sunken" value="recruiter" readonly tabindex="-1" aria-label="User name"></label>
        <label><span><span class="u">P</span>assword:</span>
          <input class="field sunken" id="pw" type="password" name="password" autocomplete="current-password"
            aria-label="Password" required autofocus></label>
      </div>
      <div class="actions">
        <button class="btn raised" type="submit">OK</button>
        <button class="btn raised" type="button" data-clear>Cancel</button>
      </div>
    </div>
  </form>
  ${
    error
      ? `<div id="msg" class="win raised dialog msg" role="alertdialog" aria-labelledby="msgtext">
    <div class="title"><span>Logon Message</span>
      <button type="button" class="tbtn raised" aria-label="Close" data-dismiss>${CLOSE_SVG}</button></div>
    <div class="body">
      <div class="err" aria-hidden="true"><svg width="14" height="12" viewBox="0 0 8 7"><path d="M0 0h2l2 2 2-2h2L5 3.5 8 7H6L4 5 2 7H0l3-3.5z"/></svg></div>
      <div id="msgtext">The password you typed is incorrect. Please try again.</div>
      <button class="btn raised ok" type="button" data-dismiss autofocus>OK</button>
    </div>
  </div>`
      : ""
  }
  <div class="hint">SuraajOS 98 &middot; suraaj.me</div>
</main>
<script>
(function () {
  var body = document.body, pw = document.getElementById("pw"), timers = [];
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function login() {
    timers.forEach(clearTimeout); timers = [];
    body.dataset.phase = "login";
    document.removeEventListener("keydown", login); document.removeEventListener("pointerdown", login);
    var msg = document.getElementById("msg");
    (msg ? msg.querySelector(".ok") : pw).focus();
  }
  document.querySelectorAll("[data-clear]").forEach(function (b) {
    b.addEventListener("click", function () { pw.value = ""; pw.focus(); });
  });
  document.querySelectorAll("[data-dismiss]").forEach(function (b) {
    b.addEventListener("click", function () { document.getElementById("msg").remove(); pw.focus(); });
  });
  document.getElementById("logon").addEventListener("submit", function () { body.classList.add("wait"); });

  var seen = false;
  try { seen = sessionStorage.getItem("ssos-booted") === "1"; sessionStorage.setItem("ssos-booted", "1"); } catch (e) {}
  var calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (body.hasAttribute("data-error") || seen || calm) return login();

  body.dataset.phase = "bios";
  document.addEventListener("keydown", login); document.addEventListener("pointerdown", login);
  var out = document.getElementById("biosout");
  function line(text) { out.appendChild(document.createTextNode(text + "\\n")); }
  line(""); line("Suraaj Neural Engine-II CPU at 233MHz");
  var mem = document.createTextNode(""); out.appendChild(mem); out.appendChild(document.createTextNode("\\n"));
  var kb = 0, total = 65536;
  (function count() {
    kb = Math.min(total, kb + 4096);
    mem.data = "Memory Test : " + kb + "K" + (kb === total ? " OK" : "");
    if (kb < total) later(count, 40);
  })();
  var lines = [
    "", "Detecting IDE Primary Master ... GEORGIA_TECH_CS",
    "Detecting IDE Primary Slave  ... RESUME_DISK 2026",
    "Detecting IDE Secondary Master... None", "",
    "Loading drivers: pytorch.sys  cuda.vxd  kdb.drv  agents.dll", "",
    "Verifying DMI Pool Data ........ OK", "Boot from C: ..."
  ];
  lines.forEach(function (t, i) { later(function () { line(t); }, 750 + i * 150); });
  later(function () { body.dataset.phase = "splash"; }, 750 + lines.length * 150 + 450);
  later(login, 750 + lines.length * 150 + 450 + 1900);
})();
</script>
<script src="/journey-analytics.js" defer></script>
</body></html>`;
}

const ICONS = {
  computer: `<svg viewBox="0 0 32 32"><rect x="3" y="3" width="26" height="19" fill="#c0c0c0" stroke="#000"/><rect x="6" y="6" width="20" height="13" fill="#000080"/><path d="M8 9h9M8 12h12M8 15h6" stroke="#9fd7ff"/><rect x="11" y="22" width="10" height="3" fill="#808080" stroke="#000"/><rect x="5" y="25" width="22" height="4" fill="#c0c0c0" stroke="#000"/></svg>`,
  doc: `<svg viewBox="0 0 32 32"><path d="M6 2h14l6 6v22H6z" fill="#fff" stroke="#000"/><path d="M20 2v6h6" fill="#c0c0c0" stroke="#000"/><path d="M9 12h14M9 15h14M9 18h10" stroke="#808080"/><rect x="4" y="21" width="17" height="8" fill="#e00" stroke="#000"/><text x="12.5" y="27.5" text-anchor="middle" font-family="Arial" font-weight="700" font-size="7" fill="#fff">PDF</text></svg>`,
  globe: `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="#1a3fd6" stroke="#000"/><path d="M9 8c3 1 4 4 2 6s1 5 4 4 2 5 0 7M20 5c-1 3 1 4 3 4s3 3 1 5 0 4 3 3" fill="none" stroke="#55ff55" stroke-width="2.5"/><circle cx="16" cy="16" r="13" fill="none" stroke="#000"/></svg>`,
  bin: `<svg viewBox="0 0 32 32"><path d="M7 8h18l-2 21H9z" fill="#dfdfdf" stroke="#000"/><path d="M5 6h22v3H5z" fill="#c0c0c0" stroke="#000"/><path d="M12 11l1 15M16 11v15M20 11l-1 15" stroke="#808080"/></svg>`,
};

export function desktopPage(path: string) {
  const pdf = `${path}?view=pdf`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Suraaj Samanta · Resume</title>
<style>${CHROME_CSS}${BRAND_CSS}
#icons{position:absolute;left:8px;top:8px;display:grid;gap:14px;grid-auto-rows:min-content;z-index:1}
.icon{width:76px;display:grid;justify-items:center;gap:3px;padding:2px;border:0;background:none;color:#fff;
  cursor:default;text-decoration:none;text-align:center}
.icon svg{width:32px;height:32px}
.icon b{font-weight:400;padding:1px 2px;text-shadow:1px 1px #000;word-break:break-word}
.icon:focus{outline:none}
.icon.sel svg{filter:brightness(.6) sepia(1) hue-rotate(190deg) saturate(4)}
.icon.sel b{background:var(--navy);outline:1px dotted #ff0;text-shadow:none}
#win{left:120px;top:20px;width:min(880px,calc(100vw - 140px));height:calc(100vh - 72px);z-index:3}
#win.max{left:0!important;top:0!important;width:100%!important;height:calc(100% - 28px)!important}
body:not(.open) #win{display:none}
.menu{display:flex;gap:2px;padding:2px 0}
.menu span{padding:1px 6px}
.menu span:first-letter{text-decoration:underline}
.tools{display:flex;gap:4px;padding:3px 2px;border-top:1px solid var(--lo);box-shadow:0 1px var(--hi) inset}
.tools a{display:inline-flex;align-items:center;justify-content:center;color:#000;text-decoration:none}
.view{flex:1;margin-top:3px;background:#525659;padding:2px;min-height:0}
.view iframe{width:100%;height:100%;border:0;display:block;background:#525659}
.status{display:flex;gap:3px;margin-top:3px}
.status span{padding:2px 6px}
.status span:first-child{flex:1}
#zoom{position:absolute;z-index:4;border:2px solid #fff;mix-blend-mode:difference;display:none;pointer-events:none;
  transition:all .32s steps(7)}
#settings{left:50%;top:42%;transform:translate(-50%,-50%);width:300px;z-index:6;display:none}
#settings .row{padding:16px 14px;display:flex;align-items:center;gap:12px}
body[data-phase=settings] #settings{display:flex}
body[data-phase=settings],body[data-phase=settings] *{cursor:wait}
body[data-phase=settings] #icons,body[data-phase=settings] #taskbar{visibility:hidden}
.hourglass{width:22px;height:28px;flex-shrink:0}
#taskbar{position:absolute;left:0;right:0;bottom:0;height:28px;display:flex;align-items:center;gap:4px;padding:2px;z-index:7;
  box-shadow:inset 0 1px var(--lt),inset 0 2px var(--hi)}
#start{display:flex;align-items:center;gap:4px;height:22px;padding:0 5px;border:0;font-weight:700;cursor:pointer}
#start.down,#task.down{box-shadow:inset 1px 1px var(--dk),inset -1px -1px var(--hi),inset 2px 2px var(--lo);
  background:repeating-conic-gradient(#c0c0c0 0 25%,#fff 0 50%) 0 0/2px 2px}
#start .mark{width:16px;height:16px}
#start .mark i{width:9px;height:9px;border-width:1px}
#start .mark i:nth-child(2){left:3px;top:3px}#start .mark i:nth-child(3){left:6px;top:6px}
#task{display:none;align-items:center;gap:4px;height:22px;width:min(200px,40vw);padding:0 6px;border:0;cursor:pointer;
  overflow:hidden;white-space:nowrap;text-overflow:ellipsis;text-align:left}
#task svg{width:16px;height:16px;flex-shrink:0}
body.open #task,body.min #task{display:flex}
#tray{margin-left:auto;height:22px;padding:0 10px;display:flex;align-items:center}
#menu{position:absolute;left:2px;bottom:28px;z-index:8;display:none;flex-direction:row;padding:3px}
#menu.show{display:flex}
#menu .side{width:24px;background:linear-gradient(0deg,var(--navy),#1084d0);color:#c0c0c0;
  writing-mode:vertical-rl;transform:rotate(180deg);font:italic 900 17px/24px "Arial Black",Arial,sans-serif;padding:6px 0}
#menu .side b{color:#fff}
#menu ul{list-style:none;margin:0;padding:0;min-width:190px}
#menu li button,#menu li a{display:flex;align-items:center;gap:10px;width:100%;height:32px;padding:0 10px 0 6px;border:0;background:none;
  color:#000;text-decoration:none;text-align:left;cursor:pointer}
#menu li button:hover,#menu li a:hover,#menu li button:focus,#menu li a:focus{background:var(--navy);color:#fff;outline:none}
#menu li svg{width:24px;height:24px}
#menu hr{border:0;border-top:1px solid var(--lo);border-bottom:1px solid var(--hi);margin:2px 2px}
#off{position:fixed;inset:0;z-index:20;background:#000;color:#ff8a00;display:none;place-items:center;
  font:700 clamp(18px,3.4vw,34px)/1.3 "Arial Black",Arial,sans-serif;text-align:center;padding:16px;cursor:pointer}
body.off #off{display:grid}
@keyframes appear{from{opacity:0}}
body[data-phase=desktop] .icon{animation:appear .01s both}
${[1, 2, 3, 4].map((n) => `body[data-phase=desktop] .icon:nth-child(${n}){animation-delay:${n * 90}ms}`).join("")}
@media (max-width:720px){#icons{grid-auto-flow:column;grid-template-rows:auto}#win{left:0;top:0;width:100%;height:calc(100% - 28px)}
  #win .tbtn[data-max]{display:none}#task{width:auto;flex:1}}
@media (prefers-reduced-motion:reduce){#zoom{transition:none}}
</style></head>
<body data-phase="desktop" class="open">
<nav id="icons" aria-label="Desktop">
  <button class="icon" type="button" tabindex="-1" aria-hidden="true">${ICONS.computer}<b>My Computer</b></button>
  <button class="icon" type="button" id="docicon" aria-label="Open resume">${ICONS.doc}<b>Resume.pdf</b></button>
  <a class="icon" href="/" data-analytics-action="home_link" aria-label="Go to suraaj.me">${ICONS.globe}<b>suraaj.me</b></a>
  <button class="icon" type="button" tabindex="-1" aria-hidden="true">${ICONS.bin}<b>Recycle Bin</b></button>
</nav>

<section id="win" class="win raised" aria-label="Resume viewer">
  <div class="title" id="wintitle">${ICONS.doc.replace("<svg", '<svg width="16" height="16"')}
    <span>Suraaj_Samanta_Resume.pdf - Document Viewer</span>
    <button type="button" class="tbtn raised" data-min aria-label="Minimize"><svg width="8" height="7"><rect y="5" width="6" height="2"/></svg></button>
    <button type="button" class="tbtn raised" data-max aria-label="Maximize"><svg width="9" height="9"><path d="M0 0h9v9H0zM1 2v6h7V2z" fill-rule="evenodd"/></svg></button>
    <button type="button" class="tbtn raised" data-close aria-label="Close" style="margin-left:2px">${CLOSE_SVG}</button>
  </div>
  <div class="menu" aria-hidden="true"><span>File</span><span>Edit</span><span>View</span><span>Help</span></div>
  <div class="tools">
    <a class="btn raised" data-analytics-action="download_click" href="${pdf}&amp;download=1">Save</a>
    <a class="btn raised" data-analytics-action="open_pdf_tab" href="${pdf}" target="_blank" rel="noopener">Open in new tab</a>
  </div>
  <div class="view sunken"><iframe id="pdf" title="Suraaj Samanta resume" src="${pdf}#view=FitH"></iframe></div>
  <div class="status"><span class="sunken">Ready</span><span class="sunken">suraaj.me${path}</span></div>
</section>
<div id="zoom"></div>

<div id="settings" class="win raised">
  <div class="title"><span>SuraajOS</span></div>
  <div class="row">
    <svg class="hourglass" viewBox="0 0 22 28" aria-hidden="true"><path d="M2 1h18v3c0 6-6 8-6 10s6 4 6 10v3H2v-3c0-6 6-8 6-10S2 10 2 4z" fill="#fff" stroke="#000" stroke-width="1.5"/><path d="M6 6h10c-1 3-5 5-5 7-1-2-4-4-5-7zM5 25c1-4 5-6 6-6s5 2 6 6z" fill="#c8a000"/></svg>
    <span>Loading your personal settings&hellip;</span>
  </div>
</div>

<div id="menu" class="raised" role="menu">
  <div class="side"><b>Suraaj</b>OS 98</div>
  <ul>
    <li><button type="button" data-open role="menuitem">${ICONS.doc}Open Resume</button></li>
    <li><a data-analytics-action="download_click" href="${pdf}&amp;download=1" role="menuitem">${ICONS.doc}Download PDF</a></li>
    <li><a href="/" data-analytics-action="home_link" role="menuitem">${ICONS.globe}Visit suraaj.me</a></li>
    <li><hr></li>
    <li><button type="button" data-off role="menuitem">${ICONS.computer}Shut Down&hellip;</button></li>
  </ul>
</div>

<footer id="taskbar" class="raised">
  <button id="start" class="raised" type="button" aria-haspopup="menu" aria-controls="menu"><span class="mark"><i></i><i></i><i></i></span>Start</button>
  <button id="task" class="raised down" type="button">${ICONS.doc}Suraaj_Samanta_Resume.pdf</button>
  <div id="tray" class="sunken"><span id="clock"></span></div>
</footer>
<div id="off" role="button" tabindex="0">It&rsquo;s now safe to turn off<br>your computer.</div>

<script>
(function () {
  var body = document.body, win = document.getElementById("win"), zoom = document.getElementById("zoom");
  var icon = document.getElementById("docicon"), task = document.getElementById("task");
  var start = document.getElementById("start"), menu = document.getElementById("menu");
  var calm = matchMedia("(prefers-reduced-motion: reduce)").matches;

  function tick() {
    var d = new Date(), h = d.getHours(), m = d.getMinutes();
    document.getElementById("clock").textContent = ((h + 11) % 12 + 1) + ":" + (m < 10 ? "0" : "") + m + " " + (h < 12 ? "AM" : "PM");
  }
  tick(); setInterval(tick, 15000);

  function rect(el) { var r = el.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; }
  function place(r) { for (var k in r) zoom.style[k] = r[k] + "px"; }
  function select(on) { icon.classList.toggle("sel", on); }

  function note(action) { document.dispatchEvent(new CustomEvent("ss:resume-action", { detail: action })); }

  function open(event) {
    closeMenu();
    if (body.classList.contains("open")) return;
    if (event) note("open_resume");
    select(true);
    body.classList.remove("min");
    if (calm) { body.classList.add("open"); task.classList.add("down"); return; }
    body.classList.add("open"); var to = rect(win); body.classList.remove("open");
    place(rect(icon)); zoom.style.display = "block";
    requestAnimationFrame(function () { requestAnimationFrame(function () { place(to); }); });
    setTimeout(function () { zoom.style.display = "none"; body.classList.add("open"); task.classList.add("down"); }, 340);
  }
  function close() { note("close_resume"); body.classList.remove("open", "min"); select(false); }
  function minimize() { note("minimize_resume"); body.classList.remove("open"); body.classList.add("min"); task.classList.remove("down"); }

  icon.addEventListener("click", function (e) { select(true); if (matchMedia("(hover: none)").matches) open(e); });
  icon.addEventListener("dblclick", open);
  icon.addEventListener("keydown", function (e) { if (e.key === "Enter") open(e); });
  document.addEventListener("pointerdown", function (e) {
    if (!icon.contains(e.target) && !win.contains(e.target)) select(false);
    if (!menu.contains(e.target) && !start.contains(e.target)) closeMenu();
  });
  win.querySelector("[data-close]").addEventListener("click", close);
  win.querySelector("[data-min]").addEventListener("click", minimize);
  win.querySelector("[data-max]").addEventListener("click", function () { note("maximize_resume"); win.classList.toggle("max"); });
  task.addEventListener("click", function () { body.classList.contains("open") ? minimize() : (note("open_resume"), body.classList.remove("min"), body.classList.add("open"), task.classList.add("down")); });

  function closeMenu() { menu.classList.remove("show"); start.classList.remove("down"); }
  start.addEventListener("click", function () { var s = menu.classList.toggle("show"); start.classList.toggle("down", s); });
  menu.querySelector("[data-open]").addEventListener("click", open);
  menu.querySelector("[data-off]").addEventListener("click", function () { closeMenu(); body.classList.add("off"); });
  var off = document.getElementById("off");
  off.addEventListener("click", function () { location.reload(); });
  off.addEventListener("keydown", function (e) { if (e.key === "Enter") location.reload(); });

  var title = document.getElementById("wintitle"), drag = null;
  title.addEventListener("pointerdown", function (e) {
    if (e.target.closest("button") || win.classList.contains("max") || innerWidth <= 720) return;
    var r = win.getBoundingClientRect(); drag = { x: e.clientX - r.left, y: e.clientY - r.top };
    title.setPointerCapture(e.pointerId); document.getElementById("pdf").style.pointerEvents = "none";
  });
  title.addEventListener("pointermove", function (e) {
    if (!drag) return;
    win.style.left = Math.max(-200, Math.min(innerWidth - 80, e.clientX - drag.x)) + "px";
    win.style.top = Math.max(0, Math.min(innerHeight - 60, e.clientY - drag.y)) + "px";
  });
  title.addEventListener("pointerup", function () { drag = null; document.getElementById("pdf").style.pointerEvents = ""; });
  title.addEventListener("dblclick", function (e) { if (!e.target.closest("button")) { note("maximize_resume"); win.classList.toggle("max"); } });

  if (calm) return;
  body.classList.remove("open");
  body.dataset.phase = "settings";
  setTimeout(function () { body.dataset.phase = "desktop"; }, 1300);
  setTimeout(function () { select(true); }, 1900);
  setTimeout(open, 2300);
})();
</script>
<script src="/journey-analytics.js" defer></script>
</body></html>`;
}
