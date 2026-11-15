import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('Madfun hub links the Beerio alias and the alias adds help to the shared game',()=>{
 assert.match(read('../page.tsx'),/href="\/madfun\/beerio"/);
 const nested=read('../beerio/page.tsx');
 assert.match(nested,/import Beerio from "\.\.\/\.\.\/beerio\/Beerio"/);
 assert.match(nested,/export \{ metadata \} from "\.\.\/\.\.\/beerio\/page"/);
 assert.match(nested,/<Beerio quickStart=\{<QuickStart game="Beerio"/);
 assert.match(read('../../beerio/page.tsx'),/return <Beerio \/>/);
});
test('Beerio QR and reconnect links retain either entry pathname and room query',()=>{
 assert.match(read('../../beerio/Beerio.tsx'),/const url = new URL\(window.location.href\); url.search = ""; url.searchParams.set\("room", room.code\)/);
 for(const path of ['/beerio','/madfun/beerio']){
  const url=new URL(`https://suraaj.me${path}?old=value`);url.search='';url.searchParams.set('room','ABC234');
  assert.equal(url.pathname,path);assert.equal(url.search,'?room=ABC234');
 }
});
