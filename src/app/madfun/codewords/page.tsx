import type { Metadata } from 'next';
import Codewords from './Codewords';

export const metadata: Metadata = {
 title: 'Codewords | Madfun',
 description: 'Two teams, two clue-givers, one secret board. Play from your phones.',
};
export default function Page() { return <Codewords />; }
