"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { CHARACTERS, GARAGE_VEHICLES, currentGarageVehicle, selectionCharacters, CHARACTER_COLUMNS, type CharacterId } from "../appearance";
import type { RoomPlayer } from "../room/types";
import styles from "./character-selection.module.css";

type Direction = "up" | "down" | "left" | "right";
type Choice = { direction: Direction } | { confirm: boolean };

export function CharacterPortrait({ id, large = false }: { id?: CharacterId; large?: boolean }) {
  const character = CHARACTERS.find(item => item.id === id);
  if (!character) return <span className={`${styles.portrait} ${styles.blankPortrait} ${large ? styles.largePortrait : ""}`} aria-label="No character chosen">?</span>;
  return <span className={`${styles.portrait} ${styles.modelPortrait} ${large ? styles.largePortrait : ""}`} role="img" aria-label={character.name} style={{ backgroundImage: `url("/beerio/models/heads/${character.id}.png")` }} />;
}

export function SelectionCountdown({ endsAt }: { endsAt: number }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
  useEffect(() => {
    const update = () => setRemaining(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    const frame = window.requestAnimationFrame(update);
    const timer = window.setInterval(update, 100);
    return () => { window.cancelAnimationFrame(frame); window.clearInterval(timer); };
  }, [endsAt]);
  return <div className={styles.countdown} role="status" aria-live="polite"><span>EVERYONE HAS PICKED</span><strong>{remaining || "GO!"}</strong><span>{remaining ? "RACE STARTS IN…" : "START YOUR ENGINES"}</span></div>;
}

export function CharacterGrid({ players, endsAt, version = 2 }: { players: RoomPlayer[]; endsAt?: number | null; version?: number }) {
  const characters = selectionCharacters(version);
  const rows = Math.ceil(characters.length / CHARACTER_COLUMNS);
  const featured = players.find(player => player.connected && (player.characterCursor || player.character));
  const featuredCharacter = characters.find(character => character.id === (featured?.characterCursor ?? featured?.character));
  const featuredRide = featured && GARAGE_VEHICLES.find(ride => ride.id === currentGarageVehicle(featured.vehicle ?? "kart"));
  return <section className={styles.selection} aria-label="Choose your character" style={{ "--character-rows": rows } as CSSProperties}>
    <div className={styles.selectionTitle}><div><span>THE WHOLE CREW</span><h2>Pick your character.</h2><p>Join with your phone, then move the joystick and press SELECT. The race countdown starts automatically when everyone has picked.</p></div><strong>{players.filter(p => p.characterConfirmed).length} / {players.length} PICKED</strong></div>
    <div className={styles.roster} aria-label="Drivers choosing characters">{players.map(player => <span key={player.id} title={player.name} style={{ "--driver-color": player.color } as CSSProperties}>{player.name}<small>{!player.connected ? "RECONNECTING" : player.characterConfirmed ? "PICKED ✓" : "CHOOSING"}</small></span>)}</div>
    <div className={styles.garageBoard}><div className={styles.characterGrid} role="list" aria-label={`${characters.length} characters in ${CHARACTER_COLUMNS} columns and ${rows} rows`}>{characters.map(character => {
      const hovering = players.filter(player => (player.characterCursor ?? player.character) === character.id);
      return <article role="listitem" aria-label={character.name} className={`${styles.characterCard} ${hovering.length ? styles.highlighted : ""}`} key={character.id}>
        <div className={styles.nameFlags}>{hovering.map(player => <span key={player.id} title={player.name} className={!player.connected ? styles.offline : ""} style={{ "--driver-color": player.color } as CSSProperties}>{player.name}{player.characterConfirmed ? " ✓" : ""}</span>)}</div>
        <CharacterPortrait id={character.id} /><strong>{character.name}</strong>
      </article>;
    })}</div><aside className={styles.garageSpotlight} aria-label="Garage spotlight">
      <span>GARAGE SPOTLIGHT</span>
      {featured && featuredCharacter && featuredRide ? <>
        <strong>{featured.name}</strong>
        <div className={styles.spotlightHead} aria-hidden="true" style={{ backgroundImage: `url("/beerio/models/heads/${featuredCharacter.id}.png")` }} />
        <b>{featuredCharacter.name}</b>
        <div className={styles.spotlightRide} aria-hidden="true" style={{ backgroundImage: `url("/beerio/models/rides/${featuredRide.id}.png")` }} />
        <b>{featuredRide.name}</b>
      </> : <p>Driver and ride appear here when someone browses.</p>}
    </aside></div>
    {endsAt && <SelectionCountdown endsAt={endsAt} />}
  </section>;
}

/** Direction is one discrete step per tilt, with slow repeat while held. */
export function CharacterController({ player, onChoose, endsAt }: { player: RoomPlayer; onChoose: (choice: Choice) => void; endsAt?: number | null }) {
  const [direction, setDirection] = useState<Direction | null>(null);
  const held = useRef<Direction | null>(null);
  const repeat = useRef<ReturnType<typeof setInterval> | null>(null);
  const pointer = useRef<number | null>(null);
  const callback = useRef(onChoose);
  useEffect(() => { callback.current = onChoose; }, [onChoose]);
  const stop = () => { held.current = null; pointer.current = null; setDirection(null); if (repeat.current) clearInterval(repeat.current); repeat.current = null; };
  useEffect(() => {
    const reset = () => { held.current = null; pointer.current = null; setDirection(null); if (repeat.current) clearInterval(repeat.current); repeat.current = null; };
    window.addEventListener("blur", reset); window.addEventListener("pagehide", reset); window.addEventListener("orientationchange", reset); document.addEventListener("visibilitychange", reset);
    return () => { reset(); window.removeEventListener("blur", reset); window.removeEventListener("pagehide", reset); window.removeEventListener("orientationchange", reset); document.removeEventListener("visibilitychange", reset); };
  }, []);
  const move = (next: Direction | null) => {
    if (player.characterConfirmed || next === held.current) return;
    if (repeat.current) clearInterval(repeat.current); repeat.current = null;
    held.current = next; setDirection(next);
    if (next) { callback.current({ direction: next }); repeat.current = setInterval(() => callback.current({ direction: next }), 320); }
  };
  const tilt = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left - rect.width / 2, y = event.clientY - rect.top - rect.height / 2;
    move(Math.hypot(x, y) < rect.width * .13 ? null : Math.abs(x) > Math.abs(y) ? x < 0 ? "left" : "right" : y < 0 ? "up" : "down");
  };
  const cursor = player.characterCursor ?? player.character;
  const character = CHARACTERS.find(item => item.id === cursor);
  return <div className={styles.phoneSelection}>
    {endsAt ? <SelectionCountdown endsAt={endsAt} /> : <><p className={styles.phoneEyebrow}>{player.characterConfirmed ? "CHARACTER SELECTED" : "LOOK UP AT THE BIG SCREEN"}</p><h1 aria-live="polite" aria-atomic="true">{character?.name ?? "Choose a character"}</h1>{character && "title" in character && <span className={styles.characterTitle}>{character.title}</span>}<CharacterPortrait id={cursor ?? undefined} large /><p>{player.characterConfirmed ? "Waiting for the others to choose." : "Tilt the joystick to browse. Hit SELECT when you find your favorite."}</p></>}
    <div className={styles.selectionControls}>
      {!player.characterConfirmed && <div className={styles.selectionJoystick} role="group" aria-label="Character selection joystick" onKeyDown={event => {
        const directions: Record<string, Direction> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
        const next = directions[event.key];
        if (next) { event.preventDefault(); if (!event.repeat) callback.current({ direction: next }); }
      }} onPointerDown={event => { if (pointer.current !== null || event.button !== 0) return; event.preventDefault(); pointer.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId); tilt(event); }} onPointerMove={event => { if (event.pointerId === pointer.current) tilt(event); }} onPointerUp={event => { if (event.pointerId === pointer.current) stop(); }} onPointerCancel={stop} onLostPointerCapture={stop} onContextMenu={event => event.preventDefault()}>
        {(["up", "left", "right", "down"] as const).map((value, index) => <button type="button" key={value} className={`${styles.direction} ${styles[value]}`} aria-label={`Choose character ${value}`} onClick={event => { if (event.detail === 0) callback.current({ direction: value }); }}>{["▲", "◀", "▶", "▼"][index]}</button>)}
        <span className={`${styles.joystickKnob} ${direction ? styles[`tilt${direction}`] : ""}`} aria-hidden="true" />
      </div>}
      <button type="button" disabled={!player.characterConfirmed && !cursor} className={player.characterConfirmed ? styles.changeChoice : styles.selectButton} onClick={() => { stop(); onChoose({ confirm: !player.characterConfirmed }); }}>{player.characterConfirmed ? "CHANGE CHARACTER" : "SELECT"}</button>
    </div>
  </div>;
}
