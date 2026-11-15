import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { createRelay } from '../../../../beerio-server/server.mjs';

const require = createRequire(new URL('../../../../beerio-server/server.mjs', import.meta.url));

const modules = new Map();
function load(id) {
  if (modules.has(id)) return modules.get(id);
  const source = fs.readFileSync(new URL(id + '.ts', import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {};
  new Function('exports', 'require', outputText)(exports, specifier =>
    specifier === '../shared/usePhoneParty' ? {} : load(specifier));
  modules.set(id, exports);
  return exports;
}

const { insideRanksConfig: config } = load('./useInsideRanksSession');
const host = { id: 'host', name: 'TV', connected: true };
const players = ['ada', 'bo', 'cyd', 'dee'].map(id => ({ id, name: id, connected: true }));
const act = (state, actor, action, roster = players, round = state.match?.round) =>
  config.reduce(state, actor, { action, matchId: state.matchId, round }, roster, host.id);

test('each phone can queue and remove its own private question before play; other seats and TV cannot read it', () => {
  const base = config.initial();
  assert.equal(act(base, host, { type: 'submit_question', text: 'Who owns a jet?' }), null);
  assert.equal(act(base, players[0], { type: 'submit_question', text: ' '.repeat(8) }), null);
  assert.equal(act(base, players[0], { type: 'submit_question', text: 'A'.repeat(181) }), null);
  const state = act(base, players[0], { type: 'submit_question', text: '  Who owns a jet?  ' });
  assert.equal(config.view(state, players, host.id).questionCount, 1);
  assert.equal(JSON.stringify(config.view(state, players, host.id)).includes('owns a jet'), false);
  assert.deepEqual(config.secret(state, players[1].id).questions, []);
  assert.deepEqual(config.secret(state, players[0].id).questions, [{ id: 'custom-1', text: 'Who owns a jet?' }]);
  assert.equal(act(state, players[0], { type: 'submit_question', text: 'Who wants another card?' }), null);
  assert.equal(act(state, players[1], { type: 'submit_question', text: 'who owns a jet' }), null);
  assert.equal(act(state, players[1], { type: 'remove_question', id: 'custom-1' }), null);
  assert.equal(act(state, players[0], { type: 'remove_question', id: 'custom-1' }).questions.length, 0);
  const started = act(state, host, { type: 'start' });
  assert.equal(started.match.correct.id, 'custom-1');
  assert.equal(act(started, players[0], { type: 'remove_question', id: 'custom-1' }), null);
});

test('simultaneous mode has one host-controlled 60s deadline and locks each phone independently', t => {
  let now = 1000;
  t.mock.method(Date, 'now', () => now);
  const base = config.initial();
  assert.equal(act(base, players[0], { type: 'set_simultaneous', enabled: true }), null);
  const selected = act(base, host, { type: 'set_simultaneous', enabled: true });
  const started = act(selected, host, { type: 'start' });
  assert.equal(started.match.phase, 'batch_ranking');
  assert.equal(started.deadline, 61000);
  assert.equal(act(started, host, { type: 'set_auto', enabled: true }).deadline, 61000);
  assert.equal(act(started, host, { type: 'expire_ranking' }), null);
  const order = players.map(p => p.id).reverse();
  const locked = act(started, players[0], { type: 'rank', orderedIds: order });
  assert.equal(locked.deadline, started.deadline);
  assert.equal(locked.match.phase, 'batch_ranking');
  assert.equal(act(locked, players[0], { type: 'rank', orderedIds: order }), null);
  assert.equal(act(locked, players[1], { type: 'rank_preview', orderedIds: order, drag: null }), null);
  now = 61000;
  assert.equal(act(locked, players[1], { type: 'rank', orderedIds: order }), null);
  const review = act(locked, host, { type: 'expire_ranking' });
  assert.equal(review.match.phase, 'hint');
  assert.equal(review.match.totalRounds, 1);
  assert.equal(review.match.ranker.id, players[0].id);
  assert.equal(review.deadline, null);
});


test('real relay delivers independent private assignments and a single public slide at a time', async t => {
  const { PartyClient } = load('../shared/party-client');
  const { createIdentity, sealFor, openFor } = load('../shared/private-seat');
  const oldSocket = globalThis.WebSocket;
  globalThis.WebSocket = require('ws');
  const relay = createRelay();
  await new Promise(resolve => relay.server.listen(0, '127.0.0.1', resolve));
  const url = `ws://127.0.0.1:${relay.server.address().port}/party`;
  const screen = new PartyClient(url);
  const phones = await Promise.all(players.slice(0, 3).map(async player => ({
    client: new PartyClient(url), player, identity: await createIdentity(), packet: null,
  })));
  const waitFor = async (check, description) => {
    for (let attempt = 0; attempt < 250; attempt++) {
      if (check()) return;
      await new Promise(resolve => setTimeout(resolve, 8));
    }
    assert.fail(description);
  };
  t.after(async () => {
    screen.leave();
    phones.forEach(phone => phone.client.leave());
    await relay.close();
    globalThis.WebSocket = oldSocket;
  });
  screen.create('simulator');
  await waitFor(() => screen.getSnapshot().code, 'host created room');
  const { code } = screen.getSnapshot();
  for (const phone of phones) {
    phone.client.onState(packet => { phone.packet = packet; });
    phone.client.join(code, phone.player.name, 'simulator');
  }
  await waitFor(() => phones.every(phone => phone.client.getSnapshot().status === 'connected'), 'all phones joined');
  const addresses = Object.fromEntries(phones.map(phone => [phone.client.getSnapshot().playerId, phone]));
  const people = phones.map(phone => phone.player);
  let state = config.initial();
  let serial = 0;
  const publish = async () => {
    const revision = ++serial;
    const snapshot = state;
    const secrets = Object.fromEntries(await Promise.all(Object.entries(addresses).map(async ([id, phone]) => [
      id, await sealFor(phone.identity.publicKey, config.secret(snapshot, phone.player.id)),
    ])));
    screen.publish({ revision, public: config.view(snapshot, people, host.id), secrets });
    await waitFor(() => phones.every(phone => phone.packet?.revision === revision), 'all phones received revision');
  };
  screen.onAction(({ playerId, payload }) => {
    const phone = addresses[playerId];
    if (phone) state = act(state, phone.player, payload, people) ?? state;
  });
  const question = 'Who would spend a year living on the moon?';
  phones[0].client.sendAction({ type: 'submit_question', text: question });
  await waitFor(() => state.questions.length === 1, 'question received from phone');
  await publish();
  assert.equal(JSON.stringify(phones[1].packet).includes(question), false);
  assert.equal((await openFor(phones[1].identity.privateKey, phones[1].packet.secrets[phones[1].client.getSnapshot().playerId])).questions.length, 0);
  state = act(state, host, { type: 'set_simultaneous', enabled: true }, people);
  state = act(state, host, { type: 'start' }, people);
  await publish();
  const assigned = await Promise.all(phones.map(phone => openFor(phone.identity.privateKey, phone.packet.secrets[phone.client.getSnapshot().playerId])));
  assert.equal(new Set(assigned.map(packet => packet.prompt.text)).size, 3);
  for (const item of assigned) assert.equal(JSON.stringify(phones[0].packet.public).includes(item.prompt.text), false);
  const order = people.map(player => player.id).reverse();
  for (const phone of phones) phone.client.sendAction({ type: 'rank', orderedIds: order });
  await waitFor(() => state.match.phase === 'hint', 'all rankings locked and entered review');
  await publish();
  assert.deepEqual(phones[0].packet.public.match.ranking.map(player => player.id), order);
  assert.equal(phones[0].packet.public.match.hint, null);
  assert.equal(phones[0].packet.public.match.correct, null);
  state = act(state, host, { type: 'show_options' }, people);
  await publish();
  const guesser = phones.find(phone => phone.player.id !== state.match.ranker.id);
  const chosen = guesser.packet.public.match.options.find(option => option.text === question);
  assert.ok(chosen);
  guesser.client.sendAction({ type: 'guess', optionId: chosen.id });
  await waitFor(() => Object.keys(state.match.guesses).length === 1, 'phone guess received');
  state = act(state, host, { type: 'reveal' }, people);
  await publish();
  assert.equal(phones[0].packet.public.match.correct.text, question);
  assert.equal(phones[0].packet.public.match.scores[guesser.player.id], 1);
  state = act(state, host, { type: 'next' }, people);
  await publish();
  assert.equal(phones[0].packet.public.match.round, 2);
  assert.equal(phones[0].packet.public.match.correct, null);
  for (let remaining = 2; remaining <= phones.length; remaining++) {
    state = act(state, host, { type: 'reveal' }, people);
    state = act(state, host, { type: 'next' }, people);
  }
  assert.equal(state.match.phase, 'finished');
  assert.deepEqual(state.questions, [], 'reviewed player question leaves the queue');
});
