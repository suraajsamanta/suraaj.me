import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const path = new URL("./arena-auto-start.ts", import.meta.url);
const { outputText } = ts.transpileModule(fs.readFileSync(path, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { arenaStartKey, ARENA_AUTO_START_MS } = await import("data:text/javascript;base64," + Buffer.from(outputText).toString("base64"));
const phone = (id, props = {}) => ({ id, ready: true, connected: true, ...props });
const lobby = (players, status = "connected", locked = false) => ({ players, status, locked });

test("autostart never arms for a host-only, not-ready, paused, or locked arena", () => {
  assert.equal(ARENA_AUTO_START_MS, 12_000);
  assert.equal(arenaStartKey(lobby([]), 9), null);
  assert.equal(arenaStartKey(lobby([phone("a")]), 0), null);
  assert.equal(arenaStartKey(lobby([phone("a"), phone("b", { ready: false })]), 9), null);
  assert.equal(arenaStartKey(lobby([phone("a"), phone("b")], "reconnecting"), 0), null);
  assert.equal(arenaStartKey(lobby([phone("a"), phone("b")], "connected", true), 0), null);
});

test("readiness key stays stable under input traffic but resets when actual roster or bots change", () => {
  const a = phone("a"), b = phone("b"), c = phone("c");
  const key = arenaStartKey(lobby([a, b]), 0);
  assert.ok(key);
  assert.equal(arenaStartKey(lobby([{ ...b, input: { x: 1 } }, a]), 0), key);
  assert.equal(arenaStartKey(lobby([a, b, { ...c, connected: false }]), 0), key);
  assert.notEqual(arenaStartKey(lobby([a, b, c]), 0), key);
  assert.notEqual(arenaStartKey(lobby([a, b]), 1), key);
  assert.ok(arenaStartKey(lobby([a]), 1));
});
