export type Prompt={id:string;category:string;text:string};export type Player={id:string;name:string};export type Answer={id:string;playerId:string;text:string};
type Seat=Player&{eligibleFromRound:number;connected:boolean};
export type RankingDrag={id:string;position:number};
type RankingPreview={ids:string[];drag:RankingDrag};
export const ANSWER_TIME_MS=45000;
export type SimState={phase:'lobby'|'answering'|'judging'|'reveal'|'finished';guest:string;round:number;deadline:number|null;prompts:Prompt[];players:Seat[];answers:Answer[];ranking:string[];judgingOrder:string[];rankingVersion:number;rankingPreview:RankingPreview|null;authorForToken:Record<string,string>;scores:Record<string,number>;roundPoints:Record<string,number>};
export function newGame(guest:string):SimState{return{phase:'lobby',guest:guest.trim().slice(0,50)||'Our guest',round:0,deadline:null,prompts:[],players:[],answers:[],ranking:[],judgingOrder:[],rankingVersion:0,rankingPreview:null,authorForToken:{},scores:{},roundPoints:{}};}
export function shuffled<T>(items:T[],random=Math.random){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export function start(s:SimState,players:Player[],bank:Prompt[],random=Math.random,now=Date.now()){if(!['lobby','finished'].includes(s.phase)||players.length<2||players.length>10)return false;const unique=bank.filter((p,i,a)=>a.findIndex(x=>x.id===p.id)===i);if(unique.length<10)return false;Object.assign(s,{players:players.map(({id,name})=>({id,name,eligibleFromRound:1,connected:true})),prompts:shuffled(unique,random).slice(0,10),scores:Object.fromEntries(players.map(p=>[p.id,0])),round:1,phase:'answering',deadline:now+ANSWER_TIME_MS,answers:[],ranking:[],judgingOrder:[],rankingPreview:null,authorForToken:{},roundPoints:{}});return true;}
export function syncPlayers(s:SimState,connectedPlayers:Player[]){
 if(s.phase==='lobby'||s.phase==='finished')return false;
 const connected=new Map(connectedPlayers.map(({id,name})=>[id,name]));
 let changed=false;
 for(const player of s.players){
  const online=connected.has(player.id);
  if(player.connected!==online){player.connected=online;changed=true;}
  connected.delete(player.id);
 }
 for(const [id,name] of connected){
  s.players.push({id,name,eligibleFromRound:s.round+1,connected:true});
  s.scores[id]=0;changed=true;
 }
 return changed;
}
const eligible=(s:SimState,p:Seat)=>s.round>=p.eligibleFromRound;
export function submit(s:SimState,playerId:string,text:string,id:string,now=Date.now()){if(s.phase!=='answering'||s.deadline===null||now>=s.deadline||!s.players.some(p=>p.id===playerId&&p.connected&&eligible(s,p))||typeof text!=='string'||!text.trim())return false;const previous=s.answers.find(a=>a.playerId===playerId);if(previous)previous.text=text.trim().slice(0,280);else s.answers.push({id,playerId,text:text.trim().slice(0,280)});return true;}
export function beginJudging(s:SimState,random=Math.random){
 if(s.phase!=='answering'||!s.answers.length)return false;
 // Assign new tokens after shuffling. A token never encodes an author, an
 // original answer ID, or the order in which the submission came in.
 s.rankingVersion++;
 const sources=shuffled(s.answers,random).map((a,i)=>[`choice-${s.rankingVersion}-${i}`,a.playerId] as const);
 s.authorForToken=Object.fromEntries(sources);
 s.judgingOrder=sources.map(([token])=>token);
 s.rankingPreview=null;
 s.phase='judging';s.deadline=null;
 return true;
}
export function expireAnswering(s:SimState,now=Date.now()){
 if(s.phase!=='answering'||s.deadline===null||now<s.deadline)return false;
 if(s.answers.length)return beginJudging(s);
 s.phase='reveal';s.deadline=null;s.roundPoints=Object.fromEntries(s.players.map(p=>[p.id,0]));
 return true;
}
const validRanking=(s:SimState,ids:unknown,version:number):ids is string[]=>s.phase==='judging'&&version===s.rankingVersion&&Array.isArray(ids)&&ids.length===s.judgingOrder.length&&new Set(ids).size===ids.length&&ids.every(id=>s.judgingOrder.includes(id));
// A drag is transient: project its order without changing the settled order or
// advancing the version. That lets the judge send multiple moves in one gesture.
export function previewRanking(s:SimState,ids:unknown,version:number,drag:unknown){
 if(!validRanking(s,ids,version)||!drag||typeof drag!=='object'||Array.isArray(drag))return false;
 const {id,position}=drag as Partial<RankingDrag>;
 if(typeof id!=='string'||!ids.includes(id)||typeof position!=='number'||!Number.isFinite(position)||position<0||position>ids.length-1)return false;
 const cleanPosition=Math.round(position*100)/100;
 const previous=s.rankingPreview;
 if(previous?.drag.id===id&&previous.drag.position===cleanPosition&&ids.every((item,i)=>item===previous.ids[i]))return false;
 s.rankingPreview={ids:[...ids],drag:{id,position:cleanPosition}};
 return true;
}
export function clearRankingPreview(s:SimState){
 if(!s.rankingPreview)return false;
 s.rankingPreview=null;
 return true;
}
export function proposeRanking(s:SimState,ids:string[],version:number){
 if(!validRanking(s,ids,version))return false;
 s.judgingOrder=[...ids];s.rankingPreview=null;s.rankingVersion++;return true;
}
export function rank(s:SimState,ids:string[],version:number){
 if(!validRanking(s,ids,version))return false;
 s.ranking=[...ids];s.rankingPreview=null;s.rankingVersion++;
 s.roundPoints=Object.fromEntries(s.players.map(p=>[p.id,0]));
 for(const [i,id] of ids.entries()){
  const playerId=s.authorForToken[id],points=ids.length-i;
  s.roundPoints[playerId]=points;s.scores[playerId]=(s.scores[playerId]??0)+points;
 }
 s.phase='reveal';return true;
}
export function next(s:SimState,now=Date.now()){if(s.phase!=='reveal')return false;if(s.round===10){s.phase='finished';return true;}s.round++;s.phase='answering';s.deadline=now+ANSWER_TIME_MS;s.answers=[];s.ranking=[];s.judgingOrder=[];s.rankingPreview=null;s.authorForToken={};s.roundPoints={};return true;}
export function promptText(s:SimState){return(s.prompts[s.round-1]?.text??'').replaceAll('{name}',s.guest);}
const answerFor=(s:SimState,token:string)=>s.answers.find(a=>a.playerId===s.authorForToken[token])!;
const anonymousOrder=(s:SimState)=>s.phase==='judging'?(s.rankingPreview?.ids??s.judgingOrder).map(id=>({id,text:answerFor(s,id).text})):[];
const rankingDrag=(s:SimState)=>s.phase==='judging'?s.rankingPreview?.drag??null:null;
export function publicState(s:SimState){
 const players=s.players.map(p=>({id:p.id,name:p.name,connected:p.connected,eligible:eligible(s,p),score:s.scores[p.id]??0,submitted:s.answers.some(a=>a.playerId===p.id),points:s.roundPoints[p.id]??0}));
 return{phase:s.phase,guest:s.guest,round:s.round,deadline:s.deadline,totalRounds:10,prompt:promptText(s),category:s.prompts[s.round-1]?.category??'',answerCount:s.answers.length,activePlayerCount:players.filter(p=>p.eligible&&(p.connected||p.submitted)).length,rankingVersion:s.rankingVersion,rankingDrag:rankingDrag(s),judgingAnswers:anonymousOrder(s),players,reveal:['reveal','finished'].includes(s.phase)?s.ranking.map(id=>{const a=answerFor(s,id);return{name:s.players.find(p=>p.id===a.playerId)?.name??'Player',text:a.text,points:s.roundPoints[a.playerId]};}):[]};
}
export function judgeState(s:SimState){return{phase:s.phase,guest:s.guest,round:s.round,prompt:promptText(s),rankingVersion:s.rankingVersion,rankingDrag:rankingDrag(s),answers:anonymousOrder(s)};}
export type PublicState=ReturnType<typeof publicState>;export type JudgeState=ReturnType<typeof judgeState>;
