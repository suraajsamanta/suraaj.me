export type Clue={prompt:string;answer?:string;choices?:string[];aliases?:string[];manual?:boolean};
export type Deck={title:string;categories:{name:string;clues:Clue[]}[];final?:Clue&{category:string}};
export type Seat={id:string;name:string;connected:boolean};
export type Question=Clue&{round:string;points:number;start:boolean};
export type Run={phase:'round'|'answer'|'review'|'reveal'|'results';index:number;players:Seat[];scores:Record<string,number>;answers:Record<string,string>;marks:Record<string,boolean>;deadline:number|null;version:number};
const norm=(x:string)=>x.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/^\s*(what|who)\s+(is|are|was|were)\s+/,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const correct=(c:Clue,x:string)=>!c.manual&&!!norm(x)&&[c.answer,...c.aliases??[]].some(a=>a&&norm(a)===norm(x));
export function parseDeck(text:string):Deck{
 const r=JSON.parse(text);
 const str=(x:unknown,n:number)=>{if(typeof x!=='string'||!x.trim()||x.length>n)throw Error('Required text is empty or too long.');return x.trim();};
 const clue=(x:Record<string,unknown>):Clue=>{
  const c:Clue={prompt:str(x?.prompt,400),...(x?.manual===true?{manual:true}:{answer:str(x?.answer,160)}),aliases:Array.isArray(x?.aliases)?x.aliases.slice(0,16).map(a=>str(a,160)):[]};
  if(x?.choices!==undefined){if(!Array.isArray(x.choices)||x.choices.length<2||x.choices.length>8)throw Error('Include 2–8 choices.');c.choices=x.choices.map(a=>str(a,160));if(new Set(c.choices.map(norm)).size!==c.choices.length||c.choices.some(a=>!norm(a)))throw Error('Choices must be distinct.');if(!c.manual&&c.choices.filter(a=>correct(c,a)).length!==1)throw Error('Exactly one choice must match the answer.');}return c;
 };
 if(!Array.isArray(r?.categories)||r.categories.length<1||r.categories.length>6)throw Error('Include 1–6 rounds.');
 return {title:str(r.title,70),categories:r.categories.map((x:{name:unknown;clues:Record<string,unknown>[]})=>{if(!Array.isArray(x?.clues)||x.clues.length<1||x.clues.length>5)throw Error('Include 1–5 clues per round.');return {name:str(x.name,36),clues:x.clues.map(clue)};}),...(r.final?{final:{...clue(r.final),category:str(r.final.category,36)}}:{})};
}
export function makeQueue(d:Deck,random=Math.random):Question[]{
 const shuffle=(c:Clue)=>{if(!c.choices)return c;const choices=[...c.choices];for(let i=choices.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[choices[j],choices[i]]=[choices[i],choices[j]];}return {...c,choices};};
 return [...d.categories.flatMap(c=>c.clues.map((q,i)=>({...shuffle(q),round:c.name,points:100*(i+1),start:i===0}))),...(d.final?[{...shuffle(d.final),round:d.final.category,points:500,start:true}]:[])];
}
export const newRun=(players:Seat[],version:number):Run=>({phase:'round',index:0,players:players.filter(p=>p.connected),scores:{},answers:{},marks:{},deadline:null,version});
export function move(g:Run,queue:Question[],actor:string,input:unknown,now=Date.now()):Run{
 const c=queue[g.index];if(!c||!input||typeof input!=='object')return g;const a=input as {type?:unknown;value?:unknown;version?:unknown};if(a.version!==g.version)return g;
 const next=(patch:Partial<Run>):Run=>({...g,...patch,version:g.version+1});
 if(actor!=='host'){
  if(g.phase!=='answer'||a.type!=='answer'||!g.players.some(p=>p.id===actor)||Object.hasOwn(g.answers,actor)||typeof a.value!=='string'||now>(g.deadline??0))return g;
  const v=a.value.trim();return v&&v.length<=160&&(!c.choices||c.choices.includes(v))?{...g,answers:{...g.answers,[actor]:v}}:g;
 }
 if((g.phase==='round'&&a.type==='open')||(g.phase==='reveal'&&a.type==='next')){
  const index=g.index+Number(g.phase==='reveal');if(index===queue.length)return next({phase:'results'});
  if(g.phase==='reveal'&&queue[index].start)return next({index,phase:'round',answers:{},marks:{},deadline:null});
  return next({index,phase:'answer',answers:{},marks:{},deadline:now+30000});
 }
 if(g.phase==='answer'&&a.type==='close')return next({phase:'review',deadline:null,marks:Object.fromEntries(Object.entries(g.answers).map(([id,v])=>[id,Boolean(correct(c,v))]))});
 if(g.phase==='review'&&a.type==='mark'&&typeof a.value==='string'&&Object.hasOwn(g.answers,a.value))return {...g,marks:{...g.marks,[a.value]:!g.marks[a.value]}};
 if(g.phase==='review'&&a.type==='reveal')return next({phase:'reveal',scores:Object.fromEntries(g.players.map(p=>[p.id,(g.scores[p.id]??0)+(g.marks[p.id]?c.points:0)]))});
 return g;
}
export function publicRun(g:Run,q:Question[],title:string){
 const c=q[g.index];
 return {title,phase:g.phase,index:g.index,total:q.length,round:c.round,points:c.points,players:g.players,scores:g.scores,version:g.version,deadline:g.deadline,submitted:Object.keys(g.answers),...(['answer','review','reveal'].includes(g.phase)?{prompt:c.prompt,choices:c.choices}:{}),...(g.phase==='reveal'?{answer:c.answer,answers:g.answers,marks:g.marks}:{})};
}
export type PublicRun=ReturnType<typeof publicRun>;
