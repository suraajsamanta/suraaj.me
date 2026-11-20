import { test } from "node:test";
import assert from "node:assert/strict";
import { parseActivity } from "./activity.ts";

const sid = "a".repeat(32), eid = "b".repeat(32), matchId = "c".repeat(32);
const playerId = "d".repeat(32), roomId = "e".repeat(32);
test("projects allowlisted home actions and excludes private caller fields", () => {
  assert.deepEqual(parseActivity({kind:"site_action", path:"/", label:"github", sid, eid,
    password:"private", url:"https://example.test/a?token=private", vid:"private"}), {
    kind:"site_action", path:"/", label:"github", sid, eid,
  });
  assert.equal(parseActivity({kind:"section_seen", path:"/", sid, eid, label:"arbitrary"}), null);
  assert.equal(parseActivity({kind:"site_action", path:"/resume?p=private", sid, eid, label:"open_resume"}), null);
});
test("only validates bounded active deltas on allowed pages", () => {
  const e = {kind:"page_active", path:"/resume", sid, eid, durationMs:30000, label:"viewer_active"};
  assert.deepEqual(parseActivity(e), e);
  for (const change of [{durationMs:0},{durationMs:60001},{durationMs:5.5},{sid:"name"},
    {eid:undefined},{path:"/internal"},{path:"/madfun/share"},{path:"/madfun",label:"viewer_active"}]) {
    assert.equal(parseActivity({...e,...change}), null);
  }
});
test("resume access milestones cannot be submitted as client events", () => {
  for (const kind of ["resume_unlocked","resume_opened","resume_pdf_loaded","resume_download"]) {
    assert.equal(parseActivity({kind,path:"/resume",sid,eid}), null);
  }
});
test("game events need whitelisted games and opaque IDs", () => {
  const base = {kind:"game_join",game:"inside-ranks",matchId,roomId,playerId};
  const parsed = parseActivity({...base,path:"/secret",name:"Don't retain",code:"PLAY"});
  assert.equal(parsed.path, "/madfun/inside-ranks");
  assert.equal(parsed.playerId,playerId);
  assert.equal(parsed.roomId,roomId);
  assert.equal(parsed.name,undefined);
  assert.equal(parsed.code,undefined);
  for (const change of [{game:"controller"},{playerId:undefined},{roomId:"ROOM"},
    {matchId:"ROOM"},{outcome:"illegal"},{kind:"game_player_duration"}]) {
    assert.equal(parseActivity({...base,...change}), null);
  }
  assert.equal(parseActivity({...base,kind:"game_end", durationMs:40000, outcome:"completed"}).durationMs,40000);
  assert.equal(parseActivity({...base,kind:"game_player_duration",durationMs:60e6}),null);
});
