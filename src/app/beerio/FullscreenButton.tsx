'use client';

import { useEffect, useState } from 'react';
import styles from './beerio.module.css';

type FullscreenDocument = Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => Promise<void> | void };
type FullscreenElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

/** Fullscreen begins only from a direct tap; unsupported browsers keep the game usable. */
export default function FullscreenButton() {
  const [active, setActive] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    const doc = document as FullscreenDocument;
    const update = () => setActive(Boolean(doc.fullscreenElement || doc.webkitFullscreenElement));
    update();
    document.addEventListener('fullscreenchange', update);
    document.addEventListener('webkitfullscreenchange', update);
    return () => { document.removeEventListener('fullscreenchange', update); document.removeEventListener('webkitfullscreenchange', update); };
  }, []);
  const toggle = async () => {
    const doc = document as FullscreenDocument, element = document.documentElement as FullscreenElement;
    setMessage('');
    try {
      if (doc.fullscreenElement || doc.webkitFullscreenElement) {
        if (doc.exitFullscreen) await doc.exitFullscreen(); else await doc.webkitExitFullscreen?.();
      } else if (element.requestFullscreen) await element.requestFullscreen();
      else if (element.webkitRequestFullscreen) await element.webkitRequestFullscreen();
      else setMessage(/iPhone|iPod/.test(navigator.userAgent) ? 'On iPhone: Share → Add to Home Screen, then open Beerio there for a full-screen view.' : 'Fullscreen is not supported here. Use your browser’s full-screen option if available.');
    } catch { setMessage('Fullscreen could not open. Try again from this button or use your browser’s full-screen option.'); }
  };
  return <span><button type="button" className={styles.smallButton} onClick={toggle} aria-pressed={active}>{active ? 'EXIT FULLSCREEN' : 'FULLSCREEN'}</button>{message && <small role="status">{message}</small>}</span>;
}
