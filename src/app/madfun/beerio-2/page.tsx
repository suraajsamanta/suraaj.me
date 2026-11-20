"use client";

import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState, useSyncExternalStore, type FormEvent } from "react";
import { Beerio2Session, MIN_DRIVERS, MAX_DRIVERS } from "./online";
import RaceScreen, { type RaceBanner } from "./race-screen";
import type { OnlineRaceView } from "./race";
import { TRACKS, getTrack, type TrackId } from "./course";
import styles from "./beerio2.module.css";
import QuickStart from "../shared/QuickStart";
import { FINISHES, readFinish, type CarFinish } from "./finishes";
import { CHARACTERS, DEFAULT_RIDE, RIDES, readRide, saveRide, type RideSelection } from "./ride-selection";
const CarLab = dynamic(() => import("./car-lab"), { ssr: false, loading: () => <main className={styles.shell}><section className={styles.entryStage}>Opening the car lab…</section></main> });

type Screen = "menu" | "solo" | "host" | "join" | "watch" | "lab";
const quickStartSteps = [
  { title: "Pick a circuit and car", body: "Choose Seattle Night or Neon Orbit. Open Car Lab to pick your car and character. Race AI puts you on the grid against three rivals; Time Trial is for chasing your best lap." },
  { title: "Create a race or join friends", body: "Choose Create on shared screen on the TV or laptop. Everyone who wants to drive scans the player QR on a separate device. Start when two drivers are ready. Start the race on the shared screen, or turn on Auto-run for a 10-second lobby timer." },
  { title: "Drive on your own screen", body: "Every driver gets their own chase view. Drag the steering wheel left or right, hold GAS to accelerate, and use BRAKE to slow down. Keep holding BRAKE after stopping to reverse. Hold DRIFT while steering, then release it to get a boost." },
  { title: "Race three laps", body: "First across the finish line wins the race. The screen that created the room shows the race and results without entering as a driver." },
] as const;
const tvQuickStartSteps = [
  { title: "Put this link on the big screen", body: "Open the TV link on a TV browser or on a computer connected to the TV, then select Open TV view." },
  { title: "Join from phones", body: "Drivers use the separate player invite, room code, or QR. The host starts and controls the race on the screen that created it. This screen only watches and does not take a driver slot." },
] as const;
const ROOM_CODE = /^[A-HJ-NP-Z2-9]{6}$/;
const AUTO_START_MS = 10_000;
const END_ROOM_CONFIRMATION = "End this Beerio 2 room for everyone?";
const CONTROL = /[\p{Cc}\p{Cf}]/u;
const cleanCode = (value: string) => value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, "").slice(0, 6);
const readInvite = () => cleanCode(new URLSearchParams(window.location.search).get("room") ?? "");
const readWatchInvite = () => {
  const invite = new URLSearchParams(window.location.hash.slice(1)).get("tv") ?? "";
  return /^[A-Za-z0-9_-]{32}$/.test(invite) ? invite : "";
};
const serverInvite = () => "";
const readLabLink = () => new URLSearchParams(window.location.search).get("car") === "1";
const serverLabLink = () => false;
const listenInvite = (fn: () => void) => {
  window.addEventListener("popstate", fn);
  window.addEventListener("hashchange", fn);
  return () => { window.removeEventListener("popstate", fn); window.removeEventListener("hashchange", fn); };
};
const inviteUrl = (code: string) => new URL(`/madfun/beerio-2?room=${code}`, window.location.origin).toString();
function tvUrl(code: string, token: string) {
  const url = new URL(inviteUrl(code));
  url.hash = new URLSearchParams({ tv: token }).toString();
  return url.toString();
}

function resultTime(time: number | null) {
  if (time === null) return "DNF";
  const whole = Math.max(0, Math.floor(time * 100));
  return `${Math.floor(whole / 6000)}:${String(Math.floor(whole / 100) % 60).padStart(2, "0")}.${String(whole % 100).padStart(2, "0")}`;
}

function LobbyHeader() {
  return <header className={styles.top}>
    <Link className={styles.home} href="/madfun" aria-label="Back to Madfun"><span aria-hidden>‹</span> Madfun</Link>
    <h1>BEERIO<span>02</span></h1>
    <span className={styles.edition}><i aria-hidden /><span>AFTERHOURS RACING</span></span>
  </header>;
}

export default function Beerio2Page() {
  const inviteCode = useSyncExternalStore(listenInvite, readInvite, serverInvite);
  const watchToken = useSyncExternalStore(listenInvite, readWatchInvite, serverInvite);
  const labLink = useSyncExternalStore(listenInvite, readLabLink, serverLabLink);
  const [choice, setChoice] = useState<Screen | null>(null);
  const [name, setName] = useState("");
  const savedFinish = useSyncExternalStore(() => () => {}, readFinish, () => FINISHES[0]);
  const [finishOverride, setFinishOverride] = useState<CarFinish | null>(null);
  const finish = finishOverride ?? savedFinish;
  const savedRide = useSyncExternalStore(() => () => {}, readRide, () => DEFAULT_RIDE);
  const [rideOverride, setRideOverride] = useState<RideSelection | null>(null);
  const ride = rideOverride ?? savedRide;
  const [labReturn, setLabReturn] = useState<"menu" | "join">("menu");
  const vehicleName = RIDES.find(entry => entry.id === ride.vehicle)?.name;
  const characterName = CHARACTERS.find(entry => entry.id === ride.character)?.name;
  const [trackId, setTrackId] = useState<TrackId>("seattle");
  const [soloMode, setSoloMode] = useState<"race" | "time-trial">("race");
  const selectedTrack = getTrack(trackId);
  const [typedCode, setTypedCode] = useState<string | null>(null);
  const [validation, setValidation] = useState("");
  const [shareStatus, setShareStatus] = useState("");
  const [autoRun, setAutoRun] = useState(false);
  const [session] = useState(() => new Beerio2Session());
  const room = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const screen = choice ?? (ROOM_CODE.test(inviteCode) ? watchToken ? "watch" : "join" : labLink ? "lab" : "menu");
  const code = typedCode ?? inviteCode;
  const host = room.role === "host";
  const additionalScreen = room.role === "spectator";
  const spectator = host || additionalScreen;
  const seatId = room.playerId;
  const inRoom = !!room.code && (host || !!seatId);
  const connecting = room.status === "connecting" || room.status === "reconnecting" || room.loading;
  const readyToStart = host && inRoom && room.status === "connected" && room.hostConnected && !room.loading &&
    room.phase === "lobby" && room.players.filter(p => p.connected && p.ready).length >= MIN_DRIVERS;
  const onlineView = useMemo<OnlineRaceView | undefined>(() => inRoom ? {
    get id() {
      if (!spectator) return seatId ?? "";
      const drivers = session.getFrame()?.players ?? [];
      return drivers.find(driver => driver.connected)?.id ?? drivers[0]?.id ?? "";
    },
    getFrame: session.getFrame,
    getRenderFrame: session.getRenderFrame,
    getNetworkStats: spectator ? undefined : session.getNetworkStats,
    setInput: spectator ? () => {} : session.setInput,
  } : undefined, [inRoom, seatId, session, spectator]);

  useEffect(() => {
    const whenHidden = () => { if (document.hidden) session.setPaused(true); };
    const pagehide = (event: PageTransitionEvent) => { if (!event.persisted) session.flushAnalytics(); };
    document.addEventListener("visibilitychange", whenHidden);
    window.addEventListener("pagehide", pagehide);
    return () => { document.removeEventListener("visibilitychange", whenHidden); window.removeEventListener("pagehide", pagehide); session.leave(); };
  }, [session]);

  useEffect(() => {
    if (!autoRun || !readyToStart) return;
    let timer: number | undefined;
    const arm = () => {
      window.clearTimeout(timer);
      if (document.hidden) return;
      timer = window.setTimeout(() => {
        const liveRoom = session.getSnapshot();
        if (!document.hidden && liveRoom.code === room.code && liveRoom.role === "host" && liveRoom.phase === "lobby" && liveRoom.status === "connected" &&
          liveRoom.hostConnected && !liveRoom.loading && liveRoom.players.filter(p => p.connected && p.ready).length >= MIN_DRIVERS) session.start();
      }, AUTO_START_MS);
    };
    arm();
    document.addEventListener("visibilitychange", arm);
    return () => { window.clearTimeout(timer); document.removeEventListener("visibilitychange", arm); };
  }, [autoRun, readyToStart, room.code, session]);

  function choose(next: Screen) {
    setValidation("");
    setShareStatus("");
    setChoice(next);
    if (next === "lab" || labLink) {
      const url = new URL(window.location.href);
      if (next === "lab") url.searchParams.set("car", "1");
      else url.searchParams.delete("car");
      window.history.replaceState(window.history.state, "", url);
    }
    if (next !== "menu" && next !== "lab") void import("./race").catch(() => {});
  }

  function leave() {
    if (host && inRoom && !window.confirm(END_ROOM_CONFIRMATION)) return;
    setAutoRun(false);
    session.leave();
    if (additionalScreen || screen === "watch") window.history.replaceState(window.history.state, "", "/madfun/beerio-2");
    choose("menu");
  }

  function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (connecting) return;
    if (screen === "host") {
      setValidation("");
      setShareStatus("");
      setAutoRun(false);
      session.create(trackId);
      return;
    }
    const driver = name.trim();
    if (!driver || Array.from(driver).length > 24 || CONTROL.test(driver)) {
      setValidation("Enter a driver name of 1–24 characters.");
      return;
    }
    if (screen === "join" && !ROOM_CODE.test(code)) {
      setValidation("Enter the six-character code from your host.");
      return;
    }
    setValidation("");
    setShareStatus("");
    void import("./race").catch(() => {});
    session.join(code, driver, ride);
  }

  async function share(useShareSheet: boolean, tv = false) {
    if (!room.code || (tv && (!host || !room.watchInvite))) return;
    const code = room.code;
    const url = tv && room.watchInvite ? tvUrl(code, room.watchInvite) : inviteUrl(code);
    if (useShareSheet && navigator.share) {
      try {
        await navigator.share({ title: tv ? "Beerio 2 · TV view" : `Beerio 2 · ${getTrack(room.trackId).name}`, text: tv ? "Open on a TV browser or a computer connected to your TV. The screen that created the room controls the race." : `Join my ${getTrack(room.trackId).name} race`, url });
        return;
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
      }
    }
    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable.");
      await navigator.clipboard.writeText(url);
      setShareStatus(tv ? "TV link copied. Open it on your display." : "Driver invite copied.");
    } catch {
      setShareStatus(tv ? "Select the TV link below to copy it." : `Share this room code: ${code}`);
    }
  }

  if (screen === "lab") return <CarLab ride={ride} onRide={next => { saveRide(next); setRideOverride(next); }} finish={finish} onFinish={next => {
    setFinishOverride(next);
    try { localStorage.setItem("beerio2-car-finish", next.id); } catch {}
  }} exit={() => choose(labReturn)} roomSetup={labReturn !== "menu"} race={() => {
    if (labReturn !== "menu") choose(labReturn);
    else { setSoloMode("race"); choose("solo"); }
  }} />;
  if (screen === "solo") return <RaceScreen trackId={trackId} mode={soloMode} ride={ride} paint={finish.hex} exit={() => choose("menu")} />;

  if (inRoom && onlineView) {
    const roomTrack = getTrack(room.trackId);
    const lobby = room.phase === "lobby";
    const results = room.phase === "results";
    const countdown = room.phase === "countdown";
    const hostAvailable = room.hostConnected && room.status === "connected";
    const raceFrame = session.getFrame();
    const racers = room.players.filter((player) => player.connected);
    const placeItems = raceFrame?.results ?? [];
    const closed = room.status === "closed" || room.status === "error";
    const canPause = host && hostAvailable && (room.phase === "race" || countdown);
    let banner: RaceBanner | undefined;
    if (closed) {
      banner = { label: "ROOM UNAVAILABLE", title: "Connection ended", detail: room.error ?? "Leave the room and rejoin with a fresh code." };
    } else if (!lobby && !results && (!hostAvailable || room.phase === "paused")) {
      banner = { label: "RACE PAUSED", title: hostAvailable ? "Waiting for host" : "Reconnecting", detail: spectator ? "The display will catch up automatically." : "Keep this screen open. Your seat is reserved briefly." };
    } else if (countdown) {
      banner = { label: `${roomTrack.name.toUpperCase()} · GET READY`, title: String(Math.max(1, Math.ceil(room.countdown))), countdown: true };
    }

    const lobbyPanel = lobby && !closed && <section className={styles.roomPanel} aria-label="Race lobby" data-mobile-host={host ? "true" : undefined}>
      <div className={styles.kicker}><i aria-hidden /> {host ? "SHARED SCREEN · HOST ONLY" : additionalScreen ? "EXTRA DISPLAY · WATCH ONLY" : "PRIVATE GRID"}</div>
      <div className={styles.roomTop}>
        <div><h2>{additionalScreen ? "Ready to watch" : "Starting grid"}</h2><p>{roomTrack.name} · Three laps · {racers.length}/{MAX_DRIVERS} drivers</p></div>
        <div className={styles.codeDisplay}><small>ROOM CODE</small><b>{room.code}</b></div>
      </div>
      <div className={styles.lobbyActionBar}>
        {host && <button className={styles.primaryAction} type="button" disabled={!readyToStart} onClick={() => void session.start()}>
          {room.loading ? "Preparing the race…" : racers.length < MIN_DRIVERS ? "Waiting for two drivers" : "Start race"}
        </button>}
        {host && <div className={styles.autoRun}>
          <button className={styles.secondaryAction} type="button" aria-pressed={autoRun} disabled={!hostAvailable} onClick={() => setAutoRun(!autoRun)}>{autoRun ? "Auto-run on" : "Auto-run off"}</button>
          <p role="status">{autoRun ? readyToStart ? "Race starts automatically after 10 seconds with two or more ready drivers." : "Waiting for at least two ready drivers to start the 10-second timer." : "Optional: start automatically after two drivers are ready for 10 seconds."}</p>
        </div>}
        {!additionalScreen && <div className={styles.shareRow}>
          <button className={styles.secondaryAction} type="button" onClick={() => void share(true)}>Invite players</button>
          <button className={styles.secondaryAction} type="button" onClick={() => void share(false)}>Copy driver link</button>
        </div>}
      </div>
      {room.code && <div className={styles.lobbyExtras}><RoomQr code={room.code} autoOpen={spectator} /></div>}
      {host && room.code && room.watchInvite && <details className={styles.lobbyExtras}>
        <summary>{room.spectatorConnected ? "Extra display · Connected" : "Optional extra display"}</summary>
        <p>Mirror the race to an additional display. This screen still starts and runs the race.</p>
        <button className={styles.secondaryAction} type="button" onClick={() => void share(true, true)}>Share TV link</button>
        <label>TV link<input readOnly value={tvUrl(room.code, room.watchInvite)} onFocus={event => event.currentTarget.select()} aria-label="Private TV link" /></label>
      </details>}
      <p className={styles.statusLine} role="status">{shareStatus}</p>
      <div className={styles.rosterTitle}><b>DRIVERS</b><span>{racers.length} / {MAX_DRIVERS}</span></div>
      <ol className={styles.roster}>
        {room.players.map((player) => <li key={player.id}>
          <i className={styles.driverDot} style={{ backgroundColor: player.color }} aria-hidden />
          <span>{player.name}</span><small>{player.id === room.playerId ? "YOU" : !player.connected ? "OFFLINE" : "IN GRID"}</small>
        </li>)}
      </ol>
      {room.error && <p className={styles.formError} role="alert">{room.error}</p>}
      {!host && <p className={styles.lobbyWait} role="status">{hostAvailable ? "Waiting for the host to start" : "Waiting for the host to reconnect"}</p>}
    </section>;
    const resultsPanel = results && !closed && <section className={styles.roomPanel} aria-label="Race results" data-mobile-host={host ? "true" : undefined}>
      <div className={styles.kicker}><i aria-hidden /> {roomTrack.name.toUpperCase()} · FINAL</div>
      <h2>Race results</h2>
      {host && hostAvailable && <div className={styles.lobbyActionBar}><button className={styles.primaryAction} type="button" onClick={() => session.rematch()}>Back to starting grid</button></div>}
      <ol className={styles.roster}>
        {placeItems.map((item, index) => <li key={item.id}>
          <strong>{String(index + 1).padStart(2, "0")}</strong><span>{item.name}{item.id === room.playerId ? " (you)" : ""}</span><small>{resultTime(item.time)}</small>
        </li>)}
      </ol>
      {!host && <p className={styles.lobbyWait}>Waiting for the host to set up a rematch</p>}
    </section>;

    const resumePanel = host && hostAvailable && room.phase === "paused" && <section className={styles.roomPanel} aria-label="Race paused">
      <div className={styles.kicker}><i aria-hidden /> {roomTrack.name.toUpperCase()}</div>
      <h2>Race paused</h2>
      <p>Everyone can keep driving once you resume.</p>
      <button className={styles.primaryAction} type="button" onClick={() => session.setPaused(false)}>Resume race</button>
    </section>;

    return <RaceScreen
      trackId={room.trackId}
      onlineView={onlineView}
      banner={banner}
      exit={() => leave()}
      spectator={spectator}
      host={host}
      racing={!spectator && hostAvailable && !lobby && !results && room.phase !== "paused"}
      pause={canPause ? () => session.setPaused(true) : undefined}
      laps={3}
      panel={lobbyPanel || resultsPanel || resumePanel}
    />;
  }

  if (screen === "watch") return <main className={`${styles.shell} ${styles.menuShell} ${styles.tvShell}`}>
    <LobbyHeader />
    <section className={styles.entryStage} aria-label="Set up TV view">
      <div className={styles.entryCard}>
        <span className={styles.kicker}>BEERIO 2 · OPTIONAL TV VIEW</span>
        <h2>Put the race on TV.</h2>
        <QuickStart game="Beerio 2 TV view" steps={tvQuickStartSteps} />
        <p>This is a watch-only screen. The screen that created the room still runs the race.</p>
        {room.error && <p className={styles.formError} role="alert">{room.error}</p>}
        <button type="button" className={styles.primaryAction} disabled={connecting || !watchToken || !ROOM_CODE.test(inviteCode)} onClick={() => session.watch(inviteCode, watchToken)}>{connecting ? "Connecting…" : "Open TV view"}</button>
        <button type="button" className={styles.backAction} onClick={() => leave()}>‹ Back to Beerio 2</button>
      </div>
    </section>
  </main>;

  return <main className={`${styles.shell} ${styles.menuShell}`} data-track={trackId}>
    <LobbyHeader />
    <section className={styles.entryStage} aria-label="Beerio 2 start screen">
      <div className={styles.entryWrap}>
        <div className={styles.quickStart}><QuickStart game="Beerio 2" steps={quickStartSteps} /></div>
        <div className={styles.hero}>
          <div className={styles.heroEyebrow}><span className={styles.kicker}><i aria-hidden /> THE CITY IS YOUR CIRCUIT</span><span>VOL. 02</span></div>
          <div className={styles.heroHeadline}><p className={styles.trackIndex}>{trackId === "seattle" ? "01 / PACIFIC NORTHWEST" : "02 / BEYOND THE CITY"}</p>
            <h2>{trackId === "seattle" ? <>SEATTLE<br /><em>NIGHT.</em></> : <>NEON<br /><em>ORBIT.</em></>}</h2>
          </div>
          <CircuitArt trackId={trackId} />
          <div className={styles.heroCaption}><span>{trackId === "seattle" ? "WET ASPHALT. CITY LIGHTS. FULL SEND." : "ELEVATED RIBBONS. ELECTRIC HORIZONS."}</span><span aria-hidden>↗</span></div>
        </div>
        {screen === "menu" ? <section className={styles.entryCard} aria-label="Choose race mode">
          <div className={styles.cardEyebrow}><span className={styles.kicker}>YOUR NEXT GREEN LIGHT</span><span className={styles.livePill}>READY</span></div>
          <h2>Make it a race.</h2>
          <p>Chase the pack. Beat the clock.<br />Or settle it with your friends.</p>
          <button className={`${styles.primaryAction} ${styles.raceAiAction}`} type="button" onClick={() => { setSoloMode("race"); choose("solo"); }}><span><b>Race AI</b><small>Jump in. Take on the grid.</small></span><span className={styles.actionArrow} aria-hidden>↗</span></button>
          <button className={styles.secondaryAction} type="button" onClick={() => { setSoloMode("time-trial"); choose("solo"); }}><span><b>Time trial</b><small>Just you and your best lap.</small></span><span className={styles.actionArrow} aria-hidden>→</span></button>
          <button className={styles.secondaryAction} type="button" onClick={() => { setLabReturn("menu"); choose("lab"); }}><span><b>Car Lab</b><small>Pick your car, driver and paint</small></span><span className={styles.actionArrow} aria-hidden>↗</span></button>
          <div className={styles.modeDivider}><span>BETTER WITH RIVALS</span></div>
          <div className={styles.onlineChoices}>
            <button className={styles.secondaryAction} type="button" onClick={() => choose("host")}><span><b>Create on shared screen</b><small>Show the race and a player QR</small></span><span aria-hidden>＋</span></button>
            <button className={styles.secondaryAction} type="button" onClick={() => choose("join")}><span><b>Join a room</b><small>Drive on this phone</small></span><span aria-hidden>→</span></button>
          </div>
          <div className={styles.cardFoot}><span aria-hidden>◉</span> Up to 10 drivers · Host display is not a driver</div>
        </section> : <form className={styles.entryCard} onSubmit={connect}>
          <button className={styles.backAction} type="button" onClick={() => { session.leave(); choose("menu"); }}>‹ All modes</button>
          <div className={styles.kicker}>{screen === "host" ? "BUILD YOUR STARTING GRID" : "YOUR SEAT IS WAITING"}</div>
          <h2>{screen === "host" ? "Set up the shared screen." : "Join the grid."}</h2>
          <p>{screen === "host" ? "Create the room here, then show the QR. Everyone who drives joins on a separate device, including you." : "Same race. Your own screen. Enter the code from your host."}</p>
          {screen === "host" ? <div className={styles.formCircuit}><TrackMap trackId={trackId} /><div><small>YOUR CIRCUIT</small><strong>{selectedTrack.name}</strong><span>Choose a circuit below before creating.</span></div></div> : <div className={styles.joinNote}>Your host’s circuit loads automatically.</div>}
          {screen === "join" && <><button className={styles.secondaryAction} type="button" disabled={connecting} onClick={() => { setLabReturn("join"); choose("lab"); }}>
            <span><b>Edit car &amp; driver</b><small>{vehicleName} · {characterName}</small></span><span aria-hidden>↗</span>
          </button>
          <label>DRIVER NAME<input value={name} onChange={(event) => setName(event.target.value)} name="driver-name" autoComplete="nickname" placeholder="What should we call you?" required maxLength={48} disabled={connecting} /></label>
          <label>ROOM CODE<input className={styles.codeInput} value={code} onChange={(event) => setTypedCode(cleanCode(event.target.value))} name="room-code" autoCapitalize="characters" autoComplete="off" autoCorrect="off" spellCheck={false} placeholder="ABC234" required minLength={6} maxLength={6} disabled={connecting} /></label></>}
          {(validation || room.error) && <p className={styles.formError} role="alert">{validation || room.error}</p>}
          {connecting && <p className={styles.statusLine} role="status">Connecting to the race relay…</p>}
          <button className={styles.primaryAction} type="submit" disabled={connecting}>{connecting ? "Connecting…" : screen === "host" ? "Create room" : "Join race"}<span aria-hidden>↗</span></button>
          <div className={styles.cardFoot}>No account. No download. Just race.</div>
        </form>}
        <section className={styles.circuitSelector} aria-label="Select circuit">
          <div className={styles.sectionLabel}><span>CHOOSE YOUR CIRCUIT</span><span>{screen === "join" ? "SOLO & HOST MODES" : "02 DESTINATIONS"}</span></div>
          <div className={styles.circuitChoices}>{TRACKS.map((track, index) => <button key={track.id} type="button" className={styles.circuitChoice} aria-pressed={trackId === track.id} disabled={connecting} onClick={() => setTrackId(track.id)} data-circuit={track.id}>
            <TrackMap trackId={track.id} />
            <span className={styles.circuitCopy}><small>CIRCUIT 0{index + 1}</small><strong>{track.name}</strong><span>{track.id === "seattle" ? "City streets · Sweeping corners" : "Skyway · High-speed elevation"}</span></span>
            <span className={styles.circuitSelected} aria-hidden>{trackId === track.id ? "✓" : "↗"}</span>
          </button>)}</div>
        </section>
      </div>
    </section>
    <footer className={styles.bottom}><span className={styles.mode}>MADFUN MOTORSPORT <span> / </span> BEERIO 02</span><span className={styles.help}>BUILT FOR THE AFTERHOURS</span></footer>
  </main>;
}

function trackGeometry(trackId: TrackId) {
  const points = getTrack(trackId).points;
  const xs = points.map((point) => point.x), zs = points.map((point) => point.z);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const scale = 170 / Math.max(maxX - minX, maxZ - minZ);
  const projected = points.map((point) => ({ x: (point.x - (minX + maxX) / 2) * scale, y: (point.z - (minZ + maxZ) / 2) * scale }));
  const path = projected.map((point, i) => `${i ? "L" : "M"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ") + "Z";
  const first = projected[0], before = projected[projected.length - 1], after = projected[1];
  const dx = after.x - before.x, dy = after.y - before.y, length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length * 9, ny = dx / length * 9;
  return { path, gate: `M${first.x - nx},${first.y - ny}L${first.x + nx},${first.y + ny}` };
}
function trackPath(trackId: TrackId) { return trackGeometry(trackId).path; }

function TrackMap({ trackId }: { trackId: TrackId }) {
  const geometry = trackGeometry(trackId);
  return <svg className={styles.trackMap} viewBox="-104 -104 208 208" aria-hidden="true"><path d={geometry.path} fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" /><path d={geometry.gate} stroke="#f1f5ff" strokeWidth="4" /></svg>;
}

function CircuitArt({ trackId }: { trackId: TrackId }) {
  const orbit = trackId === "orbit";
  return <svg className={styles.circuitArt} viewBox="0 0 660 390" aria-hidden="true">
    <defs><linearGradient id="b2-road" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#314451" /><stop offset="1" stopColor="#0d1824" /></linearGradient><linearGradient id="b2-car" x1="0" y1="0" x2="0.6" y2="1"><stop stopColor="#e4ff8a" /><stop offset="1" stopColor="#709b38" /></linearGradient><radialGradient id="b2-halo"><stop stopColor={orbit ? "#af61ff" : "#57e2ce"} stopOpacity=".25" /><stop offset="1" stopColor="#121a24" stopOpacity="0" /></radialGradient></defs>
    <ellipse cx="360" cy="230" rx="320" ry="160" fill="url(#b2-halo)" />
    {[0, 1, 2, 3, 4, 5, 6].map((line) => <path key={line} d={`M${60 + line * 78} 100L${-50 + line * 110} 390M0 ${160 + line * 37}H660`} stroke="#8bb6d4" strokeOpacity=".055" />)}
    {orbit ? <g fill="none" stroke="#be84ff"><ellipse cx="444" cy="132" rx="128" ry="45" transform="rotate(-28 444 132)" strokeWidth="1" opacity=".6" /><ellipse cx="444" cy="132" rx="106" ry="31" transform="rotate(-28 444 132)" strokeWidth="9" opacity=".12" /><circle cx="491" cy="103" r="39" fill="#392247" strokeWidth="1" /><path d="M230 176L260 19M574 251L603 109" opacity=".35" /></g> : <g opacity=".7">{[ [266,149,25,69], [303,122,32,88], [465,105,28,90], [506,152,36,62], [550,130,25,79] ].map(([x,y,w,h],i)=><g key={i}><path d={`M${x} ${y}l${w} -10v${h}l-${w} 10Z`} fill="#182c36" /><path d={`M${x+w} ${y-10}l14 8v${h}l-14 -8Z`} fill="#0e1b26" />{[0,1,2,3].map(n=><path key={n} d={`M${x+5} ${y+12+n*12}l${w-10} -6`} stroke="#65a9ab" strokeWidth="2" opacity=".7" />)}</g>)}<path d="M407 198L419 52L432 198M402 198L419 66L437 198" fill="none" stroke="#5b7a85" strokeWidth="4" /><path d="M390 65Q419 47 448 65L440 73H398Z" fill="#7b99a3" /><path d="M419 49V28" stroke="#8ab0b6" strokeWidth="2" /><path d="M393 66H445" stroke="#d0e98e" strokeWidth="2" /></g>}
    <g transform="translate(360 249) rotate(-15) scale(2.65 1.05)"><path d={trackPath(trackId)} fill="none" stroke="#040b14" strokeWidth="21" transform="translate(0 9)" /><path d={trackPath(trackId)} fill="none" stroke={orbit ? "#bd7dff" : "#8cbeb6"} strokeWidth="20" opacity=".7" /><path d={trackPath(trackId)} fill="none" stroke="url(#b2-road)" strokeWidth="17" /><path d={trackPath(trackId)} fill="none" stroke="#c2e0d0" strokeWidth=".6" strokeDasharray="4 6" opacity=".55" /></g>
    <g transform="translate(372 303) rotate(-15)"><ellipse cx="0" cy="12" rx="72" ry="19" fill="#030913" opacity=".7" /><path d="M-66 8L-65 -4L-40 -12L15 -12L59 -1L66 10L38 23L-45 23Z" fill="#17212b" /><path d="M-66 3L-49 -15L-12 -20L36 -12L61 1L43 16L-42 16Z" fill="url(#b2-car)" /><path d="M-27 -17L-13 -29L15 -29L35 -12L19 -5L-20 -6Z" fill="#97be66" /><path d="M-13 -26H12L27 -13L-19 -11Z" fill="#132c35" /><path d="M-64 3L-44 6M43 6L61 1" stroke="#e8ffdf" strokeWidth="4" /><path d="M-46 -12L-66 -14M-66 -14V-6" stroke="#d6f596" strokeWidth="4" /><path d="M-30 15L29 15" stroke="#c9e982" strokeWidth="3" /><path d="M-60 17L-49 20M41 18L52 14" stroke="#0a101a" strokeWidth="8" /></g>
    <path d="M199 331L294 306M161 347L280 316M452 280L551 252" stroke={orbit ? "#c38cff" : "#d0f89a"} strokeOpacity=".4" strokeWidth="2" />
  </svg>;
}

function RoomQr({ code, autoOpen = false }: { code: string; autoOpen?: boolean }) {
  const [open, setOpen] = useState(autoOpen);
  const [qr, setQr] = useState<{ code: string; src: string } | null>(null);
  useEffect(() => {
    if (!open) return;
    let active = true;
    void import("qrcode").then((module) => module.toDataURL(inviteUrl(code), { width: 232, margin: 3 }))
      .then((src) => { if (active) setQr({ code, src }); }).catch(() => {});
    return () => { active = false; };
  }, [code, open]);
  return <details className={styles.roomQr} open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary>Player QR · Scan to drive</summary>
    {qr?.code === code ? <Image src={qr.src} width={176} height={176} alt="Scan this Beerio 2 invite with your phone camera" unoptimized /> : <p>Preparing QR code…</p>}
  </details>;
}
