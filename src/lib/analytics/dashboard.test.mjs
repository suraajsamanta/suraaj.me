import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { dashboardPage } from "./dashboard.ts";

const at = Date.now() - 100_000;
const owner = "owner-browser";
const guest = "abc123-browser";

function event(kind, path, offset, extra = {}) {
  return { kind, path, t: at + offset, vid: guest, device: "desktop", browser: "Chrome", ...extra };
}

function render(events, site = "all") {
  const html = dashboardPage(events, true);
  const embedded = html.match(/<script id="events" type="application\/json">([^\n]*)<\/script>/)[1];
  const script = html.split("<script>")[1].split("</script>")[0];
  const nodes = new Map();
  const get = (id) => {
    if (!nodes.has(id)) nodes.set(id, {});
    return nodes.get(id);
  };
  get("events").textContent = embedded;
  vm.runInNewContext(script, {
    document: { getElementById: get, querySelectorAll: () => [] },
    localStorage: { getItem: () => JSON.stringify({ site }), setItem() {} },
    window: {},
  });
  return { embedded, detail: get("detail").innerHTML, tiles: get("tiles").innerHTML, recent: get("recent").innerHTML, places: get("places").innerHTML };
}

test("reports a cross-page browser journey with qualified resume milestones and deduped active time", () => {
  const events = [
    event("view", "/", 0, { city: "San Francisco" }),
    event("section_seen", "/", 500, { sid: "tab1", eid: "section", label: "socials" }),
    event("page_active", "/", 800, { sid: "tab1", eid: "time", durationMs: 12_000 }),
    event("page_active", "/", 900, { sid: "tab1", eid: "time", durationMs: 12_000 }),
    event("resume_locked", "/cv", 2000),
    event("resume_unlocked", "/cv", 3000),
    event("resume_opened", "/cv", 4000),
    event("resume_pdf_loaded", "/cv", 5000),
    event("resume_download", "/cv", 5500),
    event("page_active", "/cv", 6000, { sid: "tab1", eid: "resume-time", durationMs: 8500 }),
    event("page_active", "/cv", 6100, { sid: "tab1", eid: "viewer", label: "viewer_active", durationMs: 4000 }),
  ];
  const all = render(events);
  assert.match(all.detail, /1 of 1/);
  assert.match(all.detail, /24 s active · 4 s viewer active/);
  assert.match(all.detail, /Reached section: Socials/);
  assert.match(all.detail, /Opened the AI Labs resume login/);
  assert.match(all.detail, /PDF served for AI Labs/);
  assert.match(all.detail, /Download response for AI Labs/);
  assert.match(all.places, /San Francisco/);
  const resume = render(events, "resumes");
  assert.match(resume.detail, /Viewer opened/);
  assert.match(resume.detail, /PDF served/);
  assert.match(resume.detail, /Download response/);
  assert.doesNotMatch(resume.recent, /Downloaded/);
});

test("keeps host-reported guest activity distinct from link clicks and browser visits", () => {
  const room = { vid: owner, owner: true, game: "inside-ranks", roomId: "room1" };
  const round = { ...room, matchId: "round1" };
  const events = [
    event("view", "/madfun/inside-ranks", 0, { q: "room-link" }),
    event("view", "/beerio", 100, { q: "race-link" }),
    event("game_join", "/madfun/inside-ranks", 1000, { ...room, matchId: room.roomId, playerId: "p1" }),
    event("game_join", "/madfun/inside-ranks", 1500, { ...room, matchId: room.roomId, playerId: "p1" }),
    event("game_start", "/madfun/inside-ranks", 4000, round),
    event("game_end", "/madfun/inside-ranks", 60400, { ...round, durationMs: 56_400, outcome: "completed" }),
    event("game_player_duration", "/madfun/inside-ranks", 60500, { ...round, playerId: "p1", durationMs: 39_000, estimated: true }),
    event("game_start", "/madfun/inside-ranks", 61500, { ...round, matchId: "round2" }),
    event("view", "/madfun/inside-ranks", 64000, { vid: owner, owner: true }),
  ];
  const dash = render(events, "madfun");
  assert.match(dash.tiles, /Guest room joins<\/span><b>1/);
  assert.match(dash.tiles, /Rounds started<\/span><b>2/);
  assert.match(dash.tiles, /Visitors<\/span><b>1/);
  assert.match(dash.detail, /Recent rooms/);
  assert.match(dash.detail, /Completed/);
  assert.match(dash.detail, /No end recorded/);
  assert.match(dash.detail, /56 s/);
  assert.match(dash.detail, /Guest 1: ≈ 39 s/);
  assert.match(dash.detail, /Beerio/);
  assert.match(dash.recent, /Opened room link for Inside Ranks/);
  assert.doesNotMatch(dash.detail, /p1|room-link|owner-browser/);
});

test("does not embed raw markup and escapes event descriptions", () => {
  const malicious = "</script><img src=x onerror=alert(1)>";
  const result = render([event("section_seen", "/", 0, { label: malicious })]);
  assert.doesNotMatch(result.embedded, /</);
  assert.match(result.detail, /&lt;\/script&gt;/);
  assert.doesNotMatch(result.detail, /<img/);
});
