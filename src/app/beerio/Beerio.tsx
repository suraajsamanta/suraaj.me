"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import Link from "next/link";
import Image from "next/image";
import GameView from "./game/GameView";
import { unlockRaceAudio } from "./game/audio";
import { TRACKS, type TrackId } from "./game/track";
import { useBeerioRoom } from "./room/useBeerioRoom";
import styles from "./beerio.module.css";

type Input = { steer: number; accelerate: boolean; brake: boolean };
const neutral: Input = { steer: 0, accelerate: false, brake: false };

type Mode = "home" | "host" | "join" | "practice";
type ControlKey = "left" | "right" | "accelerate" | "brake";
const releasedControls = { left: false, right: false, accelerate: false, brake: false };

function TrackPicker({ value, onChange, label = "CHOOSE YOUR TRACK" }: { value: TrackId; onChange: (value: TrackId) => void; label?: string }) {
  const selected = TRACKS.find((track) => track.id === value) || TRACKS[0];
  return <div className={styles.trackPicker}>
    <label><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value as TrackId)}>{TRACKS.map((track) => <option key={track.id} value={track.id}>{track.name}</option>)}</select></label>
    <p>{selected.description}</p>
  </div>;
}

function Controller({ send, useItem }: { send: (input: Input) => void; useItem: () => void }) {
  const keys = useRef({ ...releasedControls });
  const pointers = useRef(new Map<number, ControlKey>());
  const keyboard = useRef(new Set<ControlKey>());
  const [pressed, setPressed] = useState({ ...releasedControls });
  const update = useCallback(() => {
    const held = new Set([...pointers.current.values(), ...keyboard.current]);
    keys.current = { left: held.has("left"), right: held.has("right"), accelerate: held.has("accelerate"), brake: held.has("brake") };
    setPressed(keys.current);
    send({ steer: Number(keys.current.right) - Number(keys.current.left), accelerate: keys.current.accelerate, brake: keys.current.brake });
  }, [send]);
  useEffect(() => {
    const heldPointers = pointers.current;
    const heldKeyboard = keyboard.current;
    const timer = window.setInterval(() => send({ steer: Number(keys.current.right) - Number(keys.current.left), accelerate: keys.current.accelerate, brake: keys.current.brake }), 100);
    const reset = () => { heldPointers.clear(); heldKeyboard.clear(); keys.current = { ...releasedControls }; setPressed(keys.current); send(neutral); };
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
      heldPointers.clear(); heldKeyboard.clear(); keys.current = { ...releasedControls }; send(neutral);
    };
  }, [send]);
  const releasePointer = (pointerId: number) => { if (pointers.current.delete(pointerId)) update(); };
  const control = (key: ControlKey, label: string, content: string, extra = "") => (
    <button type="button" className={`${styles.control} ${extra} ${pressed[key] ? styles.pressed : ""}`} aria-label={label} aria-pressed={pressed[key]}
      onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); pointers.current.set(event.pointerId, key); update(); }}
      onPointerUp={(event) => releasePointer(event.pointerId)} onPointerCancel={(event) => releasePointer(event.pointerId)} onLostPointerCapture={(event) => releasePointer(event.pointerId)}
      onKeyDown={(event) => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); keyboard.current.add(key); update(); } }}
      onKeyUp={(event) => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); keyboard.current.delete(key); update(); } }}
      onBlur={() => { if (keyboard.current.delete(key)) update(); }} onContextMenu={(event) => event.preventDefault()}>
      <span aria-hidden="true">{content}</span>{(key === "left" || key === "right") && <small>{key.toUpperCase()}</small>}
    </button>
  );
  return <div className={styles.controller}>
    <div className={styles.controllerStatus}><span className={styles.dot} /> RACE ON · CONTROLLER READY</div>
    <p className={styles.controlHint}>Hold GO + a direction. Grab a pickup, then tap USE ITEM.</p>
    <div className={styles.controls}>
      <div className={styles.steering}>{control("left", "Steer left", "◀")}{control("right", "Steer right", "▶")}</div>
      <button type="button" className={styles.itemControl} onClick={useItem} onContextMenu={(event) => event.preventDefault()} aria-label="Use item"><span aria-hidden="true">✦</span><strong>USE ITEM</strong></button>
      <div className={styles.pedals}>{control("brake", "Brake", "BRAKE", styles.brake)}{control("accelerate", "Accelerate", "GO", styles.go)}</div>
    </div>
  </div>;
}

export default function Beerio() {
  const room = useBeerioRoom();
  const { code: roomCode, role: roomRole, status: roomStatus, setLocked, publishState } = room;
  const [mode, setMode] = useState<Mode>("home");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [racing, setRacing] = useState(false);
  const [raceKey, setRaceKey] = useState(0);
  const [qr, setQr] = useState("");
  const [joinUrl, setJoinUrl] = useState("");
  const [practiceInput, setPracticeInput] = useState<Input>(neutral);
  const [finished, setFinished] = useState(false);
  const [steeringAssist, setSteeringAssist] = useState(true);
  const [selectedTrack, setSelectedTrack] = useState<TrackId>("sunset");
  const [raceTrack, setRaceTrack] = useState<TrackId>("sunset");
  const [raceRoster, setRaceRoster] = useState<Array<{ id: string; name: string; color: string; input: Input }>>([]);

  useEffect(() => {
    const preset = new URLSearchParams(window.location.search).get("room");
    if (preset) queueMicrotask(() => { setCode(preset.toUpperCase()); setMode("join"); });
    try {
      if (localStorage.getItem("beerio-steering-assist") === "off") queueMicrotask(() => setSteeringAssist(false));
      const savedTrack = localStorage.getItem("beerio-track");
      if (TRACKS.some((track) => track.id === savedTrack)) queueMicrotask(() => setSelectedTrack(savedTrack as TrackId));
    } catch { /* Storage restrictions must not prevent racing. */ }
  }, []);
  useEffect(() => {
    if (!roomCode || !roomRole || roomStatus !== "connected") return;
    if (mode === "home" || (mode === "join" && roomRole === "host") || (mode === "host" && roomRole === "player")) {
      queueMicrotask(() => setMode(roomRole === "host" ? "host" : "join"));
      // A refreshed host has lost its in-memory simulation; reopen the lobby.
      if (roomRole === "host") { setLocked(false); publishState({ phase: "lobby" }); }
    }
  }, [roomCode, roomRole, roomStatus, setLocked, publishState, mode]);
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
  const exit = () => { room.leaveRoom(); setRacing(false); setFinished(false); setMode("home"); };
  // Resume audio directly inside the gesture, before React mounts the race.
  const start = () => { void unlockRaceAudio(); setRaceTrack(selectedTrack); setRaceRoster(room.players.filter((player) => player.connected)); setFinished(false); setRaceKey((n) => n + 1); setRacing(true); room.setLocked(true); room.publishState({ phase: "racing" }); };
  const practice = () => { void unlockRaceAudio(); setRaceTrack(selectedTrack); setMode("practice"); setRaceKey((n) => n + 1); setFinished(false); };
  const lobby = () => { setRacing(false); setFinished(false); room.setLocked(false); room.publishState({ phase: "lobby" }); };
  const players = mode === "practice" ? [{ id: "practice", name: "YOU", color: "#ffce58", input: practiceInput }] : raceRoster.map((driver) => {
    const current = room.players.find((player) => player.id === driver.id);
    return { ...driver, input: current?.connected ? current.input : neutral };
  });
  const activePlayers = room.players.filter((player) => player.connected);
  const chooseTrack = (track: TrackId) => {
    setSelectedTrack(track);
    try { localStorage.setItem("beerio-track", track); } catch { /* Optional preference storage. */ }
  };
  const toggleSteeringAssist = () => {
    const enabled = !steeringAssist;
    setSteeringAssist(enabled);
    try { localStorage.setItem("beerio-steering-assist", enabled ? "on" : "off"); } catch { /* Optional preference storage. */ }
  };

  if (mode === "practice" || (mode === "host" && racing)) return <main className={styles.race}>
    <GameView players={players} raceKey={raceKey} trackId={raceTrack} localKeyboard={mode === "practice"} autoSteer={steeringAssist} onFinish={() => setFinished(true)} />
    <div className={styles.raceTop}><button className={styles.smallButton} onClick={mode === "practice" ? exit : lobby}>← {mode === "practice" ? "Exit practice" : "Lobby"}</button>{mode === "practice" && <><span>ARROWS / WASD · SPACE BRAKES · E USES ITEM</span><button type="button" role="switch" aria-label="Steering assist" aria-checked={steeringAssist} className={styles.smallButton} onClick={toggleSteeringAssist}>STEERING ASSIST: {steeringAssist ? "ON" : "OFF"}</button></>}{finished && mode === "practice" && <button className={styles.smallButton} onClick={practice}>RACE AGAIN ↻</button>}</div>
    {mode === "host" && room.status !== "connected" && <div role="alert" className={styles.connectionWarning}>{room.error || "Connection lost. Reconnecting…"}{(room.status === "closed" || room.status === "error") && <button className={styles.smallButton} onClick={exit}>EXIT ROOM</button>}</div>}
  </main>;

  if (mode === "join" && room.playerId) {
    // The room lock is the durable race phase. Unlike a transient state event, it
    // arrives in welcome/resume snapshots even when a phone misses the start.
    const canDrive = room.status === "connected" && room.hostConnected && room.locked;
    const player = room.players.find((driver) => driver.id === room.playerId);
    const ended = room.status === "closed" || room.status === "error";
    const waitingTitle = room.status === "closed" ? "Room closed." : ended ? "Room unavailable." : room.status !== "connected" ? "Reconnecting…" : !room.hostConnected ? "Host reconnecting…" : "Waiting for the host.";
    const waitingDetail = ended ? "Leave this room to join another race." : room.status !== "connected" ? "Your controls are paused. We’ll reconnect you automatically." : !room.hostConnected ? "Keep this screen open. Controls will return when the host reconnects." : "You’re on the starting grid. Your controls will appear when the host starts the race.";
    return <main className={`${styles.shell} ${styles.phoneShell}`}>
      <section className={styles.phone}>
        <header className={styles.phoneHead}>
          <div className={styles.driverIdentity}><span className={styles.avatar} style={{ background: player?.color || "#ffce58" }} /><div><strong>{player?.name || name || "DRIVER"}</strong><p>ROOM {room.code}</p></div></div>
          <button className={styles.phoneLeave} onClick={exit}>{ended ? "EXIT ROOM" : "LEAVE"}</button>
        </header>
        {canDrive ? <Controller send={room.setInput} useItem={room.useItem} /> : <div className={styles.phoneWaiting} role="status" aria-live="polite">
          <div className={styles.waitingFlag} aria-hidden="true">{ended ? "!" : "⚑"}</div>
          <div className={styles.eyebrow}>{ended ? "RACE PAUSED" : room.status === "connected" && room.hostConnected ? "YOU’RE IN" : "HOLD TIGHT"}</div>
          <h1>{waitingTitle}</h1><p>{waitingDetail}</p>
          {!ended && room.status === "connected" && room.hostConnected && <span className={styles.readyBadge}><span className={styles.dot} /> CONNECTED & READY</span>}
        </div>}
        {room.error && <p role="alert" className={`${styles.error} ${styles.phoneError}`}>{room.error}</p>}
      </section>
    </main>;
  }

  return <main className={styles.shell}>
    <header className={styles.header}><Link href="/beerio" className={styles.wordmark}>BEERIO<span>★</span></Link><span>THE BIG SCREEN IS THE TRACK.</span><Link href="/">suraaj.me ↗</Link></header>
    <div className={styles.content}>
      {mode === "home" && <section className={styles.hero}>
        <div className={styles.eyebrow}>THE PARTY RACING GAME</div><h1>READY.<br /><em>SET.</em> RACE.</h1>
        <p>One big screen. Your phones as controllers. Up to six friends racing for the glory.</p>
        <div className={styles.actions}><button className={styles.primary} onClick={() => setMode("host")}>HOST A RACE <span>↗</span></button><button className={styles.secondary} onClick={() => setMode("join")}>JOIN WITH A CODE</button></div>
        <div className={styles.practiceSetup}><TrackPicker value={selectedTrack} onChange={chooseTrack} label="SOLO PRACTICE TRACK" /><button className={styles.textButton} onClick={practice}>Try a solo practice lap →</button></div>
        <div className={styles.checkers} aria-hidden="true" /><div className={styles.bigStar} aria-hidden="true">✳</div>
      </section>}
      {mode === "host" && !room.code && <section className={styles.panel}><button className={styles.back} onClick={exit}>← BACK</button><div className={styles.eyebrow}>THE HOST SCREEN</div><h1>Get the gang<br /><em>together.</em></h1><p>Open this page on the laptop connected to your TV. Create a room, then have everyone join on their phones.</p><button className={styles.primary} disabled={room.status === "connecting"} onClick={() => room.createRoom({ maxPlayers: 6 })}>{room.status === "connecting" ? "CONNECTING..." : "CREATE ROOM ↗"}</button>{room.error && <p role="alert" className={styles.error}>{room.error}</p>}<p className={styles.fine}>The host screen runs the race. Players join from any network using a room code.</p></section>}
      {mode === "host" && room.code && <section className={styles.lobby}><div className={styles.lobbyHead}><div><div className={styles.eyebrow}>THE STARTING GRID</div><h1>Join the race<span>.</span></h1><p>Scan the code or open the link and enter the room code.</p></div><button className={styles.secondary} onClick={exit}>CLOSE ROOM</button></div>
        <div className={styles.lobbyGrid}><div className={styles.joinCard}><div className={styles.codeLabel}>ROOM CODE</div><div className={styles.code}>{room.code}</div><p className={styles.url}>{joinUrl}</p>{qr && <Image className={styles.qr} src={qr} alt="QR code to join this room" width={180} height={180} unoptimized />}</div>
          <div className={styles.players}><div className={styles.playersHead}>DRIVERS <span>{activePlayers.length} / 6</span></div>{room.players.length === 0 && <p className={styles.waiting}>Waiting for the first driver...</p>}{room.players.map((player) => <div className={styles.player} key={player.id}><span className={styles.avatar} style={{ background: player.color }} /> <strong>{player.name}</strong><span>{player.connected ? "READY" : "DISCONNECTED"}</span></div>)}<TrackPicker value={selectedTrack} onChange={chooseTrack} /><div className={styles.assistSetting}><button type="button" role="switch" aria-checked={steeringAssist} className={styles.assistToggle} onClick={toggleSteeringAssist}><span>STEERING ASSIST</span><strong>{steeringAssist ? "ON" : "OFF"}</strong></button><p className={styles.fine}>{steeringAssist ? "Follows the bends. Drivers steer to pass and dodge." : "Full control. Drivers must steer through every bend."}</p></div><button className={styles.primary} disabled={activePlayers.length < 1 || room.status !== "connected"} onClick={start}>START YOUR ENGINES ↗</button><p className={styles.fine}>Best with 4–6 players. The host can start with fewer.</p></div></div>{room.error && <p role="alert" className={styles.error}>{room.error}</p>}</section>}
      {mode === "join" && !room.playerId && <section className={styles.panel}><button className={styles.back} onClick={exit}>← BACK</button><div className={styles.eyebrow}>GRAB THE WHEEL</div><h1>You&apos;re<br /><em>driving.</em></h1><p>Enter the code on the big screen and pick a name.</p><form className={styles.form} onSubmit={(event) => { event.preventDefault(); room.joinRoom({ code: code.trim().toUpperCase(), name: name.trim() }); }}><label>ROOM CODE<input required autoCapitalize="characters" autoCorrect="off" maxLength={8} value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="ABC123" /></label><label>DRIVER NAME<input required maxLength={20} value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" /></label><button className={styles.primary} disabled={room.status === "connecting" || !name.trim() || !code.trim()}>{room.status === "connecting" ? "CONNECTING..." : "JOIN THE RACE ↗"}</button></form>{room.error && <p role="alert" className={styles.error}>{room.error}</p>}</section>}
    </div>
  </main>;
}
