'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Image from 'next/image';
import QRCode from 'qrcode';
import { PartyClient } from './party-client';
import { remoteBoard, validateRemoteCommand, type RemoteAction } from './host-remote-protocol';
import styles from './host-remote.module.css';

export type { RemoteAction } from './host-remote-protocol';

export default function HostRemote({ game, active = true, phase = 'Host controls', actions }: {
  game: string; active?: boolean; phase?: string; actions: readonly RemoteAction[];
}) {
  const [client] = useState(() => new PartyClient());
  const room = useSyncExternalStore(client.subscribe, client.getSnapshot, client.getSnapshot);
  const [opened, setOpened] = useState(false);
  const [qr, setQr] = useState<{ key: string; image: string } | null>(null);
  const [notice, setNotice] = useState('');
  const actionsRef = useRef(actions);
  const boardVersion = useRef({ revision: 0, content: '' });
  const published = useRef('');
  const signature = JSON.stringify(remoteBoard(game, 0, phase, actions));
  const pairingKey = room.code && room.judgeInvite ? `${room.code}:${room.judgeInvite}` : '';

  useEffect(() => { actionsRef.current = actions; }, [actions]);
  useEffect(() => {
    const reset = client.onAction((event) => {
      const state = client.getSnapshot();
      if (state.status !== 'connected' || !state.judgeConnected) return;
      validateRemoteCommand(event, boardVersion.current.revision, actionsRef.current)?.run();
    });
    return () => { reset(); client.leave(); };
  }, [client]);
  useEffect(() => { if (!active) client.leave(); }, [active, client]);
  useEffect(() => {
    if (!active || !pairingKey || room.status !== 'connected') return;
    const version = boardVersion.current;
    if (version.content !== signature) { version.content = signature; version.revision++; }
    const stamp = `${pairingKey}:${version.revision}`;
    if (published.current !== stamp && client.publishJudge(remoteBoard(game, version.revision, phase, actionsRef.current))) published.current = stamp;
  }, [active, client, game, pairingKey, phase, room.status, room.judgeConnected, signature]);

  function controllerUrl() {
    const url = new URL('/madfun/controller', window.location.origin);
    url.hash = new URLSearchParams({ room: room.code ?? '', key: room.judgeInvite ?? '' }).toString();
    return url.href;
  }
  async function copyLink() {
    if (!pairingKey) return;
    try {
      await navigator.clipboard.writeText(controllerUrl());
      setNotice('Private controller link copied.');
    } catch { setNotice('Could not copy. Use the private QR.'); }
  }
  async function makeQR() {
    if (!pairingKey) return;
    try { setQr({ key: pairingKey, image: await QRCode.toDataURL(controllerUrl(), { width: 220, margin: 3 }) }); }
    catch { setNotice('Could not draw the QR. Use Copy private link.'); }
  }

  if (!active) return null;
  const linked = room.status === 'connected' && room.judgeConnected;
  return <div className={styles.wrap}>
    <button type="button" className={styles.trigger} aria-expanded={opened} onClick={() => { setOpened(!opened); setNotice(''); }}>
      {linked ? 'Host controller · Connected' : 'Host controller'}
    </button>
    {opened && <section className={styles.popup} aria-label="Private host controller">
      <h2>Host controller</h2>
      <p>Optional. One phone can run the game while this screen stays up. This is not the player QR.</p>
      {room.status === 'idle' ? <button type="button" onClick={() => client.create('simulator')}>Create private controller invite</button> :
        room.status === 'connected' ? <>
          {linked ? <p role="status">Controller connected. Keep this shared screen open.</p> :
            <><p>Only show this invite to the person who should run the game.</p>
              {qr?.key === pairingKey ? <Image src={qr.image} unoptimized width={160} height={160} alt="Private QR: pair a host controller phone" /> :
                <button type="button" onClick={() => void makeQR()}>Show private controller QR</button>}
              <button type="button" onClick={() => void copyLink()}>Copy private link</button>
            </>}
          <button type="button" onClick={() => { client.leave(); setQr(null); setNotice('Controller invite closed. The game is still open.'); }}>Disable controller</button>
        </> : <p role="status">{room.error ?? 'Connecting the private controller…'} <button type="button" onClick={() => client.leave()}>Cancel pairing</button></p>}
      {notice && <p role="status">{notice}</p>}
    </section>}
  </div>;
}
