import { createHash, randomBytes, randomInt } from 'node:crypto';

export const COLORS = ['#4ce4f3', '#ff7479', '#bd9aff', '#ffd264', '#66e6a2', '#ff9de2', '#fb9855', '#92c7ff', '#e9ee79', '#d2a27b'];
export const ZERO_INPUT = Object.freeze({ steer: 0, accelerate: false, brake: false });
export const INPUT_TIMEOUT_MS = 500;
export const HOST_GRACE_MS = 30_000;
export const PLAYER_GRACE_MS = 90_000;
export const LEGACY_SELECTION_CHARACTERS = ['gorilla', 'tiger', 'monkey', 'hippo', 'flamingo', 'rabbit', 'panda', 'zebra', 'cow', 'sheep', 'lion', 'buffalo', 'orangutan', 'elephant', 'goat', 'crocodile', 'antelope', 'fish', 'pig', 'ram', 'donkey', 'bear', 'giraffe', 'horse'];
export const SELECTION_CHARACTERS = [...LEGACY_SELECTION_CHARACTERS, 'bezos', 'trump', 'musk', 'zuckerberg', 'ye', 'huang'];
export const SELECTION_COLUMNS = 6;
const selectionCharacters = room => room.characterSelectionVersion >= 2 ? SELECTION_CHARACTERS : LEGACY_SELECTION_CHARACTERS;
export const SELECTION_COUNTDOWN_MS = 5000;
const CHARACTERS = new Set([...SELECTION_CHARACTERS, 'fox', 'robot', 'frog', 'cat', 'alien', 'bear', 'bird', 'blob']);
const VEHICLES = new Set(['kart', 'buggy', 'roadster', 'motorcycle', 'bmw-m2', 'bmw-m3', 'bmw-m4', 'amg-gt', 'amg-g63', 'lamborghini', 'mclaren', 'ferrari', 'ducati', 'bmw-bike', 'cybertruck', 'tesla-roadster', 'bugatti']);
const validAppearance = (a) => a && typeof a === 'object' && !Array.isArray(a) && CHARACTERS.has(a.character) && VEHICLES.has(a.vehicle) && typeof a.color === 'string' && /^#[a-f\d]{6}$/i.test(a.color);
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const safeInput = (value) => value && typeof value === 'object' &&
  typeof value.steer === 'number' && Number.isFinite(value.steer) &&
  Math.abs(value.steer) <= 1 && typeof value.accelerate === 'boolean' && typeof value.brake === 'boolean' &&
  (value.drift === undefined || typeof value.drift === 'boolean') &&
  (value.action === undefined || (Number.isSafeInteger(value.action) && value.action >= 0));
const freshInput = () => ({ ...ZERO_INPUT });
const hasInput = (input) => input.steer !== 0 || input.accelerate || input.brake || input.drift || input.action !== undefined;
const makeToken = () => randomBytes(24).toString('hex');
const hashToken = (token) => createHash('sha256').update(token).digest('hex');
const isToken = (token) => typeof token === 'string' && /^[a-f0-9]{48}$/.test(token);
const isHash = (hash) => typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash);
const cleanName = (name) => (typeof name === 'string' ? name : 'Racer')
  .replace(/[\u0000-\u001f\u007f-\u009f]/g, '').trim() || 'Racer';
const validName = (name) => Array.from(name).length <= 64;

/** Transport-independent room service. A peer supplies send(object) and close(). */
export class RoomService {
  constructor({ now = Date.now, maxRooms = 250 } = {}) {
    this.now = now;
    this.maxRooms = maxRooms;
    this.rooms = new Map();
    this.roomsByIdentity = new Map();
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
      serverTime: this.now(),
      maxPlayers: room.maxPlayers,
      publicMatchmaking: room.publicMatchmaking === true,
      locked: room.locked,
      characterSelection: room.characterSelection === true, characterSelectionVersion: room.characterSelectionVersion ?? 1, selectionPhase: room.selectionPhase ?? "gathering", countdownEndsAt: room.countdownEndsAt ?? null,
      recovering: room.recovering,
      recoveryWaitingFor: room.recovering ? [...room.participants].filter(id => !room.players.get(id)?.peer) : [],
      hostConnected: Boolean(room.host),
      players: Array.from(room.players.values(), (player) => ({
        id: player.id, name: player.name, color: player.color, character: player.character, characterCursor: player.characterCursor ?? null, vehicle: player.vehicle,
        connected: Boolean(player.peer) && !room.pendingWelcomes.has(player.peer), ready: player.ready === true, characterConfirmed: player.characterConfirmed === true, inRace: room.locked && room.participants.has(player.id), input: { ...player.input },
        ...(player.actionSequence > 0 ? { actionSequence: player.actionSequence } : {}),
      })),
    };
  }

  broadcast(room, message, includeHost = true) {
    if (includeHost) this.send(room.host, message);
    for (const player of room.players.values()) this.send(player.peer, message);
  }
  checkpoint(room) {
    // Private host-only checkpoint: hashes authorize returning controllers, never new ones.
    this.send(room.host, { type: 'checkpoint', checkpoint: {
      version: 1, revision: ++room.checkpointRevision, ackRequired: room.pendingWelcomes.size > 0,
      roomId: room.roomId, maxPlayers: room.maxPlayers, locked: room.locked, publicMatchmaking: room.publicMatchmaking === true,
      characterSelection: room.characterSelection === true, characterSelectionVersion: room.characterSelectionVersion ?? 1, selectionPhase: room.selectionPhase,
      participants: [...room.participants],
      players: Array.from(room.players.values(), (p) => ({
        id: p.id, name: p.name, color: p.color, character: p.character, characterCursor: p.characterCursor ?? null, vehicle: p.vehicle,
        tokenHash: p.tokenHash, actionSequence: p.actionSequence, characterConfirmed: p.characterConfirmed === true,
      })),
    } });
  }
  updateSelection(room) {
    if (!room.characterSelection || room.locked || !(room.characterSelectionVersion >= 4 ? ['gathering', 'selecting', 'countdown'] : ['selecting', 'countdown']).includes(room.selectionPhase)) return;
    const players = [...room.players.values()];
    const allSelected = Boolean(room.host) && players.length > 0 && room.pendingWelcomes.size === 0 &&
      players.every(player => player.peer && player.characterConfirmed);
    if (allSelected && room.characterSelectionVersion >= 4) {
      room.locked = true; room.selectionPhase = 'racing'; room.countdownEndsAt = null;
      room.participants = new Set(players.map(player => player.id));
      for (const player of players) this.resetInput(room, player);
      return;
    }
    if (!allSelected && room.selectionPhase === 'gathering') return;
    if (!allSelected) { room.selectionPhase = 'selecting'; room.countdownEndsAt = null; }
    else if (room.selectionPhase !== 'countdown') {
      room.selectionPhase = 'countdown'; room.countdownEndsAt = this.now() + (room.characterSelectionVersion >= 3 ? 8000 : SELECTION_COUNTDOWN_MS);
    }
  }
  broadcastRoom(room) { this.updateSelection(room); this.checkpoint(room); this.broadcast(room, { type: 'room', room: this.roomView(room) }); }
  welcome(peer, room, token, waitForCheckpoint = false) {
    if (waitForCheckpoint && room.recoveryEnabled) {
      // Do not tell a new controller it has joined until the host retained its
      // identity. A crash before that acknowledgment must not strand a live racer.
      room.pendingWelcomes.set(peer, { token, revision: room.checkpointRevision + 1, since: this.now() });
      this.broadcastRoom(room);
      return;
    }
    this.send(peer, { type: 'welcome', role: peer.role, playerId: peer.playerId, token, roomId: room.roomId, room: this.roomView(room) });
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
    if (['create', 'join', 'join_random', 'resume'].includes(message.type)) {
      if (peer.room) { this.error(peer, 'already_joined', 'Leave the current room first.'); return; }
      if (message.type === 'create') this.create(peer, message);
      else if (message.type === 'join') this.join(peer, message);
      else if (message.type === 'join_random') this.joinRandom(peer, message);
      else this.resume(peer, message);
      return;
    }
    const room = this.rooms.get(peer.room);
    if (!room) { this.error(peer, 'not_joined', 'Join a room first.'); return; }
    room.touchedAt = now;
    switch (message.type) {
      case 'checkpoint_ack':
        if (peer.role !== 'host' || room.host !== peer || !Number.isSafeInteger(message.revision) || message.revision < 1 || message.revision > room.checkpointRevision) {
          this.error(peer, 'invalid_checkpoint_ack', 'Only the host may acknowledge its room checkpoint.'); return;
        }
        for (const [controller, pending] of room.pendingWelcomes) {
          if (pending.revision <= message.revision) {
            room.pendingWelcomes.delete(controller);
            if (controller.room === room.code && this.peers.has(controller)) this.welcome(controller, room, pending.token);
          }
        }
        break;
      case 'input': {
        if (peer.role !== 'player' || !safeInput(message.input)) {
          this.error(peer, 'invalid_input', 'Only controllers may send valid driving input.'); return;
        }
        const player = room.players.get(peer.playerId);
        if (!player || player.peer !== peer) return;
        player.lastInputAt = now;
        const sequence = message.input.action;
        const previousSequence = player.actionSequence;
        if (sequence === undefined || sequence === 0) player.actionFloor = player.actionSequence;
        else player.actionSequence = Math.max(player.actionSequence, sequence);
        // Lobby/results traffic must never queue movement or an item for a rematch.
        const racing = Boolean(room.host) && room.locked && !room.recovering && room.participants.has(player.id) && !room.pendingWelcomes.has(peer);
        if (!racing) player.actionFloor = player.actionSequence;
        player.input = racing ? {
          steer: message.input.steer, accelerate: message.input.accelerate, brake: message.input.brake,
          ...(typeof message.input.drift === 'boolean' ? { drift: message.input.drift } : {}),
          ...(sequence > player.actionFloor ? { action: player.actionSequence } : {}),
        } : freshInput();
        // Update the host's retained checkpoint in the same packet as the action.
        // Avoid full-roster checkpoints/acknowledgments on driving heartbeats.
        this.send(room.host, { type: 'input', playerId: player.id, input: player.input,
          ...(player.actionSequence !== previousSequence ? { actionSequence: player.actionSequence } : {}),
        });
        break;
      }
      case 'select_characters':
        if (peer.role !== 'host' || room.host !== peer) { this.error(peer, 'host_only', 'Only the host may open character selection.'); return; }
        if (!room.characterSelection || room.locked || ![...room.players.values()].some(p => p.peer && !room.pendingWelcomes.has(p.peer))) { this.error(peer, 'selection_unavailable', 'Wait for a connected driver before choosing characters.'); return; }
        room.selectionPhase = 'selecting'; room.countdownEndsAt = null;
        for (const player of room.players.values()) {
          if (room.characterSelectionVersion < 3) player.characterConfirmed = false;
          if (room.characterSelectionVersion < 3 && !selectionCharacters(room).includes(player.character)) player.character = selectionCharacters(room)[0];
          this.resetInput(room, player);
        }
        this.broadcastRoom(room);
        break;
      case 'skip_offline':
        if (peer.role !== 'host' || room.host !== peer || room.locked || !room.characterSelection) { this.error(peer, 'host_only', 'Only the host may continue without disconnected drivers before the race.'); return; }
        for (const [id, player] of room.players) if (!player.peer) room.players.delete(id);
        this.broadcastRoom(room);
        break;
      case 'character': {
        const player = room.players.get(peer.playerId);
        if (peer.role !== 'player' || !player || player.peer !== peer || room.pendingWelcomes.has(peer)) { this.error(peer, 'player_only', 'Only a joined driver may choose a character.'); return; }
        if (!room.host || !room.characterSelection || room.locked || !(room.characterSelectionVersion >= 3 ? ['gathering', 'selecting', 'countdown'] : ['selecting', 'countdown']).includes(room.selectionPhase)) { this.error(peer, 'selection_unavailable', 'Character selection is not open.'); return; }
        if (message.confirm === true && message.direction === undefined) {
          if (room.characterSelectionVersion >= 3 && !selectionCharacters(room).includes(player.characterCursor)) { this.error(peer, 'invalid_character_choice', 'Move the joystick to choose a character first.'); return; }
          if (room.characterSelectionVersion >= 3) player.character = player.characterCursor;
          player.characterConfirmed = true;
        } else if (message.confirm === false && message.direction === undefined) { player.characterConfirmed = false; if (room.characterSelectionVersion >= 3) player.character = null; }
        else if (['up', 'down', 'left', 'right'].includes(message.direction) && message.confirm === undefined && !player.characterConfirmed) {
          const characters = selectionCharacters(room), columns = SELECTION_COLUMNS, rows = Math.ceil(characters.length / columns);
          const index = characters.indexOf(room.characterSelectionVersion >= 3 ? player.characterCursor : player.character);
          if (index < 0) { player.characterCursor = characters[0]; this.broadcastRoom(room); break; }
          const row = Math.floor(index / columns), column = index % columns;
          const next = message.direction === 'left' ? row * columns + (column + columns - 1) % columns : message.direction === 'right' ? row * columns + (column + 1) % columns : message.direction === 'up' ? ((row + rows - 1) % rows) * columns + column : ((row + 1) % rows) * columns + column;
          if (room.characterSelectionVersion >= 3) player.characterCursor = characters[next];
          else player.character = characters[next];
        } else { this.error(peer, 'invalid_character_choice', 'Use a direction or select the highlighted character.'); return; }
        this.broadcastRoom(room);
        break;
      }
      case 'appearance': {
        const player = room.players.get(peer.playerId);
        if (peer.role !== 'player' || !player || player.peer !== peer) { this.error(peer, 'player_only', 'Only a player may change their appearance.'); return; }
        if (room.locked || (room.characterSelection && room.selectionPhase !== 'gathering')) { this.error(peer, 'room_locked', 'Appearance is locked during character selection and racing.'); return; }
        if (!validAppearance(message.appearance)) { this.error(peer, 'invalid_appearance', 'Choose a valid racer, vehicle, and color.'); return; }
        const changed = player.character !== message.appearance.character || player.vehicle !== message.appearance.vehicle || player.color !== message.appearance.color.toLowerCase();
        Object.assign(player, { character: room.characterSelectionVersion >= 3 ? player.character : message.appearance.character, vehicle: message.appearance.vehicle, color: message.appearance.color.toLowerCase() });
        if (changed) player.ready = false;
        this.broadcastRoom(room);
        break;
      }
      case 'ready': {
        const player = room.players.get(peer.playerId);
        if (peer.role !== 'player' || !player || player.peer !== peer || room.pendingWelcomes.has(peer)) { this.error(peer, 'player_only', 'Only a joined player may set their readiness.'); return; }
        if (room.characterSelection) { this.error(peer, 'selection_required', 'Choose your character instead. No ready-up is needed.'); return; }
        if (room.locked || room.recovering) { this.error(peer, 'room_locked', 'Readiness is locked during a race.'); return; }
        if (typeof message.ready !== 'boolean') { this.error(peer, 'invalid_ready', 'Choose ready or not ready.'); return; }
        player.ready = message.ready;
        this.broadcastRoom(room);
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
        if (!message.locked && room.characterSelection && !room.locked) {
          room.selectionPhase = 'gathering'; room.countdownEndsAt = null;
          if (room.characterSelectionVersion < 3) for (const player of room.players.values()) player.characterConfirmed = false;
        }
        if (room.locked !== message.locked) {
          if (message.locked) {
            if (room.characterSelection) { this.error(peer, 'selection_required', 'The race starts after the host starts the countdown and everyone has selected a character.'); return; }
            const entrants = [...room.players.values()].filter(player => player.peer && !room.pendingWelcomes.has(player.peer));
            if (!entrants.length || entrants.some(player => !player.ready)) {
              this.error(peer, 'not_ready', 'Every connected driver must be ready before starting.'); return;
            }
          } else {
            for (const player of room.players.values()) { player.ready = false; player.characterConfirmed = false; if (room.characterSelectionVersion >= 3) { player.character = null; player.characterCursor = null; } }
            room.selectionPhase = 'gathering'; room.countdownEndsAt = null;
          }
          room.locked = message.locked;
          if (!room.locked) room.recovering = false;
          room.participants = new Set(room.locked ? Array.from(room.players.values()).filter(player => player.peer && !room.pendingWelcomes.has(player.peer)).map(player => player.id) : []);
          for (const player of room.players.values()) this.resetInput(room, player);
        }
        this.broadcastRoom(room);
        break;
      case 'resume_race':
        if (peer.role !== 'host' || room.host !== peer) {
          this.error(peer, 'host_only', 'Only the host may resume the race with missing controllers.'); return;
        }
        if (!room.recovering) return;
        room.recovering = false;
        for (const player of room.players.values()) {
          this.resetInput(room, player);
          if (!player.peer && room.participants.has(player.id)) player.goneAt = now;
        }
        this.broadcastRoom(room);
        break;
      case 'leave':
        if (peer.role === 'host') this.closeRoom(room, 'The host ended the room.');
        else {
          const player = room.players.get(peer.playerId);
          if (player) this.resetInput(room, player);
          room.players.delete(peer.playerId);
          room.participants.delete(peer.playerId);
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
    const maxPlayers = message.maxPlayers ?? 10;
    if (!Number.isInteger(maxPlayers) || maxPlayers < 4 || maxPlayers > 10) {
      this.error(peer, 'invalid_capacity', 'Choose between four and ten racer slots.', true); return;
    }
    const code = this.makeCode();
    const hostToken = makeToken();
    const room = {
      code, maxPlayers, publicMatchmaking: message.publicMatchmaking === true, players: new Map(), host: peer, hostToken, roomId: hashToken(hostToken),
      hostGoneAt: null, touchedAt: this.now(), locked: false, recovering: false,
      characterSelection: [1, 2, 3, 4].includes(message.characterSelectionVersion), characterSelectionVersion: [2, 3, 4].includes(message.characterSelectionVersion) ? message.characterSelectionVersion : 1, selectionPhase: 'gathering', countdownEndsAt: null,
      recoveryEnabled: message.recoveryVersion === 1, checkpointRevision: 0, pendingWelcomes: new Map(),
      participants: new Set(),
    };
    this.rooms.set(code, room);
    this.roomsByIdentity.set(room.roomId, room);
    peer.room = code;
    peer.role = 'host';
    this.welcome(peer, room, room.hostToken);
  }

  makeCode(excludedCode) {
    let code;
    do { code = Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join(''); }
    while (this.rooms.has(code) || code === excludedCode);
    return code;
  }

  getJoinRoom(peer, message) {
    const code = typeof message.code === 'string' ? message.code.trim().toUpperCase() : '';
    if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code) || !this.rooms.has(code)) {
      this.error(peer, 'room_not_found', 'Room not found. Check the code or ask the host for a new room.', true);
      return null;
    }
    return this.rooms.get(code);
  }

  joinRandom(peer, message) {
    // Only hosts who explicitly opt in are discoverable. Select and reserve in
    // this synchronous operation, so concurrent requests cannot overfill a room.
    const eligible = [...this.rooms.values()].filter(room => room.publicMatchmaking && room.host && !room.locked && !room.recovering && room.selectionPhase === 'gathering' && room.players.size < room.maxPlayers && (room.characterSelectionVersion < 2 || (Number.isInteger(message.characterSelectionVersion) && message.characterSelectionVersion >= room.characterSelectionVersion)));
    if (!eligible.length) { this.error(peer, 'no_random_room', 'No open public rooms right now. Try again or join with a code.', true); return; }
    this.join(peer, message, eligible[randomInt(eligible.length)]);
  }

  join(peer, message, selectedRoom) {
    const room = selectedRoom ?? this.getJoinRoom(peer, message);
    if (!room) return;
    if (!room.host) { this.error(peer, 'host_away', 'The host is reconnecting. Try again shortly.', true); return; }
    if (room.locked) { this.error(peer, 'room_locked', 'This race has started. Ask the host to open a new race.', true); return; }
    if (room.characterSelectionVersion >= 2 && (!Number.isInteger(message.characterSelectionVersion) || message.characterSelectionVersion < room.characterSelectionVersion)) { this.error(peer, 'update_required', 'Refresh Beerio on this phone to load the new characters, then join again.', true); return; }
    if (room.players.size >= room.maxPlayers) { this.error(peer, 'room_full', 'All racer slots are taken.', true); return; }
    if (message.appearance !== undefined && !validAppearance(message.appearance)) { this.error(peer, 'invalid_appearance', 'Choose a valid racer, vehicle, and color.', true); return; }
    const name = cleanName(message.name);
    if (!validName(name)) { this.error(peer, 'invalid_name', 'Names can be at most 64 characters.', true); return; }
    const usedColors = new Set(Array.from(room.players.values(), (p) => p.color));
    const token = makeToken();
    const player = {
      id: randomBytes(8).toString('hex'), tokenHash: hashToken(token), name,
      color: message.appearance?.color.toLowerCase() ?? COLORS.find((color) => !usedColors.has(color)),
      character: room.characterSelectionVersion >= 3 ? null : message.appearance?.character ?? 'fox', characterCursor: null, vehicle: message.appearance?.vehicle ?? 'kart', peer,
      input: freshInput(), ready: false, characterConfirmed: false, actionSequence: 0, actionFloor: 0, lastInputAt: this.now(), goneAt: null,
    };
    if (room.characterSelection && room.characterSelectionVersion < 3 && room.selectionPhase !== 'gathering' && !selectionCharacters(room).includes(player.character)) player.character = selectionCharacters(room)[0];
    room.players.set(player.id, player);
    room.touchedAt = this.now();
    peer.room = room.code;
    peer.role = 'player';
    peer.playerId = player.id;
    this.welcome(peer, room, token, true);
  }

  resume(peer, message) {
    if (!isToken(message.token)) {
      this.error(peer, 'invalid_session', 'This session has expired. Join again.', true); return;
    }
    const hasIdentity = message.roomId !== undefined;
    if (hasIdentity && !isHash(message.roomId)) {
      this.error(peer, 'invalid_session', 'This session has expired. Join again.', true); return;
    }
    // Never fall back to a reused public code when the session has an immutable identity.
    let room = hasIdentity ? this.roomsByIdentity.get(message.roomId) : this.getJoinRoom(peer, message);
    if (!room && hasIdentity) {
      if (message.checkpoint !== undefined) room = this.recover(peer, message);
      else this.error(peer, 'recovery_pending', 'Waiting for the host to restore the room after a relay restart.');
    }
    if (!room) return;
    if (room.characterSelectionVersion >= 2 && (!Number.isInteger(message.characterSelectionVersion) || message.characterSelectionVersion < room.characterSelectionVersion)) { this.error(peer, 'update_required', 'Refresh Beerio to reconnect with the new character roster.'); return; }
    if (message.token === room.hostToken) {
      if (room.host && room.host !== peer) {
        const old = room.host;
        old.room = null;
        this.error(old, 'session_replaced', 'The host connected in another tab.', true);
        old.close();
      }
      room.host = peer;
      room.recoveryEnabled = message.recoveryVersion === 1;
      room.hostGoneAt = null;
      room.touchedAt = this.now();
      peer.room = room.code;
      peer.role = 'host';
      for (const player of room.players.values()) {
        this.resetInput(room, player);
        if (!room.locked) player.ready = false;
      }
      this.welcome(peer, room, room.hostToken);
      return;
    }
    const player = Array.from(room.players.values()).find((p) => p.tokenHash === hashToken(message.token));
    if (!player) { this.error(peer, 'invalid_session', 'This session has expired. Join again.', true); return; }
    if (player.peer && player.peer !== peer) {
      const old = player.peer;
      old.room = null;
      this.error(old, 'session_replaced', 'This controller connected in another tab.', true);
      old.close();
    }
    player.peer = peer;
    if (!room.locked) player.ready = false;
    player.goneAt = null;
    player.lastInputAt = this.now();
    this.resetInput(room, player);
    peer.room = room.code;
    peer.role = 'player';
    peer.playerId = player.id;
    if (room.recovering && [...room.participants].every(id => room.players.get(id)?.peer)) {
      room.recovering = false;
      for (const player of room.players.values()) this.resetInput(room, player);
    }
    room.touchedAt = this.now();
    this.welcome(peer, room, message.token);
  }

  recover(peer, message) {
    // The identity is self-authenticating: only the original 192-bit host secret
    // can recreate it. The host already owns the roster and simulation authority.
    if (hashToken(message.token) !== message.roomId) {
      this.error(peer, 'invalid_session', 'Only the original host can restore this room.', true); return null;
    }
    const c = message.checkpoint;
    if (!c || typeof c !== 'object' || c.version !== 1 || c.roomId !== message.roomId ||
      !Number.isInteger(c.maxPlayers) || c.maxPlayers < 4 || c.maxPlayers > 10 ||
      (c.characterSelectionVersion !== undefined && ![1, 2, 3, 4].includes(c.characterSelectionVersion)) ||
      typeof c.locked !== 'boolean' || !Array.isArray(c.players) || c.players.length > c.maxPlayers ||
      c.players.some(p => !p || typeof p.id !== 'string' || !/^[a-f0-9]{16}$/.test(p.id) ||
        !isHash(p.tokenHash) || typeof p.name !== 'string' || p.name !== cleanName(p.name) || !validName(p.name) || !(validAppearance(p) || (c.characterSelectionVersion >= 3 && p.character === null && validAppearance({ ...p, character: 'gorilla' }))) ||
        (c.characterSelectionVersion >= 3 && p.characterCursor != null && !SELECTION_CHARACTERS.includes(p.characterCursor)) ||
        (c.characterSelectionVersion >= 3 && (p.characterConfirmed === true || c.locked) && !SELECTION_CHARACTERS.includes(p.character)) ||
        !Number.isSafeInteger(p.actionSequence) || p.actionSequence < 0) ||
      new Set(c.players.map(p => p.id)).size !== c.players.length ||
      new Set(c.players.map(p => p.tokenHash)).size !== c.players.length ||
      !Array.isArray(c.participants) || c.participants.length > c.players.length ||
      new Set(c.participants).size !== c.participants.length ||
      c.participants.some(id => !c.players.some(p => p.id === id))) {
      this.error(peer, 'invalid_recovery', 'The saved room could not be restored safely. Start a new room.', true); return null;
    }
    if (c.characterSelectionVersion >= 2 && (!Number.isInteger(message.characterSelectionVersion) || message.characterSelectionVersion < c.characterSelectionVersion)) {
      this.error(peer, 'update_required', 'Refresh Beerio to restore this room with the new character roster.'); return null;
    }
    if (this.rooms.size >= this.maxRooms) {
      this.error(peer, 'recovery_pending', 'The relay is busy. Waiting to restore the room.'); return null;
    }
    // A fresh random public code prevents arbitrary code reclamation/squatting.
    // Existing controllers reconnect by roomId, so no rejoin or new racer is needed.
    const room = {
      code: this.makeCode(message.code), roomId: message.roomId, hostToken: message.token,
      host: null, hostGoneAt: this.now(), touchedAt: this.now(),
      maxPlayers: c.maxPlayers, publicMatchmaking: c.publicMatchmaking === true, locked: c.locked, recovering: c.locked && c.participants.length > 0,
      characterSelection: c.characterSelection === true, characterSelectionVersion: [2, 3, 4].includes(c.characterSelectionVersion) ? c.characterSelectionVersion : 1, selectionPhase: c.locked ? 'racing' : ['selecting', 'countdown'].includes(c.selectionPhase) ? 'selecting' : 'gathering', countdownEndsAt: null,
      recoveryEnabled: true, checkpointRevision: 0, pendingWelcomes: new Map(),
      participants: new Set(c.participants),
      players: new Map(c.players.map(p => [p.id, {
        id: p.id, name: p.name, color: p.color.toLowerCase(), character: p.character, characterCursor: p.characterCursor ?? null, vehicle: p.vehicle,
        tokenHash: p.tokenHash, actionSequence: p.actionSequence, actionFloor: p.actionSequence,
        peer: null, ready: false, characterConfirmed: c.characterSelection === true && p.characterConfirmed === true, input: freshInput(), lastInputAt: this.now(), goneAt: this.now(),
      }])),
    };
    this.rooms.set(room.code, room);
    this.roomsByIdentity.set(room.roomId, room);
    return room;
  }

  disconnect(peer) {
    this.peers.delete(peer);
    const room = this.rooms.get(peer.room);
    if (!room) return;
    if (room.host === peer) {
      room.host = null;
      room.hostGoneAt = this.now();
      for (const player of room.players.values()) {
        this.resetInput(room, player);
        if (!room.locked) player.ready = false;
      }
    } else {
      const player = room.players.get(peer.playerId);
      if (player?.peer === peer) {
        this.resetInput(room, player);
        player.peer = null;
        if (!room.locked) player.ready = false;
        player.goneAt = this.now();
      }
      room.pendingWelcomes.delete(peer);
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
    this.roomsByIdentity.delete(room.roomId);
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
      for (const [peer, pending] of room.pendingWelcomes) {
        if (now - pending.since > 10_000) {
          room.pendingWelcomes.delete(peer);
          room.players.delete(peer.playerId);
          peer.room = null;
          this.error(peer, 'host_unavailable', 'The host did not confirm this controller. Please join again.', true);
          peer.close();
          rosterChanged = true;
        }
      }
      for (const [id, player] of room.players) {
        if (now - player.lastInputAt > INPUT_TIMEOUT_MS) this.resetInput(room, player);
        // A recovery timeout must not silently restart the race without someone.
        // Keep their name/seat until they return or the host explicitly continues.
        if (player.goneAt !== null && now - player.goneAt > PLAYER_GRACE_MS && !(room.recovering && room.participants.has(id))) {
          room.players.delete(id);
          room.participants.delete(id);
          rosterChanged = true;
        }
      }
      if (room.characterSelection && room.selectionPhase === 'countdown' && room.countdownEndsAt <= now) {
        this.updateSelection(room);
        if (room.selectionPhase === 'countdown') {
          room.locked = true; room.selectionPhase = 'racing'; room.countdownEndsAt = null;
          room.participants = new Set([...room.players.values()].filter(p => p.peer && !room.pendingWelcomes.has(p.peer)).map(p => p.id));
          for (const player of room.players.values()) this.resetInput(room, player);
        }
        rosterChanged = true;
      }
      if (rosterChanged) this.broadcastRoom(room);
    }
  }
}
