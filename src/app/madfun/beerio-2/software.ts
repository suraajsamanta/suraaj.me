import { getTrack, type Point, type TrackId } from './course';

type CarPose = { x: number; y: number; z: number; yaw: number; boost: boolean; color?: string };
type State = CarPose & { camera: Point; look: Point; rivals?: readonly CarPose[]; speed?: number; reducedMotion?: boolean };
type Face = { points: Point[]; color: string; bx: number; bz: number; radius: number; decal?: boolean };
/** A real perspective/painter renderer for browsers without any GPU context. */
export function createSoftwareView(ctx: CanvasRenderingContext2D, trackId: TrackId = 'seattle', studio = false): (state: State) => void {
  const { points: course, roadWidth: ROAD_WIDTH } = getTrack(trackId);
  const orbit = trackId === 'orbit';
  const world: Face[] = [];
  const face = (points: Point[], color: string, list = world) => {
    let bx = 0, bz = 0; for (const a of points) { bx += a.x; bz += a.z; }
    bx /= points.length; bz /= points.length;
    let radius = 0;
    for (const a of points) radius = Math.max(radius, Math.hypot(a.x-bx,a.z-bz));
    list.push({ points, color, bx, bz, radius });
  };
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
  if (!studio) for(let i=0;i<course.length;i++) {
    const j=(i+1)%course.length;
    const ribbon=(a:number,b:number,lift:number,color:string)=>face([edge(i,a,lift),edge(j,a,lift),edge(j,b,lift),edge(i,b,lift)],color);
    ribbon(-7.4,7.4,-.06,orbit?'#50316c':'#314354'); ribbon(-ROAD_WIDTH/2,ROAD_WIDTH/2,0,orbit?(i%2?'#20183a':'#221a3e'):(i%2?'#1b2a3b':'#1c2c3d'));
    ribbon(-6.95,-6.72,.05,orbit?'#df73ff':'#54cfff');ribbon(6.72,6.95,.05,orbit?'#70e4ff':'#67ffd5');
    ribbon(-5.8,-5.68,.035,'#b8dae0');ribbon(5.68,5.8,.035,'#b8dae0');
    if(i%3===0)ribbon(-.075,.075,.05,'#d8b769');
    if(i%4===0)ribbon(2.2,2.5,.025,'#2e5366');
    if(!orbit&&i%8===0){for(const s of [-1,1]){const a=edge(i,s*8.3);box(a.x,a.y,a.z,.13,6.7,.13,['#344b5e']);box(a.x,a.y+6.7,a.z,.7,.1,.7,['#ffe4b0']);}}
    if(!orbit&&i%7===0&&course[i].y>3){const a=course[i];box(a.x,0,a.z,1.3,a.y,2,['#233a4e']);}
  }
  let seed=81;const rand=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
  const stars=Array.from({length:130},()=>({a:rand(),y:rand()*.78,r:rand(),h:rand()}));
  if (studio) {
    const ring = Array.from({length:48}, (_,i)=>p(Math.cos(i*Math.PI/24)*3.8,-.035,Math.sin(i*Math.PI/24)*3.8));
    face(ring, '#1b2b3c');
    for(let i=0;i<48;i++){const j=(i+1)%48;face([ring[i],ring[j],p(ring[j].x*.985,-.034,ring[j].z*.985),p(ring[i].x*.985,-.034,ring[i].z*.985)], '#41758a');}
  } else if (orbit) {
    for (let i=0;i<course.length;i+=18) {
      const left=edge(i,-8.2),right=edge(i,8.2);
      for(const a of [left,right]) {
        box(a.x,a.y-1,a.z,1.1,6.6,1.1,['#62378b','#30334e','#f48cff']);
        box(a.x,a.y+5.5,a.z,.65,.28,.65,['#9beeff']);
        box(a.x,a.y-5,a.z,.8,4,.8,['#252148']);
      }
      const y=left.y+5.5;
      face([p(left.x,y,left.z),p(right.x,y,right.z),p(right.x,y+.35,right.z),p(left.x,y+.35,left.z)],'#76dfff');
    }
    for (const [x,z] of [[0,0],[-24,60],[18,-37],[130,-88],[-147,65],[30,135]]) {
      box(x,-10,z,17,5,17,['#302641','#454268','#272c56']);
      box(x,-5,z,12,11,12,['#2b3558','#3e2966','#536995']);
      box(x,6,z,7,12,7,['#3a3562','#373b73','#bb91ef']);
      box(x,18,z,.28,5,.28,['#72d4fd']);
      for (const sign of [-1,1]) {
        box(x+sign*15,-2,z,14,.35,6,['#65529a','#503d98','#4e73a1']);
        for(let j=0;j<5;j++)box(x+sign*(10+j*2.4),-1.62,z,.12,.04,6,['#a8a6ee']);
      }
    }
  } else {
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

  }

  // Build local geometry once, not on every frame. Flat shaded shoulder strips
  // retain paint depth without GPU lights, gradients per face, or textures.
  const makeCar = (detailed: boolean): Face[] => {
    const car:Face[]=[];
    const cf=(points:number[][],color:string)=>face(points.map(a=>p(a[0],a[1],a[2])),color,car);
    const carbon='#101b28',glass='#092636',light='#e5ffff';
    const rows=detailed ? [
      [-2.25,.88,.79],[-2.06,1.09,.98],[-1.45,1.13,1.03],[-.88,1.08,.94],
      [.52,.99,.86],[1.28,1.08,.92],[1.82,.99,.75],[2.25,.77,.57],
    ] : [[-2.25,.88,.79],[-1.4,1.13,1.03],[.52,.99,.86],[1.3,1.08,.92],[2.25,.77,.57]];
    const sections=rows.map(([z,w,top])=>{
      const d=Math.min(Math.abs(z+1.30),Math.abs(z-1.30));
      const bottom=d<.51 ? Math.min(top-.09,.425+Math.sqrt(.51**2-d**2)) : .34;
      return [[-w*.94,bottom,z],[-w,top-.17,z],[-w*.78,top,z],[0,top+.035,z],[w*.78,top,z],[w,top-.17,z],[w*.94,bottom,z]];
    });
    for(let r=1;r<sections.length;r++)for(let i=0;i<6;i++)
      cf([sections[r-1][i],sections[r][i],sections[r][i+1],sections[r-1][i+1]],['shade','paint','highlight','paint','paint','shade'][i]);
    cf(sections[0], 'shade');cf(sections[sections.length-1], 'paint');
    // Chamfered contact patch and carbon keel sit underneath the sculpted shell.
    cf([[-.85,.025,-2.25],[.85,.025,-2.25],[1.22,.025,-1.65],[1.15,.025,1.65],[.7,.025,2.35],[-.7,.025,2.35],[-1.15,.025,1.65],[-1.22,.025,-1.65]],'#050b12');
    cf([[-1.12,.30,-2.16],[1.12,.30,-2.16],[.88,.30,2.35],[-.88,.30,2.35]],carbon);
    // Swept teardrop canopy: lower and narrower than a production coupe roof.
    cf([[-.74,1.0,-1.10],[.74,1.0,-1.10],[.51,1.37,-.47],[-.51,1.37,-.47]],glass);
    cf([[-.51,1.37,-.47],[.51,1.37,-.47],[.45,1.40,.12],[-.45,1.40,.12]],carbon);
    cf([[-.45,1.40,.12],[.45,1.40,.12],[.69,.90,1.03],[-.69,.90,1.03]],glass);
    for(const side of [-1,1]){
      cf([[side*.74,1,-1.10],[side*.51,1.37,-.47],[side*.45,1.40,.12],[side*.69,.9,1.03]],'#174252');
      cf([[side*.82,1.01,-1.22],[side*.75,1.01,-1.12],[side*.48,1.40,-.44],[side*.57,1.39,-.50]],'highlight');
      cf([[side*.7,.91,1.05],[side*.63,.94,1.04],[side*.41,1.41,.12],[side*.47,1.41,.12]],'highlight');
      // A deep triangular side tunnel and lifted rocker prevent a slab silhouette.
      cf([[side*1.065,.53,-.79],[side*1.07,.82,-.76],[side*.995,.76,.45],[side*.99,.46,.30]],carbon);
      cf([[side*1.08,.35,-.78],[side*1.01,.35,.78],[side*1.03,.41,.72],[side*1.11,.41,-.73]],'shade');
      cf([[side*1.10,.415,-.73],[side*1.025,.415,.70],[side*1.02,.44,.70],[side*1.10,.44,-.73]],'#a0f4ee');
    }
    // Long carbon arrow on the low nose and narrow ivory endurance pinstripes.
    cf([[-.31,.90,.57],[.31,.90,.57],[.15,.61,2.16],[-.15,.61,2.16]],carbon);
    for(const side of [-1,1]){
      cf([[side*.33,.905,.57],[side*.37,.905,.57],[side*.20,.615,2.16],[side*.16,.615,2.16]],'#e5f5ed');
      cf([[side*.19,1.413,.12],[side*.225,1.413,.12],[side*.25,1.383,-.47],[side*.215,1.383,-.47]],'#e5f5ed');
      cf([[side*.24,.839,-2.16],[side*.28,.839,-2.16],[side*.28,1.04,-1.46],[side*.24,1.04,-1.46]],'#e5f5ed');
    }
    // Recessed rear fascia and twin hooked laser blades, not a solid red box.
    cf([[-.87,.43,-2.27],[.87,.43,-2.27],[.88,.77,-2.27],[-.88,.77,-2.27]],carbon);
    for(const side of [-1,1]){
      cf([[side*.18,.755,-2.282],[side*.84,.755,-2.282],[side*.88,.82,-2.26],[side*.27,.80,-2.282]],'#ff4269');
      cf([[side*.83,.755,-2.283],[side*.88,.82,-2.261],[side*.89,.65,-2.275],[side*.85,.625,-2.283]],'#ff6b86');
      cf([[side*.30,.47,-2.285],[side*.63,.47,-2.285],[side*.58,.58,-2.285],[side*.35,.58,-2.285]],'#477b8c');
      cf([[side*.35,.49,-2.29],[side*.58,.49,-2.29],[side*.55,.545,-2.29],[side*.38,.545,-2.29]],'#92f7ff');
      cf([[side*.39,.63,2.22],[side*.78,.64,2.20],[side*.86,.72,1.99],[side*.71,.68,2.12]],light);
      // Swan-neck wing supports climb above the vented rear deck.
      cf([[side*.62,.97,-1.67],[side*.62,1.43,-1.88],[side*.62,1.43,-2.08],[side*.62,1.04,-1.82]],carbon);
      cf([[side*1.22,1.31,-2.29],[side*1.22,1.59,-2.24],[side*1.22,1.48,-1.83],[side*1.22,1.31,-1.85]],'shade');
      cf([[side*1.225,1.55,-2.23],[side*1.225,1.57,-2.23],[side*1.225,1.47,-1.87],[side*1.225,1.45,-1.87]],'#c1fff9');
      if(detailed)for(let j=0;j<4;j++){
        const z=-1.83+j*.14;
        cf([[side*.49,1.026,z],[side*.86,1.026,z],[side*.85,1.035,z+.065],[side*.49,1.035,z+.065]],carbon);
      }
    }
    cf([[-1.23,1.42,-2.29],[1.23,1.42,-2.29],[1.17,1.46,-1.87],[-1.17,1.46,-1.87]],carbon);
    cf([[-1.23,1.42,-2.295],[1.23,1.42,-2.295],[1.23,1.46,-2.295],[-1.23,1.46,-2.295]],'highlight');
    for(let i=-2;i<=2;i++)cf([[i*.27,.27,-2.31],[i*.27,.49,-2.27],[i*.27,.42,-1.91],[i*.27,.28,-1.91]],'#344959');
    // Twelve-sided circular tires with a dished turbine hub, never square wheels.
    const n=detailed?12:8;
    for(const side of [-1,1])for(const z of [-1.30,1.30]){
      const ring=(x:number,r:number)=>Array.from({length:n},(_,i)=>[side*x,.425+Math.cos(i*Math.PI*2/n)*r,z+Math.sin(i*Math.PI*2/n)*r]);
      const inside=ring(.89,.415),outside=ring(1.17,.415),rim=ring(1.177,.30),dish=ring(1.181,.24);
      cf(outside,'#080e17');
      for(let i=0;i<n;i++){const j=(i+1)%n;cf([inside[i],inside[j],outside[j],outside[i]],i<4?'#25313e':'#0c1520');}
      cf(rim,'#a2bac7');cf(dish,'#1a3446');
      if(detailed){
        cf([[side*1.184,.29,z-.19],[side*1.184,.55,z-.19],[side*1.184,.55,z-.12],[side*1.184,.29,z-.12]],'#ff684e');
        for(let i=0;i<6;i++){
          const a=i*Math.PI/3,b=a+.22;
          cf([[side*1.19,.425+Math.cos(a)*.07,z+Math.sin(a)*.07],[side*1.19,.425+Math.cos(a+.30)*.27,z+Math.sin(a+.30)*.27],[side*1.19,.425+Math.cos(b+.30)*.27,z+Math.sin(b+.30)*.27],[side*1.19,.425+Math.cos(b)*.07,z+Math.sin(b)*.07]],'#cfdee5');
        }
      }
      cf(ring(1.195,.08),'#7694a5');
    }
    // Painter sorting needs a small bias for these coplanar rear-fascia decals.
    // Their facing check below prevents them bleeding through the nose in studio.
    for(const f of car) if(['#ff4269','#ff6b86','#477b8c','#92f7ff'].includes(f.color)) f.decal=true;
    return car;
  };
  const heroCar=makeCar(true),farCar=makeCar(false);
  const palettes=new Map<string,Record<string,string>>();
  const paintPalette=(input?:string)=>{
    const hex=input && /^#[0-9a-f]{6}$/i.test(input)?input:'#89d9e7';
    const cached=palettes.get(hex);if(cached)return cached;
    const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
    const tint=(amount:number)=>'#'+rgb.map(v=>Math.round(amount<0?v*(1+amount):v+(255-v)*amount).toString(16).padStart(2,'0')).join('');
    const palette:Record<string,string>={paint:hex,shade:tint(-.38),highlight:tint(.31)};
    if(palettes.size>=20)palettes.clear();palettes.set(hex,palette);return palette;
  };
  let motionPhase=0;

  return (s:State)=>{
    const w=ctx.canvas.width,h=ctx.canvas.height;
    if(!w||!h)return;
    ctx.setTransform(1,0,0,1,0,0);
    const sky=ctx.createLinearGradient(0,0,0,h);sky.addColorStop(0,orbit?'#050418':'#080c22');sky.addColorStop(.55,orbit?'#291647':'#243f5e');sky.addColorStop(.8,orbit?'#17112f':'#182c3b');sky.addColorStop(1,orbit?'#090b1e':'#0c1824');ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
    if (studio) {
      const light=ctx.createRadialGradient(w*.5,h*.40,0,w*.5,h*.48,Math.max(w,h)*.65);
      light.addColorStop(0,'#29455b');light.addColorStop(1,'#060c17');ctx.fillStyle=light;ctx.fillRect(0,0,w,h);
    } else if (orbit) {
      const bearing=Math.atan2(s.look.x-s.camera.x,s.look.z-s.camera.z);
      const offset=bearing/(Math.PI*2);
      for(const star of stars){const x=((star.a-offset+1)%1)*w,y=star.y*h;ctx.fillStyle=star.h>.33?'#dfd6ff':'#82c9ee';ctx.globalAlpha=.2+star.r*.62;ctx.fillRect(x,y,star.r> .87?2:1,star.r>.87?2:1);}
      ctx.globalAlpha=1;
      const px=w*(.55+Math.sin(bearing)*.27),py=h*.29,r=Math.min(w,h)*.245;
      ctx.save();
      ctx.translate(px,py);ctx.rotate(-.42);ctx.strokeStyle='#9763b783';ctx.lineWidth=r*.12;ctx.beginPath();ctx.ellipse(0,0,r*1.68,r*.40,0,Math.PI,Math.PI*2);ctx.stroke();ctx.restore();
      const gradient=ctx.createRadialGradient(px-r*.38,py-r*.45,r*.03,px,py,r);
      gradient.addColorStop(0,'#f3bdff');gradient.addColorStop(.40,'#9b66d4');gradient.addColorStop(.74,'#624bc0');gradient.addColorStop(1,'#29245f');
      ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(px,py,r,0,Math.PI*2);ctx.fill();
      ctx.save();ctx.translate(px,py);ctx.rotate(-.42);ctx.strokeStyle='#cf92e88b';ctx.lineWidth=r*.10;ctx.beginPath();ctx.ellipse(0,0,r*1.68,r*.40,0,0,Math.PI);ctx.stroke();ctx.restore();
    } else {
    const moonX=w*.77,moonY=h*.18;const moon=ctx.createRadialGradient(moonX,moonY,1,moonX,moonY,h*.2);moon.addColorStop(0,'#9ac9e51f');moon.addColorStop(1,'#9ac9e500');ctx.fillStyle=moon;ctx.fillRect(0,0,w,h);
    ctx.fillStyle='#e0eaf2';ctx.beginPath();ctx.arc(moonX,moonY,h*.012,0,Math.PI*2);ctx.fill();
    }
    let fx=s.look.x-s.camera.x,fy=s.look.y-s.camera.y,fz=s.look.z-s.camera.z;const fl=Math.hypot(fx,fy,fz);fx/=fl;fy/=fl;fz/=fl;
    const rl=Math.hypot(fx,fz),rx=fz/rl,rz=-fx/rl;
    const ux=-rz*fy,uy=rz*fx-rx*fz,uz=rx*fy; // down-vector for canvas coordinates
    const focal=h/(2*Math.tan((w<h?.93:.76)/2));
    const camera=(a:Point)=>{const x=a.x-s.camera.x,y=a.y-s.camera.y,z=a.z-s.camera.z;return p(x*rx+z*rz,x*ux+y*uy+z*uz,x*fx+y*fy+z*fz);};
    const polys:{points:Point[];color:string;depth:number}[]=[];
    const clipSide=w/(2*focal);
    const enqueue=(f:Face)=>{
      // Conservative bounding circle before vertex projection; the horizontal
      // radius lets tall and near-plane geometry stay visible without popping.
      const dx=f.bx-s.camera.x,dz=f.bz-s.camera.z,depth=dx*fx+dz*fz;
      if(depth+f.radius+45<.6||depth-f.radius>400)return;
      if(Math.abs(dx*rx+dz*rz)-f.radius>clipSide*Math.max(0,depth+f.radius+55))return;
      let points=f.points.map(camera);if(points.every(a=>a.z<.6)||points.every(a=>a.z>360))return;
      const clipped:Point[]=[];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];if(a.z>=.6)clipped.push(a);if((a.z>=.6)!==(b.z>=.6)){const t=(.6-a.z)/(b.z-a.z);clipped.push(p(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,.6));}}
      points=clipped;if(points.length<3)return;
      polys.push({points,color:f.color,depth:points.reduce((n,a)=>n+a.z,0)/points.length-(f.decal?.45:0)});
    };
    world.forEach(enqueue);
    // The same prebuilt coachwork is used for driving and the rotating studio.
    const addCar = (pose: CarPose, hero = false) => {
      const dx=pose.x-s.camera.x,dz=pose.z-s.camera.z;
      if (!hero && dx*dx+dz*dz > 180*180) return;
      const model=hero || dx*dx+dz*dz<42*42 ? heroCar : farCar;
      const sin=Math.sin(pose.yaw),cos=Math.cos(pose.yaw);
      const cp=(a:Point)=>p(pose.x+a.x*cos+a.z*sin,pose.y+a.y,pose.z-a.x*sin+a.z*cos);
      const palette=paintPalette(pose.color);
      const rearVisible=(-dx)*sin+(-dz)*cos < 0;
      for(const f of model) {
        if(f.decal && !rearVisible)continue;
        enqueue({points:f.points.map(cp),color:palette[f.color]??f.color,
          bx:pose.x+f.bx*cos+f.bz*sin,bz:pose.z-f.bx*sin+f.bz*cos,radius:f.radius,decal:f.decal});
      }
      if(pose.boost) for(const side of [-1,1]) {
        const plume=(width:number,length:number,color:string)=>{
          const points=[p(side*.47-width,.40,-2.29),p(side*.47+width,.40,-2.29),p(side*.47+width*.25,.29,-length),p(side*.47-width*.25,.29,-length)].map(cp);
          const flame:Face[]=[];face(points,color,flame);flame.forEach(enqueue);
        };
        plume(.14,3.8,'#168cb2');plume(.065,3.25,'#bdffff');
      }
    };
    addCar(s,true);
    s.rivals?.forEach(pose=>addCar(pose));
    polys.sort((a,b)=>b.depth-a.depth);
    for(const f of polys){ctx.beginPath();for(let i=0;i<f.points.length;i++){const a=f.points[i],x=w/2+a.x*focal/a.z,y=h/2+a.y*focal/a.z;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.closePath();ctx.fillStyle=f.color;ctx.fill();}
    // A bounded, peripheral optical-flow cue. Leave the racing line clear and
    // honor the same reduced-motion preference as the GPU view.
    if(!studio && !s.reducedMotion && (s.speed??0)>14) {
      const strength=Math.min(1,((s.speed??0)-14)/22);
      motionPhase=(motionPhase+.013+strength*.023)%1;
      ctx.strokeStyle=s.boost?'#a0f4ff':'#8cc5df';ctx.lineWidth=1;
      for(let i=0;i<12;i++){
        const t=(i/12+motionPhase)%1,side=i%2?-1:1;
        const x=w*.5+side*w*(.29+t*.28),y=h*(.48+(i%6)*.071+t*.12);
        ctx.globalAlpha=strength*(s.boost?.28:.13)*t;
        ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+side*w*.065*t,y+h*.035*t);ctx.stroke();
      }
      ctx.globalAlpha=1;
    }
    // Faint cinematic edge vignette; all controls remain outside this canvas.
    const vignette=ctx.createRadialGradient(w/2,h*.5,h*.2,w/2,h*.5,Math.max(w,h)*.7);vignette.addColorStop(0,'#00000000');vignette.addColorStop(1,'#02091688');ctx.fillStyle=vignette;ctx.fillRect(0,0,w,h);
  };
}
