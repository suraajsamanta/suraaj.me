import { CHARACTERS, VEHICLES } from "../appearance";
import type { RoomPlayer } from "../room/types";
import styles from "./starting-grid.module.css";

/** The host's large-screen roster. All status is read from the relay snapshot. */
export default function StartingGrid({ players, maxPlayers }: { players: RoomPlayer[]; maxPlayers: number }) {
  const slots = Array.from({ length: maxPlayers }, (_, index) => players[index]);
  return <div className={styles.grid} aria-label="Starting grid">
    {slots.map((player, index) => {
      if (!player) return <div key={`empty-${index}`} className={`${styles.card} ${styles.empty}`} aria-label={`Open driver slot ${index + 1}`}><span>✦</span><strong>OPEN SLOT</strong><small>PLAYER {index + 1}</small></div>;
      const character = CHARACTERS.find((item) => item.id === player.character) ?? CHARACTERS[0];
      const vehicle = VEHICLES.find((item) => item.id === player.vehicle) ?? VEHICLES[0];
      const status = !player.connected ? "DISCONNECTED" : "JOINED";
      return <article key={player.id} className={`${styles.card} ${player.connected ? styles.ready : ""}`} style={{ "--driver-color": player.color } as React.CSSProperties}>
        <div className={styles.cardTop}><span>PLAYER {index + 1}</span><span className={styles.status}>{status}</span></div>
        <div className={styles.art} aria-hidden="true"><span>{character.icon}</span><span>{vehicle.icon}</span></div>
        <div className={styles.details}><strong>{player.name}</strong><small>{character.name}<br />{vehicle.name}</small><div className={styles.color}><span aria-hidden="true" /> VEHICLE COLOR {player.color.toUpperCase()}</div></div>
      </article>;
    })}
  </div>;
}
