import styles from './quick-start.module.css';

type Step = { title: string; body: string };

export default function QuickStart({ game, steps }: { game: string; steps: readonly Step[] }) {
  return <details className={styles.guide}>
    <summary className={styles.summary}>
      <span className={styles.label}>Quick Start</span>
      <span className={styles.hint}>How to play {game}</span>
    </summary>
    <ol className={styles.steps}>{steps.map(({ title, body }) => <li key={title}><strong>{title}</strong><p>{body}</p></li>)}</ol>
  </details>;
}
