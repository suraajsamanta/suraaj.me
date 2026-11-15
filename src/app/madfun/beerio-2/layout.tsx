import { madfunMetadata } from '../shared/share-metadata';
import type { ReactNode } from 'react';

export const metadata = {
  ...madfunMetadata('beerio-2'),
  robots: { index: false, follow: false },
};

export default function Beerio2Layout({ children }: { children: ReactNode }) {
  return children;
}
