/** Original hand-authored BMW/AMG meshes. +Z is the nose. No downloaded assets. */
type V = [number, number, number];
type C = V;
export interface GermanGeometry {
  triangle(a: V,b: V,c: V,color: C,glow?: boolean): void;
  quad(a: V,b: V,c: V,d: V,color: C,glow?: boolean): void;
  box(center: V,size: V,color: C,yaw?: number): void;
  beam(a: V,b: V,width: number,color: C): void;
  ellipsoid(center: V,radius: V,color: C,slices?: number,rings?: number): void;
}
const black:C=[.035,.045,.055], glass:C=[.075,.14,.19], chrome:C=[.65,.70,.73], white:C=[.86,.97,1], red:C=[.95,.025,.04];
const tint=(c:C,m:number):C=>[c[0]*m,c[1]*m,c[2]*m];
function poly(g:GermanGeometry, pts:V[],c:C,glow=false){for(let i=1;i<pts.length-1;i++)g.triangle(pts[0],pts[i],pts[i+1],c,glow);}
function stroke(g:GermanGeometry,pts:V[],r:number,c:C){for(let i=1;i<pts.length;i++)g.beam(pts[i-1],pts[i],r,c);}
function wheel(g:GermanGeometry,x:number,y:number,z:number,r:number,width:number){
  const rings=[[-width/2,.85],[-width*.36,.98],[width*.36,.98],[width/2,.85]];
  const p=(j:number,a:number):V=>[x+rings[j][0],y+Math.cos(a)*r*rings[j][1],z+Math.sin(a)*r*rings[j][1]];
  for(let i=0;i<32;i++){const a=i*Math.PI/16,b=(i+1)*Math.PI/16;for(let j=0;j<3;j++)g.quad(p(j,a),p(j,b),p(j+1,b),p(j+1,a),i%4===0?tint(black,1.3):black);
    for(const s of [-1,1]){const f=x+s*(width/2+.004), q=(a:number,rad:number):V=>[f,y+Math.cos(a)*rad,z+Math.sin(a)*rad];
      g.quad(q(a,r*.84),q(b,r*.84),q(b,r*.67),q(a,r*.67),black);g.triangle([f,y,z],q(a,r*.65),q(b,r*.65),[.11,.13,.15]);
      if(i%3===0)g.triangle(q(a,r*.13),q(a,r*.64),q(b,r*.64),chrome);
    }
  }
}
function roundFace(g:GermanGeometry,x:number,y:number,z:number,r:number,c:C){const pts:V[]=[];for(let i=0;i<32;i++){const a=i*Math.PI/16;pts.push([x+Math.cos(a)*r,y+Math.sin(a)*r,z]);}poly(g,pts,c);}
function grille(g:GermanGeometry,cx:number,y:number,z:number,w:number,h:number,vertical=true){
  poly(g,[[cx-w*.42,y-h/2,z],[cx+w*.42,y-h/2,z],[cx+w/2,y+h*.35,z],[cx+w*.35,y+h/2,z],[cx-w*.35,y+h/2,z],[cx-w/2,y+h*.35,z]],black);
  for(let i=1;i<8;i++){const t=i/8;if(vertical)g.beam([cx-w*.42+w*.84*t,y-h*.40,z+.006],[cx-w*.42+w*.84*t,y+h*.40,z+.006],.006,chrome);else g.beam([cx-w*.40,y-h*.4+h*.8*t,z+.006],[cx+w*.40,y-h*.4+h*.8*t,z+.006],.006,[.22,.24,.26]);}
}
function exhaust(g:GermanGeometry,x:number,y:number,z:number,r=.055){roundFace(g,x,y,z,r,chrome);roundFace(g,x,y,z-.004,r*.69,black);}
type Station=[number,number,number];
function body(g:GermanGeometry,c:C,stations:Station[],axles:number[],r:number){
  const sample=(z:number):[number,number]=>{let i=0;while(i<stations.length-2&&z>stations[i+1][0])i++;const a=stations[i],b=stations[i+1],t=(z-a[0])/(b[0]-a[0]);return[a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];};
  const ring=(z:number,s:number):V[]=>{const [w,h]=sample(z);let lower=.26;for(const az of axles){const d=Math.abs(z-az);if(d<r+.065)lower=Math.max(lower,r+Math.sqrt((r+.065)**2-d*d));}const shoulder=Math.max(h,lower+.055);return [[0,h+.025,z],[s*w*.65,h+.015,z],[s*w*.91,shoulder,z],[s*w,shoulder-.04,z],[s*w*.99,lower,z]];};
  const min=stations[0][0],max=stations[stations.length-1][0],n=64;
  for(const s of [-1,1])for(let i=0;i<n;i++){const a=ring(min+(max-min)*i/n,s),b=ring(min+(max-min)*(i+1)/n,s);for(let j=0;j<4;j++)g.quad(a[j],b[j],b[j+1],a[j+1],j===3?tint(c,.87):c);}
  for(const z of [min,max]){const [w,h]=sample(z);g.quad([-w,.27,z],[w,.27,z],[w,h,z],[-w,h,z],c);}
}
function cabin(g:GermanGeometry,c:C,w:number,front:number,rear:number,roofFront:number,roofRear:number,belt:number,height:number,sedan=false){
  const rw=w*.80;
  const fl:V=[-w,belt,front],fr:V=[w,belt,front],rl:V=[-w,belt,rear],rr:V=[w,belt,rear];
  const a:V=[-rw,height,roofFront],b:V=[rw,height,roofFront],d:V=[-rw,height-.025,roofRear],e:V=[rw,height-.025,roofRear];
  g.quad(fl,fr,b,a,glass);g.quad(rl,rr,e,d,glass);
  for(const s of [-1,1]){
    const loF:V=[s*w,belt,front],loR:V=[s*w,belt,rear],hiF:V=[s*rw,height,roofFront],hiR:V=[s*rw,height-.025,roofRear];
    g.quad(loF,loR,hiR,hiF,glass);stroke(g,[loF,hiF,hiR,loR],.026,c);g.beam(loF,loR,.018,black);
    const z=sedan?-.13:-.37;g.beam([s*w,belt,z],[s*rw,height-.01,z],sedan?.035:.022,black);
    if(sedan)g.beam([s*w,.32,z],[s*w,belt,z],.008,tint(c,.65));
    g.ellipsoid([s*(w+.15),belt+.12,front-.11],[.115,.055,.08],tint(c,.8),12,6);
    g.beam([s*w,belt+.07,front-.15],[s*(w+.14),belt+.12,front-.11],.019,black);
  }
  for(let i=0;i<12;i++){const x1=-rw+i*rw/6,x2=x1+rw/6;const y1=height+.055*(1-(x1/rw)**2),y2=height+.055*(1-(x2/rw)**2);g.quad([x1,y1,roofFront],[x2,y2,roofFront],[x2,y2-.025,roofRear],[x1,y1-.025,roofRear],c);}
  stroke(g,[fl,a,b,fr],.025,c);stroke(g,[rl,d,e,rr],.032,c);
}
function coupe(g:GermanGeometry,c:C,id:string){
  const gt=id==='amg-gt',m2=id==='bmw-m2',m3=id==='bmw-m3';
  const l=m2?1.72:gt?1.93:1.91,w=gt?.87:m2?.80:.84,r=.345,ax=gt?1.24:m2?1.10:1.22;
  const stations:Station[]=[[-l,w*.88,.66],[-l+.15,w*.97,.72],[-ax,w,.75],[-.55,w*.94,.70],[.35,w*.94,.70],[ax,w,.73],[l-.15,w*.94,gt?.58:.64],[l,w*.85,gt?.51:.61]];
  body(g,c,stations,[-ax,ax],r);
  cabin(g,c,w*.80,gt?.19:.68,gt?-1.37:m3?-1.20:-1.18,gt?-.34:.14,gt?-.87:m3?-.68:-.53,.73,gt?1.11:m2?1.20:m3?1.22:1.16,m3);
  for(const s of [-1,1]){
    for(const z of [-ax,ax])wheel(g,s*w*.96,r,z,r,.245);
    g.beam([s*w*.97,.27,-ax+.35],[s*w*.97,.27,ax-.35],.04,black);
    g.box([s*w*.965,.68,gt?-.65:-.35],[.025,.025,.17],chrome);
    const z=l+.009,inner=s*(gt?.45:.38),outer=s*w*.85;
    poly(g,[[inner,.55,z],[outer,.56,z-.016],[outer,.67,z-.02],[inner,.63,z]],black);
    if(gt)stroke(g,[[inner,.58,z+.01],[outer,.60,z]],.014,white);
    else for(const dx of [0,.16]){const x=s*(.40+dx);stroke(g,[[x,.63,z+.015],[x+s*.015,.57,z+.015],[x+s*.10,.57,z+.015],[x+s*.12,.63,z+.015]],.012,white);}
    const rz=-l-.013;
    g.box([s*w*.65,.626,rz],[w*.49,.11,.025],black);
    stroke(g,[[s*w*.40,.65,rz-.02],[s*w*.87,.65,rz-.02],[s*w*.87,.59,rz-.02],[s*w*.67,.59,rz-.02]],gt?.012:.017,red);
    g.beam([s*w*.87,.65,rz],[s*w*.98,.65,-l+.16],.015,red);
    if(gt){g.box([s*.60,.32,-l-.035],[.26,.115,.065],chrome);g.box([s*.60,.32,-l-.071],[.21,.07,.01],black);}
    else for(const dx of [0,.12])exhaust(g,s*(.51+dx),.30,-l-.045);
    g.box([s*w*.68,.39,l+.012],[.32,.15,.025],black);
    if(gt)for(let j=0;j<3;j++)g.beam([s*w*1.002,.61,.73+j*.075],[s*w*1.002,.48,.67+j*.075],.014,black);
  }
  if(gt){grille(g,0,.455,l+.018,.77,.27);g.box([0,.46,l+.04],[.11,.025,.012],chrome);}
  else if(m2)for(const s of [-1,1])grille(g,s*.16,.565,l+.024,.27,.19);
  else for(const s of [-1,1])grille(g,s*.18,.46,l+.026,.30,.43,false);
  g.box([0,.47,-l-.016],[.34,.10,.012],black);
  g.box([0,.47,-l-.025],[.25,.065,.008],[.54,.57,.57]);
  g.box([0,.26,-l+.015],[w*1.7,.09,.13],black);
  for(const x of [-.4,-.2,0,.2,.4])g.box([x,.245,-l-.01],[.028,.12,.19],black);
  for(const s of [-1,1])g.beam([s*.28,.735,gt?.23:.72],[s*.38,gt?.59:.66,l-.14],.009,tint(c,1.10));
  g.beam([-w*.82,.739,-l+.09],[w*.82,.739,-l+.09],.027,gt?c:tint(c,.7));
}
function g63(g:GermanGeometry,c:C){
 const w=.85,l=1.78,r=.40,ax=1.13;
 body(g,c,[[-l,.82,1.03],[-1.38,w,1.04],[.55,w,1.04],[l-.10,.80,.96],[l,.78,.94]],[-ax,ax],r);
 cabin(g,c,.75,.60,-1.56,.48,-1.43,1.02,1.78,true);
 for(const s of [-1,1]){
  g.box([s*.77,1.39,-1.40],[.11,.72,.14],c);
  g.box([s*.78,1.08,-.92],[.025,.025,.20],chrome);
  g.beam([s*.79,1.02,-.75],[s*.79,1.75,-.75],.045,c);
  g.beam([s*.87,.35,-.80],[s*.87,.35,.78],.065,chrome);
  for(const z of [-ax,ax]){
   wheel(g,s*.86,r,z,r,.30);
   const pts:V[]=[[s*.93,.39,z-.46],[s*.93,.78,z-.35],[s*.93,.89,z-.18],[s*.93,.89,z+.18],[s*.93,.78,z+.35],[s*.93,.39,z+.46]];
   stroke(g,pts,.045,tint(c,.75));
  }
  roundFace(g,s*.56,.80,l+.02,.145,black);roundFace(g,s*.56,.80,l+.026,.113,white);roundFace(g,s*.56,.80,l+.029,.083,[.41,.51,.58]);
  g.box([s*.60,1.025,1.49],[.12,.045,.11],[1,.62,.12]);
  g.box([s*.62,.55,-l-.018],[.26,.095,.035],red);
  g.box([s*.77,1.01,-.25],[.025,.038,.17],black);
  for(const z of [-.64,-.50])g.box([s*.93,.30,z],[.16,.09,.10],chrome);
 }
 grille(g,0,.78,l+.025,.67,.30);g.box([0,.78,l+.04],[.12,.027,.012],chrome);
 g.box([0,.38,l+.02],[1.65,.17,.13],black);g.box([0,.34,-l],[1.65,.12,.16],black);
 const rad=.34,cy=1.10,z=-l-.16;
 for(let i=0;i<40;i++){const a=i*Math.PI/20,b=(i+1)*Math.PI/20;g.quad([Math.cos(a)*rad,cy+Math.sin(a)*rad,z-.14],[Math.cos(b)*rad,cy+Math.sin(b)*rad,z-.14],[Math.cos(b)*rad,cy+Math.sin(b)*rad,z+.11],[Math.cos(a)*rad,cy+Math.sin(a)*rad,z+.11],black);}
 roundFace(g,0,cy,z-.145,rad*.92,chrome);roundFace(g,0,cy,z-.15,rad*.83,tint(c,.8));
 g.box([0,1.79,-1.48],[.25,.035,.045],red);
 for(const s of [-1,1])g.beam([s*.70,1.83,-1.40],[s*.70,1.83,.42],.021,black);
}
export function buildGermanRide(g:GermanGeometry,color:C,id:string):boolean{
 if(!['bmw-m2','bmw-m3','bmw-m4','amg-gt','amg-g63'].includes(id))return false;
 if(id==='amg-g63')g63(g,color);else coupe(g,color,id);return true;
}
