import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
test("Bump Club owns its route, game marker and controller labels",()=>{
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
assert.match(read("./BoomerangGame.tsx"),/madfun\/bump-club\?room=/);
assert.match(read("./transport.ts"),/madfun-bump-club-v1/);
assert.match(read("./PhoneControls.tsx"),/SHOVE/);
});
