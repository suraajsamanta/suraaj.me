/* First-party, coarse journey signals. Never read input values, URL queries or link targets. */
(function () {
  "use strict";

  if (window.__ssJourneyStarted || !window.crypto?.randomUUID ||
      navigator.globalPrivacyControl === true || navigator.doNotTrack === "1" ||
      window.doNotTrack === "1") return;
  window.__ssJourneyStarted = true;

  var endpoint = "/api/analytics/activity";
  var resume = new Set(["/resume", "/cv", "/suraaj_resume"]);
  var pages = new Set(["/", ...resume, "/beerio", "/madfun", "/madfun/beerio", "/madfun/beerio-2",
    "/madfun/boomerang", "/madfun/bump-club", "/madfun/codewords", "/madfun/floor-is-trouble",
    "/madfun/inside-ranks", "/madfun/jeopardy", "/madfun/simulator"]);
  var storageKey = "ss-journey-session";
  var sessionWindowMs = 30 * 60 * 1000;
  var idleMs = 60 * 1000;
  var pulseMs = 30 * 1000;
  var path = "";
  var sid, sessionTime, lastInteraction, since, viewLabel, observer, sections;
  var uuid = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i;

  function session() {
    var now = Date.now();
    if (!sid) {
      try {
        var previous = JSON.parse(sessionStorage.getItem(storageKey) || "null");
        if (previous && uuid.test(previous.sid) && Number.isFinite(previous.t) &&
            now >= previous.t && now - previous.t < sessionWindowMs) {
          sid = previous.sid;
          sessionTime = previous.t;
        }
      } catch { /* blocked storage is fine */ }
    }
    if (!sid || now - sessionTime >= sessionWindowMs) sid = crypto.randomUUID();
    sessionTime = now;
    try { sessionStorage.setItem(storageKey, JSON.stringify({sid: sid, t: now})); } catch { /* optional */ }
    return sid;
  }

  function send(kind, label, durationMs, urgent) {
    if (!pages.has(path)) return;
    var payload = JSON.stringify({ kind: kind, path: path, sid: session(), eid: crypto.randomUUID(),
      label: label, durationMs: durationMs });
    try {
      if (urgent && navigator.sendBeacon?.(endpoint, new Blob([payload], {type: "application/json"}))) return;
      void fetch(endpoint, {method: "POST", headers: {"Content-Type": "application/json"},
        credentials: "same-origin", body: payload, keepalive: true}).catch(function () { /* optional telemetry */ });
    } catch { /* optional telemetry */ }
  }

  function viewerLabel() {
    return resume.has(path) && document.getElementById("pdf") && document.body.classList.contains("open") &&
      !document.body.classList.contains("off") ? "viewer_active" : undefined;
  }

  function flush(now, urgent) {
    if (since === undefined) return;
    var stop = Math.min(now, lastInteraction + idleMs);
    var duration = Math.round(Math.min(60000, stop - since));
    since = now < lastInteraction + idleMs ? now : undefined;
    if (duration > 0) send("page_active", viewLabel, duration, urgent);
  }

  function interact() {
    if (!pages.has(path) || document.visibilityState !== "visible") return;
    var now = performance.now();
    if (since !== undefined && now >= lastInteraction + idleMs) flush(now, false);
    lastInteraction = now;
    if (since === undefined) since = now;
  }

  function observeSections() {
    observer?.disconnect();
    if (path === "/" && observer) {
      document.querySelectorAll("[data-analytics-section]").forEach(function (el) { observer.observe(el); });
    }
  }

  function switchPath() {
    var next = location.pathname;
    if (path === next) return;
    flush(performance.now(), false);
    observer?.disconnect();
    path = next;
    since = undefined;
    viewLabel = viewerLabel();
    if (!pages.has(path)) return;
    interact();
    if (path === "/" && typeof IntersectionObserver === "function") {
      sections = new Set();
      observer = new IntersectionObserver(function (entries) {
        if (path !== "/" || document.visibilityState !== "visible") return;
        entries.forEach(function (entry) {
          var label = entry.target.dataset.analyticsSection;
          if (entry.isIntersecting && entry.intersectionRatio >= 0.25 && label && !sections.has(label)) {
            sections.add(label);
            send("section_seen", label);
          }
        });
      }, {threshold: 0.25});
      observeSections();
    }
  }

  function viewerChange() {
    var label = viewerLabel();
    if (label === viewLabel) return;
    flush(performance.now(), false);
    viewLabel = label;
  }

  document.addEventListener("ss:analytics-navigation", switchPath);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") {
      interact();
      observeSections();
    } else {
      flush(performance.now(), true);
      since = undefined;
    }
  });
  window.addEventListener("pagehide", function () { flush(performance.now(), true); since = undefined; });
  window.addEventListener("pageshow", function () { switchPath(); interact(); });
  ["pointerdown", "keydown", "scroll", "touchstart"].forEach(function (name) {
    document.addEventListener(name, interact, {passive: true, capture: true});
  });
  document.addEventListener("click", function (event) {
    var target = event.target instanceof Element ? event.target.closest("[data-analytics-action]") : null;
    if (!target || !event.isTrusted) return;
    var label = target.getAttribute("data-analytics-action");
    if (label) send("site_action", label, undefined, true);
  }, true);
  // Page state signals are emitted only for real completed viewer toggles.
  document.addEventListener("ss:resume-action", function (event) {
    if (resume.has(path)) send("site_action", event.detail, undefined, false);
  });

  switchPath();
  if (resume.has(path)) new MutationObserver(viewerChange).observe(document.body, {
    attributes: true, attributeFilter: ["class"],
  });
  setInterval(function () {
    if (document.visibilityState === "visible") flush(performance.now(), false);
  }, pulseMs);
}());
