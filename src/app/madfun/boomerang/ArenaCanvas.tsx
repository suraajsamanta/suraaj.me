"use client";
import {useEffect,useRef} from 'react';
import {ARENAS,WORLD_HEIGHT,WORLD_WIDTH,type ArenaState} from './engine';

export default function ArenaCanvas({state,className}:{state:ArenaState;className?:string}) {
  const canvas=useRef<HTMLCanvasElement>(null),current=useRef(state);
  useEffect(()=>{current.current=state;},[state]);
  useEffect(()=>{
    const el=canvas.current;if(!el)return;const ctx=el.getContext('2d');if(!ctx)return;let frame=0;
    const render=()=>{drawArena(ctx,current.current,performance.now()/1000);frame=requestAnimationFrame(render);};render();return()=>cancelAnimationFrame(frame);
  },[]);
  return <canvas ref={canvas} width={WORLD_WIDTH} height={WORLD_HEIGHT} className={className} aria-label="Boomerang arena. Watch your colored character on the shared screen." style={{width:'100%',height:'100%',objectFit:'contain',display:'block'}}/>;
}
function rounded(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
function drawArena(c:CanvasRenderingContext2D,s:ArenaState,t:number){
 const neon=s.arenaId==='neon',island=s.arenaId==='island',arena=ARENAS.find(a=>a.id===s.arenaId)!;
 c.clearRect(0,0,1200,760);const bg=c.createLinearGradient(0,0,1200,760);bg.addColorStop(0,neon?'#14122e':island?'#f69879':'#c6eaa3');bg.addColorStop(1,neon?'#2c1e46':island?'#c44570':'#56a58a');c.fillStyle=bg;c.fillRect(0,0,1200,760);
 // Surrounding water, garden stones or neon floor, all original code-drawn artwork.
 for(let i=0;i<50;i++){const x=(i*197)%1200,y=(i*137)%760;c.fillStyle=neon?'#7164b522':island?'#ffe0b844':'#fff5c044';c.beginPath();c.ellipse(x,y,island?30:4,4,0,0,Math.PI*2);c.fill();}
 c.shadowColor='#0005';c.shadowBlur=22;c.shadowOffsetY=12;rounded(c,35,35,1130,690,40);c.fillStyle=neon?'#252644':island?'#ffe2a5':'#d7ecbd';c.fill();c.shadowBlur=0;c.shadowOffsetY=0;
 c.save();rounded(c,35,35,1130,690,40);c.clip();c.strokeStyle=neon?'#7c6df022':island?'#d1a66022':'#8cb97b33';c.lineWidth=2;for(let x=35;x<1200;x+=60){c.beginPath();c.moveTo(x,35);c.lineTo(x,725);c.stroke();}for(let y=35;y<760;y+=60){c.beginPath();c.moveTo(35,y);c.lineTo(1165,y);c.stroke();}
 if(s.safeInset>0){c.fillStyle=`rgba(255,65,106,${.3+Math.sin(t*7)*.05})`;const k=s.safeInset;c.fillRect(0,0,1200,k);c.fillRect(0,760-k,1200,k);c.fillRect(0,k,k,760-2*k);c.fillRect(1200-k,k,k,760-2*k);c.strokeStyle='#ff496f';c.lineWidth=5;c.strokeRect(k,k,1200-2*k,760-2*k);}
 c.restore();
 // Low geometric cover: rim, shadow, top surface and a distinct track motif.
 for(const o of arena.obstacles){c.fillStyle='#0a10252b';rounded(c,o.x+6,o.y+12,o.w,o.h,18);c.fill();c.fillStyle=neon?'#4f397e':island?'#bf8259':'#568b64';rounded(c,o.x,o.y,o.w,o.h,18);c.fill();c.fillStyle=neon?'#7c5cb1':island?'#dbab76':'#86b77c';rounded(c,o.x+3,o.y-7,o.w-6,o.h-8,15);c.fill();c.strokeStyle=neon?'#fc8def':island?'#f5d297':'#b3d99b';c.lineWidth=3;rounded(c,o.x+9,o.y,o.w-18,o.h-22,10);c.stroke();c.font='30px sans-serif';c.textAlign='center';c.fillStyle=neon?'#fbd1ff':'#fff9d7';c.fillText(neon?'✦':island?'☀':'✿',o.x+o.w/2,o.y+o.h/2+7);}
 for(const p of s.players){
   if(!p.alive){c.globalAlpha=.4;c.strokeStyle=p.color;c.lineWidth=4;c.beginPath();c.arc(p.x,p.y,18,0,Math.PI*2);c.moveTo(p.x-8,p.y-8);c.lineTo(p.x+8,p.y+8);c.moveTo(p.x+8,p.y-8);c.lineTo(p.x-8,p.y+8);c.stroke();c.globalAlpha=1;continue;}
   const bob=Math.sin(t*7+s.players.indexOf(p))*2;c.fillStyle='#13172f35';c.beginPath();c.ellipse(p.x,p.y+24,25,9,0,0,Math.PI*2);c.fill();
   if(p.dashTime>0){c.strokeStyle=p.color;c.lineWidth=12;c.globalAlpha=.35;c.beginPath();c.moveTo(p.x-p.dx*60,p.y-p.dy*60);c.lineTo(p.x,p.y);c.stroke();c.globalAlpha=1;}
   c.save();c.translate(p.x,p.y+bob);c.strokeStyle='#24203f';c.lineWidth=3.5;
   // Squishy original dumpling/toy fighter with expressive face and tiny feet.
   c.fillStyle='#24203f';rounded(c,-19,16,13,10,5);c.fill();rounded(c,6,16,13,10,5);c.fill();
   c.fillStyle=p.color;c.beginPath();c.moveTo(-24,12);c.bezierCurveTo(-31,-13,-15,-30,0,-32);c.bezierCurveTo(16,-30,31,-12,24,12);c.quadraticCurveTo(0,31,-24,12);c.fill();c.stroke();
   c.fillStyle='#ffffff44';c.beginPath();c.ellipse(-10,-16,7,4,-.6,0,Math.PI*2);c.fill();
   const ex=p.dx*4,ey=p.dy*3;c.fillStyle='#fff';for(const x of [-8,8]){c.beginPath();c.ellipse(x+ex,-4+ey,7,9,0,0,Math.PI*2);c.fill();c.fillStyle='#22203b';c.beginPath();c.arc(x+ex+p.dx*2,-3+ey+p.dy*2,3,0,Math.PI*2);c.fill();c.fillStyle='#fff';}c.strokeStyle='#34233a';c.lineWidth=2;c.beginPath();c.arc(ex,5+ey,5,0,Math.PI);c.stroke();
   if(p.shield>0){c.strokeStyle='#ffffffbb';c.lineWidth=3;c.beginPath();c.arc(0,-1,35,0,Math.PI*2);c.stroke();}
   c.restore();
   c.font='bold 17px system-ui,sans-serif';c.textAlign='center';const label=p.name.length>22?p.name.slice(0,21)+'…':p.name;const width=Math.min(270,c.measureText(label).width+22);c.fillStyle='#17182bd9';rounded(c,p.x-width/2,p.y-66,width,26,10);c.fill();c.fillStyle='#fff';c.fillText(label,p.x,p.y-47);
   if(!s.boomerangs.some(b=>b.owner===p.id)){c.fillStyle=p.color;c.beginPath();c.arc(p.x+27,p.y+14,5,0,Math.PI*2);c.fill();}
 }
 for(const b of s.boomerangs){const owner=s.players.find(p=>p.id===b.owner);c.save();c.translate(b.x,b.y);c.rotate(t*23);c.shadowColor=owner?.color??'#fff';c.shadowBlur=13;c.strokeStyle='#22203b';c.lineWidth=14;c.lineCap='round';c.beginPath();c.moveTo(-13,-10);c.lineTo(0,5);c.lineTo(13,-10);c.stroke();c.strokeStyle=owner?.color??'#fff';c.lineWidth=9;c.stroke();c.shadowBlur=0;c.strokeStyle='#fff';c.lineWidth=2;c.stroke();c.restore();}
 for(const e of s.effects){const life=e.life/.65;c.globalAlpha=life;c.strokeStyle=e.color;c.lineWidth=4*life;c.beginPath();c.arc(e.x,e.y,(1-life)*65+12,0,Math.PI*2);c.stroke();if(e.kind==='hit'||e.kind==='win'){for(let i=0;i<8;i++){const a=i*Math.PI/4;c.fillStyle=i%2?e.color:'#fff';c.fillRect(e.x+Math.cos(a)*(1-life)*90,e.y+Math.sin(a)*(1-life)*90,8,8);}}c.globalAlpha=1;}
 c.font='800 16px system-ui,sans-serif';c.textAlign='left';c.fillStyle=neon?'#d8c8ff':'#293c42';c.fillText(arena.name.toUpperCase(),59,66);c.textAlign='right';c.fillText(s.phase==='playing'&&s.time>25?'STAY INSIDE THE ARENA':`ROUND ${Math.max(1,s.round)} • FIRST TO 5`,1140,66);
 if(s.phase==='countdown'){c.fillStyle='#11152c66';c.fillRect(35,35,1130,690);c.textAlign='center';c.fillStyle='#fff';c.shadowColor='#101324';c.shadowBlur=20;c.font='900 160px system-ui,sans-serif';c.fillText(String(Math.max(1,Math.ceil(s.phaseTime))),600,420);c.shadowBlur=0;c.font='800 25px system-ui,sans-serif';c.fillText('MOVE · THROW · DODGE',600,470);}
 if(s.phase==='roundOver'||s.phase==='matchOver'){c.fillStyle='#11152ca6';c.fillRect(35,35,1130,690);c.textAlign='center';c.fillStyle='#ffe785';c.font='900 48px system-ui,sans-serif';c.fillText(s.phase==='matchOver'?'CHAMPION!':'ROUND COMPLETE',600,325);c.fillStyle='#fff';c.font='800 32px system-ui,sans-serif';const message=s.announcement.length>45?s.announcement.slice(0,44)+'…':s.announcement;c.fillText(message,600,385);c.font='600 21px system-ui,sans-serif';c.fillText(s.phase==='matchOver'?'One more? Rematch from the host screen.':'Next round coming up…',600,435);}
}
