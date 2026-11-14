import type {Metadata} from 'next';
import Trivia from './Trivia';
export const metadata:Metadata={title:'Lore Night | Madfun',description:'Shared-screen group trivia. Everyone answers.'};
export default function Page(){return <Trivia/>;}
