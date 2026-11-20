import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const script = await readFile(new URL("../public/journey-analytics.js", import.meta.url), "utf8");

function browser(path = "/", options = {}, storage = new Map()) {
  let now = 0, pulse, onClassChange, onIntersection;
  const events = [];
  const delivered = [];
  class Element {
    constructor(attrs) { this.attrs = attrs; }
    closest() { return this; }
    getAttribute(key) { return this.attrs[key]; }
  }
  function target() {
    const events = new Map();
    return {
      addEventListener(name, callback) { events.set(name, callback); },
      dispatch(name, event) { events.get(name)?.(event); },
    };
  }
  const window = { ...target(), crypto: { randomUUID } };
  const document = {
    ...target(),
    body: { classList: new Set(), },
    visibilityState: "visible",
    getElementById(id) { return id === "pdf" && options.hasViewer; },
    querySelectorAll() { return []; },
  };
  document.body.classList.contains = document.body.classList.has.bind(document.body.classList);
  if (options.hasViewer) document.body.classList.add("open");
  const location = { pathname: path, search: "?password=not-transmitted" };
  const context = {
    window, document, location, globalThis: window, crypto: window.crypto, Element,
    Blob: class { constructor(parts) { this.payload = parts.join(""); } },
    Date: { now: () => 1770000000000 + now },
    performance: { now: () => now },
    sessionStorage: {
      getItem: (key) => storage.get(key),
      setItem: (key, value) => storage.set(key, value),
    },
    navigator: { ...options, sendBeacon(endpoint, body) {
      events.push(endpoint);
      delivered.push(JSON.parse(body.payload));
      return true;
    } },
    fetch(endpoint, options) {
      events.push(endpoint);
      delivered.push(JSON.parse(options.body));
      return Promise.resolve();
    },
    IntersectionObserver: class {
      constructor(callback) { onIntersection = callback; }
      observe() {}
      disconnect() {}
    },
    MutationObserver: class {
      constructor(callback) { onClassChange = callback; }
      observe() {}
    },
    setInterval(callback) { pulse = callback; },
  };
  vm.runInNewContext(script, context);
  return { window, document, location, events, delivered, time: (ms) => { now = ms; },
    pulse: () => pulse?.(), classChange: () => onClassChange?.(),
    intersect: (...entries) => onIntersection?.(entries), Element };
}

test("counts only allowlisted page time up to the idle cutoff and not when hidden", () => {
  const b = browser("/madfun/beerio-2");
  b.time(30000); b.pulse();
  b.time(60000); b.pulse();
  b.time(90000); b.pulse();
  b.document.visibilityState = "hidden";
  b.document.dispatch("visibilitychange");
  b.time(120000); b.pulse();
  assert.deepEqual(b.delivered.map(x => x.durationMs), [30000, 30000]);
  assert.ok(b.delivered.every(x => x.path === "/madfun/beerio-2" && !JSON.stringify(x).includes("password")));
  assert.ok(b.events.every(x => x === "/api/analytics/activity"));
  b.document.visibilityState = "visible";
  b.document.dispatch("visibilitychange");
  b.time(125000); b.window.dispatch("pagehide");
  assert.equal(b.delivered.at(-1).durationMs, 5000);
});

test("shares a tab session id across SPA paths and document reloads, with unique event ids", () => {
  const storage = new Map();
  const a = browser("/", {}, storage);
  a.time(1000); a.location.pathname = "/madfun"; a.document.dispatch("ss:analytics-navigation");
  a.time(2000); a.window.dispatch("pagehide");
  const b = browser("/cv", {}, storage);
  b.time(2000); b.window.dispatch("pagehide");
  const all = [...a.delivered, ...b.delivered];
  assert.deepEqual(all.map(x => x.path), ["/", "/madfun", "/cv"]);
  assert.equal(new Set(all.map(x => x.sid)).size, 1);
  assert.equal(new Set(all.map(x => x.eid)).size, 3);
});

test("time when resume viewer is closed does not count as viewer-active", () => {
  const b = browser("/resume", {hasViewer: true});
  b.time(5000); b.document.body.classList.delete("open"); b.classChange();
  b.time(10000); b.window.dispatch("pagehide");
  assert.deepEqual(b.delivered.map(x => [x.durationMs, x.label]), [[5000, "viewer_active"], [5000, undefined]]);
});

test("no tracking under DNT/GPC or on controller/internal/unknown routes", () => {
  for (const [path, flags] of [["/", {doNotTrack: "1"}], ["/", {globalPrivacyControl: true}],
    ["/madfun/controller", {}], ["/internal", {}], ["/unknown", {}]]) {
    const b = browser(path, flags);
    b.time(45000); b.pulse(); b.window.dispatch("pagehide");
    assert.deepEqual(b.delivered, []);
  }
});

test("section milestone is deduped and link action does not read its destination", () => {
  const b = browser("/");
  const visible = {target: {dataset: {analyticsSection: "intro"}}, isIntersecting: true, intersectionRatio: 1};
  b.intersect({...visible, intersectionRatio: 0.1}); b.intersect(visible); b.intersect(visible);
  const link = new b.Element({"data-analytics-action": "github", href: "https://somewhere.invalid/private"});
  b.document.dispatch("click", {target: link, isTrusted: true});
  assert.deepEqual(b.delivered.map(x => [x.kind, x.label]), [["section_seen", "intro"], ["site_action", "github"]]);
  assert.ok(!JSON.stringify(b.delivered).includes("https://"));
});
