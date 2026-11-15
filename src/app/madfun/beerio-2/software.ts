import { course, ROAD_WIDTH, type Point } from './course';

type CarPose = { x: number; y: number; z: number; yaw: number; boost: boolean; color?: string };
type State = CarPose & { camera: Point; look: Point; rivals?: readonly CarPose[] };
type Face = { points: Point[]; color: string };
/** A real perspective/painter renderer for browsers without any GPU context. */
export function createSoftwareView(ctx: CanvasRenderingContext2D): (state: State) => void {
  const world: Face[] = [];
  const face = (points: Point[], color: string, list = world) => list.push({ points, color });
  const p = (x: number, y: number, z: number): Point => ({ x, y, z });
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, colors: string[], list = world) => {
    const a=p(x-w/2,y,z-d/2),b=p(x+w/2,y,z-d/2),c=p(x+w/2,y,z+d/2),e=p(x-w/2,y,z+d/2);
    const A=p(a.x,y+h,a.z),B=p(b.x,y+h,b.z),C=p(c.x,y+h,c.z),E=p(e.x,y+h,e.z);
    face([a,b,B,A],colors[0],list);face([b,c,C,B],colors[1]||colors[0],list);
    face([c,e,E,C],colors[0],list);face([e,a,A,E],colors[1]||colors[0],list);
    face([A,B,C,E],colors[2]||colors[0],list);
  };
  const offsets=course.map((pt,i)=>{const a=course[(i+course.length-1)%course.length],b=course[(i+1)%course.length];const d=Math.hypot(b.x-a.x,b.z-a.z);return p((b.z-a.z)/d,0,-(b.x-a.x)/d);});
  const edge=(i:number,off:number,lift=0)=>p(course[i].x+offsets[i].x*off,course[i].y+lift,course[i].z+offsets[i].z*off);
  for(let i=0;i<course.length;i++) {
    const j=(i+1)%course.length;
    const ribbon=(a:number,b:number,lift:number,color:string)=>face([edge(i,a,lift),edge(j,a,lift),edge(j,b,lift),edge(i,b,lift)],color);
    ribbon(-7.4,7.4,-.06,'#314354'); ribbon(-ROAD_WIDTH/2,ROAD_WIDTH/2,0,i%2?'#1b2a3b':'#1c2c3d');
    ribbon(-6.95,-6.8,.03,'#54cfff');ribbon(6.8,6.95,.03,'#67ffd5');
    ribbon(-5.8,-5.68,.035,'#b8dae0');ribbon(5.68,5.8,.035,'#b8dae0');
    if(i%3===0)ribbon(-.075,.075,.05,'#d8b769');
    if(i%4===0)ribbon(2.2,2.5,.025,'#2e5366');
    if(i%8===0){for(const s of [-1,1]){const a=edge(i,s*8.3);box(a.x,a.y,a.z,.13,6.7,.13,['#344b5e']);box(a.x,a.y+6.7,a.z,.7,.1,.7,['#ffe4b0']);}}
    if(i%7===0&&course[i].y>3){const a=course[i];box(a.x,0,a.z,1.3,a.y,2,['#233a4e']);}
  }
  let seed=81;const rand=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
  const buildings=[[-26,36,13,13,37],[-8,43,11,14,56],[7,47,11,12,42],[-38,48,9,14,24],[23,43,10,11,30],[-13,62,12,10,28],[-43,20,9,10,19],[32,-29,13,14,23],[12,-42,14,10,16],[-12,-52,12,9,12]];
  for(let i=0;i<20;i++){const a=i/20*Math.PI*2;buildings.push([Math.cos(a)*145,Math.sin(a)*145,14,12,18+rand()*48]);}
  for(const [x,z,w,d,h] of buildings){
    box(x,0,z,w,h,d,['#182d43','#213b50','#355165']);
    for(let y=3;y<h-2;y+=4)for(let k=-w/2+1;k<w/2;k+=3){if(rand()<.28)continue;const color=rand()<.75?'#d1bb91':'#61a9c4';
      face([p(x+k,y,z-d/2-.03),p(x+k+1.1,y,z-d/2-.03),p(x+k+1.1,y+1,z-d/2-.03),p(x+k,y+1,z-d/2-.03)],color);
      face([p(x+k,y,z+d/2+.03),p(x+k+1.1,y,z+d/2+.03),p(x+k+1.1,y+1,z+d/2+.03),p(x+k,y+1,z+d/2+.03)],color);
    }
  }
  // Space Needle's unmistakable hourglass legs and broad saucer.
  for(let i=0;i<3;i++){const a=i*Math.PI*2/3;const x=Math.cos(a),z=Math.sin(a);face([p(15+x*7,0,5+z*7),p(15+x*1.8,29,5+z*1.8),p(15+x*5,49,5+z*5),p(15+x*5+.6,49,5+z*5),p(15+x*1.8+.6,29,5+z*1.8),p(15+x*7+.8,0,5+z*7)],'#bbd8d9');}
  const ring=(y:number,r:number)=>Array.from({length:20},(_,i)=>p(15+Math.cos(i*Math.PI/10)*r,y,5+Math.sin(i*Math.PI/10)*r));
  const rings=[ring(47,2.5),ring(50,8),ring(52,8),ring(52.3,9),ring(54.2,2.5)];
  for(let j=0;j<rings.length-1;j++)for(let i=0;i<20;i++)face([rings[j][i],rings[j][(i+1)%20],rings[j+1][(i+1)%20],rings[j+1][i]],['#adc5cd','#275b6c','#ffe0a1','#d0e3e3'][j]);
  box(15,54,5,.35,12,.35,['#a6d5dd']);box(15,66,5,.5,.5,.5,['#fc6bba']);
  // Waterfront and evergreen park silhouettes.
  face([p(-300,-.1,135),p(300,-.1,135),p(300,-.1,400),p(-300,-.1,400)],'#11324a');
  for(const [x,z] of [[-46,-44],[-45,-5],[36,13],[36,26],[-40,64],[-20,-6],[3,-24]]){box(x,0,z,.4,2,.4,['#254346']);face([p(x-2.5,1,z),p(x,8,z),p(x+2.5,1,z)],'#1d5550');face([p(x,1,z-2.5),p(x,8,z),p(x,1,z+2.5)],'#21483f');}

  return (s:State)=>{
    const w=ctx.canvas.width,h=ctx.canvas.height;
    if(!w||!h)return;
    ctx.setTransform(1,0,0,1,0,0);
    const sky=ctx.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#080c22');sky.addColorStop(.55,'#243f5e');sky.addColorStop(.8,'#182c3b');sky.addColorStop(1,'#0c1824');ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
    const moonX=w*.77,moonY=h*.18;const moon=ctx.createRadialGradient(moonX,moonY,1,moonX,moonY,h*.2);moon.addColorStop(0,'#9ac9e51f');moon.addColorStop(1,'#9ac9e500');ctx.fillStyle=moon;ctx.fillRect(0,0,w,h);
    ctx.fillStyle='#e0eaf2';ctx.beginPath();ctx.arc(moonX,moonY,h*.012,0,Math.PI*2);ctx.fill();
    let fx=s.look.x-s.camera.x,fy=s.look.y-s.camera.y,fz=s.look.z-s.camera.z;const fl=Math.hypot(fx,fy,fz);fx/=fl;fy/=fl;fz/=fl;
    const rl=Math.hypot(fx,fz),rx=fz/rl,rz=-fx/rl;
    const ux=-rz*fy,uy=rz*fx-rx*fz,uz=rx*fy; // down-vector for canvas coordinates
    const focal=h/(2*Math.tan((w<h?.93:.76)/2));
    const camera=(a:Point)=>{const x=a.x-s.camera.x,y=a.y-s.camera.y,z=a.z-s.camera.z;return p(x*rx+z*rz,x*ux+y*uy+z*uz,x*fx+y*fy+z*fz);};
    const polys:{points:Point[];color:string;depth:number}[]=[];
    const enqueue=(f:Face)=>{
      let points=f.points.map(camera);if(points.every(a=>a.z<.6)||points.every(a=>a.z>360))return;
      const clipped:Point[]=[];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];if(a.z>=.6)clipped.push(a);if((a.z>=.6)!==(b.z>=.6)){const t=(.6-a.z)/(b.z-a.z);clipped.push(p(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,.6));}}
      points=clipped;if(points.length<3)return;
      polys.push({points,color:f.color,depth:points.reduce((n,a)=>n+a.z,0)/points.length});
    };
    world.forEach(enqueue);
    // Coupe body is projected in the same 3D space, not a fixed dashboard sprite.
    const addCar = (pose: CarPose) => {
      const car:Face[]=[];const cp=(x:number,y:number,z:number)=>p(pose.x+x*Math.cos(pose.yaw)+z*Math.sin(pose.yaw),pose.y+y,pose.z-x*Math.sin(pose.yaw)+z*Math.cos(pose.yaw));
      const cf=(points:number[][],color:string)=>face(points.map(a=>cp(a[0],a[1],a[2])),color,car);
      // Soft ground shadow, four chunky tires, flared body, glass and spoiler.
      cf([[-1.3,.05,-2.5],[1.3,.05,-2.5],[1.3,.05,2.1],[-1.3,.05,2.1]],'#0a111b');
      for(const side of [-1,1])for(const z of [-1.35,1.25]){
        cf([[side*1.06,.15,z-.5],[side*1.06,.8,z-.5],[side*1.06,.8,z+.5],[side*1.06,.15,z+.5]],'#070d16');
        cf([[side*1.09,.28,z-.3],[side*1.09,.65,z-.3],[side*1.09,.65,z+.3],[side*1.09,.28,z+.3]],'#526376');
      }
      const paint = pose.color && /^#[0-9a-f]{6}$/i.test(pose.color) ? pose.color : null;
      cf([[-1,.4,-2],[1,.4,-2],[1.05,1,-1.65],[-1.05,1,-1.65]],paint ?? '#3b84b9');
      cf([[-1.05,1,-1.65],[1.05,1,-1.65],[.97,1,1.8],[-.97,1,1.8]],paint ?? '#5fc5f3');
      for(const side of [-1,1])cf([[side, .4,-2],[side*.97,.4,1.85],[side*.97,1,1.8],[side*1.05,1,-1.65]],paint ?? (side<0?'#2e709a':'#4da7ce'));
      cf([[-.8,1,-1.25],[.8,1,-1.25],[.68,1.65,-.25],[-.68,1.65,-.25]],'#122e46');
      cf([[-.68,1.65,-.25],[.68,1.65,-.25],[.66,1.65,.65],[-.66,1.65,.65]],paint ?? '#6bd3fa');
      for(const side of [-1,1])cf([[side*.8,1,-1.25],[side*.68,1.65,-.25],[side*.66,1.65,.65],[side*.8,1,1.2]],'#16394c');
      cf([[-.8,1,1.2],[.8,1,1.2],[.66,1.65,.65],[-.66,1.65,.65]],'#15374d');
      cf([[-.92,.71,-2.025],[.92,.71,-2.025],[.92,.85,-2.025],[-.92,.85,-2.025]],'#ff4e97');
      cf([[-.25,.47,-2.03],[.25,.47,-2.03],[.25,.66,-2.03],[-.25,.66,-2.03]],'#d9e6ef');
      cf([[-1.14,1.11,-1.8],[1.14,1.11,-1.8],[1.14,1.18,-1.45],[-1.14,1.18,-1.45]],'#15344d');
      if(pose.boost)for(const side of [-1,1])cf([[side*.7-.12,.4,-2],[side*.7+.12,.4,-2],[side*.7+.06,.3,-3.6],[side*.7-.06,.3,-3.6]],'#72efff');
      car.forEach(enqueue);
    };
    addCar(s);
    s.rivals?.forEach(addCar);
        polys.sort((a,b)=>b.depth-a.depth);
    for(const f of polys){ctx.beginPath();for(let i=0;i<f.points.length;i++){const a=f.points[i],x=w/2+a.x*focal/a.z,y=h/2+a.y*focal/a.z;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.closePath();ctx.fillStyle=f.color;ctx.fill();}
    // Faint cinematic edge vignette; all controls remain outside this canvas.
    const vignette=ctx.createRadialGradient(w/2,h*.5,h*.2,w/2,h*.5,Math.max(w,h)*.7);vignette.addColorStop(0,'#00000000');vignette.addColorStop(1,'#02091688');ctx.fillStyle=vignette;ctx.fillRect(0,0,w,h);
  };
}
