import type { Metadata } from 'next';
import Controller from './Controller';

export const metadata: Metadata = {
  title: 'Madfun · Host Controller',
  description: 'Pair to a shared game display. This link is for the host, not players.',
  robots: { index: false, follow: false },
};
export default function ControllerPage() { return <Controller />; }
