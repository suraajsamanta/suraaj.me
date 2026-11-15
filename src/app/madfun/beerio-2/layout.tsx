import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Beerio 2 · Afterhours Racing',
  description: 'Race Seattle Night or Neon Orbit against AI, the clock, or friends. A separate 3D racer from Madfun.',
  robots: { index: false, follow: false },
};

export default function Beerio2Layout({ children }: { children: ReactNode }) {
  return children;
}
