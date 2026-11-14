import type { Metadata } from 'next';
import InsideRanks from './InsideRanks';

export const metadata: Metadata = {
  title: 'Inside Ranks | Madfun',
  description: 'One friend ranks the group. Everyone else guesses the secret question.',
};

export default function Page() {
  return <InsideRanks />;
}
