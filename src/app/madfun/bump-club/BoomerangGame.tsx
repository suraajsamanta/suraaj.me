"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import Image from "next/image";
import QRCode from "qrcode";
import QuickStart from "../shared/QuickStart";
import HostRemote from "../shared/HostRemote";
import { ARENA_AUTO_START_MS, arenaStartKey } from "../shared/arena-auto-start";
import { ArenaRoomClient } from "./transport";
import { ARENAS, createArena, startMatch, tickArena, syncRoster, type ArenaId, type ArenaState, type ArenaInput } from "./engine";
import ArenaCanvas from "./ArenaCanvas";
import PhoneControls from "./PhoneControls";
import { useArenaAudio } from "./useArenaAudio";
import styles from "./boomerang.module.css";
const QUICK_START = [
  { title: "Set up the room", body: "On your shared screen, choose Create room. This device runs the game without joining as a player. For solo play, choose Practice with bots." },
  { title: "Join and start", body: "Every player scans the QR code with their own phone, or enters the room code and their name. With at least two fighters, start from the shared screen or via the private Game controller QR. Auto-run can start a ready room after 12 seconds." },
  { title: "Knock rivals off", body: "Use the joystick to move. Tap Shove when a rival is close or Dash into them for a harder hit. Watch your momentum as the platform shrinks." },
  { title: "Win the match", body: "Last one on the platform scores a round win. First to five round wins takes the match." },
] as const;

const EMPTY_INPUT: ArenaInput = { x: 0, y: 0, throwSeq: 0, dash: false };
const BOT_COLORS = ["#ff83c6", "#80ceff", "#ffbc68", "#b49aff"];
export default function BoomerangGame() {
  const [client] = useState(() => new ArenaRoomClient());
  const { unlock: unlockAudio, toggle: toggleAudio, update: updateAudio, muted } = useArenaAudio();
  const room = useSyncExternalStore(client.subscribe, client.getSnapshot, client.getSnapshot);
  const roomRef = useRef(room);
  useEffect(() => { roomRef.current = room; }, [room]);
  const [mode, setMode] = useState<"entry" | "host" | "phone" | "practice">("entry");
  const [showArena, setShowArena] = useState(true);
  const [invited, setInvited] = useState(false);
  const [name, setName] = useState(""); const [code, setCode] = useState("");
  const [arenaId, setArenaId] = useState<ArenaId>("garden");
  const [bots, setBots] = useState(0); const [qr, setQr] = useState("");
  const [notice, setNotice] = useState("");
  const [autoRun, setAutoRun] = useState(false);
  const [autoStatus, setAutoStatus] = useState<{ cycle: string; seconds: number } | null>(null);
  const [arena, setArena] = useState<ArenaState>(() => createArena([]));
  const pendingStart = useRef(false);
  const arenaRef = useRef(arena); const localInput = useRef<ArenaInput>({ ...EMPTY_INPUT });
  const [, redraw] = useState(0);
  const resetArena = useCallback((next: ArenaState) => { arenaRef.current = next; setArena(next); }, []);
  useEffect(() => {
    const query = new URLSearchParams(window.location.search).get("room");
    const timer = window.setTimeout(() => { if (query) { setCode(query.toUpperCase().slice(0,6)); setInvited(true); } }, 0);
    return () => { clearTimeout(timer); client.dispose(); };
  }, [client]);
  useEffect(() => client.onState((payload: unknown) => {
    if (roomRef.current.role !== "player" || !payload || typeof payload !== "object") return;
    const state = payload as ArenaState;
    if (Array.isArray(state.players) && ["lobby", "countdown", "playing", "roundOver", "matchOver"].includes(state.phase)) resetArena(state);
  }), [client, resetArena]);
  useEffect(() => {
    if (!room.code) return;
    let cancelled = false;
    QRCode.toDataURL(`${window.location.origin}/madfun/bump-club?room=${room.code}`, { width: 220, margin: 2, errorCorrectionLevel: "M" }).then(value => { if (!cancelled) setQr(value); }).catch(() => {});
    return () => { cancelled = true; };
  }, [room.code]);
  useEffect(() => {
    if (mode !== "host" || arenaRef.current.phase !== "lobby") return;
    const humans = room.players.filter(player => player.connected).map(player => ({ id: player.id, name: player.name, color: player.color }));
    const botRoster = Array.from({ length: Math.min(bots, 10 - humans.length) }, (_, index) => ({ id: `bot-${index}`, name: ["Mochi", "Pickle", "Waffles", "Peach"][index % 4], color: BOT_COLORS[index % 4], bot: true }));
    syncRoster(arenaRef.current, [...humans, ...botRoster]); redraw(value => value + 1);
  }, [room.players, bots, mode]);
  useEffect(() => {
    if (mode !== "host" && mode !== "practice") return;
    let last = performance.now(); let lastUi = last;
    const timer = window.setInterval(() => {
      const now = performance.now(); const dt = Math.min((now-last)/1000, .05); last = now;
      const snapshot = roomRef.current;
      if (mode === "host" && pendingStart.current && snapshot.locked) { pendingStart.current = false; syncRoster(arenaRef.current, arenaRef.current.players.filter(player => player.bot || snapshot.players.some(current => current.id === player.id && current.connected)));
        if (!arenaRef.current.players.some(player => !player.bot) || !startMatch(arenaRef.current)) client.lobby(); }
      const inputs: Record<string, ArenaInput> = {};
      for (const player of snapshot.players) inputs[player.id] = player.connected ? player.input : EMPTY_INPUT;
      if (mode === "practice") inputs.you = localInput.current;
      if (mode === "practice" || (snapshot.status === "connected" && (arenaRef.current.phase === "lobby" || snapshot.locked))) tickArena(arenaRef.current, inputs, dt);
      if (mode === "host") client.publish(arenaRef.current);
      if (mode === "practice" || snapshot.status === "connected") updateAudio(arenaRef.current);
      if (now-lastUi > 80) { lastUi = now; redraw(value => value + 1); }
    }, 16);
    return () => clearInterval(timer);
  }, [client, mode, updateAudio]);
  useEffect(() => {
    if (mode !== "practice") return;
    const held = new Set<string>();
    const update = () => { localInput.current = { ...localInput.current, x: Number(held.has("d") || held.has("arrowright"))-Number(held.has("a") || held.has("arrowleft")), y: Number(held.has("s") || held.has("arrowdown"))-Number(held.has("w") || held.has("arrowup")), dash: held.has("shift") }; };
    const down = (event: KeyboardEvent) => { const key = event.key.toLowerCase(); if (event.target instanceof Element && event.target.closest("input,textarea,button,select,[contenteditable]")) return; if ([" ","shift","arrowleft","arrowright","arrowup","arrowdown","w","a","s","d"].includes(key)) event.preventDefault(); if (key === " " && !event.repeat) localInput.current.throwSeq++; held.add(key); update(); };
    const up = (event: KeyboardEvent) => { held.delete(event.key.toLowerCase()); update(); };
    const blur = () => { held.clear(); update(); };
    window.addEventListener("keydown", down); window.addEventListener("keyup", up); window.addEventListener("blur", blur);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", blur); };
  }, [mode]);
  const input = useCallback((value: ArenaInput) => { client.setInput(value); }, [client]);
  const practiceInput = useCallback((value: ArenaInput) => { localInput.current = value; }, []);
  const leave = () => { pendingStart.current = false; setAutoRun(false); setAutoStatus(null); client.leave(); setMode("entry"); setShowArena(true); resetArena(createArena([], arenaId)); setNotice(""); };
  const fullscreen = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen(); else setNotice("On iPhone, use Share → Add to Home Screen for a browser-free view."); } catch { setNotice("Fullscreen is unavailable in this browser. Try landscape or Add to Home Screen."); } };
  const host = () => { unlockAudio(); resetArena(createArena([], arenaId)); setBots(0); setMode("host"); client.create(); };
  const copyJoin = async () => {
    if (!room.code) return;
    try { await navigator.clipboard.writeText(new URL("/madfun/bump-club?room=" + room.code, location.origin).href); setNotice("Join link copied."); }
    catch { setNotice("Copy the room code and send it to your friends: " + room.code); }
  };
  const practice = () => { unlockAudio(); localInput.current = { ...EMPTY_INPUT }; const state = createArena([{ id: "you", name: name.trim() || "You", color: "#d6ff65" }, ...BOT_COLORS.slice(0,3).map((color,index) => ({ id: `bot-${index}`, name: ["Mochi","Pickle","Waffles"][index], color, bot:true }))], arenaId); startMatch(state); resetArena(state); setMode("practice"); };
  const startKey = arenaStartKey(room, bots);
  const autoCycle = mode === "host" && autoRun && arena.phase === "lobby" && startKey
    ? JSON.stringify([room.code, arenaId, startKey]) : null;
  const countdown = autoStatus?.cycle === autoCycle ? autoStatus.seconds : ARENA_AUTO_START_MS / 1000;
  const toggleAutoRun = () => { setAutoStatus(null); setAutoRun(value => !value); };
  const begin = useCallback((manual = true, expectedKey?: string) => {
    const ready = arenaStartKey(client.getSnapshot(), bots);
    if (mode !== "host" || pendingStart.current || arenaRef.current.phase !== "lobby" ||
      !ready || (expectedKey !== undefined && ready !== expectedKey)) return;
    if (manual) unlockAudio();
    setAutoStatus(null);
    pendingStart.current = true;
    client.start();
  }, [bots, client, mode, unlockAudio]);

  useEffect(() => {
    if (!autoCycle || !startKey) return;
    // A disconnected/unready phone, changed roster, or arena selection resets the lead-in.
    const deadline = performance.now() + ARENA_AUTO_START_MS;
    const watch = window.setInterval(() => {
      const seconds = Math.max(1, Math.ceil((deadline - performance.now()) / 1000));
      setAutoStatus(previous => previous?.cycle === autoCycle && previous.seconds === seconds ? previous : { cycle: autoCycle, seconds });
    }, 250);
    const timer = window.setTimeout(() => begin(false, startKey), ARENA_AUTO_START_MS);
    return () => { window.clearInterval(watch); window.clearTimeout(timer); };
  }, [autoCycle, begin, startKey]);
  const rematch = () => {
    unlockAudio();
    if (mode === "host") {
      const roster = arenaRef.current.players.filter(player => player.bot || room.players.some(current => current.id === player.id && current.connected));
      if (roster.length < 2 || !roster.some(player => !player.bot)) { setNotice("Return to the lobby to reconnect a player or add a bot before the next match."); return; }
      const next = createArena(roster, arenaId); startMatch(next); resetArena(next);
    } else startMatch(arenaRef.current);
    redraw(value => value+1);
  };
  const lobby = () => { client.lobby(); const roster = arenaRef.current.players.map(player => ({ id: player.id, name: player.name, color: player.color, bot: player.bot })); resetArena(createArena(roster, arenaId)); };
  const pickArena = (id: ArenaId) => {
    if (pendingStart.current || arenaRef.current.phase !== "lobby" || roomRef.current.locked) return;
    setArenaId(id);
    resetArena(createArena(arenaRef.current.players, id));
  };
  const roomActions = room.status !== "connected" ? [
    { id: "reconnect", label: "Reconnect host display", run: client.retry },
  ] : arena.phase === "lobby" ? [
    { id: "start", label: "Start match", run: () => begin(), disabled: !startKey },
    { id: "auto-run", label: autoRun ? "Turn Auto-run off" : "Turn Auto-run on", run: toggleAutoRun },
    ...ARENAS.map(({ id, name: label }) => ({ id: `arena-${id}`, label: `Arena: ${label}`, run: () => pickArena(id), disabled: id === arenaId || room.locked })),
    { id: "add-bot", label: "Add a bot", run: () => setBots(value => value + 1), disabled: arena.players.length >= 10 || room.locked },
    { id: "remove-bots", label: "Remove bots", run: () => setBots(0), disabled: bots === 0 || room.locked },
  ] : arena.phase === "matchOver" ? [
    { id: "rematch", label: "Play again", run: rematch },
    { id: "lobby", label: "Return to lobby", run: lobby },
  ] : [];
  const hostActions = [
    ...roomActions,
    { id: "audio", label: muted ? "Unmute display audio" : "Mute display audio", run: toggleAudio },
    { id: "end-room", label: "End room", run: leave, confirm: "End the room for everyone?" },
  ];
  const remotePhase = room.status !== "connected" ? "Host display offline" : arena.phase === "lobby" ? "Starting lobby" : arena.phase === "matchOver" ? "Final scores" : `Round ${arena.round}`;
  const topbar = <header className={styles.topbar}><Link href="/madfun" className={styles.brand}>mad<span>fun</span> / bump club</Link><div className={styles.topActions}>{mode === "host" && room.code && <HostRemote game="Bump Club" phase={remotePhase} actions={hostActions} />}{(mode === "host" || mode === "practice") && <button className={styles.subtle} aria-pressed={muted} aria-label={muted ? "Unmute game audio" : "Mute game audio"} onClick={toggleAudio}>{muted ? "Sound off" : "Sound on"}</button>}<button className={styles.subtle} onClick={fullscreen}>⛶ Fullscreen</button>{mode !== "entry" && <button className={styles.subtle} onClick={() => { if (mode !== "host" || window.confirm("End the room for everyone?")) leave(); }}>{mode === "host" ? "End room" : "Leave"}</button>}</div></header>;
  const alerts = <>{notice && <div className={styles.notice}>{notice}</div>}{room.error && <div role="alert" className={styles.error}>{room.error} {room.status !== "connected" && mode !== "entry" && <button className={styles.subtle} onClick={() => client.retry()}>Retry</button>}</div>}</>;
  if (mode === "entry") return <main className={`${styles.shell} ${invited ? styles.invited : ""}`}>{topbar}<section className={styles.hero}><div className={styles.eyebrow}>ONE SCREEN. MANY GRUDGES.</div><h1>BUMP<span>CLUB.</span></h1><p className={styles.intro}>A slippery platform. Ten tiny troublemakers. Shove rivals over the edge and be the last one standing.</p>{alerts}<QuickStart game="Bump Club" steps={QUICK_START} /><div className={styles.entryGrid}><div className={styles.panel}><h2>Host on the shared screen.</h2><p>This screen runs and shows the game. To play, scan the room QR on a separate phone.</p><div className={styles.form}><button className={styles.primary} onClick={host}>Create room ↗</button><button className={styles.secondary} onClick={practice}>Practice with bots</button></div><p className={styles.help}>2–10 players · 3 arenas · No accounts · Original arcade action</p></div><div className={styles.panel}><h2>Join on your phone.</h2><p>Scan the host’s QR code or enter their six-letter room code.</p><form className={styles.form} onSubmit={event => { event.preventDefault(); if (!name.trim()) return; setMode("phone"); client.join(code, name.trim()); }}><label>YOUR NAME<input required maxLength={64} autoComplete="nickname" placeholder="Pick a name" value={name} onChange={event => setName(event.target.value)} /></label><label>ROOM CODE<input required minLength={6} maxLength={6} autoCapitalize="characters" autoCorrect="off" placeholder="ABCDEF" value={code} onChange={event => setCode(event.target.value.replace(/\s/g, "").toUpperCase())} /></label><button className={styles.primary} type="submit">Join →</button></form></div></div></section></main>;
  if (mode === "phone") {
    const me = arena.players.find(player => player.id === room.playerId);
    const active = arena.phase !== "lobby" && room.locked;
    const connected = room.status === "connected" && room.hostConnected;
    const matchWinner = arena.players.find(player => player.id === arena.winnerId);
    const endOfMatch = arena.phase === "matchOver";
    return <main className={`${styles.shell} ${styles.phone} ${active ? styles.phoneWithArena : ""}`}>{topbar}{alerts}<div className={styles.phoneStatus}><span className={styles.statusBadge}>{connected ? active ? `ROUND ${arena.round} · ${me?.score ?? 0} WINS` : `ROOM ${room.code}` : room.status.toUpperCase()}</span><h1 style={{ color: me?.color }}>{me?.name || name}</h1><p>{!connected ? "Connecting to your host…" : arena.phase === "countdown" ? `Get ready · ${Math.max(1,Math.ceil(arena.phaseTime))}` : arena.phase === "matchOver" ? matchWinner ? `${matchWinner.name} wins!` : "Match finished!" : me && !me.alive && active ? "You’re out this round. Back in the next!" : active ? "Shove up close. Dash into rivals. Watch the edge." : "You’re in. Waiting for the host to start."}</p></div>{active && !endOfMatch && <button className={styles.viewToggle} aria-pressed={showArena} onClick={() => setShowArena(value => !value)}>{showArena ? "Hide arena · controls only" : "Show arena on this phone"}</button>}{active && showArena && !endOfMatch && <div className={styles.phoneArena}><ArenaCanvas state={arena} /></div>}{endOfMatch ? <ol className={styles.phoneResults} aria-label="Final standings">{[...arena.players].sort((a,b) => b.score-a.score).map(player => <li key={player.id}><span>{player.name}</span><b>{player.score} wins</b></li>)}</ol> : active ? <PhoneControls disabled={!connected || arena.phase !== "playing" || !me?.alive} onInput={input} /> : <div className={styles.waiting}><div><div className={styles.waitingSymbol}>⌁</div><h2>IN THE MIX.</h2><p>Move to aim. Shove nearby rivals. Dash for a big hit, but watch your momentum near the edge.</p></div></div>}<div className={styles.phoneFooter}>{me && active ? `SHOVE ${me.shoveCooldown > 0 ? me.shoveCooldown.toFixed(1) + "s" : "READY"} · DASH ${me.dashCooldown > 0 ? me.dashCooldown.toFixed(1) + "s" : "READY"}` : "MOVE TO AIM · SHOVE TO BUMP · DASH FOR IMPACT"}</div></main>;
  }
  if (arena.phase === "lobby") return <main className={styles.shell}>{topbar}<section className={styles.lobby}>{alerts}<QuickStart game="Bump Club" steps={QUICK_START} /><div className={styles.lobbyHead}><div><div className={styles.eyebrow}>HOST DISPLAY · NO PLAYER SLOT</div><h1>Gather your rivals.</h1><p className={styles.help}>Keep this display open. Everyone who wants to play scans the QR on their own phone.</p></div><div className={styles.qrBox}>{qr && <Image src={qr} alt="Scan to join Bump Club" width={140} height={140} unoptimized />}<div><span className={styles.eyebrow}>PLAYER QR · SCAN TO PLAY</span><div className={styles.roomCode}>{room.code || "······"}</div><p>{room.status === "connected" ? "Scan here or enter this code on your phone." : "Waking up the free game server. This can take a moment."}</p>{room.code && <button className={styles.subtle} onClick={() => void copyJoin()}>Copy join link</button>}</div></div></div><div className={styles.playerGrid}>{Array.from({ length: 10 }, (_,index) => { const player = arena.players[index]; return <div key={player?.id || index} className={`${styles.playerCard} ${!player ? styles.emptyCard : ""}`}><span className={styles.avatar} style={{ background: player?.color || "#535267" }}>{player ? "•ᴗ•" : "+"}</span><div><span className={styles.playerName}>{player?.name || "Open spot"}</span><span className={styles.playerLabel}>{player ? player.bot ? "BOT RIVAL" : "PHONE CONNECTED" : "JOIN WITH YOUR PHONE"}</span></div></div>; })}</div><div className={styles.settings}><div><p className={styles.eyebrow}>CHOOSE YOUR ARENA</p><div className={styles.arenaChoices}>{ARENAS.map(item => <button key={item.id} className={`${styles.arenaChoice} ${arenaId === item.id ? styles.selected : ""}`} onClick={() => pickArena(item.id)}>{item.name}</button>)}</div></div><div className={styles.form}><button className={styles.secondary} disabled={arena.players.length >= 10} onClick={() => setBots(value => value+1)}>+ Bot</button>{bots > 0 && <button className={styles.subtle} onClick={() => setBots(0)}>Remove bots</button>}<button className={styles.primary} disabled={!startKey} onClick={() => begin()}>Start match →</button><button className={styles.secondary} aria-pressed={autoRun} onClick={toggleAutoRun}>Auto-run {autoRun ? "on" : "off"}</button>{autoRun && <p className={styles.help}>{autoCycle ? `Auto-start in ${countdown}s if the room stays ready.` : "Auto-run starts 12 seconds after the room is ready and stops at final scores."}</p>}</div></div><p className={styles.help}>Last one on the platform scores. First to 5 wins. Shove up close, dash into rivals, and brake your slide before the edge.</p></section></main>;
  const winner = arena.players.find(player => player.id === arena.winnerId);
  return <main className={`${styles.shell} ${styles.gameShell}`}>{topbar}{alerts}<div className={styles.arenaWrap}><ArenaCanvas state={arena} />{mode === "host" && room.status !== "connected" && <div className={styles.overlay}><div className={styles.overlayCard}><h2>Connection paused</h2><p>The match will continue when the host reconnects.</p><button className={styles.primary} onClick={() => client.retry()}>Reconnect</button></div></div>}{arena.phase === "matchOver" && <div className={styles.overlay}><div className={styles.overlayCard}><span className={styles.eyebrow}>WINNER TAKES THE GLORY</span><h2 style={{ color: winner?.color }}>{winner?.name || "Match complete"}</h2><ol className={styles.leaderboard}>{[...arena.players].sort((a,b) => b.score-a.score).map(player => <li key={player.id}><span>{player.name}</span><b>{player.score} wins · {player.kills} KOs</b></li>)}</ol><div className={styles.overlayButtons}><button className={styles.primary} onClick={rematch}>Play again ↗</button><button className={styles.secondary} onClick={mode === "practice" ? leave : lobby}>Lobby</button></div></div></div>}{mode === "practice" && <><div className={styles.localInstructions}>WASD / arrows move · Space shove · Shift dash</div><div className={styles.practiceControls}><PhoneControls disabled={arena.phase !== "playing"} onInput={practiceInput} /></div></>}</div><div className={styles.scoreStrip}>{arena.players.map(player => <div className={styles.scorePill} key={player.id} style={{ opacity: player.alive ? 1 : .45 }}><span style={{ color: player.color }}>●</span>{player.name}<b>{player.score}/5</b></div>)}</div></main>;
}
