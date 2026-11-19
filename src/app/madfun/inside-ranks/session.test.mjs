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
  const draftAction = { type: 'rank_preview', orderedIds: order, drag: null };
  const drafted = act(locked, players[1], draftAction);
  assert(drafted);
  assert.equal(config.shouldPublish(locked, drafted, { action: draftAction }), false);
  assert.deepEqual(config.view(drafted, players, host.id), config.view(locked, players, host.id));
  assert.deepEqual(config.secret(drafted, players[1].id).orderedIds, order);
  assert.equal(config.secret(drafted, players[2].id).orderedIds, undefined);
  now = 61000;
  assert.equal(act(locked, players[1], { type: 'rank', orderedIds: order }), null);
  const review = act(drafted, host, { type: 'expire_ranking' });
  assert.equal(review.match.phase, 'hint');
  assert.equal(review.match.totalRounds, players.length);
  assert.equal(review.deadline, null);
  const defaultOrder = players.map(player => player.id);
  for (const assignment of review.match.batchAssignments) {
    assert.deepEqual(assignment.orderedIds, [players[0].id, players[1].id].includes(assignment.ranker.id) ? order : defaultOrder);
  }
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


test('host restarts in place with a fresh match ID, deadline, and score, without changing settings or questions', t => {
  let now = 1000;
  t.mock.method(Date, 'now', () => now);
  let state = config.initial();
  state = act(state, players[0], { type: 'submit_question', text: 'Who would start a space program?' });
  state = act(state, host, { type: 'set_deck', deck: 'dark' });
  state = act(state, host, { type: 'set_simultaneous', enabled: true });
  state = act(state, host, { type: 'set_auto', enabled: true });
  state = act(state, host, { type: 'start' });
  const ids = players.map(player => player.id).reverse();
  state = act(state, players[0], { type: 'rank', orderedIds: ids });
  assert.equal(act(state, players[0], { type: 'restart' }), null);
  now = 20_000;
  const restarted = act(state, host, { type: 'restart' });
  assert.equal(restarted.matchId, state.matchId + 1);
  assert.equal(restarted.match.phase, 'batch_ranking');
  assert.equal(restarted.deadline, 80_000);
  assert.equal(restarted.deck, 'dark');
  assert.equal(restarted.simultaneous, true);
  assert.equal(restarted.autoRun, true);
  assert.deepEqual(restarted.questions, state.questions);
  assert.deepEqual(restarted.match.rankTargets, state.match.rankTargets);
  assert.deepEqual(config.view(restarted, players, host.id).match.batch.submittedIds, []);
  assert.equal(config.reduce(restarted, players[1], { action: { type: 'rank', orderedIds: ids }, matchId: state.matchId, round: 1 }, players, host.id), null);
  const fewer = players.map(player => ({ ...player, connected: player.id === players[0].id }));
  const lobby = act(restarted, host, { type: 'restart' }, fewer);
  assert.equal(lobby.match, null);
  assert.equal(lobby.deadline, null);
  assert.deepEqual(config.view(lobby, fewer, host.id).players, fewer);
});


test('Dark Mode permits authored prompts, hides the ranker and keeps Paranoid decoys', () => {
  const { INSIDE_RANKS_DARK_PROMPTS } = load('./dark-prompts');
  const bank = new Set(INSIDE_RANKS_DARK_PROMPTS.map(prompt => prompt.text));
  for (const simultaneous of [false, true]) {
    let state = act(config.initial(), host, { type: 'set_deck', deck: 'dark' });
    for (const [index, player] of players.entries()) {
      state = act(state, player, { type: 'submit_question', text: `Who would annex moon number ${index}?` });
    }
    assert.equal(config.view(state, players, host.id).questionCount, players.length);
    if (simultaneous) state = act(state, host, { type: 'set_simultaneous', enabled: true });
    state = act(state, host, { type: 'start' });
    const publicMatch = () => config.view(state, players, host.id).match;
    assert.equal(publicMatch().ranker, null);
    assert.deepEqual(publicMatch().eligibleGuesserIds, []);
    if (simultaneous) {
      assert.deepEqual(publicMatch().batch.rankerIds, []);
      assert.deepEqual(publicMatch().batch.submittedIds, []);
      for (const assignment of state.match.batchAssignments) {
        assert.notEqual(assignment.ranker.id, assignment.correct.authorId);
        assert.equal(config.secret(state, assignment.ranker.id).role.batchAssigned, true);
      }
      for (const player of players) state = act(state, player, { type: 'rank', orderedIds: players.map(p => p.id) });
    } else {
      const ranker = state.match.ranker;
      assert.notEqual(ranker.id, state.match.correct.authorId);
      assert.equal(config.secret(state, ranker.id).role.ranker, true);
      state = act(state, ranker, { type: 'rank', orderedIds: players.map(p => p.id) });
    }
    assert.equal(publicMatch().reviewNumber, 1);
    assert.deepEqual(publicMatch().ranking.map(p => p.id), players.map(p => p.id));
    assert.equal(publicMatch().hint, null);
    assert.deepEqual(publicMatch().options, []);
    state = act(state, host, { type: 'show_options' });
    assert.equal(publicMatch().ranker, null);
    assert.equal(publicMatch().options.length, 6);
    assert.equal(new Set(publicMatch().options.map(o => o.text)).size, 6);
    assert.equal(publicMatch().options.filter(option => bank.has(option.text)).length, 5);
    state = act(state, host, { type: 'reveal' });
    assert.equal(publicMatch().ranker, null);
    assert.deepEqual(publicMatch().results, []);
    assert.equal(publicMatch().correct.text, state.match.correct.text);
    state = act(state, host, { type: 'next' });
    if (!simultaneous) state = act(state, state.match.ranker, { type: 'rank', orderedIds: players.map(p => p.id) });
    assert.equal(publicMatch().reviewNumber, 2);
  }
});

test('reshuffle preserves the ranking deadline and stale lock-ins cannot submit a replaced question', () => {
  for (const simultaneous of [false, true]) {
    let state = config.initial();
    state = act(state, host, { type: 'set_deck', deck: 'dark' });
    if (simultaneous) state = act(state, host, { type: 'set_simultaneous', enabled: true });
    state = act(state, host, { type: 'start' });
    const ranker = simultaneous ? state.match.batchAssignments[0].ranker : state.match.ranker;
    const before = config.secret(state, ranker.id);
    assert.equal(before.reshufflesLeft, 3);
    assert.equal(act(state, host, { type: 'reshuffle', promptId: before.prompt.id }), null);
    assert.equal(act({ ...state, deadline: Date.now() - 1 }, ranker, { type: 'reshuffle', promptId: before.prompt.id }), null);
    const changed = act(state, ranker, { type: 'reshuffle', promptId: before.prompt.id });
    assert.equal(changed.deadline, state.deadline);
    const after = config.secret(changed, ranker.id);
    assert.equal(after.reshufflesLeft, 2);
    const orderedIds = changed.match.rankTargets.map(p => p.id);
    assert.equal(act(changed, ranker, { type: 'rank', promptId: before.prompt.id, orderedIds }), null);
    const locked = act(changed, ranker, { type: 'rank', promptId: after.prompt.id, orderedIds });
    assert(locked);
    assert.equal(act(locked, ranker, { type: 'reshuffle', promptId: after.prompt.id }), null);
    const restarted = act(locked, host, { type: 'restart' });
    const newRanker = simultaneous ? restarted.match.batchAssignments[0].ranker : restarted.match.ranker;
    assert.equal(config.secret(restarted, newRanker.id).reshufflesLeft, 3);
  }
});
