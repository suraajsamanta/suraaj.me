import { randomBytes, randomInt } from 'node:crypto';

export const COLORS = ['#4ce4f3', '#ff7479', '#bd9aff', '#ffd264', '#66e6a2', '#ff9de2'];
export const ZERO_INPUT = Object.freeze({ steer: 0, accelerate: false, brake: false });
export const INPUT_TIMEOUT_MS = 500;
export const HOST_GRACE_MS = 30_000;
export const PLAYER_GRACE_MS = 90_000;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const safeInput = (value) => value && typeof value === 'object' &&
  typeof value.steer === 'number' && Number.isFinite(value.steer) &&
  Math.abs(value.steer) <= 1 && typeof value.accelerate === 'boolean' && typeof value.brake === 'boolean' &&
  (value.action === undefined || (Number.isSafeInteger(value.action) && value.action >= 0));
const freshInput = () => ({ ...ZERO_INPUT });
const hasInput = (input) => input.steer !== 0 || input.accelerate || input.brake || input.action !== undefined;
const makeToken = () => randomBytes(24).toString('hex');
const cleanName = (name) => (typeof name === 'string' ? name : 'Racer')
  .replace(/[\u0000-\u001f\u007f-\u009f]/g, '').trim().slice(0, 18) || 'Racer';

/** Transport-independent room service. A peer supplies send(object) and close(). */
export class RoomService {
  constructor({ now = Date.now, maxRooms = 250 } = {}) {
    this.now = now;
    this.maxRooms = maxRooms;
    this.rooms = new Map();
    this.peers = new Set();
  }

  connect(peer) {
    peer.room = null;
    peer.role = null;
    peer.playerId = null;
    peer.tokens = 80;
    peer.tokenTime = this.now();
    peer.connectedAt = this.now();
    peer.lastState = -Infinity;
    this.peers.add(peer);
  }

  send(peer, message) { if (peer) peer.send(message); }
  error(peer, code, message, fatal = false) {
    this.send(peer, { type: 'error', code, message, fatal });
  }

  roomView(room) {
    return {
      code: room.code,
      maxPlayers: room.maxPlayers,
      locked: room.locked,
      hostConnected: Boolean(room.host),
      players: Array.from(room.players.values(), (player) => ({
        id: player.id, name: player.name, color: player.color,
        connected: Boolean(player.peer), input: { ...player.input },
        ...(player.actionSequence > 0 ? { actionSequence: player.actionSequence } : {}),
      })),
    };
  }

  broadcast(room, message, includeHost = true) {
    if (includeHost) this.send(room.host, message);
    for (const player of room.players.values()) this.send(player.peer, message);
  }
  broadcastRoom(room) { this.broadcast(room, { type: 'room', room: this.roomView(room) }); }
  welcome(peer, room, token) {
    this.send(peer, { type: 'welcome', role: peer.role, playerId: peer.playerId, token, room: this.roomView(room) });
    this.broadcastRoom(room);
  }
  resetInput(room, player) {
    const changed = hasInput(player.input);
    player.input = freshInput();
    player.actionFloor = player.actionSequence;
    if (changed) this.send(room.host, { type: 'input', playerId: player.id, input: player.input });
  }

  receive(peer, message) {
    if (!this.peers.has(peer)) return;
    const now = this.now();
    peer.tokens = Math.min(80, peer.tokens + (now - peer.tokenTime) * 0.06);
    peer.tokenTime = now;
    if (peer.tokens < 1) {
      this.error(peer, 'rate_limit', 'Too many messages. Please reconnect.', true);
      peer.close();
      this.disconnect(peer);
      return;
    }
    peer.tokens -= 1;
    if (!message || typeof message !== 'object' || Array.isArray(message) || typeof message.type !== 'string') {
      this.error(peer, 'invalid_message', 'Invalid message.'); return;
    }
    if (['create', 'join', 'resume'].includes(message.type)) {
      if (peer.room) { this.error(peer, 'already_joined', 'Leave the current room first.'); return; }
      if (message.type === 'create') this.create(peer, message);
      else if (message.type === 'join') this.join(peer, message);
      else this.resume(peer, message);
      return;
    }
    const room = this.rooms.get(peer.room);
    if (!room) { this.error(peer, 'not_joined', 'Join a room first.'); return; }
    room.touchedAt = now;
    switch (message.type) {
      case 'input': {
        if (peer.role !== 'player' || !safeInput(message.input)) {
          this.error(peer, 'invalid_input', 'Only controllers may send valid driving input.'); return;
        }
        const player = room.players.get(peer.playerId);
        if (!player || player.peer !== peer) return;
        player.lastInputAt = now;
        const sequence = message.input.action;
        if (sequence === undefined || sequence === 0) player.actionFloor = player.actionSequence;
        else player.actionSequence = Math.max(player.actionSequence, sequence);
        if (!room.host) player.actionFloor = player.actionSequence;
        player.input = room.host ? {
          steer: message.input.steer, accelerate: message.input.accelerate, brake: message.input.brake,
          ...(sequence > player.actionFloor ? { action: player.actionSequence } : {}),
        } : freshInput();
        this.send(room.host, { type: 'input', playerId: player.id, input: player.input });
        break;
      }
      case 'state':
        if (peer.role !== 'host' || room.host !== peer) {
          this.error(peer, 'host_only', 'Only the host may publish race state.'); return;
        }
        // 20 Hz maximum. The laptop remains authoritative; the relay never interprets race state.
        if (now - peer.lastState < 50) return;
        if (JSON.stringify(message.payload ?? null).length > 32_768) {
          this.error(peer, 'state_too_large', 'Race update is too large.'); return;
        }
        peer.lastState = now;
        this.broadcast(room, { type: 'state', payload: message.payload ?? null }, false);
        break;
      case 'lock':
        if (peer.role !== 'host' || room.host !== peer || typeof message.locked !== 'boolean') {
          this.error(peer, 'host_only', 'Only the host may lock the room.'); return;
        }
        room.locked = message.locked;
        this.broadcastRoom(room);
        break;
      case 'leave':
        if (peer.role === 'host') this.closeRoom(room, 'The host ended the room.');
        else {
          const player = room.players.get(peer.playerId);
          if (player) this.resetInput(room, player);
          room.players.delete(peer.playerId);
          peer.room = null;
          peer.role = null;
          peer.playerId = null;
          this.broadcastRoom(room);
        }
        break;
      default: this.error(peer, 'unknown_message', 'Unsupported message.');
    }
  }

  create(peer, message) {
    if (this.rooms.size >= this.maxRooms) {
      this.error(peer, 'server_full', 'The relay is full. Try again shortly.', true); return;
    }
    const maxPlayers = message.maxPlayers ?? 6;
    if (!Number.isInteger(maxPlayers) || maxPlayers < 4 || maxPlayers > 6) {
      this.error(peer, 'invalid_capacity', 'Choose between four and six racer slots.', true); return;
    }
    let code;
    do { code = Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join(''); }
    while (this.rooms.has(code));
    const room = {
      code, maxPlayers, players: new Map(), host: peer, hostToken: makeToken(),
      hostGoneAt: null, touchedAt: this.now(), locked: false,
    };
    this.rooms.set(code, room);
    peer.room = code;
    peer.role = 'host';
    this.welcome(peer, room, room.hostToken);
  }

  getJoinRoom(peer, message) {
    const code = typeof message.code === 'string' ? message.code.trim().toUpperCase() : '';
    if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code) || !this.rooms.has(code)) {
      this.error(peer, 'room_not_found', 'Room not found. Check the code or ask the host for a new room.', true);
      return null;
    }
    return this.rooms.get(code);
  }

  join(peer, message) {
    const room = this.getJoinRoom(peer, message);
    if (!room) return;
    if (!room.host) { this.error(peer, 'host_away', 'The host is reconnecting. Try again shortly.', true); return; }
    if (room.locked) { this.error(peer, 'room_locked', 'This race has started. Ask the host to open a new race.', true); return; }
    if (room.players.size >= room.maxPlayers) { this.error(peer, 'room_full', 'All racer slots are taken.', true); return; }
    const usedColors = new Set(Array.from(room.players.values(), (p) => p.color));
    const player = {
      id: randomBytes(8).toString('hex'), token: makeToken(), name: cleanName(message.name),
      color: COLORS.find((color) => !usedColors.has(color)), peer,
      input: freshInput(), actionSequence: 0, actionFloor: 0, lastInputAt: this.now(), goneAt: null,
    };
    room.players.set(player.id, player);
    room.touchedAt = this.now();
    peer.room = room.code;
    peer.role = 'player';
    peer.playerId = player.id;
    this.welcome(peer, room, player.token);
  }

  resume(peer, message) {
    const room = this.getJoinRoom(peer, message);
    if (!room) return;
    if (typeof message.token !== 'string' || !/^[a-f0-9]{48}$/.test(message.token)) {
      this.error(peer, 'invalid_session', 'This session has expired. Join again.', true); return;
    }
    if (message.token === room.hostToken) {
      if (room.host && room.host !== peer) {
        const old = room.host;
        old.room = null;
        this.error(old, 'session_replaced', 'The host connected in another tab.', true);
        old.close();
      }
      room.host = peer;
      room.hostGoneAt = null;
      peer.room = room.code;
      peer.role = 'host';
      for (const player of room.players.values()) this.resetInput(room, player);
      this.welcome(peer, room, room.hostToken);
      return;
    }
    const player = Array.from(room.players.values()).find((p) => p.token === message.token);
    if (!player) { this.error(peer, 'invalid_session', 'This session has expired. Join again.', true); return; }
    if (player.peer && player.peer !== peer) {
      const old = player.peer;
      old.room = null;
      this.error(old, 'session_replaced', 'This controller connected in another tab.', true);
      old.close();
    }
    player.peer = peer;
    player.goneAt = null;
    player.lastInputAt = this.now();
    this.resetInput(room, player);
    peer.room = room.code;
    peer.role = 'player';
    peer.playerId = player.id;
    this.welcome(peer, room, player.token);
  }

  disconnect(peer) {
    this.peers.delete(peer);
    const room = this.rooms.get(peer.room);
    if (!room) return;
    if (room.host === peer) {
      room.host = null;
      room.hostGoneAt = this.now();
      for (const player of room.players.values()) this.resetInput(room, player);
    } else {
      const player = room.players.get(peer.playerId);
      if (player?.peer === peer) {
        this.resetInput(room, player);
        player.peer = null;
        player.goneAt = this.now();
      }
    }
    peer.room = null;
    this.broadcastRoom(room);
  }

  closeRoom(room, reason) {
    this.broadcast(room, { type: 'room_closed', reason });
    for (const peer of [room.host, ...Array.from(room.players.values(), (p) => p.peer)]) {
      if (peer) { peer.room = null; peer.close(); }
    }
    this.rooms.delete(room.code);
  }

  sweep() {
    const now = this.now();
    // Unauthenticated peers cannot occupy sockets indefinitely.
    for (const peer of this.peers) {
      if (!peer.room && now - peer.connectedAt > 15_000) { peer.close(); this.peers.delete(peer); }
    }
    for (const room of this.rooms.values()) {
      if ((room.hostGoneAt !== null && now - room.hostGoneAt > HOST_GRACE_MS) || now - room.touchedAt > 7_200_000) {
        this.closeRoom(room, 'The host left. Start a new room to race again.'); continue;
      }
      let rosterChanged = false;
      for (const [id, player] of room.players) {
        if (now - player.lastInputAt > INPUT_TIMEOUT_MS) this.resetInput(room, player);
        if (player.goneAt !== null && now - player.goneAt > PLAYER_GRACE_MS) {
          room.players.delete(id);
          rosterChanged = true;
        }
      }
      if (rosterChanged) this.broadcastRoom(room);
    }
  }
}
