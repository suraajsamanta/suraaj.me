'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { PartyClient, type PartyPlayer } from './party-client';
import { PartySeatRegistry, browserSeatCredential, forgetActivePlayer, isSeatCredential, readActivePlayer, rememberActivePlayer } from './party-seat-recovery';
import { createIdentity, isPublicKey, openFor, sealFor, type Sealed } from './private-seat';

type Participant = PartyPlayer & { publicKey: string };
type Hello = { name: string; mode: 'player' | 'watch'; publicKey: string; seatCredential?: string };
type Entry = { name: string; mode: 'host' | 'player' | 'watch'; seatCredential?: string };
type Envelope<Public> = { protocol: string; room: string; serial: number; state: Public; secrets: Record<string, Sealed>; seatIds?: Record<string,string> };
export type PhonePartyConfig<Model, Public> = {
  protocol: string;
  recoverPlayersKey?: string;
  initial: () => Model;
  reconcilePresence?: (model: Model, participants: Participant[]) => Model;
  view: (model: Model, participants: Participant[], hostId: string) => Public;
  secret: (model: Model, playerId: string) => unknown;
  // Allow a game to retain private, high-frequency draft data on the host without
  // rebroadcasting a full snapshot. Normal actions and presence still publish.
  shouldPublish?: (before: Model, after: Model, action: unknown) => boolean;
  reduce: (model: Model, actor: PartyPlayer, action: unknown, participants: Participant[], hostId: string) => Model | null;
};

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;

export function usePhoneParty<Model, Public>(config: PhonePartyConfig<Model, Public>) {
  const [client] = useState(() => new PartyClient(undefined, { rememberPlayerSeatKey: config.recoverPlayersKey && config.recoverPlayersKey + '.transport' }));
  const connection = useSyncExternalStore(client.subscribe, client.getSnapshot, client.getSnapshot);
  const [state, setState] = useState<Public | null>(null);
  const [secret, setSecret] = useState<unknown>(null);
  const [issue, setIssue] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [watching, setWatching] = useState(false);
  const [seatId, setSeatId] = useState<string | null>(null);
  const identity = useRef<Awaited<ReturnType<typeof createIdentity>> | null>(null);
  const model = useRef<Model | null>(null);
  const entry = useRef<Entry | null>(null);
  const [registry] = useState(() => new PartySeatRegistry());
  const hellos = useRef(new Map<string, Hello>());
  const serial = useRef(0);
  const operation = useRef(0);
  const snapshot = useRef<Envelope<Public> | null>(null);

  const participants = (): (Participant & { transportId: string })[] => {
    const room = client.getSnapshot();
    if (config.recoverPlayersKey) {
      const connected = new Set(room.players.filter(p => p.connected).map(p => p.id));
      return registry.entries().map(({ id, name, transportId }) => ({
        id, name, transportId, connected: connected.has(transportId),
        publicKey: hellos.current.get(transportId)?.publicKey ?? '',
      }));
    }
    // Only phones that joined as players can take a gameplay seat or receive secrets.
    return room.players.flatMap(player => {
      const h = hellos.current.get(player.id);
      return h?.mode === 'player' ? [{ ...player, name: h.name, publicKey: h.publicKey, transportId: player.id }] : [];
    });
  };

  const publish = () => {
    const room = client.getSnapshot();
    if (room.role !== 'host' || !room.code || !room.playerId || model.current === null) return;
    const players = participants();
    const current = config.reconcilePresence?.(model.current, players) ?? model.current;
    model.current = current;
    const id = room.playerId, code = room.code;
    const version = ++serial.current;
    const projected = config.view(current, players, id);
    setState(projected);
    setSecret(null);
    void Promise.all(players.map(async p => {
      if (!p.publicKey) return null;
      const value = config.secret(current, p.id);
      if (value == null) return null;
      try {
        const packet = await sealFor(p.publicKey, { room: code, serial: version, value });
        return [p.transportId, packet] as const;
      } catch { return null; }
    })).then(packets => {
      if (serial.current !== version || client.getSnapshot().code !== code) return;
      client.publish({ protocol: config.protocol, room: code, serial: version, state: projected,
        secrets: Object.fromEntries(packets.filter(p => p !== null)),
        ...(config.recoverPlayersKey ? {
          seatIds: Object.fromEntries(players.filter(p => p.connected).map(p => [p.transportId, p.id])),
        } : {}), });
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
    if (config.recoverPlayersKey) {
      const aliases = record(message.seatIds);
      const alias = room.playerId && aliases && Object.hasOwn(aliases, room.playerId) ? aliases[room.playerId] : null;
      setSeatId(typeof alias === 'string' ? alias : null);
    }
    const packet = entry.current?.mode === 'player' && room.playerId && message.secrets[room.playerId];
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
    const actor = id === room.playerId
      ? { id, name: 'Host screen', connected: true }
      : players.find(p => p.transportId === id && p.connected);
    if (!actor) return;
    const previous = model.current;
    const next = config.reduce(previous, actor, value, players, room.playerId);
    if (next !== null) {
      model.current = next;
      if (config.shouldPublish?.(previous, next, value) !== false) publish();
    }
  };

  useEffect(() => {
    let welcomed = false;
    let previousRoom = '';
    let welcomedAs = '';
    const unsub = client.subscribe(() => {
      const room = client.getSnapshot();
      if (room.status !== 'connected') {
        welcomed = false;
        if (room.status === 'closed' && config.recoverPlayersKey && entry.current?.mode === 'player') {
          forgetActivePlayer(config.recoverPlayersKey);
        }
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
        if (config.recoverPlayersKey && room.playerId && room.playerId !== welcomedAs) {
          welcomedAs = room.playerId;
          snapshot.current = null;
          setSeatId(null);
          setSecret(null);
        }
        if (!welcomed && room.hostConnected && identity.current && entry.current && entry.current.mode !== 'host') {
          welcomed = true;
          if (config.recoverPlayersKey && room.code && entry.current.mode === 'player') {
            rememberActivePlayer(config.recoverPlayersKey, { code: room.code, name: entry.current.name });
          }
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
        if (config.recoverPlayersKey && p.mode === 'player' &&
          !registry.bind(playerId, name, isSeatCredential(p.seatCredential) ? p.seatCredential : undefined)) return;
        hellos.current.set(playerId, { name, mode: p.mode, publicKey: p.publicKey });
        publish();
      } else if (p.type === 'game-action') act(playerId, p.action);
    });
    const onState = client.onState(receive);
    let lastWake = 0;
    const wake = () => {
      if (!config.recoverPlayersKey || document.visibilityState !== 'visible' || entry.current?.mode !== 'player') return;
      const room = client.getSnapshot();
      const now = Date.now();
      if ((room.status === 'reconnecting' || room.status === 'error') && room.code &&
        readActivePlayer(config.recoverPlayersKey, room.code) && now - lastWake > 500) {
        lastWake = now;
        client.retry();
      }
    };
    if (config.recoverPlayersKey) {
      document.addEventListener('visibilitychange', wake);
      window.addEventListener('online', wake);
    }
    return () => {
      if (config.recoverPlayersKey) {
        document.removeEventListener('visibilitychange', wake);
        window.removeEventListener('online', wake);
      }
      unsub(); onAction(); onState(); client.dispose();
    };
    // Configuration and transport helpers are immutable per game.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, config]);

  const leave = (forget = true) => {
    operation.current++;
    serial.current++;
    if (forget && config.recoverPlayersKey && entry.current?.mode === 'player') {
      forgetActivePlayer(config.recoverPlayersKey);
    }
    if (forget) client.forgetSimulatorSeat();
    client.leave(); registry.clear(); entry.current = null; identity.current = null; hellos.current.clear();
    snapshot.current = null; model.current = null;
    setState(null); setSecret(null); setSeatId(null); setIssue(null); setOpening(false); setWatching(false);
  };

  const begin = async (who: Entry, code?: string) => {
    const name = who.name.trim();
    const roomCode = code?.trim().toUpperCase();
    if (!name || Array.from(name).length > 40 || /[\p{Cc}\p{Cf}]/u.test(name)) { setIssue('Enter a name of 1–40 characters.'); return; }
    if (code !== undefined && !/^[A-HJ-NP-Z2-9]{6}$/.test(roomCode ?? '')) { setIssue('Enter the six-character room code.'); return; }
    leave(false);
    const current = operation.current;
    setOpening(true);
    setWatching(who.mode === 'watch');
    try {
      const pair = who.mode === 'host' ? null : await createIdentity();
      if (current !== operation.current) return;
      identity.current = pair;
      entry.current = { name, mode: who.mode,
        ...(who.mode === 'player' && roomCode && config.recoverPlayersKey ? {
          seatCredential: browserSeatCredential(config.recoverPlayersKey, roomCode, name),
        } : {}),
      };
      if (roomCode) client.join(roomCode, name, 'simulator', who.mode === 'player');
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
    if (connection.status !== 'connected') return;
    if (entry.current?.mode === 'host' && connection.role === 'host' && connection.playerId) act(connection.playerId, action);
    else if (entry.current?.mode === 'player' && connection.role === 'player') client.sendAction({ protocol: config.protocol, type: 'game-action', action });
  };
  return {
    status: opening ? 'connecting' as const : connection.status, roomCode: connection.code, participantId: connection.role === 'player' && !watching ? seatId ?? connection.playerId : null,
    host: connection.role === 'host', watching, hostConnected: connection.hostConnected,
    state, secret, error: issue ?? connection.error,
    create: () => { void begin({ mode: 'host', name: 'Host screen' }); },
    join: (code: string, name: string) => { void begin({ mode: 'player', name }, code); },
    watch: (code: string) => { void begin({ mode: 'watch', name: 'TV board' }, code); },
    restorePlayer: (code?: string) => {
      if (!config.recoverPlayersKey || client.getSnapshot().status !== 'idle' || entry.current) return false;
      const saved = readActivePlayer(config.recoverPlayersKey, code);
      if (!saved) return false;
      void begin({ mode: 'player', name: saved.name }, saved.code);
      return true;
    },
    leave: () => leave(), retry: client.retry, dispatch,
  };
}
