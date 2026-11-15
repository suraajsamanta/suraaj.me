import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { PartyService } from '../../../../beerio-server/party.mjs';

const moduleUrl = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
function compile(file, replacements = {}) {
  let code = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const [name, url] of Object.entries(replacements)) code = code.replaceAll(`'${name}'`, JSON.stringify(url));
  return moduleUrl(code);
}
const partyMock = moduleUrl('export const usePhoneParty = () => globalThis.__codewordsParty;');
const words = moduleUrl('export const CODEWORDS = Array.from({length:100}, (_, i) => "word"+i);');
const { codewordsPartyConfig: config, useCodewordsSession } = await import(compile('./useCodewordsSession.ts', {
  '../shared/usePhoneParty': partyMock, '@/lib/madfun/wordgame/words': words, './engine': compile('./engine.ts'),
}));
const { PartySeatRegistry } = await import(compile('../shared/party-seat-recovery.ts'));
const { createIdentity, openFor, sealFor } = await import(compile('../shared/private-seat.ts'));
const participants = [
  ['red-master', 'red', 'spymaster'], ['blue-master', 'blue', 'spymaster'],
  ['red-guesser', 'red', 'guesser'], ['blue-guesser', 'blue', 'guesser'],
];
const host = { id: 'host', name: 'Host', connected: true };

function start(people) {
  let model = config.initial();
  for (let i = 0; i < people.length; i++) {
    const [, team, role] = participants[i];
    model = config.reduce(model, people[i], { action: { type: 'seat', team, role }, match: 0 }, people, host.id);
    assert(model);
  }
  const started = config.reduce(model, host, { action: { type: 'start' }, match: 0 }, people, host.id);
  assert(started);
  return started;
}

test('same browser can recover the active clue-giver role after transport expiry; a shared name cannot reclaim it', async () => {
  assert.equal(config.recoverPlayersKey, 'madfun.codewords.player.v1');
  let now = 0;
  const service = new PartyService({ now: () => now });
  const registry = new PartySeatRegistry();
  const peer = () => {
    const messages = [];
    const p = { send: m => messages.push(m), close() {} };
    service.connect(p);
    return { p, messages };
  };
  const roomHost = peer();
  service.receive(roomHost.p, {type: 'create', game: 'simulator'});
  const code = roomHost.messages.find(m => m.type === 'welcome').room.code;
  const join = (name, credential) => {
    const client = peer();
    service.receive(client.p, { type:'join', code, name, game:'simulator' });
    const welcome = client.messages.find(m => m.type === 'welcome');
    return { ...client, welcome, logical: registry.bind(welcome.playerId, name, credential) };
  };
  const logicalPlayers = () => {
    const roster = roomHost.messages.filter(m => m.type === 'room').at(-1).room.players;
    return registry.entries().map(p => ({id:p.id, name:p.name, connected:roster.some(r=>r.id===p.transportId&&r.connected)}));
  };
  const peers = participants.map(([name], i) => join(name, String(i).repeat(48)));
  const model = start(logicalPlayers());
  const i = model.game.turn === 'red' ? 0 : 1;
  const original = peers[i], name = participants[i][0], token = String(i).repeat(48);
  const actorId = original.logical.id;
  service.disconnect(original.p);
  now += 91_000;
  service.sweep();
  const reload = peer();
  service.receive(reload.p, {type:'resume', code, session:original.welcome.session, game:'simulator'});
  assert(reload.messages.some(m => m.code === 'invalid_session'));
  const stranger = join(name, 'e'.repeat(48));
  assert.notEqual(stranger.logical.id, actorId);
  assert.equal(config.secret(model, stranger.logical.id), null);
  assert.equal(config.secret(model, peers[2].logical.id), null);
  assert(config.view(model,logicalPlayers(),host.id).game.board.every(c=>c.kind===null));
  const returned = join(name, token);
  assert.notEqual(returned.welcome.playerId, original.welcome.playerId);
  assert.equal(returned.logical.id, actorId);
  assert.equal(registry.owner(original.welcome.playerId), null);
  const people = logicalPlayers();
  const restored = config.view(model,people,host.id).seats.find(s => s.id === actorId);
  assert.deepEqual(restored, {id:actorId,name,connected:true,team:model.game.turn,role:'spymaster'});
  const message = config.secret(model, actorId), own = await createIdentity(), other = await createIdentity();
  const packet = await sealFor(own.publicKey, {room:code, value:message});
  await assert.rejects(openFor(other.privateKey, packet));
  assert.deepEqual(await openFor(own.privateKey, packet), {room:code,value:message});
  assert.equal(message.key.length,25);
  const clue = { action: {type:'clue',word:'Animals',count:1}, match:model.match,turn:model.game.turnNumber };
  assert.equal(config.reduce(model,people.find(p=>p.id===stranger.logical.id),clue,people,host.id),null);
  assert.equal(config.reduce(model,restored,clue,people,host.id).game.phase,'guess');
});

test('the phone only renders a matching key for its connected clue-giver seat', t => {
  t.after(() => { delete globalThis.__codewordsParty; });
  const people = participants.map(([id]) => ({ id, name:id, connected:true }));
  const model = start(people);
  const master = people[0].id;
  const saved = {status:'connected',hostConnected:true,host:false,watching:false,participantId:master,
    state:config.view(model,people,host.id),secret:config.secret(model,master)};
  globalThis.__codewordsParty = saved;
  assert.equal(useCodewordsSession().key.length, 25);
  for (const change of [{status:'reconnecting'},{hostConnected:false},{watching:true},{host:true},
    {participantId:people[2].id},{secret:{...saved.secret,match:model.match+1}}]) {
    globalThis.__codewordsParty = {...saved,...change};
    assert.equal(useCodewordsSession().key,null);
  }
});
