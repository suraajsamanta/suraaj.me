"use client";
import { useEffect, useRef } from "react";
import { ARENAS, SIDE, type ArenaState } from "./engine";

export default function ArenaCanvas({state}:{state:ArenaState}){
  const canvas=useRef<HTMLCanvasElement>(null);
  const current=useRef(state);
  useEffect(()=>{current.current=state;},[state]);
  useEffect(()=>{
    const el=canvas.current;
    const ctx=el?.getContext("2d");
    if(!el||!ctx)return;
    let frame=0;
    const draw=(time:number)=>{
      const s=current.current;
      const width=el.clientWidth,height=el.clientHeight;
      if(width&&height){
        const scale=Math.min(window.devicePixelRatio||1,2);
        if(el.width!==Math.round(width*scale)||el.height!==Math.round(height*scale)){
          el.width=Math.round(width*scale);el.height=Math.round(height*scale);
        }
        ctx.setTransform(scale,0,0,scale,0,0);
        const tint=ARENAS.find(a=>a.id===s.arenaId)?.color??"#fb7140";
        const cell=Math.min(width*.78,height*.80)/SIDE;
        const size=cell*SIDE,left=(width-size)/2,top=(height-size)/2;
        const bg=ctx.createRadialGradient(width*.5,height*.6,10,width*.5,height*.6,Math.max(width,height)*.6);
        bg.addColorStop(0,tint+"55");bg.addColorStop(1,"#0b0b1a");
        ctx.fillStyle=bg;ctx.fillRect(0,0,width,height);
        ctx.fillStyle="#ffffff13";
        for(let x=14;x<width;x+=21)for(let y=14;y<height;y+=21)ctx.fillRect(x,y,2,2);
        s.floor.tiles.forEach((t,i)=>{
          const x=left+(i%SIDE)*cell,y=top+Math.floor(i/SIDE)*cell;
          const gap=Math.max(2,cell*.08);
          if(t===2){
            ctx.fillStyle="#0a071b88";ctx.fillRect(x+gap,y+gap,cell-gap*2,cell-gap*2);return;
          }
          ctx.fillStyle=t===1?(Math.sin(time*.018)>.1?"#fff3a5":"#ff654e"):i%2?"#252b47":"#343956";
          ctx.beginPath();ctx.roundRect(x+gap*.5,y+gap*.5,cell-gap,cell-gap,Math.min(6,cell*.13));ctx.fill();
          ctx.strokeStyle=t===1?"#fff3a5":tint+"55";ctx.lineWidth=t===1?2:1;ctx.stroke();
          if(t===1){ctx.fillStyle="#201328";ctx.font=`900 ${cell*.52}px system-ui`;ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("!",x+cell/2,y+cell/2);}
        });
        for(const p of s.players){
          if(!p.alive)continue;
          const x=left+p.x*cell,y=top+p.y*cell;
          const lift=Math.max(0,Math.sin(p.airborne/.42*Math.PI))*cell*.62;
          ctx.fillStyle="#07051299";ctx.beginPath();ctx.ellipse(x,y+cell*.14,cell*.43,cell*.23,0,0,Math.PI*2);ctx.fill();
          ctx.fillStyle=p.color;ctx.strokeStyle="#ffffffdd";ctx.lineWidth=2;
          ctx.beginPath();ctx.roundRect(x-cell*.38,y-lift-cell*.36,cell*.76,cell*.72,cell*.24);ctx.fill();ctx.stroke();
          ctx.fillStyle="#171729";
          for(const e of [-1,1]){ctx.beginPath();ctx.arc(x+e*cell*.14,y-lift-cell*.05,cell*.055,0,Math.PI*2);ctx.fill();}
          ctx.font=`800 ${Math.max(12,cell*.31)}px system-ui`;ctx.textAlign="center";ctx.textBaseline="alphabetic";
          ctx.lineWidth=4;ctx.strokeStyle="#101020";ctx.strokeText(p.name,x,y-lift-cell*.50,cell*3.2);
          ctx.fillStyle="#fff";ctx.fillText(p.name,x,y-lift-cell*.50,cell*3.2);
        }
        ctx.textAlign="left";ctx.textBaseline="top";ctx.fillStyle="#fff";ctx.font="800 14px system-ui";ctx.fillText(`ROUND ${s.round}  /  ${s.players.filter(p=>p.alive).length} LEFT`,16,14);
        if(s.phase==="countdown"||s.phase==="roundOver"){
          const label=s.phase==="countdown"?String(Math.max(1,Math.ceil(s.phaseTime))):s.announcement;
          ctx.fillStyle="#07061199";ctx.fillRect(0,height*.34,width,height*.32);
          ctx.font=`900 ${Math.min(width*.11,height*.14)}px system-ui`;ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillStyle=s.phase==="countdown"?tint:"#fff";ctx.fillText(label,width/2,height/2,width*.89);
        }
      }
      frame=requestAnimationFrame(draw);
    };
    frame=requestAnimationFrame(draw);
    return ()=>cancelAnimationFrame(frame);
  },[]);
  return <canvas ref={canvas} aria-label="Tile survival arena" style={{display:"block",width:"100%",height:"100%"}} />;
}
