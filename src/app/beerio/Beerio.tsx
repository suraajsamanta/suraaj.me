"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import Link from "next/link";
import Image from "next/image";
import GameView, { type PlayerInventory, type RaceResult } from "./game/GameView";
import { POWER_UPS, type PowerUp } from "./game/powerups";
import SteeringJoystick from "./game/SteeringJoystick";
import { CHARACTERS, VEHICLES, PALETTE, DEFAULT_APPEARANCE, validAppearance, type Appearance, type CharacterId, type VehicleId } from "./appearance";
import type { RoomPlayer } from "./room/types";
import { unlockRaceAudio } from "./game/audio";
import { TRACKS, type TrackId } from "./game/track";
import { useBeerioRoom } from "./room/useBeerioRoom";
import styles from "./beerio.module.css";
import StartingGrid from "./lobby/StartingGrid";
import { CharacterGrid, CharacterController, CharacterPortrait } from "./lobby/CharacterSelection";
import selectionStyles from "./lobby/character-selection.module.css";

type Input = { steer: number; accelerate: boolean; brake: boolean; drift?: boolean };
const neutral: Input = { steer: 0, accelerate: false, brake: false };

type Mode = "home" | "host" | "join" | "solo" | "practice";
type ControlKey = "accelerate" | "brake" | "drift";
const releasedControls = { accelerate: false, brake: false, drift: false };

function TrackPicker({ value, onChange, label = "CHOOSE YOUR TRACK" }: { value: TrackId; onChange: (value: TrackId) => void; label?: string }) {
  const selected = TRACKS.find((track) => track.id === value) || TRACKS[0];
  return <div className={styles.trackPicker}>
    <label><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value as TrackId)}>{TRACKS.map((track) => <option key={track.id} value={track.id}>{track.name}</option>)}</select></label>
    <p>{selected.description}</p>
  </div>;
}

function AppearancePicker({ value, onChange, colorOnly = false }: { value: Appearance; onChange: (patch: Partial<Appearance>) => void; colorOnly?: boolean }) {
  const selected = CHARACTERS.find((character) => character.id === value.character) ?? CHARACTERS[0];
  const ride = VEHICLES.find((vehicle) => vehicle.id === value.vehicle) ?? VEHICLES[0];
  return <fieldset className={styles.appearancePicker}>
    <legend>{colorOnly ? "YOUR COLOR" : "YOUR RACER, RIDE & COLOR"}</legend>
    {!colorOnly && <><div className={styles.appearancePreview} style={{ borderColor: value.color }} aria-hidden="true"><CharacterPortrait id={selected.id} /><span>{ride.icon}</span></div>
    <div className={styles.appearanceFields}>
      <label>RACER<select value={value.character} onChange={(event) => onChange({ character: event.target.value as CharacterId })}>{CHARACTERS.map((character) => <option key={character.id} value={character.id}>{character.icon} {character.name}</option>)}</select></label>
      <label>RIDE<select value={value.vehicle} onChange={(event) => onChange({ vehicle: event.target.value as VehicleId })}>{VEHICLES.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.icon} {vehicle.name}</option>)}</select></label>
    </div>
    </>}
    <div className={styles.colorChoices}><span>COLOR</span>{PALETTE.map((color) => <button type="button" key={color} title={color} aria-label={`Choose ${color}`} aria-pressed={value.color.toLowerCase() === color} className={styles.colorSwatch} style={{ backgroundColor: color }} onClick={() => onChange({ color })} />)}<label className={styles.customColor}>CUSTOM<input type="color" value={value.color} onChange={(event) => onChange({ color: event.target.value })} aria-label="Custom vehicle color" /></label></div>
    <p className={styles.appearanceNote}>{colorOnly ? "Pick your character together on the big screen after joining." : "Looks only. Every ride races equally."}</p>
  </fieldset>;
}

function Controller({ send, useItem: activateItem, item, itemFeedback = "" }: { send: (input: Input) => void; useItem: () => void; item: PowerUp | null | undefined; itemFeedback?: string }) {
  const keys = useRef({ ...releasedControls });
  const pointers = useRef(new Map<number, ControlKey>());
  const steering = useRef(0);
  // Keep a cancelled drift omitted until a fresh press, even across later heartbeats.
  const driftCancelled = useRef(false);
  const keyboard = useRef(new Set<ControlKey>());
  const goPress = useRef<{ owner: string; at: number; usedItem: boolean } | null>(null);
  const lastGoTap = useRef<number | null>(null);
  const [pressed, setPressed] = useState({ ...releasedControls });
  // A quick tap followed by a second press fires the item immediately. Keep
  // holding that second press to drive; long holds and cancelled gestures never
  // arm the shortcut, and a third tap cannot accidentally fire a second item.
  const beginGo = (owner: string, at: number) => {
    const usedItem = lastGoTap.current !== null && at >= lastGoTap.current && at - lastGoTap.current <= 320;
    lastGoTap.current = null;
    goPress.current = { owner, at, usedItem };
    if (usedItem) activateItem();
  };
  const endGo = (owner: string, at: number, cancelled = false) => {
    const press = goPress.current;
    if (press?.owner !== owner) return;
    lastGoTap.current = !cancelled && !press.usedItem && at >= press.at && at - press.at <= 240 ? at : null;
    goPress.current = null;
  };
  const update = useCallback((cancelDrift = false) => {
    const held = new Set([...pointers.current.values(), ...keyboard.current]);
    keys.current = { accelerate: held.has("accelerate"), brake: held.has("brake"), drift: held.has("drift") };
    if (cancelDrift && !keys.current.drift) driftCancelled.current = true;
    setPressed(keys.current);
    send({ steer: steering.current, accelerate: keys.current.accelerate, brake: keys.current.brake, ...(driftCancelled.current ? {} : { drift: keys.current.drift }) });
  }, [send]);
  const onSteer = useCallback((value: number) => { steering.current = value; update(); }, [update]);
  useEffect(() => {
    const heldPointers = pointers.current;
    const heldKeyboard = keyboard.current;
    const timer = window.setInterval(() => send({ steer: steering.current, accelerate: keys.current.accelerate, brake: keys.current.brake, ...(driftCancelled.current ? {} : { drift: keys.current.drift }) }), 100);
    const reset = () => { driftCancelled.current = true; goPress.current = null; lastGoTap.current = null; heldPointers.clear(); heldKeyboard.clear(); steering.current = 0; keys.current = { ...releasedControls }; setPressed(keys.current); send(neutral); };
    window.addEventListener("blur", reset);
    window.addEventListener("pagehide", reset);
    window.addEventListener("orientationchange", reset);
    document.addEventListener("visibilitychange", reset);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("blur", reset);
      window.removeEventListener("pagehide", reset);
      window.removeEventListener("orientationchange", reset);
      document.removeEventListener("visibilitychange", reset);
      driftCancelled.current = true; goPress.current = null; lastGoTap.current = null; heldPointers.clear(); heldKeyboard.clear(); steering.current = 0; keys.current = { ...releasedControls }; send(neutral);
    };
  }, [send]);
  const releasePointer = (pointerId: number, at: number, cancelled = false) => {
    const key = pointers.current.get(pointerId);
    if (!pointers.current.delete(pointerId)) return;
    if (key === "accelerate") endGo(`pointer:${pointerId}`, at, cancelled);
    update(cancelled && key === "drift");
  };
  const control = (key: ControlKey, label: string, content: string, extra = "") => (
    <button type="button" className={`${styles.control} ${extra} ${pressed[key] ? styles.pressed : ""}`} aria-label={label} aria-pressed={pressed[key]}
      aria-describedby={key === "accelerate" ? "go-shortcut-help" : undefined}
      onPointerDown={(event) => {
        if (event.button !== 0 || keys.current[key]) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        if (key === "drift") driftCancelled.current = false;
        pointers.current.set(event.pointerId, key);
        update();
        if (key === "accelerate") beginGo(`pointer:${event.pointerId}`, event.timeStamp);
      }}
      onPointerUp={(event) => releasePointer(event.pointerId, event.timeStamp)} onPointerCancel={(event) => releasePointer(event.pointerId, event.timeStamp, true)} onLostPointerCapture={(event) => releasePointer(event.pointerId, event.timeStamp, true)}
      onKeyDown={(event) => {
        if (event.key !== " " && event.key !== "Enter") return;
        event.preventDefault();
        if (event.repeat || keys.current[key]) return;
        if (key === "drift") driftCancelled.current = false;
        keyboard.current.add(key);
        update();
        if (key === "accelerate") beginGo("keyboard", event.timeStamp);
      }}
      onKeyUp={(event) => {
        if (event.key !== " " && event.key !== "Enter") return;
        event.preventDefault();
        if (!keyboard.current.delete(key)) return;
        if (key === "accelerate") endGo("keyboard", event.timeStamp);
        update();
      }}
      onBlur={() => {
        if (key === "accelerate") { lastGoTap.current = null; endGo("keyboard", 0, true); }
        if (keyboard.current.delete(key)) update(key === "drift");
      }} onContextMenu={(event) => event.preventDefault()}>
      <span aria-hidden="true">{content}</span>
      {key === "accelerate" && <small id="go-shortcut-help">HOLD TO DRIVE<br />DOUBLE-TAP FOR ITEM</small>}
    </button>
  );
  return <div className={styles.controller}>
    <div className={styles.controllerStatus}><span className={styles.dot} /> RACE ON · CONTROLLER READY</div>
    <p className={styles.controlHint}>Steer with your left thumb. Hold GO with your right. Double-tap GO to use your power-up.</p>
    <div className={styles.controls}>
      <div className={styles.steering}><SteeringJoystick onSteer={onSteer} /></div>
      <button type="button" className={styles.itemControl} data-loaded={Boolean(item)}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          // Secondary touches may never produce a click while GO/steering are held.
          event.preventDefault();
          activateItem();
        }}
        // Keyboard and assistive activation have no pointerdown. Ignore the
        // compatibility click after a pointer press so each press fires once.
        onClick={(event) => {
          const pointerType = (event.nativeEvent as PointerEvent).pointerType;
          if (event.detail === 0 && !pointerType) activateItem();
        }}
        onContextMenu={(event) => event.preventDefault()} aria-label="Use item"><span aria-hidden="true">✦</span><strong>USE ITEM</strong><small aria-live="polite">{item === undefined ? "Waiting for item status" : item === "flask" ? "Fizz Flask · tap again for boosts" : item ? POWER_UPS[item].name : "Drive through a box to collect"}</small>{itemFeedback && <small className={styles.itemFeedback} role="status" aria-live="polite" aria-atomic="true">{itemFeedback}</small>}</button>
      <div className={styles.pedals}>{control("accelerate", "Accelerate", "GO", styles.go)}{control("brake", "Brake", "BRAKE", styles.brake)}{control("drift", "Drift", "DRIFT", styles.drift)}</div>
    </div>
  </div>;
}

export default function Beerio() {
  const room = useBeerioRoom();
  const { code: roomCode, role: roomRole, status: roomStatus, setLocked, publishState, onState } = room;
  const [mode, setMode] = useState<Mode>("home");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [publicRoom, setPublicRoom] = useState(false);
  const [randomJoin, setRandomJoin] = useState(false);
  const [racing, setRacing] = useState(false);
  const [raceKey, setRaceKey] = useState(0);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");
  const [phoneItem, setPhoneItem] = useState<PowerUp | null | undefined>(undefined);
  const [phoneItemFeedback, setPhoneItemFeedback] = useState("");
  const [phonePhase, setPhonePhase] = useState<"unknown" | "racing" | "results">("unknown");
  const acceptInventory = useRef(false);
  const resultsRef = useRef<RaceResult[] | null>(null);
  const resultsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startGeneration = useRef(0);
  const committedStart = useRef(-1);
  const [qr, setQr] = useState("");
  const [joinUrl, setJoinUrl] = useState("");
  const [practiceInput, setPracticeInput] = useState<Input>(neutral);
  const [raceFinished, setRaceFinished] = useState(false);
  const [steeringAssist, setSteeringAssist] = useState(true);
  const [selectedTrack, setSelectedTrack] = useState<TrackId>("sunset");
  const [raceTrack, setRaceTrack] = useState<TrackId>("sunset");
  const [raceRoster, setRaceRoster] = useState<RoomPlayer[]>([]);
  const [appearance, setAppearance] = useState<Appearance>(DEFAULT_APPEARANCE);
  const appearanceRef = useRef<Appearance>(DEFAULT_APPEARANCE);
  const selectionArmed = useRef(false);
  const needsLobbyUnlock = useRef(false);
  const self = room.players.find((player) => player.id === room.playerId);
  // Room state messages are optional on older clients/relays. Only accept a
  // known item for this phone while the durable room lock says it is racing.
  useEffect(() => {
    if (roomRole !== "player") return;
    return onState((value) => {
      if (!value || typeof value !== "object") return;
      const state = value as { phase?: unknown; type?: unknown; inventory?: unknown };
      if (state.phase === "results") { setPhoneItem(undefined); setPhoneItemFeedback(""); setPhonePhase("results"); return; }
      if (state.phase === "lobby") { setPhoneItem(undefined); setPhoneItemFeedback(""); setPhonePhase("unknown"); return; }
      if (state.phase === "racing") { setPhoneItem(undefined); setPhoneItemFeedback(""); setPhonePhase("racing"); return; }
      if (state.type !== "inventory" || !room.locked || !room.hostConnected || room.recovering || room.status !== "connected" || !Array.isArray(state.inventory)) return;
      const mine = state.inventory.find((entry: unknown) => entry && typeof entry === "object" && (entry as { id?: unknown }).id === room.playerId) as { item?: unknown; feedback?: unknown } | undefined;
      const item = mine?.item;
      setPhoneItem(item === null ? null : typeof item === "string" && Object.prototype.hasOwnProperty.call(POWER_UPS, item) ? item as PowerUp : undefined);
      const feedback = mine?.feedback;
      const knownItem = typeof item === "string" && Object.prototype.hasOwnProperty.call(POWER_UPS, item);
      const heldFeedback = knownItem && typeof feedback === "string" && ["No racer ahead", "No racer behind", "No rivals to strike", "Use your held item first"].includes(feedback);
      const successFeedback = (item === null || knownItem) && typeof feedback === "string" && Object.values(POWER_UPS).some(power => feedback === `${power.name} collected!` || feedback === `${power.name} activated!`);
      setPhoneItemFeedback(heldFeedback || successFeedback ? feedback as string : "");
    });
  }, [onState, roomRole, room.playerId, room.locked, room.status, room.hostConnected, room.recovering]);
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) { setPhoneItem(undefined); setPhoneItemFeedback(""); if (room.status !== "connected" || room.locked) setPhonePhase("unknown"); } });
    return () => { cancelled = true; };
  }, [room.code, room.playerId, room.status, room.locked, room.hostConnected, room.recovering]);
  const scheduleResults = useCallback(() => {
    if (resultsTimer.current) clearTimeout(resultsTimer.current);
    const generation = startGeneration.current;
    resultsTimer.current = setTimeout(() => {
      resultsTimer.current = null;
      if (startGeneration.current === generation && resultsRef.current) publishState({ phase: "results", results: resultsRef.current });
    }, 150);
  }, [publishState]);
  useEffect(() => {
    if (mode === "host" && raceFinished && roomStatus === "connected" && resultsRef.current) scheduleResults();
  }, [mode, raceFinished, roomStatus, scheduleResults]);
  useEffect(() => () => { if (resultsTimer.current) clearTimeout(resultsTimer.current); }, []);
  useEffect(() => {
    const preset = new URLSearchParams(window.location.search).get("room");
    if (preset) queueMicrotask(() => { setCode(preset.toUpperCase()); setMode("join"); });
    try {
      if (localStorage.getItem("beerio-steering-assist") === "off") queueMicrotask(() => setSteeringAssist(false));
      try {
        const savedAppearance = JSON.parse(localStorage.getItem("beerio-appearance") || "null");
        if (validAppearance(savedAppearance)) queueMicrotask(() => { appearanceRef.current = savedAppearance; setAppearance(savedAppearance); });
      } catch { /* Ignore an obsolete or malformed saved appearance. */ }
      const savedTrack = localStorage.getItem("beerio-track");
      if (TRACKS.some((track) => track.id === savedTrack)) queueMicrotask(() => setSelectedTrack(savedTrack as TrackId));
    } catch { /* Storage restrictions must not prevent racing. */ }
  }, []);
  useEffect(() => {
    if (!roomCode || !roomRole || roomStatus !== "connected") return;
    if (mode === "home" || (mode === "join" && roomRole === "host") || (mode === "host" && roomRole === "player")) {
      queueMicrotask(() => setMode(roomRole === "host" ? "host" : "join"));
      // A refreshed host has lost its in-memory simulation; reopen the lobby.
      if (roomRole === "host") { needsLobbyUnlock.current = true; selectionArmed.current = false; setLocked(false); publishState({ phase: "lobby" }); }
    }
  }, [roomCode, roomRole, roomStatus, setLocked, publishState, mode]);
  // Finish, cancel and host reload may happen offline. Replay only an explicit
  // lobby intent, never unlock a valid automatic countdown-to-race transition.
  useEffect(() => {
    if (mode !== "host" || roomRole !== "host" || roomStatus !== "connected" || !needsLobbyUnlock.current) return;
    if (room.locked || room.selectionPhase !== "gathering") {
      setLocked(false); publishState({ phase: raceFinished ? "results" : "lobby" });
    } else needsLobbyUnlock.current = false;
  }, [mode, roomRole, roomStatus, room.locked, room.selectionPhase, raceFinished, setLocked, publishState]);
  useEffect(() => {
    if (!starting || room.status === "connected") return;
    queueMicrotask(() => { setStarting(false); setStartError("Connection interrupted while opening character selection. Reconnect and try again if the grid did not open."); });
  }, [starting, room.status]);
  // The relay owns the countdown and freezes the roster.
  // Only an acknowledged racing lock starts a simulation, never a local timer.
  useEffect(() => {
    if (mode !== "host" || racing || !selectionArmed.current || room.status !== "connected" || !room.locked || room.selectionPhase !== "racing") return;
    const generation = startGeneration.current;
    const entrants = room.players.filter(player => player.inRace).map(player => ({ ...player, input: { ...neutral } }));
    if (!entrants.length) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled || committedStart.current === generation) return;
      committedStart.current = generation;
      acceptInventory.current = true; resultsRef.current = null;
      setRaceRoster(entrants); setRaceFinished(false); setRaceKey(n => n + 1); setRacing(true); setStarting(false);
      publishState({ phase: "racing" });
    });
    return () => { cancelled = true; };
  }, [mode, racing, room.status, room.locked, room.selectionPhase, room.players, publishState]);
  useEffect(() => {
    if (!starting || room.selectionPhase === "gathering" && !room.error) return;
    queueMicrotask(() => setStarting(false));
  }, [starting, room.selectionPhase, room.error]);
  useEffect(() => {
    if (!starting) return;
    const timer = setTimeout(() => { setStarting(false); setStartError("Character selection did not open. Check the connection and try again."); }, 10000);
    return () => clearTimeout(timer);
  }, [starting]);
  useEffect(() => {
    if (!room.code || room.role !== "host") return;
    const url = new URL(window.location.href); url.search = ""; url.searchParams.set("room", room.code);
    QRCode.toDataURL(url.toString(), { width: 220, margin: 1, color: { dark: "#171528", light: "#ffffff" } }).then((data) => { setJoinUrl(url.toString()); setQr(data); }).catch(() => { setJoinUrl(url.toString()); setQr(""); });
  }, [room.code, room.role]);
  useEffect(() => {
    if (mode !== "practice") return;
    const held = new Set<string>();
    const apply = () => setPracticeInput({ steer: Number(held.has("ArrowRight") || held.has("d")) - Number(held.has("ArrowLeft") || held.has("a")), accelerate: held.has("ArrowUp") || held.has("w"), brake: held.has("ArrowDown") || held.has("s") });
    const down = (e: KeyboardEvent) => { if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d"].includes(e.key)) { e.preventDefault(); held.add(e.key); apply(); } };
    const up = (e: KeyboardEvent) => { held.delete(e.key); apply(); };
    const clear = () => { held.clear(); apply(); };
    window.addEventListener("keydown", down); window.addEventListener("keyup", up); window.addEventListener("blur", clear);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", clear); };
  }, [mode]);
  const confirmLeavingRace = () => {
    const active = (mode === "practice" && !raceFinished) || (mode === "host" && racing && !raceFinished) || (mode === "join" && room.locked && phonePhase !== "results");
    return !active || window.confirm("Leave this race? Your current race progress will be lost.");
  };
  const exit = () => { if (!confirmLeavingRace()) return; acceptInventory.current = false; resultsRef.current = null; startGeneration.current++; selectionArmed.current = false; setStarting(false); setStartError(""); room.leaveRoom(); setRacing(false); setRaceFinished(false); setMode("home"); };
  // Resume audio directly inside the gesture, before React mounts the race.
  const start = () => {
    if (starting || room.status !== "connected" || room.locked || !room.players.some(player => player.connected)) return;
    void unlockRaceAudio(); startGeneration.current++; needsLobbyUnlock.current = false; selectionArmed.current = true; setStartError(""); setRaceTrack(selectedTrack); setStarting(true); room.beginCharacterSelection();
  };
  const practice = () => { void unlockRaceAudio(); setRaceFinished(false); setRaceTrack(selectedTrack); setMode("practice"); setRaceKey((n) => n + 1); };
  const lobby = () => { if (!confirmLeavingRace()) return; acceptInventory.current = false; resultsRef.current = null; startGeneration.current++; selectionArmed.current = false; needsLobbyUnlock.current = true; setStarting(false); setStartError(""); setRacing(false); setRaceFinished(false); room.setLocked(false); room.publishState({ phase: "lobby" }); };
  const players = mode === "practice" ? [{ id: "practice", name: "YOU", ...appearance, input: practiceInput }] : raceRoster.map((driver) => {
    const current = room.players.find((player) => player.id === driver.id);
    return { ...driver, character: driver.character ?? undefined, connected: current?.connected === true, input: current?.connected ? current.input : neutral };
  });
  const activePlayers = room.players.filter((player) => player.connected);
  const choosingCharacters = room.selectionPhase === "selecting" || room.selectionPhase === "countdown";
  const chooseTrack = (track: TrackId) => {
    setSelectedTrack(track);
    try { localStorage.setItem("beerio-track", track); } catch { /* Optional preference storage. */ }
  };
  const chooseAppearance = (patch: Partial<Appearance>) => {
    const next = { ...appearanceRef.current, ...patch };
    appearanceRef.current = next;
    setAppearance(next);
    try { localStorage.setItem("beerio-appearance", JSON.stringify(next)); } catch { /* Optional preference storage. */ }
  };
  const toggleSteeringAssist = () => {
    const enabled = !steeringAssist;
    setSteeringAssist(enabled);
    try { localStorage.setItem("beerio-steering-assist", enabled ? "on" : "off"); } catch { /* Optional preference storage. */ }
  };

  if (mode === "practice" || (mode === "host" && racing)) return <main className={styles.race}>
    <GameView initialCountdown={mode === "host" ? 0 : 8} players={players} paused={mode === "host" && (room.status !== "connected" || room.recovering)} raceKey={raceKey} trackId={raceTrack} localKeyboard={mode === "practice"} autoSteer={steeringAssist}
      onInventoryChange={mode === "host" ? (inventory: PlayerInventory[]) => { if (acceptInventory.current && room.status === "connected" && !room.recovering) room.publishState({ type: "inventory", inventory }); } : undefined}
      onFinish={(results) => { acceptInventory.current = false; setRaceFinished(true); if (mode === "host") { resultsRef.current = results; needsLobbyUnlock.current = true; room.setLocked(false); room.publishState({ phase: "results", results }); scheduleResults(); } }}
      onRematch={mode === "practice" ? practice : undefined} onLobby={mode === "practice" ? exit : lobby}
      lobbyLabel={mode === "practice" ? "Back to menu" : "Rematch lobby"}
      rematchDisabled={mode === "host" && (room.status !== "connected" || room.locked || starting || activePlayers.length === 0)} />
    <div className={styles.raceTop}><button className={styles.smallButton} onClick={mode === "practice" ? exit : lobby}>← {mode === "practice" ? "Exit practice" : "Lobby"}</button>{mode === "practice" && <><span>ARROWS / WASD · SPACE BRAKES · SHIFT DRIFTS · E USES ITEM</span><button type="button" role="switch" aria-label="Steering assist" aria-checked={steeringAssist} className={styles.smallButton} onClick={toggleSteeringAssist}>STEERING ASSIST: {steeringAssist ? "ON" : "OFF"}</button></>}</div>
    {mode === "host" && room.status === "connected" && room.recovering && <div role="status" aria-live="polite" className={styles.connectionWarning}>
      Race paused while drivers reconnect. {room.recoveryWaitingFor.length > 0 && <>Waiting for: {room.recoveryWaitingFor.map((id) => room.players.find((player) => player.id === id)?.name || "Driver").join(", ")}.</>}
      {room.recoveryWaitingFor.length > 0 && <button className={styles.smallButton} onClick={room.resumeRace}>CONTINUE WITHOUT MISSING DRIVERS</button>}
    </div>}
    {mode === "host" && startError && room.status === "connected" && <div role="alert" className={styles.connectionWarning}>{startError}</div>}
    {mode === "host" && room.status !== "connected" && <div role="alert" className={styles.connectionWarning}>{room.error || "Connection lost. Reconnecting…"} Race paused while the host reconnects.{room.status === "error" && room.canRetryConnection && <button className={styles.smallButton} onClick={room.retryConnection}>RETRY CONNECTION</button>}{(room.status === "closed" || room.status === "error") && <button className={styles.smallButton} onClick={exit}>EXIT ROOM</button>}</div>}
  </main>;

  if (mode === "join" && room.playerId) {
    // The room lock is the durable race phase. Unlike a transient state event, it
    // arrives in welcome/resume snapshots even when a phone misses the start.
    const canDrive = room.status === "connected" && room.hostConnected && room.locked && !room.recovering && self?.inRace === true;
    const player = room.players.find((driver) => driver.id === room.playerId);
    const canChoose = room.status === "connected" && room.hostConnected && !room.locked && !room.recovering && Boolean(player) && (choosingCharacters || (room.characterSelectionVersion ?? 1) >= 3 && room.selectionPhase === "gathering");
    const ended = room.status === "closed" || room.status === "error";
    const waitingTitle = room.status === "closed" ? "Room closed." : ended && room.canRetryConnection ? "Connection paused." : ended ? "Room unavailable." : room.status !== "connected" ? "Reconnecting…" : !room.hostConnected ? "Host reconnecting…" : room.recovering ? "Waiting for drivers…" : room.locked && !player?.inRace ? "Race in progress." : phonePhase === "results" ? "Race finished!" : "You’re in!";
    const waitingDetail = ended && room.canRetryConnection ? "Try reconnecting to return to your racer." : ended ? "Leave this room to join another race." : room.status !== "connected" ? "Your controls are paused. We’ll reconnect you automatically." : !room.hostConnected ? "Keep this screen open. Controls will return when the host reconnects." : room.recovering ? "The race is paused while drivers reconnect. Controls return when the race resumes." : room.locked && !player?.inRace ? "You reconnected after the start. Join the next race." : phonePhase === "results" ? "Nice race! The host will open character selection for the next one." : "Eyes on the big screen. Once everyone has joined, the host opens character selection. No ready-up needed.";
    return <main className={`${styles.shell} ${styles.phoneShell}`}>
      <section className={styles.phone}>
        <header className={styles.phoneHead}>
          <div className={styles.driverIdentity}><span className={styles.avatar} style={{ background: player?.color || "#ffce58" }} /><div><strong>{player?.name || name || "DRIVER"}</strong><p>ROOM {room.code}</p></div></div>
          <button className={styles.phoneLeave} onClick={exit}>{ended ? "EXIT ROOM" : "LEAVE"}</button>
        </header>
        {canDrive ? <Controller send={room.setInput} useItem={room.useItem} item={phoneItem} itemFeedback={phoneItemFeedback} /> : canChoose && player ? <CharacterController player={player} onChoose={room.chooseCharacter} endsAt={room.countdownEndsAt} /> : <div className={styles.phoneWaiting} role="status" aria-live="polite">
          <div className={styles.waitingFlag} aria-hidden="true">{ended ? "!" : "⚑"}</div>
          <div className={styles.eyebrow}>{ended ? "RACE PAUSED" : room.status === "connected" && room.hostConnected ? "YOU’RE IN" : "HOLD TIGHT"}</div>
          <h1>{waitingTitle}</h1><p>{waitingDetail}</p>
        </div>}
        {room.error && <p role="alert" className={`${styles.error} ${styles.phoneError}`}>{room.error}</p>}
        {room.status === "error" && room.canRetryConnection && <button className={styles.secondary} onClick={room.retryConnection}>RETRY CONNECTION</button>}
      </section>
    </main>;
  }

  if (mode === "host" && room.code && (room.characterSelectionVersion ?? 1) >= 3) return <main className={selectionStyles.hostScreen}>
    <header className={selectionStyles.hostHeader}><strong>BEERIO<span>★</span></strong><div>ROOM <b>{room.code}</b></div><button type="button" className={styles.smallButton} onClick={exit}>CLOSE ROOM</button></header>
    <div className={selectionStyles.hostWorkspace}>
      <aside className={selectionStyles.hostSidebar}>
        <div className={selectionStyles.joinDetails}><span>SCAN TO JOIN</span>{qr && <Image src={qr} alt="QR code to join this room" width={180} height={180} unoptimized />}<strong>{room.code}</strong><small>{joinUrl}</small></div>
        <TrackPicker value={selectedTrack} onChange={chooseTrack} />
        <button type="button" role="switch" aria-checked={steeringAssist} className={styles.assistToggle} onClick={toggleSteeringAssist}><span>STEERING ASSIST</span><strong>{steeringAssist ? "ON" : "OFF"}</strong></button>
        <button className={styles.primary} disabled={starting || !activePlayers.length || room.players.some(player => !player.connected || !player.characterConfirmed) || room.status !== "connected" || choosingCharacters} onClick={start}>{starting ? "STARTING…" : choosingCharacters ? "RACE STARTING…" : "START RACE ↗"}</button>
        <p className={styles.fine}>Everyone picks a character, then the host starts the race.</p>
        {room.players.some(player => !player.connected) && <button className={styles.smallButton} disabled={room.status !== "connected"} onClick={room.skipOfflineDrivers}>CONTINUE WITHOUT DISCONNECTED DRIVERS</button>}
        {(room.error || startError) && <p role="alert" className={styles.error}>{room.error || startError}</p>}
        {room.status === "error" && room.canRetryConnection && <button className={styles.secondary} onClick={room.retryConnection}>RETRY CONNECTION</button>}
      </aside>
      <CharacterGrid version={room.characterSelectionVersion} players={room.players} endsAt={room.status === "connected" && room.hostConnected ? room.countdownEndsAt : null} />
    </div>
  </main>;

  if (mode === "host" && room.code && choosingCharacters) return <main className={selectionStyles.hostScreen}>
    <header className={selectionStyles.hostHeader}><strong>BEERIO<span>★</span></strong><div>ROOM <b>{room.code}</b><small>{TRACKS.find(track => track.id === raceTrack)?.name}</small></div><div><button type="button" className={styles.smallButton} disabled={room.status !== "connected"} onClick={() => { selectionArmed.current = false; needsLobbyUnlock.current = true; room.setLocked(false); }}>BACK TO JOINING</button><button type="button" className={styles.smallButton} onClick={exit}>CLOSE ROOM</button></div></header>
    <CharacterGrid version={room.characterSelectionVersion ?? 1} players={room.players} endsAt={room.status === "connected" && room.hostConnected ? room.countdownEndsAt : null} />
    {room.players.some(player => !player.connected) && <div className={selectionStyles.offlineNotice}><span>Waiting for disconnected drivers to return.</span><button className={styles.smallButton} disabled={room.status !== "connected"} onClick={room.skipOfflineDrivers}>CONTINUE WITHOUT THEM</button></div>}
    {(room.error || startError) && <p role="alert" className={styles.error}>{room.error || startError}</p>}
    {room.status !== "connected" && <p role="status" className={styles.error}>Connection interrupted. The countdown is paused while the host reconnects.</p>}
    {room.status === "error" && room.canRetryConnection && <button className={styles.secondary} onClick={room.retryConnection}>RETRY CONNECTION</button>}
  </main>;

  return <main className={styles.shell}>
    <header className={styles.header}><Link href="/beerio" className={styles.wordmark}>BEERIO<span>★</span></Link><span>THE BIG SCREEN IS THE TRACK.</span><Link href="/">suraaj.me ↗</Link></header>
    <div className={styles.content}>
      {mode === "home" && <section className={styles.hero}>
        <div className={styles.eyebrow}>THE PARTY RACING GAME</div><h1>READY.<br /><em>SET.</em> RACE.</h1>
        <p>One big screen. Your phones as controllers. Up to ten friends racing for the glory.</p>
        <div className={styles.actions}><button className={styles.primary} onClick={() => setMode("host")}>HOST A RACE <span>↗</span></button><button className={styles.secondary} onClick={() => { setRandomJoin(false); setMode("join"); }}>JOIN WITH A CODE</button><button className={styles.secondary} onClick={() => { setRandomJoin(true); setMode("join"); }}>JOIN A RANDOM ROOM</button></div>
        <button className={styles.textButton} onClick={() => setMode("solo")}>Set up a solo practice race →</button>
        <div className={styles.checkers} aria-hidden="true" /><div className={styles.bigStar} aria-hidden="true">✳</div>
      </section>}
      {mode === "solo" && <section className={styles.panel}><button className={styles.back} onClick={exit}>← BACK</button><div className={styles.eyebrow}>SOLO PRACTICE</div><h1>Make a<br /><em>practice run.</em></h1><p>Choose your racer, ride, and track for a practice race. A keyboard is required: use the arrow keys or WASD.</p><div className={styles.practiceSetup}><AppearancePicker value={appearance} onChange={chooseAppearance} /><TrackPicker value={selectedTrack} onChange={chooseTrack} label="SOLO PRACTICE TRACK" /><button className={styles.primary} onClick={practice}>START SOLO PRACTICE ↗</button></div></section>}
      {mode === "host" && !room.code && <section className={styles.panel}><button className={styles.back} onClick={exit}>← BACK</button><div className={styles.eyebrow}>THE HOST SCREEN</div><h1>Get the gang<br /><em>together.</em></h1><p>Open this page on the laptop connected to your TV. Create a room, then have everyone join on their phones.</p><div className={styles.assistSetting}><button type="button" role="switch" aria-checked={publicRoom} className={styles.assistToggle} disabled={room.status === "connecting"} onClick={() => setPublicRoom(!publicRoom)}><span>ALLOW RANDOM PLAYERS</span><strong>{publicRoom ? "ON" : "OFF"}</strong></button><p className={styles.fine}>When on, anyone can join this room while it is open. Players need to see the host screen to race.</p></div><button className={styles.primary} disabled={room.status === "connecting"} onClick={() => room.createRoom({ maxPlayers: 10, publicMatchmaking: publicRoom })}>{room.status === "connecting" ? "CONNECTING..." : "CREATE ROOM ↗"}</button>{room.error && <p role="alert" className={styles.error}>{room.error}</p>}<p className={styles.fine}>The host screen runs the race. Players join from any network using a room code.</p></section>}
      {mode === "host" && room.code && <section className={styles.lobby}><div className={styles.lobbyHead}><div><div className={styles.eyebrow}>THE STARTING GRID</div><h1>Join the race<span>.</span></h1><p>Everyone joins with a name and color. Then choose your characters together.</p></div><button className={styles.secondary} onClick={exit}>CLOSE ROOM</button></div>
        {publicRoom && !room.publicMatchmaking && <p role="alert" className={styles.error}>This relay does not support random joining yet. This room is code-only.</p>}
        {room.maxPlayers < 10 && <div className={styles.capacityWarning} role="status"><strong>This older room holds only {room.maxPlayers} players.</strong><p>To race with 10, create a new room. This closes the current room and everyone will need to rejoin with the new code.</p><button type="button" className={styles.secondary} disabled={room.status !== "connected" || room.locked || starting} onClick={() => {
          if (room.players.length > 0 && !window.confirm("Create a 10-player room? This closes the current room and disconnects everyone. Players will need the new code to rejoin.")) return;
          room.createRoom({ maxPlayers: 10, ...(room.publicMatchmaking ? { publicMatchmaking: true } : {}), relayUrl: room.relayUrl });
        }}>CREATE 10-PLAYER ROOM ↗</button></div>}
        <div className={styles.lobbyGrid}><div className={styles.joinCard}><div className={styles.codeLabel}>ROOM CODE</div><p className={styles.fine}>{room.publicMatchmaking ? "OPEN TO RANDOM PLAYERS" : "CODE-ONLY ROOM"}</p><div className={styles.code}>{room.code}</div><p className={styles.url}>{joinUrl}</p>{qr && <Image className={styles.qr} src={qr} alt="QR code to join this room" width={180} height={180} unoptimized />}</div>
          <div className={styles.players}><div className={styles.playersHead}>DRIVERS <span>{activePlayers.length} / {room.maxPlayers}</span></div>
            {!choosingCharacters && <><StartingGrid players={room.players} maxPlayers={room.maxPlayers} /><TrackPicker value={selectedTrack} onChange={chooseTrack} /><div className={styles.assistSetting}><button type="button" role="switch" aria-checked={steeringAssist} className={styles.assistToggle} onClick={toggleSteeringAssist}><span>STEERING ASSIST</span><strong>{steeringAssist ? "ON" : "OFF"}</strong></button><p className={styles.fine}>{steeringAssist ? "Follows the bends. Drivers steer to pass and dodge." : "Full control. Drivers must steer through every bend."}</p></div><button className={styles.primary} disabled={starting || !activePlayers.length || room.status !== "connected"} onClick={start}>{starting ? "OPENING…" : "EVERYONE’S IN · CHOOSE CHARACTERS ↗"}</button><p className={styles.fine}>Invite everyone first, then open the character grid. No ready-up. Last character pick starts the five-second countdown.</p></>}
            {choosingCharacters && <><p className={styles.fine}>Racing on {TRACKS.find(track => track.id === raceTrack)?.name}. Use your phone joystick to choose, then SELECT.</p><button className={styles.secondary} disabled={room.status !== "connected"} onClick={() => { selectionArmed.current = false; needsLobbyUnlock.current = true; room.setLocked(false); }}>BACK TO JOINING</button></>}
            {room.players.some(player => !player.connected) && <button className={styles.secondary} disabled={room.status !== "connected"} onClick={room.skipOfflineDrivers}>CONTINUE WITHOUT DISCONNECTED DRIVERS</button>}
          </div></div>
          {choosingCharacters && <CharacterGrid version={room.characterSelectionVersion ?? 1} players={room.players} endsAt={room.hostConnected ? room.countdownEndsAt : null} />}
          {(room.error || startError) && <p role="alert" className={styles.error}>{room.error || startError}</p>}{room.status === "error" && room.canRetryConnection && <button className={styles.secondary} onClick={room.retryConnection}>RETRY CONNECTION</button>}</section>}
      {mode === "join" && !room.playerId && <section className={styles.panel}><button className={styles.back} onClick={exit}>← BACK</button><div className={styles.eyebrow}>GRAB THE WHEEL</div><h1>You&apos;re<br /><em>driving.</em></h1><p>{randomJoin ? "Join an open public room. You’ll need to see the host’s screen to follow the race." : "Enter the code, your name, and your color. You’ll pick your character together on the big screen."}</p><form className={styles.form} onSubmit={(event) => { event.preventDefault(); if (Array.from(name.trim()).length <= 64) { if (randomJoin) room.joinRandomRoom({ name: name.trim(), appearance }); else room.joinRoom({ code: code.trim().toUpperCase(), name: name.trim(), appearance }); } }}>{!randomJoin && <label>ROOM CODE<input required autoCapitalize="characters" autoCorrect="off" maxLength={8} value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="ABC123" /></label>}<label>DRIVER NAME <span>(up to 64 Unicode characters)</span><input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" aria-invalid={Array.from(name.trim()).length > 64} aria-describedby="driver-name-help" /><small id="driver-name-help">{Array.from(name.trim()).length > 64 ? "Name is too long. Use 64 characters or fewer." : `${Array.from(name.trim()).length} / 64 characters`}</small></label><AppearancePicker value={appearance} onChange={chooseAppearance} colorOnly /><button className={styles.primary} disabled={room.status === "connecting" || !name.trim() || Array.from(name.trim()).length > 64 || (!randomJoin && !code.trim())}>{room.status === "connecting" ? "CONNECTING..." : randomJoin ? "FIND A ROOM ↗" : "JOIN THE RACE ↗"}</button></form>{(room.error || startError) && <p role="alert" className={styles.error}>{room.error || startError}</p>}{room.status === "error" && room.canRetryConnection && <button className={styles.secondary} onClick={room.retryConnection}>RETRY CONNECTION</button>}</section>}
    </div>
  </main>;
}
