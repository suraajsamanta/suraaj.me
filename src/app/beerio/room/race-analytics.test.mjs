import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("./race-analytics.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { RaceAnalytics } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));

const driver = (id, connected = true) => ({ id, connected });
function setup() {
  const events = [];
  let t = 0, n = 0;
  const stats = new RaceAnalytics("beerio-2", e => events.push(e), () => t, () => String(++n));
  return { stats, events, time: v => { t = v; } };
}
test("only connected accepted host roster seats count, one per room, no raw identifiers", () => {
  const { stats, events } = setup();
  stats.observeRoom("PRIVATE-CODE", [driver("LOCAL-SEAT")], false, false);
  stats.observeRoom("PRIVATE-CODE", [driver("LOCAL-SEAT", false)], true, false);
  assert.equal(events.length, 0);
  stats.observeRoom("PRIVATE-CODE", [driver("LOCAL-SEAT")], true, false);
  stats.observeRoom("PRIVATE-CODE", [driver("LOCAL-SEAT", false)], true, false);
  stats.observeRoom("PRIVATE-CODE", [driver("LOCAL-SEAT")], true, false);
  assert.deepEqual(events.map(e => e.kind), ["game_join"]);
  assert.equal(events[0].roomId, events[0].matchId);
  assert.doesNotMatch(JSON.stringify(events), /PRIVATE-CODE|LOCAL-SEAT/);
});

test("finished match uses simulation clock, rematch gets new id, unfinished player time is estimated", () => {
  const { stats, events, time } = setup();
  const a = driver("alice"), b = driver("bob");
  stats.observeRoom("private", [a, b], true, false);
  stats.start([a, b]);
  time(1500);
  stats.observeRoom("private", [a, driver("bob", false)], true, true);
  time(2500);
  stats.observeRoom("private", [a, driver("bob", false)], true, false);
  time(7000);
  stats.finish(2.25, [{ id: "alice", time: 2 }, { id: "bob", time: null }]);
  stats.start([a]);
  assert.equal(events[3].durationMs, 2250);
  assert.equal(events[3].outcome, "completed");
  assert.equal(events[4].durationMs, 2000);
  assert.equal(events[4].estimated, false);
  assert.equal(events[5].durationMs, 1500);
  assert.equal(events[5].estimated, true);
  assert.notEqual(events[2].matchId, events[6].matchId);
  assert.equal(events[2].roomId, events[6].roomId);
});
test("close flushes one estimated abandonment but does not reset gameplay", () => {
  const { stats, events, time } = setup();
  const a = driver("a");
  stats.observeRoom("a-room", [a], true, false);
  stats.start([a]);
  time(500);
  stats.closeRoom();
  stats.closeRoom();
  assert.equal(events.filter(e => e.kind === "game_end").length, 1);
  assert.equal(events[2].durationMs, 500);
  assert.equal(events[2].outcome, "abandoned");
  assert.equal(events[2].estimated, true);
});
