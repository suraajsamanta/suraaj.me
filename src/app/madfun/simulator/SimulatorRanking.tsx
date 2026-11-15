import { useEffect, useEffectEvent, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createDragPreviewStream } from './drag-preview';
import styles from './simulator.module.css';

type Answer = { id: string; text: string };
type Drag = { id: string; position: number };
type Preview = { ids: string[]; drag: Drag };
type BoardProps = {
  answers: readonly Answer[];
  ids: string[];
  base?: readonly string[] | null;
  drag: Drag | null;
  list?: { current: HTMLOListElement | null };
  controls?: (id: string, index: number) => ReactNode;
};

const remap = (ids: readonly string[], id: string, at: number) => {
  const next = ids.filter(item => item !== id);
  next.splice(at, 0, id);
  return next;
};

function RankingBoard({ answers, ids, base, drag, list, controls }: BoardProps) {
  const fallback = useRef<HTMLOListElement>(null);
  const board = list ?? fallback;
  const [geometry, geometryChanged] = useState({ row: 0, gap: 0 });
  useEffect(() => {
    const node = board.current;
    if (!node) return;
    const measure = () => {
      const row = node.querySelector<HTMLElement>(':scope > li[data-drag-id]');
      if (!row) return;
      const height = row.getBoundingClientRect().height;
      const gap = Number.parseFloat(getComputedStyle(node).rowGap) || 0;
      geometryChanged(last => last.row === height && last.gap === gap ? last : { row: height, gap });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [board, ids.length]);

  const held = drag && answers.find(answer => answer.id === drag.id);
  const rendered = base ?? ids;
  return <ol ref={board} className={`${styles.draftList} ${styles.dragBoard}`}
    aria-label={controls ? 'Rank anonymous answers' : 'Live anonymous ranking'}>
    {rendered.map((id, originalSlot) => {
      const a = answers.find(answer => answer.id === id);
      const index = ids.indexOf(id);
      return a && index >= 0 && <li key={id} data-drag-id={id} data-podium={index < 3} data-lifted={held?.id === id}
        className={controls ? styles.draggableAnswer : undefined}
        style={{ '--shift': index - originalSlot } as CSSProperties}>
        {controls && <span className={styles.answerGrip} aria-hidden="true">⠿</span>}
        <span className={styles.draftPlace}>#{index + 1}</span>
        <span className={styles.draftText}>{a.text}</span>
        <span className={styles.draftPoints}>{ids.length - index} pts</span>
        {controls?.(id, index)}
      </li>;
    })}
    {held && drag && geometry.row > 0 && <li className={`${styles.answerGhost} ${controls ? styles.localGhost : ''}`} aria-hidden="true" data-answer-ghost
      style={{ '--ghost-height': `${geometry.row}px`, '--drag-top': `${(geometry.row + geometry.gap) * drag.position}px` } as CSSProperties}>
      <span className={styles.answerGrip}>⠿</span>
      <span className={styles.draftText}>{held.text}</span>
      <span className={styles.draftPoints}>Moving</span>
    </li>}
  </ol>;
}

export function LiveAnswerRanking({ answers, drag }: { answers: readonly Answer[]; drag: Drag | null | undefined }) {
  const ids = answers.map(a => a.id);
  const viewport = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!drag || !viewport.current) return;
    const container = viewport.current;
    const frame = requestAnimationFrame(() => {
      const ghost = container.querySelector<HTMLElement>('[data-answer-ghost]');
      const board = ghost?.parentElement;
      if (!ghost || !board) return;
      const y = Number.parseFloat(ghost.style.getPropertyValue('--drag-top')) || 0;
      const viewportBounds = container.getBoundingClientRect();
      const top = board.getBoundingClientRect().top + y;
      const bottom = top + ghost.offsetHeight;
      const by = top < viewportBounds.top ? top - viewportBounds.top :
        bottom > viewportBounds.bottom ? bottom - viewportBounds.bottom : 0;
      if (by) container.scrollBy({ top: by, behavior: 'instant' });
    });
    return () => cancelAnimationFrame(frame);
  }, [drag]);
  // Keep DOM rows stable while CSS moves them between slots during the gesture.
  return <div className={styles.liveAnswerBoard}>
    <span className={styles.liveAnswerStatus}><i aria-hidden="true"/> {drag ? 'Moving answer' : 'Live ranking · draft'}</span>
    <div ref={viewport} className={styles.liveAnswerViewport} tabIndex={0} role="region" aria-label="Live ranking board">
      <RankingBoard answers={answers} ids={ids} base={drag ? [...ids].sort() : null} drag={drag ?? null}/>
    </div>
  </div>;
}

export function JudgeRanking({ answers, canRank, busy, revision, onPreview, onDrop, onLock }: {
  answers: readonly Answer[]; canRank: boolean; busy: boolean; revision?: number;
  onPreview: (ids: string[], drag: Drag) => void;
  onDrop: (ids: string[]) => void;
  onLock: (ids: string[]) => void;
}) {
  const list = useRef<HTMLOListElement>(null);
  const [draft, setDraft] = useState<{ ids: string[]; base: string[]; drag: Drag } | null>(null);
  const [settled, setSettled] = useState<{ ids: string[]; revision?: number } | null>(null);
  const serverOrder = answers.map(a => a.id);
  const ids = draft?.ids ?? (busy && settled?.revision === revision ? settled?.ids : null) ?? serverOrder;
  const enabled = canRank && !busy;
  const hand = useRef<{
    kind: 'touch' | 'pointer'; identifier: number; move: (y: number) => void;
    finish: (y: number | null, cancelled: boolean) => void; dispose: () => void;
  } | null>(null);
  const readOrder = useEffectEvent(() => enabled ? ids : null);
  const sendPreview = useEffectEvent((sample: Preview) => { if (enabled) onPreview(sample.ids, sample.drag); });
  const settle = useEffectEvent((next: string[]) => {
    if (!enabled) return;
    setSettled({ ids: next, revision });
    onDrop(next);
  });
  useEffect(() => {
    if (enabled) return;
    const frame = requestAnimationFrame(() => hand.current?.finish(null, true));
    return () => cancelAnimationFrame(frame);
  }, [enabled]);

  useEffect(() => {
    const board = list.current;
    if (!board) return;

    function grab(target: EventTarget | null, y: number, kind: 'touch' | 'pointer', identifier: number) {
      if (hand.current || !(target instanceof Element) || target.closest('button')) return null;
      const row = target.closest<HTMLElement>('[data-drag-id]');
      const id = row?.dataset.dragId;
      const base = readOrder();
      if (!board || !row || !board.contains(row) || !id || !base || base.length < 2) return null;
      const slot = base.indexOf(id);
      const gap = Number.parseFloat(getComputedStyle(board).rowGap) || 0;
      if (slot < 0) return null;
      const offset = y - row.getBoundingClientRect().top - row.getBoundingClientRect().height / 2;
      const stream = createDragPreviewStream(sendPreview);
      let frame: number;
      let order = base, position = slot, lastSample = slot;
      const move = (clientY: number, broadcast = true) => {
        y = clientY;
        const rect = board.getBoundingClientRect();
        const step = (rect.height + gap) / base.length;
        if (!step) return;
        position = Math.max(0, Math.min(base.length - 1, (y - offset - rect.top + gap / 2) / step - .5));
        const at = Math.round(position);
        if (order[at] !== id) order = remap(base, id, at);
        const sample = Math.round(position * 100) / 100;
        setDraft(previous => previous?.drag.position === position ? previous : { ids: order, base, drag: { id, position } });
        if (broadcast && sample !== lastSample) {
          lastSample = sample;
          stream.push({ ids: order, drag: { id, position: sample } });
        }
      };
      const dispose = () => {
        hand.current = null;
        cancelAnimationFrame(frame);
        stream.cancel();
      };
      const finish = (clientY: number | null, cancelled: boolean) => {
        if (!cancelled && clientY !== null) move(clientY, false);
        dispose();
        setDraft(null);
        settle(cancelled ? base : order);
      };
      const scroll = () => {
        const viewport = window.visualViewport;
        const top = viewport?.offsetTop ?? 0;
        const bottom = top + (viewport?.height ?? window.innerHeight);
        const delta = y < top + 62 ? -Math.min(18, (top + 62 - y) / 3) :
          y > bottom - 62 ? Math.min(18, (y - bottom + 62) / 3) : 0;
        if (delta) {
          const before = window.scrollY;
          window.scrollBy({ top: delta, behavior: 'instant' });
          if (window.scrollY !== before) move(y);
        }
        frame = requestAnimationFrame(scroll);
      };
      hand.current = { kind, identifier, move, finish, dispose };
      setDraft({ ids: base, base, drag: { id, position: slot } });
      sendPreview({ ids: base, drag: { id, position: slot } });
      frame = requestAnimationFrame(scroll);
      return row;
    }

    function touchStart(event: TouchEvent) {
      if (event.touches.length !== 1) return;
      const touch = event.changedTouches.item(0);
      if (touch && grab(event.target, touch.clientY, 'touch', touch.identifier) && event.cancelable) event.preventDefault();
    }
    function touchMove(event: TouchEvent) {
      const active = hand.current;
      if (active?.kind !== 'touch') return;
      const touch = Array.from(event.changedTouches).find(item => item.identifier === active.identifier);
      if (!touch) return;
      if (event.cancelable) event.preventDefault();
      active.move(touch.clientY);
    }
    function touchEnd(event: TouchEvent) {
      const active = hand.current;
      if (active?.kind !== 'touch') return;
      const touch = Array.from(event.changedTouches).find(item => item.identifier === active.identifier);
      if (touch) active.finish(touch.clientY, event.type === 'touchcancel');
    }
    function pointerDown(event: PointerEvent) {
      if (event.pointerType === 'touch' || !event.isPrimary || event.button !== 0) return;
      const row = grab(event.target, event.clientY, 'pointer', event.pointerId);
      if (!row) return;
      event.preventDefault();
      try { row.setPointerCapture(event.pointerId); } catch { /* document events still tracked */ }
    }
    function pointerMove(event: PointerEvent) {
      const active = hand.current;
      if (active?.kind === 'pointer' && event.pointerId === active.identifier) active.move(event.clientY);
    }
    function pointerEnd(event: PointerEvent) {
      const active = hand.current;
      if (active?.kind === 'pointer' && event.pointerId === active.identifier) active.finish(event.clientY, event.type !== 'pointerup');
    }
    const onBlur = () => hand.current?.finish(null, true);
    const onVisibility = () => { if (document.hidden) onBlur(); };

    board.addEventListener('touchstart', touchStart, { passive: false });
    document.addEventListener('touchmove', touchMove, { passive: false });
    document.addEventListener('touchend', touchEnd);
    document.addEventListener('touchcancel', touchEnd);
    board.addEventListener('pointerdown', pointerDown);
    document.addEventListener('pointermove', pointerMove);
    document.addEventListener('pointerup', pointerEnd);
    document.addEventListener('pointercancel', pointerEnd);
    document.addEventListener('lostpointercapture', pointerEnd);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      hand.current?.dispose();
      board.removeEventListener('touchstart', touchStart);
      document.removeEventListener('touchmove', touchMove);
      document.removeEventListener('touchend', touchEnd);
      document.removeEventListener('touchcancel', touchEnd);
      board.removeEventListener('pointerdown', pointerDown);
      document.removeEventListener('pointermove', pointerMove);
      document.removeEventListener('pointerup', pointerEnd);
      document.removeEventListener('pointercancel', pointerEnd);
      document.removeEventListener('lostpointercapture', pointerEnd);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const step = (id: string, at: number) => {
    if (!enabled || hand.current || at < 0 || at >= ids.length) return;
    const next = remap(ids, id, at);
    setSettled({ ids: next, revision });
    onDrop(next);
  };
  return <>
    <p>Drag an anonymous answer card to reorder it. The shared screen follows live. First earns {answers.length} points, then one fewer per place.</p>
    <RankingBoard answers={answers} ids={ids} base={draft?.base} drag={draft?.drag ?? null} list={list}
      controls={(id, index) => <div className={styles.rankButtons}>
        <button type="button" aria-label={`Move answer ${index + 1} up`} disabled={!enabled || !!draft || index === 0} onClick={() => step(id, index - 1)}>↑</button>
        <button type="button" aria-label={`Move answer ${index + 1} down`} disabled={!enabled || !!draft || index === ids.length - 1} onClick={() => step(id, index + 1)}>↓</button>
      </div>}/>
    <button className={styles.primary} type="button" disabled={!enabled || !!draft || !ids.length}
      onClick={() => { if (!hand.current) onLock(ids); }}>Lock rankings &amp; reveal</button>
  </>;
}
