export type Prompt={id:string;category:string;text:string};export type Player={id:string;name:string};export type Answer={id:string;playerId:string;text:string};
export type SimState={phase:'lobby'|'answering'|'judging'|'reveal'|'finished';guest:string;round:number;prompts:Prompt[];players:Player[];answers:Answer[];ranking:string[];judgingOrder:string[];rankingVersion:number;authorForToken:Record<string,string>;scores:Record<string,number>;roundPoints:Record<string,number>};
export function newGame(guest:string):SimState{return{phase:'lobby',guest:guest.trim().slice(0,50)||'Our guest',round:0,prompts:[],players:[],answers:[],ranking:[],judgingOrder:[],rankingVersion:0,authorForToken:{},scores:{},roundPoints:{}};}
export function shuffled<T>(items:T[],random=Math.random){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export function start(s:SimState,players:Player[],bank:Prompt[],random=Math.random){if(!['lobby','finished'].includes(s.phase)||players.length<2||players.length>10)return false;const unique=bank.filter((p,i,a)=>a.findIndex(x=>x.id===p.id)===i);if(unique.length<10)return false;Object.assign(s,{players:players.map(p=>({...p})),prompts:shuffled(unique,random).slice(0,10),scores:Object.fromEntries(players.map(p=>[p.id,0])),round:1,phase:'answering',answers:[],ranking:[],judgingOrder:[],authorForToken:{},roundPoints:{}});return true;}
export function submit(s:SimState,playerId:string,text:string,id:string){if(s.phase!=='answering'||!s.players.some(p=>p.id===playerId)||typeof text!=='string'||!text.trim())return false;const previous=s.answers.find(a=>a.playerId===playerId);if(previous)previous.text=text.trim().slice(0,280);else s.answers.push({id,playerId,text:text.trim().slice(0,280)});return true;}
export function beginJudging(s:SimState,random=Math.random){
 if(s.phase!=='answering'||!s.answers.length)return false;
 // Assign new tokens after shuffling. A token never encodes an author, an
 // original answer ID, or the order in which the submission came in.
 s.rankingVersion++;
 const sources=shuffled(s.answers,random).map((a,i)=>[`choice-${s.rankingVersion}-${i}`,a.playerId] as const);
 s.authorForToken=Object.fromEntries(sources);
 s.judgingOrder=sources.map(([token])=>token);
 s.phase='judging';
 return true;
}
const validRanking=(s:SimState,ids:string[],version:number)=>s.phase==='judging'&&version===s.rankingVersion&&Array.isArray(ids)&&ids.length===s.judgingOrder.length&&new Set(ids).size===ids.length&&ids.every(id=>s.judgingOrder.includes(id));
export function proposeRanking(s:SimState,ids:string[],version:number){
 if(!validRanking(s,ids,version))return false;
 s.judgingOrder=[...ids];s.rankingVersion++;return true;
}
export function rank(s:SimState,ids:string[],version:number){
 if(!validRanking(s,ids,version))return false;
 s.ranking=[...ids];s.rankingVersion++;
 s.roundPoints=Object.fromEntries(s.players.map(p=>[p.id,0]));
 for(const [i,id] of ids.entries()){
  const playerId=s.authorForToken[id],points=ids.length-i;
  s.roundPoints[playerId]=points;s.scores[playerId]=(s.scores[playerId]??0)+points;
 }
 s.phase='reveal';return true;
}
export function next(s:SimState){if(s.phase!=='reveal')return false;if(s.round===10){s.phase='finished';return true;}s.round++;s.phase='answering';s.answers=[];s.ranking=[];s.judgingOrder=[];s.authorForToken={};s.roundPoints={};return true;}
export function promptText(s:SimState){return(s.prompts[s.round-1]?.text??'').replaceAll('{name}',s.guest);}
const answerFor=(s:SimState,token:string)=>s.answers.find(a=>a.playerId===s.authorForToken[token])!;
const anonymousOrder=(s:SimState)=>s.phase==='judging'?s.judgingOrder.map(id=>({id,text:answerFor(s,id).text})):[];
export function publicState(s:SimState){return{phase:s.phase,guest:s.guest,round:s.round,totalRounds:10,prompt:promptText(s),category:s.prompts[s.round-1]?.category??'',answerCount:s.answers.length,rankingVersion:s.rankingVersion,judgingAnswers:anonymousOrder(s),players:s.players.map(p=>({...p,score:s.scores[p.id]??0,submitted:s.answers.some(a=>a.playerId===p.id),points:s.roundPoints[p.id]??0})),reveal:['reveal','finished'].includes(s.phase)?s.ranking.map(id=>{const a=answerFor(s,id);return{name:s.players.find(p=>p.id===a.playerId)?.name??'Player',text:a.text,points:s.roundPoints[a.playerId]};}):[]};}
export function judgeState(s:SimState){return{phase:s.phase,guest:s.guest,round:s.round,prompt:promptText(s),rankingVersion:s.rankingVersion,answers:anonymousOrder(s)};}
export type PublicState=ReturnType<typeof publicState>;export type JudgeState=ReturnType<typeof judgeState>;
