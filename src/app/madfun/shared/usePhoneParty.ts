'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { PartyClient, type PartyPlayer } from './party-client';
import { createIdentity, isPublicKey, openFor, sealFor, type Sealed } from './private-seat';

type Participant = PartyPlayer & { publicKey: string };
type Hello = { name: string; mode: 'player' | 'watch'; publicKey: string };
type Entry = { name: string; mode: 'player' | 'watch' };
type Envelope<Public> = { protocol: string; room: string; serial: number; state: Public; secrets: Record<string, Sealed> };
export type PhonePartyConfig<Model, Public> = {
  protocol: string;
  initial: () => Model;
  view: (model: Model, participants: Participant[], hostId: string) => Public;
  secret: (model: Model, playerId: string) => unknown;
  reduce: (model: Model, actor: Participant, action: unknown, participants: Participant[], hostId: string) => Model | null;
};

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;

export function usePhoneParty<Model, Public>(config: PhonePartyConfig<Model, Public>) {
  const [client] = useState(() => new PartyClient());
  const connection = useSyncExternalStore(client.subscribe, client.getSnapshot, client.getSnapshot);
  const [state, setState] = useState<Public | null>(null);
  const [secret, setSecret] = useState<unknown>(null);
  const [issue, setIssue] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [watching, setWatching] = useState(false);
  const identity = useRef<Awaited<ReturnType<typeof createIdentity>> | null>(null);
  const model = useRef<Model | null>(null);
  const entry = useRef<Entry | null>(null);
  const hellos = useRef(new Map<string, Hello>());
  const serial = useRef(0);
  const operation = useRef(0);
  const snapshot = useRef<Envelope<Public> | null>(null);

  const participants = () => {
    const room = client.getSnapshot();
    const host = room.playerId;
    if (!host || !entry.current || !identity.current) return [];
    return [{ id: host, name: entry.current.name, connected: room.status === 'connected', publicKey: identity.current.publicKey },
      ...room.players.flatMap(player => {
        const h = hellos.current.get(player.id);
        return h?.mode === 'player' ? [{ ...player, name: h.name, publicKey: h.publicKey }] : [];
      })];
  };

  const publish = () => {
    const room = client.getSnapshot();
    if (room.role !== 'host' || !room.code || !room.playerId || model.current === null) return;
    const current = model.current;
    const players = participants();
    const id = room.playerId, code = room.code;
    const version = ++serial.current;
    const projected = config.view(current, players, id);
    setState(projected);
    setSecret(config.secret(current, id));
    void Promise.all(players.filter(p => p.id !== id).map(async p => {
      const value = config.secret(current, p.id);
      if (value == null) return null;
      try {
        const packet = await sealFor(p.publicKey, { room: code, serial: version, value });
        return [p.id, packet] as const;
      } catch { return null; }
    })).then(packets => {
      if (serial.current !== version || client.getSnapshot().code !== code) return;
      client.publish({ protocol: config.protocol, room: code, serial: version, state: projected,
        secrets: Object.fromEntries(packets.filter(p => p !== null)) });
    });
  };

  const receive = (value: unknown) => {
    const room = client.getSnapshot();
    const p = record(value);
    if (!p || p.protocol !== config.protocol || p.room !== room.code || !Number.isSafeInteger(p.serial) || !record(p.state) || !record(p.secrets)) {
      if (p && p.protocol !== config.protocol && !snapshot.current) setIssue('That room belongs to a different game.');
      return;
    }
    const message = p as unknown as Envelope<Public>;
    if (snapshot.current && snapshot.current.serial >= message.serial) return;
    snapshot.current = message;
    setIssue(null);
    setState(message.state);
    const packet = room.playerId && message.secrets[room.playerId];
    const privateKey = identity.current?.privateKey;
    if (!packet || !privateKey) { setSecret(null); return; }
    void openFor(privateKey, packet).then(value => {
      if (snapshot.current !== message) return;
      const secretPacket = record(value);
      setSecret(secretPacket?.room === room.code && secretPacket?.serial === message.serial ? secretPacket.value : null);
    }).catch(() => { if (snapshot.current === message) setSecret(null); });
  };

  const act = (id: string, value: unknown) => {
    const room = client.getSnapshot();
    if (room.status !== 'connected' || room.role !== 'host' || model.current === null || !room.playerId) return;
    const players = participants();
    const actor = players.find(p => p.id === id && p.connected);
    if (!actor) return;
    const next = config.reduce(model.current, actor, value, players, room.playerId);
    if (next !== null) { model.current = next; publish(); }
  };

  useEffect(() => {
    let welcomed = false;
    let previousRoom = '';
    const unsub = client.subscribe(() => {
      const room = client.getSnapshot();
      if (room.status !== 'connected') {
        welcomed = false;
        if (room.status === 'closed' || room.status === 'error') { setState(null); setSecret(null); }
        return;
      }
      if (room.role === 'host') {
        const roster = JSON.stringify(room.players);
        if (!welcomed || roster !== previousRoom) {
          welcomed = true;
          previousRoom = roster;
          const active = new Set(room.players.map(p => p.id));
          for (const id of hellos.current.keys()) if (!active.has(id)) hellos.current.delete(id);
          publish();
        }
      } else {
        if (!welcomed && room.hostConnected && identity.current && entry.current) {
          welcomed = true;
          client.sendAction({ protocol: config.protocol, type: 'hello', ...entry.current, publicKey: identity.current.publicKey });
        }
        if (!room.hostConnected) welcomed = false;
      }
    });
    const onAction = client.onAction(({ playerId, role, payload }) => {
      if (role !== 'player') return;
      const p = record(payload);
      if (p?.protocol !== config.protocol) return;
      if (p.type === 'hello' && isPublicKey(p.publicKey) && (p.mode === 'player' || p.mode === 'watch')) {
        if (!client.getSnapshot().players.some(s => s.id === playerId && s.connected)) return;
        const current = hellos.current.get(playerId);
        const name = client.getSnapshot().players.find(s => s.id === playerId)!.name;
        // A watcher cannot claim a playing seat mid-match by changing its tag.
        if (current && current.mode !== p.mode) return;
        if (current?.publicKey === p.publicKey) return;
        hellos.current.set(playerId, { name, mode: p.mode, publicKey: p.publicKey });
        publish();
      } else if (p.type === 'game-action') act(playerId, p.action);
    });
    const onState = client.onState(receive);
    return () => { unsub(); onAction(); onState(); client.dispose(); };
    // Configuration and transport helpers are immutable per game.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, config]);

  const leave = () => {
    operation.current++;
    serial.current++;
    client.leave(); entry.current = null; identity.current = null; hellos.current.clear();
    snapshot.current = null; model.current = null;
    setState(null); setSecret(null); setIssue(null); setOpening(false); setWatching(false);
  };

  const begin = async (who: Entry, code?: string) => {
    const name = who.name.trim();
    const roomCode = code?.trim().toUpperCase();
    if (!name || Array.from(name).length > 40 || /[\p{Cc}\p{Cf}]/u.test(name)) { setIssue('Enter a name of 1–40 characters.'); return; }
    if (code !== undefined && !/^[A-HJ-NP-Z2-9]{6}$/.test(roomCode ?? '')) { setIssue('Enter the six-character room code.'); return; }
    leave();
    const current = operation.current;
    setOpening(true);
    setWatching(who.mode === 'watch');
    try {
      const pair = await createIdentity();
      if (current !== operation.current) return;
      identity.current = pair;
      entry.current = { name, mode: who.mode };
      if (roomCode) client.join(roomCode, name, 'simulator');
      else {
        model.current = config.initial();
        // Reuse the deployed generic party transport without restarting it.
        client.create('simulator');
      }
    } catch {
      if (current === operation.current) setIssue('Unable to set up a private connection. Open this game over HTTPS.');
    } finally {
      if (current === operation.current) setOpening(false);
    }
  };
  const dispatch = (action: unknown) => {
    if (entry.current?.mode !== 'player' || connection.status !== 'connected') return;
    if (connection.role === 'host' && connection.playerId) act(connection.playerId, action);
    else client.sendAction({ protocol: config.protocol, type: 'game-action', action });
  };
  return {
    status: opening ? 'connecting' as const : connection.status, roomCode: connection.code, participantId: connection.playerId,
    host: connection.role === 'host', watching, hostConnected: connection.hostConnected,
    state, secret, error: issue ?? connection.error,
    create: (name: string) => { void begin({ mode: 'player', name }); },
    join: (code: string, name: string) => { void begin({ mode: 'player', name }, code); },
    watch: (code: string) => { void begin({ mode: 'watch', name: 'TV board' }, code); },
    leave, retry: client.retry, dispatch,
  };
}
