"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState, useSyncExternalStore, type FormEvent } from "react";
import { Beerio2Session } from "./online";
import RaceScreen, { type RaceBanner } from "./race-screen";
import type { OnlineRaceView } from "./race";
import styles from "./beerio2.module.css";

type Screen = "menu" | "solo" | "host" | "join";
const ROOM_CODE = /^[A-HJ-NP-Z2-9]{6}$/;
const CONTROL = /[\p{Cc}\p{Cf}]/u;
const cleanCode = (value: string) => value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, "").slice(0, 6);
const readInvite = () => cleanCode(new URLSearchParams(window.location.search).get("room") ?? "");
const serverInvite = () => "";
const listenInvite = (fn: () => void) => { window.addEventListener("popstate", fn); return () => window.removeEventListener("popstate", fn); };
const inviteUrl = (code: string) => new URL(`/madfun/beerio-2?room=${code}`, window.location.origin).toString();

function resultTime(time: number | null) {
  if (time === null) return "DNF";
  const whole = Math.max(0, Math.floor(time * 100));
  return `${Math.floor(whole / 6000)}:${String(Math.floor(whole / 100) % 60).padStart(2, "0")}.${String(whole % 100).padStart(2, "0")}`;
}

function LobbyHeader() {
  return <header className={styles.top}>
    <Link className={styles.home} href="/madfun" aria-label="Back to Madfun"><span aria-hidden>‹</span> Madfun</Link>
    <h1>BEERIO<span>02</span></h1>
    <span className={styles.edition}><i aria-hidden /><span>SEATTLE NIGHT</span></span>
  </header>;
}

export default function Beerio2Page() {
  const inviteCode = useSyncExternalStore(listenInvite, readInvite, serverInvite);
  const [choice, setChoice] = useState<Screen | null>(null);
  const [name, setName] = useState("");
  const [typedCode, setTypedCode] = useState<string | null>(null);
  const [validation, setValidation] = useState("");
  const [shareStatus, setShareStatus] = useState("");
  const [session] = useState(() => new Beerio2Session());
  const room = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const screen = choice ?? (ROOM_CODE.test(inviteCode) ? "join" : "menu");
  const code = typedCode ?? inviteCode;
  const inRoom = !!room.playerId && !!room.code;
  const seatId = inRoom ? room.playerId : null;
  const host = room.role === "host";
  const connecting = room.status === "connecting" || room.status === "reconnecting" || room.loading;
  const onlineView = useMemo<OnlineRaceView | undefined>(() => seatId ? {
    id: seatId,
    getFrame: () => session.getFrame(),
    setInput: (input) => session.setInput(input),
  } : undefined, [seatId, session]);

  useEffect(() => {
    const whenHidden = () => { if (document.hidden) session.setPaused(true); };
    document.addEventListener("visibilitychange", whenHidden);
    return () => { document.removeEventListener("visibilitychange", whenHidden); session.leave(); };
  }, [session]);

  function choose(next: Screen) {
    setValidation("");
    setShareStatus("");
    setChoice(next);
    if (next !== "menu") void import("./race").catch(() => {});
  }

  function leave() {
    if (host && inRoom && !window.confirm("End this Beerio 2 room for everyone?")) return;
    session.leave();
    choose("menu");
  }

  function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (connecting) return;
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
    if (screen === "host") void session.create(driver);
    else session.join(code, driver);
  }

  async function share(useShareSheet: boolean) {
    if (!room.code) return;
    const url = inviteUrl(room.code);
    if (useShareSheet && navigator.share) {
      try {
        await navigator.share({ title: "Beerio 2 · Seattle Night", text: "Join my Seattle Night race", url });
        return;
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
      }
    }
    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable.");
      await navigator.clipboard.writeText(url);
      setShareStatus("Invite link copied.");
    } catch {
      setShareStatus(`Share this room code: ${room.code}`);
    }
  }

  if (screen === "solo") return <RaceScreen exit={() => choose("menu")} />;

  if (inRoom && onlineView) {
    const lobby = room.phase === "lobby";
    const results = room.phase === "results";
    const countdown = room.phase === "countdown";
    const hostAvailable = room.hostConnected && room.status === "connected";
    const raceFrame = session.getFrame();
    const racers = room.players.filter((player) => player.connected);
    const placeItems = raceFrame?.results ?? [];
    let banner: RaceBanner | undefined;
    if (!lobby && !results && (room.status === "closed" || room.status === "error")) {
      banner = { label: "ROOM UNAVAILABLE", title: "Connection ended", detail: room.error ?? "Leave the room and rejoin with a fresh code." };
    } else if (!lobby && !results && (!hostAvailable || room.phase === "paused")) {
      banner = { label: "RACE PAUSED", title: "Reconnecting", detail: "Keep this screen open. Your seat is reserved briefly." };
    } else if (countdown) {
      banner = { label: "SEATTLE NIGHT · GET READY", title: String(Math.max(1, Math.ceil(room.countdown))), countdown: true };
    }

    const lobbyPanel = lobby && <section className={styles.roomPanel} aria-label="Race lobby">
      <div className={styles.kicker}><i aria-hidden /> PRIVATE GRID</div>
      <div className={styles.roomTop}>
        <div><h2>Starting grid</h2><p>Seattle Night · Three laps</p></div>
        <div className={styles.codeDisplay}><small>ROOM CODE</small><b>{room.code}</b></div>
      </div>
      <div className={styles.shareRow}>
        <button className={styles.secondaryAction} type="button" onClick={() => void share(true)}>Share invite</button>
        <button className={styles.secondaryAction} type="button" onClick={() => void share(false)}>Copy link</button>
        <p className={styles.statusLine} role="status">{shareStatus}</p>
      </div>
      {room.code && <RoomQr code={room.code} />}
      <div className={styles.rosterTitle}><b>DRIVERS</b><span>{racers.length} / 10</span></div>
      <ol className={styles.roster}>
        {room.players.map((player) => <li key={player.id}>
          <i className={styles.driverDot} style={{ backgroundColor: player.color }} aria-hidden />
          <span>{player.name}</span><small>{player.id === room.playerId ? "YOU" : player.id === "host" ? "HOST" : !player.connected ? "OFFLINE" : "IN GRID"}</small>
        </li>)}
      </ol>
      {room.error && <p className={styles.formError} role="alert">{room.error}</p>}
      {host ? <button className={styles.primaryAction} type="button" disabled={racers.length < 2 || !hostAvailable || room.loading} onClick={() => void session.start()}>
        {room.loading ? "Preparing the race" : racers.length < 2 ? "Waiting for another driver" : "Start race"}
      </button> : <p className={styles.lobbyWait} role="status">{hostAvailable ? "Waiting for the host to start" : "Waiting for the host to reconnect"}</p>}
    </section>;

    const resultsPanel = results && <section className={styles.roomPanel} aria-label="Race results">
      <div className={styles.kicker}><i aria-hidden /> SEATTLE NIGHT · FINAL</div>
      <h2>Race results</h2>
      <ol className={styles.roster}>
        {placeItems.map((item, index) => <li key={item.id}>
          <strong>{String(index + 1).padStart(2, "0")}</strong><span>{item.name}{item.id === room.playerId ? " (you)" : ""}</span><small>{resultTime(item.time)}</small>
        </li>)}
      </ol>
      {host && hostAvailable ? <button className={styles.primaryAction} type="button" onClick={() => session.rematch()}>Back to starting grid</button> : <p className={styles.lobbyWait}>Waiting for the host to set up a rematch</p>}
    </section>;

    const resumePanel = host && hostAvailable && room.phase === "paused" && <section className={styles.roomPanel} aria-label="Race paused">
      <div className={styles.kicker}><i aria-hidden /> SEATTLE NIGHT</div>
      <h2>Race paused</h2>
      <p>Everyone can keep driving once you resume.</p>
      <button className={styles.primaryAction} type="button" onClick={() => session.setPaused(false)}>Resume race</button>
    </section>;

    return <RaceScreen
      onlineView={onlineView}
      banner={banner}
      exit={leave}
      racing={hostAvailable && !lobby && !results && room.phase !== "paused"}
      laps={3}
      panel={lobbyPanel || resultsPanel || resumePanel}
    />;
  }

  return <main className={styles.shell}>
    <LobbyHeader />
    <section className={styles.entryStage} aria-label="Beerio 2 start screen">
      <div className={styles.entryWrap}>
        <div className={styles.hero}>
          <div className={styles.kicker}><i aria-hidden /> MADFUN MOTORSPORT</div>
          <p className={styles.trackIndex}>CIRCUIT 01 / WASHINGTON</p>
          <h2>SEATTLE<br /><em>NIGHT</em></h2>
          <p className={styles.heroText}>Wet streets, neon corners, and your own cockpit. Drift through the city after dark.</p>
          <div className={styles.heroTags}><span>10 DRIVER GRID</span><span>SOLO TIME TRIAL</span></div>
        </div>
        {screen === "menu" ? <section className={styles.entryCard} aria-label="Choose race mode">
          <div className={styles.kicker}>THE STARTING LINE</div>
          <h2>Find your race</h2>
          <p>Everyone drives on their own screen.</p>
          <button className={styles.primaryAction} type="button" onClick={() => choose("host")}>Host &amp; drive <span aria-hidden>↗</span></button>
          <button className={styles.secondaryAction} type="button" onClick={() => choose("join")}>Join a room <span aria-hidden>→</span></button>
          <button className={styles.tertiaryAction} type="button" onClick={() => choose("solo")}>Solo time trial <span aria-hidden>›</span></button>
        </section> : <form className={styles.entryCard} onSubmit={connect}>
          <button className={styles.backAction} type="button" onClick={() => { session.leave(); choose("menu"); }}>‹ All modes</button>
          <h2>{screen === "host" ? "Host & drive" : "Join a room"}</h2>
          <p>{screen === "host" ? "Create a private room, then invite friends to race." : "Enter a driver name and the code from your host."}</p>
          <label>Driver name<input value={name} onChange={(event) => setName(event.target.value)} name="driver-name" autoComplete="nickname" placeholder="Your name" required maxLength={48} disabled={connecting} /></label>
          {screen === "join" && <label>Room code<input className={styles.codeInput} value={code} onChange={(event) => setTypedCode(cleanCode(event.target.value))} name="room-code" autoCapitalize="characters" autoComplete="off" autoCorrect="off" spellCheck={false} placeholder="ABC234" required minLength={6} maxLength={6} disabled={connecting} /></label>}
          {(validation || room.error) && <p className={styles.formError} role="alert">{validation || room.error}</p>}
          {connecting && <p className={styles.statusLine} role="status">Connecting to the race relay…</p>}
          <button className={styles.primaryAction} type="submit" disabled={connecting}>{connecting ? "Connecting…" : screen === "host" ? "Create room" : "Join race"}</button>
        </form>}
      </div>
    </section>
    <footer className={styles.bottom}><span className={styles.mode}>BEERIO 02 <span>·</span> SEATTLE NIGHT</span><span className={styles.help}>NO ACCOUNT REQUIRED</span></footer>
  </main>;
}

function RoomQr({ code }: { code: string }) {
  const [open, setOpen] = useState(false);
  const [qr, setQr] = useState<{ code: string; src: string } | null>(null);
  useEffect(() => {
    if (!open) return;
    let active = true;
    void import("qrcode").then((module) => module.toDataURL(inviteUrl(code), { width: 128, margin: 2 }))
      .then((src) => { if (active) setQr({ code, src }); }).catch(() => {});
    return () => { active = false; };
  }, [code, open]);
  return <details className={styles.roomQr} onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary>Show phone QR</summary>
    {qr?.code === code ? <Image src={qr.src} width={128} height={128} alt="Scan this Beerio 2 invite with your phone camera" unoptimized /> : <p>Preparing QR code…</p>}
  </details>;
}
