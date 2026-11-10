import type { CSSProperties } from 'react';
import { POWER_UPS, type ItemNotice, type PowerUp } from './powerups';
import styles from './power-up-notice.module.css';

/** Short, accurate instructions stay useful when animation is disabled. */
const EFFECTS: Record<PowerUp, string> = {
  fizz: 'Speed up. Shake off slowdowns.',
  guard: 'A shield against the next hit.',
  slick: 'Leave a slippery puddle behind.',
  bolt: 'A bubble chases the racer ahead.',
  dance: 'Send the racer ahead dancing.',
  flask: 'Tap again for bursts for 7 seconds.',
  prism: '6 seconds of speed + protection.',
  splat: 'Cover rival views in berry foam.',
  diddy: 'Baby oil clouds rival views for 4 seconds.',
  jet: 'Protected autopilot. Brake to cancel.',
  crown: 'A comet hunts down the leader.',
  lightning: 'Strike and slow unprotected rivals.',
  twerk: 'Make the racer behind twerk.',
};

function Kart({ ghost = false }: { ghost?: boolean }) {
  return <g fill={ghost ? '#7892b4' : 'currentColor'} stroke="#101a2c" strokeWidth="2" strokeLinejoin="round">
    <path d="M-22 2h9l5-11H5l9 11h9v12h-46z" />
    <path d="M-8-5H3l7 7H-11z" fill="#e5f9ff" stroke="none" />
    <circle cx="-14" cy="15" r="6" fill="#101a2c" stroke="#d9edff" /><circle cx="15" cy="15" r="6" fill="#101a2c" stroke="#d9edff" />
  </g>;
}

function Dancer({ twerk }: { twerk: boolean }) {
  return <g className={twerk ? styles.twerkDancer : styles.danceDancer} stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="0" cy="-21" r="7" fill="#fff3da" stroke="none" />
    <path d={twerk ? 'M0-10L9 4L-3 12M1-7L16-3L20-10' : 'M0-10V10M0-5L-15-12L-20-5M0-5L15-16L20-10'} fill="none" />
    <path d={twerk ? 'M-3 12L-12 24H-22M-3 12L10 19L5 28' : 'M0 10L-10 25H-19M0 10L11 24L20 19'} fill="none" />
  </g>;
}

/** Small SVG vignettes explain each effect without another canvas, timers,
 * network assets or frame callbacks. No shared SVG IDs across split screens. */
function EffectScene({ item }: { item: PowerUp }) {
  let scene;
  switch (item) {
    case 'fizz':
      scene = <><g className={styles.speedTrails} stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M15 33H50M5 45H42M22 57H49" /></g><g transform="translate(88 47)"><g className={styles.fizzKart}><Kart /></g></g><g className={styles.fizzBubbles} fill="none" stroke="currentColor" strokeWidth="2"><circle cx="52" cy="23" r="4" /><circle cx="32" cy="16" r="2" /><circle cx="66" cy="9" r="3" /></g></>;
      break;
    case 'guard':
      scene = <><g transform="translate(78 47)"><Kart /></g><path className={styles.guardShield} d="M78 8L113 21V43Q110 64 78 79Q46 64 43 43V21Z" fill="#69eddd24" stroke="currentColor" strokeWidth="3" /><g className={styles.guardImpact} stroke="#fff3b1" strokeWidth="3"><path d="M17 30L35 41M13 45H31M24 60L37 50" /></g></>;
      break;
    case 'slick':
      scene = <><g className={styles.slickPuddle}><ellipse cx="46" cy="66" rx="32" ry="10" fill="currentColor" opacity=".7" /><path d="M26 65Q46 53 66 65M35 67L40 60M49 67L51 59" fill="none" stroke="#f1ffc8" strokeWidth="2" /></g><g className={styles.slickDrop} fill="currentColor"><path d="M48 28Q31 49 47 53Q64 49 48 28" /></g><g transform="translate(99 34)"><g className={styles.slickKart}><Kart /></g></g></>;
      break;
    case 'bolt':
      scene = <><path d="M13 64Q45 10 99 46" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3 5" opacity=".4" /><g transform="translate(113 51) scale(.65)"><Kart ghost /></g><g className={styles.boltBubble}><circle cx="33" cy="49" r="15" fill="#f8a6ef48" stroke="currentColor" strokeWidth="3" /><path d="M25 44Q27 38 34 38" stroke="white" strokeWidth="3" strokeLinecap="round" fill="none" /></g><circle className={styles.boltImpact} cx="108" cy="50" r="20" fill="none" stroke="currentColor" strokeWidth="3" /></>;
      break;
    case 'dance':
    case 'twerk':
      scene = <><g transform={item === 'twerk' ? 'translate(112 55) scale(.55)' : 'translate(31 55) scale(.55)'} opacity=".6"><Kart ghost /></g><ellipse cx="77" cy="75" rx="26" ry="5" fill="currentColor" opacity=".18" /><g transform="translate(77 43)"><Dancer twerk={item === 'twerk'} /></g><g className={styles.musicNotes} fill="currentColor"><path d="M113 17v16a5 4 0 1 1-3-4V14l13-3v7zM29 12v13a4 3 0 1 1-3-3V10l8-2v5z" /></g></>;
      break;
    case 'flask':
      scene = <><g className={styles.flaskBottle} fill="currentColor" stroke="#fff1bf" strokeWidth="2"><path d="M60 25V14H80V25L92 40V69Q70 80 48 69V40Z" /><path d="M55 49Q70 42 85 49V64Q70 70 55 64Z" fill="#d97722" stroke="none" /><path d="M67 33L59 49H68L64 60L80 42H70L76 33Z" fill="#fff7cc" stroke="none" /></g><path className={styles.flaskCap} d="M59 10H81" stroke="#fff1bf" strokeWidth="6" strokeLinecap="round" /><g className={styles.flaskFizz} fill="none" stroke="currentColor" strokeWidth="2"><circle cx="49" cy="23" r="4" /><circle cx="91" cy="18" r="3" /><circle cx="78" cy="5" r="2" /></g><path className={styles.flaskBoost} d="M104 44L113 51L104 58M117 44L126 51L117 58" fill="none" stroke="currentColor" strokeWidth="3" /></>;
      break;
    case 'prism':
      scene = <><g className={styles.prismAura} fill="none" strokeWidth="3"><path d="M72 5L119 43L72 81L25 43Z" stroke="#bc9dff" /><path d="M72 11L112 43L72 75L32 43Z" stroke="#87edff" /><path d="M72 17L105 43L72 69L39 43Z" stroke="#ffb9dc" /></g><g transform="translate(72 43)"><g className={styles.prismKart}><Kart /></g></g><g className={styles.prismStars} fill="#fff"><path d="M20 16L23 23L30 26L23 29L20 36L17 29L10 26L17 23ZM121 55L123 60L128 62L123 64L121 69L119 64L114 62L119 60Z" /></g></>;
      break;
    case 'splat':
      scene = <><path d="M29 19H115L128 69H16Z" fill="#adc6e51a" stroke="#b6c7de" strokeWidth="2" /><path d="M72 22V66M24 59L58 40" stroke="#b6c7de" strokeWidth="2" opacity=".4" /><g className={styles.berrySplat} fill="currentColor"><path d="M71 29Q81 6 87 28Q116 18 103 41Q125 57 101 60Q95 80 80 65Q56 84 54 63Q22 67 37 46Q23 24 50 32Q52 11 65 28Z" /><circle cx="22" cy="25" r="5" /><circle cx="121" cy="44" r="4" /><circle cx="40" cy="76" r="3" /><path d="M58 40Q70 31 83 37" fill="none" stroke="#ebd3ff" strokeWidth="4" strokeLinecap="round" /></g></>;
      break;
    case 'diddy':
      scene = <><path d="M25 24H118L130 74H12Z" fill="#c9e9ef25" stroke="#b6c7de" strokeWidth="2" /><g className={styles.oilPour} fill="currentColor"><path d="M42 30Q30 15 41 10Q52 16 46 30L62 50Q68 64 56 68Q43 64 47 53Z" /><path d="M83 28Q70 45 78 55Q92 65 91 46Z" opacity=".75" /><path d="M108 39Q97 52 102 65Q116 73 117 58Z" opacity=".6" /><ellipse cx="66" cy="65" rx="44" ry="9" opacity=".4" /><path d="M52 51L55 59M82 46L84 53M108 57L109 62" fill="none" stroke="#fffdf1" strokeWidth="3" strokeLinecap="round" /></g><g transform="translate(31 9) rotate(-30)" fill="#e9f5f1" stroke="#203142" strokeWidth="2"><path d="M0 9V3H12V9L17 14V33H-5V14Z" /><path d="M0 2H12" stroke="#75d3d6" strokeWidth="5" /><path d="M-1 19H13V28H-1Z" fill="#ffdda5" stroke="none" /></g></>;
      break;
    case 'jet':
      scene = <><g className={styles.jetTrails} stroke="currentColor" strokeWidth="2"><path d="M7 23H34M1 44H29M12 66H42" /></g><g className={styles.jetRocket}><path className={styles.jetFlame} d="M52 34L16 44L52 55L39 44Z" fill="#ffd56d" /><path d="M47 29Q85 14 113 44Q85 73 47 59Z" fill="currentColor" stroke="#ffe0c5" strokeWidth="2" /><path d="M58 25V63M83 26V62" stroke="#793a32" strokeWidth="4" /><circle cx="96" cy="44" r="7" fill="#d9fbff" /><path d="M60 25L48 12L45 30M60 63L48 76L45 58" fill="#ffbfa3" /></g></>;
      break;
    case 'crown':
      scene = <><path d="M16 12Q86 0 107 49" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3 5" opacity=".4" /><path d="M91 64L87 47L97 54L107 42L116 54L126 47L122 64Z" fill="#ffd36b" /><path d="M94 70H120" stroke="#ffd36b" strokeWidth="3" /><g className={styles.crownComet}><path d="M15 11L58 28L41 37Z" fill="#7ebdff77" /><circle cx="50" cy="31" r="11" fill="currentColor" /><circle cx="52" cy="29" r="5" fill="white" /></g><circle className={styles.crownImpact} cx="107" cy="53" r="23" fill="none" stroke="#ffedab" strokeWidth="3" /></>;
      break;
    case 'lightning':
      scene = <><path d="M37 20Q28 7 45 9Q53-3 65 8Q82-2 91 10Q114 7 108 23Z" fill="#c0e9ff" /><g className={styles.stormBolts} fill="currentColor"><path d="M46 26L33 45H43L36 59L55 37H44ZM72 24L61 43H71L64 57L83 35H72ZM99 26L88 45H98L91 59L110 37H99Z" /></g><g className={styles.stormKarts}><g transform="translate(32 67) scale(.4)"><Kart ghost /></g><g transform="translate(73 66) scale(.4)"><Kart ghost /></g><g transform="translate(114 67) scale(.4)"><Kart ghost /></g></g></>;
      break;
  }
  return <svg className={styles.scene} viewBox="0 0 144 88" aria-hidden="true" focusable="false"><path d="M14 77H130" stroke="currentColor" opacity=".15" />{scene}</svg>;
}

export function PowerUpNotice({ item, kind, keyboard, playerName, paused = false }: { item: PowerUp; kind: ItemNotice['kind']; keyboard: boolean; playerName: string; paused?: boolean }) {
  const power = POWER_UPS[item];
  const prompt = keyboard ? 'Press E to use' : 'Double-tap GO to use';
  return <div className={styles.notice} style={{ '--item-color': power.color } as CSSProperties} data-kind={kind} data-item={item} data-paused={paused || undefined} role="status" aria-atomic="true">
    <span className={styles.srOnly}>{playerName}. </span>
    <div className={styles.art} aria-hidden="true">
      <span className={styles.halo} />
      {kind === 'full' ? <span className={styles.heldIcon}>{power.icon}</span> : <EffectScene item={item} />}
    </div>
    <div className={styles.copy}>
      <small className={styles.eyebrow}>{kind === 'activate' ? 'POWER-UP ACTIVATED' : kind === 'pickup' ? 'POWER-UP COLLECTED' : 'ITEM ALREADY HELD'}</small>
      <strong className={styles.title}>{power.name}</strong>
      <span className={styles.effect}>{kind === 'full' ? 'Use your held item first.' : EFFECTS[item]}</span>
      {kind !== 'activate' && <span className={styles.prompt}>{prompt}<span aria-hidden="true"> ↗</span></span>}
    </div>
  </div>;
}
