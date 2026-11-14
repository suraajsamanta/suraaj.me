import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('./private-seat.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } });
const { createIdentity, isPublicKey, openFor, sealFor } = await import('data:text/javascript;base64,' + Buffer.from(outputText).toString('base64'));

test('each private-seat packet is readable by its intended browser and not another seat', async () => {
  const [red, blue, spectator] = await Promise.all([createIdentity(), createIdentity(), createIdentity()]);
  const value = { room: 'ABC234', serial: 20, value: ['red', 'blue', 'assassin'] };
  assert.ok(isPublicKey(red.publicKey));
  const [redPacket, bluePacket] = await Promise.all([sealFor(red.publicKey, value), sealFor(blue.publicKey, value)]);
  assert.deepEqual(await openFor(red.privateKey, redPacket), value);
  assert.deepEqual(await openFor(blue.privateKey, bluePacket), value);
  await assert.rejects(() => openFor(blue.privateKey, redPacket));
  await assert.rejects(() => openFor(spectator.privateKey, redPacket));
  await assert.rejects(() => crypto.subtle.exportKey('jwk', red.privateKey));
  assert.notEqual(redPacket.ciphertext, bluePacket.ciphertext);
});

test('private seat rejects tampering and invalid key exchanges', async () => {
  const { publicKey, privateKey } = await createIdentity();
  const packet = await sealFor(publicKey, { prompt: 'An unrevealed prompt' });
  const first = packet.ciphertext[0] === 'Z' ? 'A' : 'Z';
  await assert.rejects(() => openFor(privateKey, { ...packet, ciphertext: first + packet.ciphertext.slice(1) }));
  await assert.rejects(() => sealFor('invalid-public-key', {}));
});
