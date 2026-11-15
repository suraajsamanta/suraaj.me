import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import type { Player } from './engine';
import styles from './inside-ranks.module.css';

type Drag = { id: string; position: number };
type Preview = { orderedIds: string[]; drag: Drag | null };
const slotStyle = (index: number) => ({ '--slot': index }) as CSSProperties;
const listStyle = (length: number) => ({ '--count': length }) as CSSProperties;
const insertAt = (ids: string[], id: string, slot: number) => {
  const result = ids.filter(current => current !== id);
  result.splice(slot, 0, id);
  return result;
};
const initials = (name: string) => name.trim().split(/\s+/u).slice(0, 2).map(word => Array.from(word)[0]).join('').toUpperCase();

function HeldCard({ player, position }: { player: Player; position: number }) {
  return <div className={styles.heldCard} style={slotStyle(position)} aria-hidden="true">
    <span className={styles.rankAvatar}>{initials(player.name)}</span><strong>{player.name}</strong>
    <span className={styles.heldLabel}>Moving</span>
  </div>;
}

export function LiveRanking({ players, preview }: { players: readonly Player[]; preview?: Preview | null }) {
  const ids = preview?.orderedIds ?? players.map(player => player.id);
  const held = players.find(player => player.id === preview?.drag?.id);
  return <div className={styles.liveBoard}>
    <div className={styles.liveHeader}><span><i/> Live ranking</span><small>{held ? `${held.name} is moving` : 'Order isn’t final yet'}</small></div>
    <ol className={styles.dragList} aria-label="Live draft ranking" style={listStyle(ids.length)}>
      {ids.map((id, slot) => {
        const player = players.find(person => person.id === id);
        return player && <li key={id} className={styles.dragRow} style={slotStyle(slot)} data-lifted={held?.id === id}>
          <span className={styles.number}>{slot + 1}</span><span className={styles.rankAvatar} aria-hidden="true">{initials(player.name)}</span>
          <strong>{player.name}</strong>
        </li>;
      })}
      {held && preview?.drag && <li className={styles.dragOverlay} aria-hidden="true"><HeldCard player={held} position={preview.drag.position}/></li>}
    </ol>
  </div>;
}

export function RankForm({ players, initial, settleOnMount, prompt, disabled, onRank, onPreview }: {
  players: readonly Player[]; initial?: string[]; settleOnMount?: boolean; prompt: string; disabled: boolean;
  onRank: (ids: string[]) => void; onPreview: (preview: Preview) => void;
}) {
  const [order, setOrder] = useState(() => initial ?? players.map(player => player.id));
  const [drag, setDrag] = useState<Drag | null>(null);
  const [dragBase, setDragBase] = useState<string[] | null>(null);
  const list = useRef<HTMLOListElement>(null);
  const hand = useRef<{ pointer: number; id: string; ids: string[]; base: string[]; y: number; offset: number; sent: number; frame: number } | null>(null);
  const send = useRef(onPreview);
  useEffect(() => { send.current = onPreview; }, [onPreview]);
  const wasDisabled = useRef(disabled || settleOnMount === true);
  useEffect(() => {
    const current = hand.current;
    let reset: number | undefined;
    if (disabled && current) {
      cancelAnimationFrame(current.frame);
      hand.current = null;
      reset = requestAnimationFrame(() => { setDrag(null); setDragBase(null); });
    }
    if (!disabled && wasDisabled.current) send.current({orderedIds: order, drag: null});
    wasDisabled.current = disabled;
    return () => { if (reset !== undefined) cancelAnimationFrame(reset); };
  }, [disabled, order]);
  useEffect(() => () => { if (hand.current) cancelAnimationFrame(hand.current.frame); }, []);

  function update(y: number, now: number) {
    const current = hand.current;
    const board = list.current;
    if (!current || !board) return;
    const rect = board.getBoundingClientRect();
    const step = rect.height / current.base.length;
    if (!step) return;
    const position = Math.max(0, Math.min(current.base.length - 1, (y - current.offset - rect.top) / step - .5));
    const next = insertAt(current.base, current.id, Math.round(position));
    current.ids = next;
    setOrder(previous => previous.every((id, index) => id === next[index]) ? previous : next);
    setDrag({ id: current.id, position });
    if (now - current.sent >= 85) {
      current.sent = now;
      send.current({ orderedIds: next, drag: { id: current.id, position: Math.round(position * 100) / 100 } });
    }
  }

  function grab(event: PointerEvent<HTMLSpanElement>, id: string, slot: number) {
    const board = list.current;
    if (!board || disabled || hand.current || !event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = board.getBoundingClientRect();
    const current = { pointer: event.pointerId, id, ids: order, base: order, y: event.clientY,
      offset: event.clientY - (rect.top + rect.height / order.length * (slot + .5)), sent: event.timeStamp, frame: 0 };
    hand.current = current;
    setDragBase(order);
    setDrag({id, position: slot});
    onPreview({orderedIds: order, drag: {id, position: slot}});
    const scroll = (now: number) => {
      if (hand.current !== current) return;
      const height = window.visualViewport?.height ?? window.innerHeight;
      const delta = current.y < 62 ? -Math.min(18, (62 - current.y) / 3) :
        current.y > height - 62 ? Math.min(18, (current.y - height + 62) / 3) : 0;
      if (delta) {
        const before = window.scrollY;
        window.scrollBy(0, delta);
        if (window.scrollY !== before) update(current.y, now);
      }
      current.frame = requestAnimationFrame(scroll);
    };
    current.frame = requestAnimationFrame(scroll);
  }

  function drop(event: PointerEvent<HTMLSpanElement>, cancelled: boolean) {
    const current = hand.current;
    if (!current || event.pointerId !== current.pointer) return;
    if (!cancelled) update(event.clientY, event.timeStamp);
    hand.current = null;
    cancelAnimationFrame(current.frame);
    const next = cancelled ? current.base : current.ids;
    setOrder(next);
    setDrag(null);
    setDragBase(null);
    onPreview({orderedIds: next, drag: null});
  }

  function step(id: string, to: number) {
    if (disabled || hand.current || to < 0 || to >= order.length) return;
    const next = insertAt(order, id, to);
    setOrder(next);
    onPreview({orderedIds: next, drag: null});
  }

  const held = players.find(player => player.id === drag?.id);
  return <form className={styles.stack} onSubmit={event => { event.preventDefault(); if (!disabled && !hand.current) onRank(order); }}>
    <div className={styles.private}><span className={styles.kicker}>Private • Only you can see this</span><h2>{prompt}</h2></div>
    <p>Drag the grip to reorder. Put your best match at #1. Everyone can see the moves, but only you see the question.</p>
    <ol ref={list} className={`${styles.dragList} ${styles.editable}`} aria-label="Rank your friends" style={listStyle(order.length)}>
      {(dragBase ?? order).map(id => {
        const slot = order.indexOf(id);
        const player = players.find(person => person.id === id);
        return player && <li key={id} className={styles.dragRow} style={slotStyle(slot)} data-lifted={held?.id === id}>
          <span className={styles.grip} aria-hidden="true" onPointerDown={event => grab(event, id, slot)}
            onPointerMove={event => { if (hand.current?.pointer === event.pointerId) { hand.current.y = event.clientY; update(event.clientY, event.timeStamp); } }}
            onPointerUp={event => drop(event, false)} onPointerCancel={event => drop(event, true)} onLostPointerCapture={event => drop(event, true)}>⠿</span>
          <span className={styles.number}>{slot + 1}</span><strong>{player.name}</strong>
          <div className={styles.move}>
            <button type="button" disabled={disabled || slot === 0} onClick={() => step(id, slot - 1)} aria-label={`Move ${player.name} up`}>↑</button>
            <button type="button" disabled={disabled || slot === order.length - 1} onClick={() => step(id, slot + 1)} aria-label={`Move ${player.name} down`}>↓</button>
          </div>
        </li>;
      })}
      {held && drag && <li className={styles.dragOverlay} aria-hidden="true"><HeldCard player={held} position={drag.position}/></li>}
    </ol>
    <button className={styles.primary} disabled={disabled || !!drag}>Lock in ranking</button>
  </form>;
}
