'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { PartyClient } from '../shared/party-client';
import { HOST_REMOTE, readRemoteBoard, roomPattern, invitePattern, type RemoteBoard, type RemoteButton } from '../shared/host-remote-protocol';
import styles from './controller.module.css';

const current = () => window.location.hash;
const noHash = () => '';
const subscribeHash = (f: () => void) => { window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange',f); };

export default function Controller() {
  const [client] = useState(() => new PartyClient());
  const room = useSyncExternalStore(client.subscribe, client.getSnapshot, client.getSnapshot);
  const hash = useSyncExternalStore(subscribeHash,current,noHash);
  const params = new URLSearchParams(hash.slice(1));
  const roomCode = params.get('room') ?? '';
  const key = params.get('key') ?? '';
  const valid = roomPattern.test(roomCode) && invitePattern.test(key);
  const [board,setBoard] = useState<RemoteBoard | null>(null);
  const [notice,setNotice] = useState('');
  const [pending,setPending] = useState<{ id: string; before: number } | null>(null);
  const [confirm,setConfirm] = useState<{ button: RemoteButton; revision: number } | null>(null);

  useEffect(() => {
    const unsubscribe = client.onJudgeState(value => { const parsed = readRemoteBoard(value); if (parsed) setBoard(parsed); });
    return () => { unsubscribe(); client.leave(); };
  }, [client]);
  useEffect(() => {
    if (!pending) return;
    const timer = window.setTimeout(() => setPending(null), 800);
    return () => window.clearTimeout(timer);
  }, [pending]);

  const ready = room.status === 'connected' && room.hostConnected && !!board;
  function send(button: RemoteButton, confirmed = false) {
    if (!ready || !board || button.disabled || pending?.before === board.revision) return;
    if (button.confirm && !confirmed) { setConfirm({ button, revision: board.revision }); return; }
    setConfirm(null);
    if (client.sendAction({ protocol: HOST_REMOTE, revision: board.revision, id: button.id, confirmed })) {
      setPending({id:button.id,before:board.revision});setNotice('Command sent to the display.');
    } else setNotice('Could not send. Check the connection.');
  }

  return <main className={styles.page}>
    <section className={styles.card}>
      <span className={styles.eyebrow}>MADFUN · PRIVATE HOST REMOTE</span>
      <h1>{board?.game ?? 'Host controller'}</h1>
      <p>You’re running the shared screen. This phone is not a player.</p>
      {!valid ? <p>Ask the host to open <strong>Host controller</strong> on the shared screen, then scan its private QR.</p> :
        room.status === 'idle' ? <button className={styles.primary} onClick={() => {
          setBoard(null);setNotice('');setPending(null);setConfirm(null);client.joinJudge(roomCode,key);
        }}>Connect to display</button> :
        <><p className={styles.status} role="status">{ready ? `Connected · ${board.phase}` : room.error ?? 'Connecting to the shared display…'}</p>
          {ready && <div className={styles.buttons}>
            {board.buttons.length ? board.buttons.map(button => <button key={button.id} type="button" disabled={button.disabled || pending?.before===board.revision} onClick={() => send(button)}>{button.label}</button>) :
              <p>Waiting for the next host action.</p>}
          </div>}
          {ready && confirm?.revision === board?.revision && <section className={styles.confirm} aria-label="Confirm host command">
            <p>{confirm?.button.confirm}</p><button type="button" onClick={() => { if(confirm)send(confirm.button,true); }}>Confirm</button><button type="button" onClick={() => setConfirm(null)}>Cancel</button>
          </section>}
          {notice && <p role="status">{notice}</p>}
          <button type="button" className={styles.leave} onClick={() => { client.leave();setBoard(null);setNotice('');setPending(null);setConfirm(null); }}>Disconnect controller</button>
        </>}
    </section>
  </main>;
}
