"use client";

import { ZERO_INPUT, normalizeInput, type RoomInput, type RoomPlayer, type RoomSnapshot, type CreateRoomOptions, type JoinRoomOptions, type RoomRole } from "./types";

const STORAGE_KEY = "beerio-room-session-v1";
const MAX_RETRIES = 12;
const FIRST_CONNECTION_WINDOW_MS = 90_000;
type SavedSession = { code: string; token: string; role: RoomRole; relayUrl: string };
type WelcomeRoom = { code: string; players: RoomPlayer[]; maxPlayers: number; locked: boolean; hostConnected: boolean };

/** NEXT_PUBLIC values are compiled at build time. Never point cellular phones at localhost. */
export function getRelayUrl(): string {
  const configured = process.env.NEXT_PUBLIC_BEERIO_RELAY_URL?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
    return `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.hostname}:8787`;
  }
  return "";
}

function validateUrl(value: string): string {
  if (!value) throw new Error("Online rooms need a relay. Set NEXT_PUBLIC_BEERIO_RELAY_URL to your public wss:// relay and rebuild the site.");
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("Enter a valid ws:// or wss:// relay URL."); }
  if (!["ws:", "wss:"].includes(url.protocol) || url.username || url.password || url.hash || url.search) {
    throw new Error("Enter a ws:// or wss:// relay URL without credentials, query, or fragment.");
  }
  if (typeof window !== "undefined" && window.location.protocol === "https:" && url.protocol !== "wss:") {
    throw new Error("An HTTPS game needs a secure wss:// relay URL.");
  }
  return url.href;
}

function initialSnapshot(): RoomSnapshot {
  return { status: "idle", role: null, code: null, playerId: null, players: [], maxPlayers: 6, locked: false, hostConnected: false, error: null, relayUrl: getRelayUrl() };
}

/** Browser room transport. Every reconnect resumes with a secret token, not the public room code. */
export class BeerioRoomClient {
  private snapshot = initialSnapshot();
  private listeners = new Set<() => void>();
  private stateListeners = new Set<(state: unknown) => void>();
  private socket: WebSocket | null = null;
  private session: SavedSession | null = null;
  private pendingHello: Record<string, unknown> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connectionTimer: ReturnType<typeof setTimeout> | null = null;
  private coldStartTimer: ReturnType<typeof setTimeout> | null = null;
  private firstConnectionDeadline = 0;
  private inputTimer: ReturnType<typeof setInterval> | null = null;
  private safetyTimer: ReturnType<typeof setInterval> | null = null;
  private lastInputAt = new Map<string, number>();
  private input: RoomInput = { ...ZERO_INPUT };
  private lastSentInput = 0;
  private actionSequence = 0;
  private lastSentState = 0;
  private retries = 0;
  private intentionalClose = false;
  private suppressInput = false;

  getSnapshot = (): RoomSnapshot => this.snapshot;
  getServerSnapshot = (): RoomSnapshot => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  onState = (listener: (state: unknown) => void) => { this.stateListeners.add(listener); return () => { this.stateListeners.delete(listener); }; };
  private update(patch: Partial<RoomSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener();
  }
  private clearTimers() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.connectionTimer) clearTimeout(this.connectionTimer);
    if (this.coldStartTimer) clearTimeout(this.coldStartTimer);
    if (this.inputTimer) clearInterval(this.inputTimer);
    if (this.safetyTimer) clearInterval(this.safetyTimer);
    this.reconnectTimer = null;
    this.connectionTimer = null;
    this.coldStartTimer = null;
    this.inputTimer = null;
    this.safetyTimer = null;
  }
  private storeSession() {
    try {
      if (this.session) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(this.session));
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch { /* Private browsing/storage restrictions must not block play. */ }
  }
  private zeroPlayers(): RoomPlayer[] {
    return this.snapshot.players.map((player) => ({ ...player, input: { ...ZERO_INPUT } }));
  }
  private send(message: Record<string, unknown>) {
    if (this.socket?.readyState !== WebSocket.OPEN || this.socket.bufferedAmount > 128 * 1024) return false;
    try { this.socket.send(JSON.stringify(message)); return true; } catch { return false; }
  }

  restoreSession = (expectedCode?: string) => {
    if (this.socket || this.pendingHello) return;
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null") as SavedSession | null;
      if (!saved || !/^[A-HJ-NP-Z2-9]{6}$/.test(saved.code) || !/^[a-f0-9]{48}$/.test(saved.token) || !["host", "player"].includes(saved.role)) return;
      if (expectedCode && saved.code !== expectedCode.trim().toUpperCase()) return;
      this.session = { ...saved, relayUrl: validateUrl(saved.relayUrl) };
      this.update({ role: saved.role, code: saved.code, relayUrl: this.session.relayUrl });
      this.intentionalClose = false;
      this.retries = 0;
      this.connect(true);
    } catch { /* An obsolete or malformed session is ignored. */ }
  };

  createRoom = (options: CreateRoomOptions = {}) => {
    this.begin({ type: "create", maxPlayers: options.maxPlayers ?? 6 }, options.relayUrl, "host");
  };
  joinRoom = (options: JoinRoomOptions) => {
    const code = options.code.replace(/\s/g, "").toUpperCase();
    if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) { this.update({ status: "error", error: "Enter the six-character room code shown on the host screen." }); return; }
    this.begin({ type: "join", code, name: options.name.trim().slice(0, 18) || "Racer" }, options.relayUrl, "player");
  };
  private begin(hello: Record<string, unknown>, relayUrl: string | undefined, role: RoomRole) {
    this.leaveRoom();
    try {
      const url = validateUrl(relayUrl?.trim() || getRelayUrl());
      this.pendingHello = hello;
      this.firstConnectionDeadline = Date.now() + FIRST_CONNECTION_WINDOW_MS;
      this.intentionalClose = false;
      this.retries = 0;
      this.update({ ...initialSnapshot(), relayUrl: url, role, status: "connecting" });
      this.connect(false);
    } catch (error) {
      this.update({ status: "error", error: error instanceof Error ? error.message : "Invalid relay configuration." });
    }
  }

  private connect(resume: boolean) {
    this.clearTimers();
    this.input = { ...ZERO_INPUT };
    this.update({ status: resume ? "reconnecting" : "connecting", error: null, players: this.zeroPlayers() });
    let socket: WebSocket;
    try { socket = new WebSocket(this.snapshot.relayUrl); }
    catch { this.fail("Could not connect to the relay. Check its URL and try again."); return; }
    this.socket = socket;
    this.connectionTimer = setTimeout(() => {
      if (this.socket === socket && this.snapshot.status !== "connected") socket.close();
    }, resume ? 10_000 : Math.max(1, this.firstConnectionDeadline - Date.now()));
    if (!resume) {
      this.coldStartTimer = setTimeout(() => {
        if (this.socket === socket && this.snapshot.status === "connecting") {
          this.update({ error: "The relay may be waking up. The first connection can take up to 90 seconds." });
        }
      }, 10_000);
    }
    socket.onopen = () => {
      if (this.socket !== socket) return;
      const hello = this.session ? { type: "resume", code: this.session.code, token: this.session.token } : this.pendingHello;
      if (hello) this.send(hello);
    };
    socket.onmessage = (event) => {
      if (this.socket !== socket || typeof event.data !== "string" || event.data.length > 40_960) return;
      try { this.receive(JSON.parse(event.data)); } catch { /* Ignore malformed relay traffic. */ }
    };
    socket.onerror = () => { /* onclose handles reconnect without duplicating requests. */ };
    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.clearTimers();
      this.input = { ...ZERO_INPUT };
      this.update({ players: this.zeroPlayers(), hostConnected: false });
      if (this.intentionalClose) return;
      if (!this.session && this.pendingHello && Date.now() < this.firstConnectionDeadline) {
        this.update({ status: "connecting", error: "The relay may be waking up. Retrying for up to 90 seconds…" });
        const delay = Math.min(5000, 1000 * 2 ** Math.min(this.retries++, 3), this.firstConnectionDeadline - Date.now());
        this.reconnectTimer = setTimeout(() => this.connect(false), delay);
        return;
      }
      if (!this.session || this.retries >= MAX_RETRIES) {
        this.fail(this.session ? "Connection lost. Rejoin the room when your connection returns." : "The relay did not respond within 90 seconds. Check that it is running and reachable, then try again.");
        return;
      }
      this.update({ status: "reconnecting", error: "Connection lost. Reconnecting…" });
      const delay = Math.min(8000, 500 * 2 ** this.retries++) + Math.random() * 250;
      this.reconnectTimer = setTimeout(() => this.connect(true), delay);
    };
  }

  private receive(message: Record<string, unknown>) {
    switch (message.type) {
      case "welcome": {
        const room = message.room as WelcomeRoom;
        if (!room || !Array.isArray(room.players) || typeof message.token !== "string" || (message.role !== "host" && message.role !== "player")) return;
        this.session = { code: room.code, token: message.token, role: message.role, relayUrl: this.snapshot.relayUrl };
        this.storeSession();
        // A resumed phone starts from the relay's high-water mark, not zero.
        // Pending presses are deliberately not replayed across a reconnect.
        if (message.role === "player") {
          const self = room.players.find(player => player.id === message.playerId);
          this.actionSequence = Math.max(this.actionSequence, self?.actionSequence ?? 0, self?.input.action ?? 0);
          this.input = { ...ZERO_INPUT };
        }
        this.pendingHello = null;
        this.retries = 0;
        if (this.connectionTimer) clearTimeout(this.connectionTimer);
        if (this.coldStartTimer) clearTimeout(this.coldStartTimer);
        this.connectionTimer = null;
        this.coldStartTimer = null;
        this.firstConnectionDeadline = 0;
        this.update({ ...room, status: "connected", role: message.role, playerId: typeof message.playerId === "string" ? message.playerId : null, error: null });
        this.inputTimer = setInterval(() => {
          if (this.snapshot.role === "player") this.sendInput();
        }, 100);
        this.safetyTimer = setInterval(() => {
          if (this.snapshot.role !== "host") return;
          const now = Date.now();
          let changed = false;
          const players = this.snapshot.players.map((player) => {
            if (now - (this.lastInputAt.get(player.id) ?? 0) > 600 && (player.input.steer !== 0 || player.input.accelerate || player.input.brake || player.input.action !== undefined)) {
              changed = true;
              return { ...player, input: { ...ZERO_INPUT } };
            }
            return player;
          });
          if (changed) this.update({ players });
        }, 100);
        break;
      }
      case "room": {
        const room = message.room as WelcomeRoom;
        if (!room || room.code !== this.snapshot.code || !Array.isArray(room.players)) return;
        // A lock transition is a race boundary. Held controls from the previous
        // race (or its results screen) must not continue into the next one.
        if (!room.hostConnected || room.locked !== this.snapshot.locked) this.input = { ...ZERO_INPUT };
        this.update(room);
        break;
      }
      case "input": {
        if (this.snapshot.role !== "host" || typeof message.playerId !== "string" || !message.input || typeof message.input !== "object") return;
        const input = normalizeInput(message.input as RoomInput);
        this.lastInputAt.set(message.playerId, Date.now());
        this.update({ players: this.snapshot.players.map((player) => player.id === message.playerId ? { ...player, input } : player) });
        break;
      }
      case "state":
        for (const listener of this.stateListeners) listener(message.payload);
        break;
      case "error":
        if (message.fatal) {
          this.session = null;
          this.storeSession();
          this.fail(typeof message.message === "string" ? message.message : "Room connection failed.");
        } else this.update({ error: typeof message.message === "string" ? message.message : "Room request failed." });
        break;
      case "room_closed":
        this.session = null;
        this.storeSession();
        this.stopConnection();
        this.update({ status: "closed", players: this.zeroPlayers(), hostConnected: false, error: typeof message.reason === "string" ? message.reason : "The host ended the room." });
        break;
    }
  }

  private fail(error: string) {
    this.stopConnection();
    this.update({ status: "error", error, hostConnected: false, players: this.zeroPlayers() });
  }
  setInput = (input: RoomInput) => {
    const previous = this.input;
    // Only useItem creates action events. Direction updates preserve the current
    // event until an explicit safety reset, so heartbeats cannot erase a tap.
    const normalized = normalizeInput(input);
    delete normalized.action;
    this.input = this.suppressInput ? { ...ZERO_INPUT } : { ...normalized, ...(previous.action ? { action: previous.action } : {}) };
    // Send an actual release immediately, but do not flood the relay with repeated neutral frames.
    const released = (previous.accelerate || previous.brake || previous.steer !== 0) &&
      !this.input.accelerate && !this.input.brake && this.input.steer === 0;
    if (released || Date.now() - this.lastSentInput >= 34) this.sendInput();
  };
  /** A discrete press, separate from held driving controls. */
  useItem = (): boolean => {
    if (this.suppressInput || this.snapshot.role !== "player" || this.snapshot.status !== "connected" || !this.snapshot.hostConnected || !this.snapshot.locked || this.socket?.readyState !== WebSocket.OPEN) return false;
    const self = this.snapshot.players.find(player => player.id === this.snapshot.playerId);
    this.actionSequence = Math.max(this.actionSequence, self?.actionSequence ?? 0);
    if (this.actionSequence >= Number.MAX_SAFE_INTEGER) return false;
    this.input = { ...this.input, action: ++this.actionSequence };
    this.sendInput();
    return true;
  };
  private sendInput() {
    if (this.snapshot.role !== "player" || this.snapshot.status !== "connected") return;
    this.lastSentInput = Date.now();
    this.send({ type: "input", input: this.snapshot.hostConnected && this.snapshot.locked ? this.input : { ...ZERO_INPUT } });
  }
  publishState = (state: unknown) => {
    if (this.snapshot.role !== "host" || this.snapshot.status !== "connected" || Date.now() - this.lastSentState < 50) return;
    this.lastSentState = Date.now();
    this.send({ type: "state", payload: state });
  };
  setLocked = (locked: boolean) => {
    if (this.snapshot.role === "host" && this.snapshot.status === "connected") this.send({ type: "lock", locked });
  };
  /** Bind to page visibility/blur so backgrounded controllers can never keep accelerating. */
  resetInput = () => { this.input = { ...ZERO_INPUT }; this.sendInput(); };
  setInputSuppressed = (suppressed: boolean) => { this.suppressInput = suppressed; if (suppressed) this.resetInput(); };

  private stopConnection() {
    this.intentionalClose = true;
    this.clearTimers();
    this.input = { ...ZERO_INPUT };
    const socket = this.socket;
    this.socket = null;
    if (socket) socket.close();
  }
  leaveRoom = () => {
    this.resetInput();
    this.send({ type: "leave" });
    this.stopConnection();
    this.session = null;
    this.pendingHello = null;
    this.lastInputAt.clear();
    this.actionSequence = 0;
    this.storeSession();
    this.update(initialSnapshot());
  };
  /** Cleanup preserves the session for reload/React remount. Explicit Leave ends it. */
  destroy = () => { this.resetInput(); this.stopConnection(); this.pendingHello = null; };
}
