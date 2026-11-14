import type { GarageColor as Color, GarageGeometry as Geometry } from './garageGeometry';
import type { Vec3 } from './track';

/** Original baked meshes, +z forward. No downloaded assets or runtime tessellation.
 * Each model has independent silhouette stations, canopy and signature aero geometry. */
const BLACK: Color = [.025,.033,.043], CARBON: Color = [.065,.077,.092];
const GLASS: Color = [.085,.16,.22], GLINT: Color = [.18,.30,.38];
const LED: Color = [.84,.96,1], RED: Color = [.98,.035,.07], CHROME: Color = [.64,.70,.74];
const shade=(c:Color,n:number):Color=>c.map(v=>Math.min(1,v*n)) as Color;
type Station=readonly [z:number,halfWidth:number,deck:number,shoulder:number];
type Body={length:number;width:number;frontAxle:number;rearAxle:number;stations:readonly Station[];rearRadius?:number};
const AVENTADOR:Body={length:2.19,width:.93,frontAxle:1.30,rearAxle:-1.23,stations:[
 [-2.19,.76,.66,.65],[-1.94,.90,.72,.73],[-1.55,.93,.73,.79],[-1.23,.93,.73,.80],[-.75,.88,.67,.68],
 [0,.82,.64,.64],[.68,.85,.65,.67],[1.30,.91,.65,.79],[1.65,.89,.59,.69],[1.98,.81,.48,.52],[2.19,.69,.43,.43]]};
const MCLAREN:Body={length:2.12,width:.90,frontAxle:1.27,rearAxle:-1.25,stations:[
 [-2.12,.70,.62,.63],[-1.89,.85,.69,.70],[-1.55,.90,.72,.78],[-1.25,.90,.72,.80],[-.72,.83,.67,.68],
 [-.05,.75,.62,.63],[.52,.78,.62,.63],[1.27,.88,.61,.78],[1.58,.87,.54,.71],[1.92,.76,.44,.51],[2.12,.63,.40,.43]]};
const F40:Body={length:2.05,width:.93,frontAxle:1.18,rearAxle:-1.19,stations:[
 [-2.05,.86,.67,.68],[-1.84,.92,.70,.72],[-1.19,.93,.72,.78],[-.73,.90,.67,.68],
 [0,.84,.62,.64],[.60,.86,.61,.65],[1.18,.92,.58,.76],[1.57,.90,.50,.61],[1.89,.84,.43,.46],[2.05,.78,.39,.40]]};
const CHIRON:Body={length:2.12,width:.95,frontAxle:1.28,rearAxle:-1.22,rearRadius:.35,stations:[
 [-2.12,.75,.66,.67],[-1.93,.87,.71,.74],[-1.55,.95,.75,.80],[-1.22,.95,.76,.83],[-.77,.91,.70,.73],
 [-.15,.86,.65,.68],[.52,.85,.66,.68],[1.28,.93,.64,.80],[1.66,.90,.60,.70],[1.97,.79,.53,.55],[2.12,.70,.48,.49]]};
function poly(g:Geometry,p:Vec3[],c:Color,glow=false){for(let i=1;i+1<p.length;i++)g.triangle(p[0],p[i],p[i+1],c,glow);}
function line(g:Geometry,p:Vec3[],r:number,c:Color){for(let i=1;i<p.length;i++)g.beam(p[i-1],p[i],r,c);}
function interpolate(b:Body,z:number):Station{
 const ss=b.stations;let i=1;while(i<ss.length-1&&ss[i][0]<z)i++;
 const a=ss[i-1],c=ss[i],t=Math.max(0,Math.min(1,(z-a[0])/(c[0]-a[0])));
 return [z,a[1]+(c[1]-a[1])*t,a[2]+(c[2]-a[2])*t,a[3]+(c[3]-a[3])*t];
}
function shell(g:Geometry,color:Color,b:Body,twoTone=false){
 const wheelZ=[b.rearAxle,b.frontAxle],zs=b.stations.map(s=>s[0]);
 // Real circular arch cutouts, not black decals over a rectangular body.
 for(const z of wheelZ)for(let i=0;i<=12;i++)zs.push(z+Math.cos(i/12*Math.PI)*.385);
 const ss=[...new Set(zs)].sort((a,c)=>a-c).map(z=>interpolate(b,z));
 const bottom=(z:number)=>{let y=.18;for(const axle of wheelZ){const d=Math.abs(z-axle);if(d<.385)y=Math.max(y,.335+Math.sqrt(.385**2-d**2));}return y;};
 for(let i=1;i<ss.length;i++){
  const a=ss[i-1],c=ss[i];for(const s of [-1,1]){
   const paint=twoTone&&(a[0]+c[0])*.5<-.38?shade(color,.35):color;
   const at=(p:Station,x:number,y:number):Vec3=>[s*p[1]*x,y,p[0]];
   g.quad(at(a,0,a[2]),at(a,.68,a[2]+.018),at(c,.68,c[2]+.018),at(c,0,c[2]),shade(paint,1.09));
   g.quad(at(a,.68,a[2]+.018),at(a,.94,a[3]),at(c,.94,c[3]),at(c,.68,c[2]+.018),shade(paint,1.15));
   const ay=Math.max(a[3]-.055,bottom(a[0])+.014),cy=Math.max(c[3]-.055,bottom(c[0])+.014);
   g.quad(at(a,.94,a[3]),at(a,1,ay),at(c,1,cy),at(c,.94,c[3]),paint);
   g.quad(at(a,1,ay),at(a,.985,bottom(a[0])),at(c,.985,bottom(c[0])),at(c,1,cy),shade(paint,.77));
  }
 }
 for(const p of [ss[0],ss[ss.length-1]]){
  g.quad([-p[1],.22,p[0]],[p[1],.22,p[0]],[p[1]*.94,p[3],p[0]],[-p[1]*.94,p[3],p[0]],color);
  g.quad([-p[1]*.94,p[3],p[0]],[p[1]*.94,p[3],p[0]],[p[1]*.68,p[2]+.018,p[0]],[-p[1]*.68,p[2]+.018,p[0]],color);
 }
 for(const s of [-1,1]){
  poly(g,[[s*.83,.20,b.rearAxle+.41],[s*.79,.30,-.42],[s*.79,.24,b.frontAxle-.41],[s*.85,.16,b.frontAxle-.41],[s*.88,.16,b.rearAxle+.41]],CARBON);
  for(const z of wheelZ){
   const r=z<0?b.rearRadius??.34:.325,w=interpolate(b,z)[1];
   g.wheel([s*(w-.135),r,z],r,.27,BLACK,20);
   const x=s*(w+.004),hub:Vec3=[x,r,z],disc:Vec3[]=[];
   for(let i=0;i<20;i++)disc.push([x-s*.003,r+Math.cos(i/20*Math.PI*2)*r*.72,z+Math.sin(i/20*Math.PI*2)*r*.72]);
   poly(g,disc,shade(CHROME,.39));
   for(let i=0;i<5;i++)for(const offset of [-.065,.065]){
    const angle=i/5*Math.PI*2+offset,p=(rr:number,a:number):Vec3=>[x+s*.008,r+Math.cos(a)*rr,z+Math.sin(a)*rr];
    g.quad(p(r*.16,angle-.16),p(r*.80,angle-.044),p(r*.80,angle+.044),p(r*.16,angle+.16),CHROME);
   }
   g.ellipsoid(hub,[.015,.046,.046],CARBON,6,4);
   g.box([x-s*.008,r+.03,z-r*.49],[.015,.13,.055],[.75,.10,.035]);
  }
 }
}
type Roof=readonly [number,number,number,number,number];
function canopy(g:Geometry,color:Color,rows:readonly Roof[],crown:number,glassRoof=false){
 const cross=(r:Roof,t:number):Vec3=>[r[3]*t,r[4]+crown*(1-t*t),r[0]],ts=[-1,-.65,-.3,0,.3,.65,1];
 for(let i=1;i<rows.length;i++){
  const a=rows[i-1],b=rows[i];for(const s of [-1,1]){
   const aa:Vec3=[s*a[1],a[2],a[0]],ab:Vec3=[s*b[1],b[2],b[0]],ba=cross(a,s),bb=cross(b,s);
   g.quad(aa,ab,bb,ba,s===1?GLINT:GLASS);g.beam(aa,ab,.012,shade(color,.65));g.beam(ba,bb,.014,color);
  }
  for(let j=1;j<ts.length;j++)g.quad(cross(a,ts[j-1]),cross(a,ts[j]),cross(b,ts[j]),cross(b,ts[j-1]),glassRoof?GLASS:shade(color,1.12));
 }
 for(const r of [rows[0],rows[rows.length-1]]){
  const rear=r===rows[0];for(let j=1;j<ts.length;j++){
   const lower=(t:number):Vec3=>[r[1]*t,r[2]+.008*(1-t*t),r[0]+(rear?-.27:.48)*(1-Math.abs(t)*.10)];
   g.quad(lower(ts[j-1]),lower(ts[j]),cross(r,ts[j]),cross(r,ts[j-1]),GLASS);
  }
  for(const s of [-1,1])g.beam([s*r[1],r[2],r[0]+(rear?-.243:.432)],cross(r,s),.020,color);
 }
}
function mirrors(g:Geometry,color:Color,w:number,z:number,y:number){for(const s of [-1,1]){g.beam([s*w*.73,y-.05,z+.06],[s*(w+.055),y,z],.016,BLACK);g.ellipsoid([s*(w+.067),y+.018,z],[.105,.037,.065],color,8,4);}}
function frontPanel(g:Geometry,s:number,z:number,points:readonly(readonly[number,number])[],color:Color){poly(g,points.map(p=>[s*p[0],p[1],z]as Vec3),color);}
function rearDiffuser(g:Geometry,l:number,w:number){g.box([0,.215,-l-.012],[w*1.68,.11,.12],CARBON);for(const x of [-.58,-.30,0,.30,.58])poly(g,[[x,.15,-l-.07],[x,.32,-l+.25],[x,.31,-l+.51],[x,.14,-l+.28]],BLACK);}

function aventador(g:Geometry,c:Color){
 const b=AVENTADOR;shell(g,c,b);
 canopy(g,c,[[-.66,.66,.70,.50,1.015],[-.35,.67,.69,.52,1.035],[.18,.63,.67,.48,1.00]],.025);mirrors(g,c,.89,.63,.77);
 const z=b.length+.012,rz=-b.length-.012;
 for(const s of [-1,1]){
  poly(g,[[s*.48,.506,1.94],[s*.81,.558,1.78],[s*.79,.602,1.59],[s*.56,.568,1.79]],BLACK);
  const hub:Vec3=[s*.65,.552,1.81];for(const p of [[s*.53,.522,1.93],[s*.77,.57,1.76],[s*.75,.591,1.65]]as Vec3[])g.beam(hub,p,.012,LED);
  frontPanel(g,s,z,[[.14,.245],[.65,.245],[.67,.365],[.43,.402],[.24,.35]],BLACK);g.beam([s*.20,.25,z+.01],[s*.48,.39,z+.01],.018,c);
  poly(g,[[s*.884,.677,-.73],[s*.899,.62,-1.00],[s*.872,.35,-.77],[s*.823,.30,.18],[s*.838,.47,-.24]],BLACK);
  poly(g,[[s*.884,.677,-.73],[s*.825,.54,-.27],[s*.823,.30,.18],[s*.83,.50,.10]],shade(c,1.17));
  line(g,[[s*.857,.64,.66],[s*.826,.37,.48],[s*.824,.29,-.38],[s*.86,.51,-.77]],.007,shade(c,.42));
  for(let i=0;i<4;i++)g.beam([s*.63,.746,-1.03-i*.13],[s*.84,.773,-1.08-i*.13],.017,BLACK);
  frontPanel(g,s,rz,[[.08,.43],[.71,.43],[.72,.59],[.12,.61]],BLACK);
  for(let i=0;i<3;i++){const x=.26+i*.15;line(g,[[s*(x-.055),.56,rz-.008],[s*x,.515,rz-.012],[s*(x+.055),.56,rz-.008]],.012,RED);g.beam([s*x,.515,rz-.012],[s*x,.475,rz-.012],.011,RED);}
  poly(g,[[s*.19,.72,-.91],[s*.59,.73,-.99],[s*.59,.75,-1.77],[s*.19,.74,-1.77]],BLACK);
 }
 for(let i=0;i<5;i++)g.beam([-.49,.757,-1.05-i*.14],[.49,.757,-1.05-i*.14],.022,shade(c,.66));
 frontPanel(g,1,rz-.04,[[-.20,.30],[.20,.30],[.15,.405],[-.15,.405]],CHROME);
 frontPanel(g,1,rz-.045,[[-.16,.317],[.16,.317],[.12,.382],[-.12,.382]],BLACK);
 g.box([0,.70,-1.97],[1.51,.045,.21],shade(c,.90));g.beam([-.68,.195,z+.015],[.68,.195,z+.015],.026,CARBON);rearDiffuser(g,b.length,b.width);
}
function mclaren(g:Geometry,c:Color){
 const b=MCLAREN;shell(g,c,b);
 canopy(g,c,[[-.79,.55,.69,.30,.91],[-.51,.62,.67,.44,1.005],[-.12,.63,.65,.47,1.015],[.26,.58,.64,.40,.96]],.025,true);mirrors(g,c,.83,.62,.75);
 for(const s of [-1,1]){
  poly(g,[[s*.43,.49,1.98],[s*.73,.535,1.84],[s*.82,.663,1.56],[s*.66,.702,1.34],[s*.51,.627,1.51]],BLACK);
  line(g,[[s*.46,.51,1.96],[s*.56,.602,1.70],[s*.66,.683,1.39],[s*.78,.655,1.57]],.014,LED);
  g.beam([s*.44,.49,1.98],[s*.66,.57,1.80],.020,shade(c,1.24));frontPanel(g,s,b.length+.012,[[.08,.23],[.60,.23],[.58,.33],[.24,.35]],BLACK);
  poly(g,[[s*.864,.71,-.93],[s*.892,.65,-1.05],[s*.857,.37,-.63],[s*.773,.30,.36],[s*.778,.48,.48],[s*.81,.55,-.30]],BLACK);
  poly(g,[[s*.864,.71,-.93],[s*.827,.52,-.22],[s*.77,.31,.44],[s*.791,.39,.54],[s*.837,.61,-.36]],shade(c,1.12));
  g.beam([s*.47,.97,-.48],[s*.68,.727,-1.25],.035,c);line(g,[[s*.79,.62,.54],[s*.77,.36,.40],[s*.79,.29,-.35]],.007,shade(c,.48));
  const rz=-b.length-.017;frontPanel(g,s,rz,[[.05,.37],[.65,.38],[.67,.54],[.22,.59]],BLACK);
  line(g,[[s*.19,.565,rz-.008],[s*.41,.58,rz-.012],[s*.63,.54,rz-.008],[s*.67,.48,rz+.02]],.012,RED);
  g.ellipsoid([s*.25,.454,rz-.022],[.071,.062,.028],CHROME,12,5);g.ellipsoid([s*.25,.454,rz-.044],[.051,.045,.012],BLACK,10,4);
 }
 g.box([0,.692,-1.92],[1.49,.045,.24],c);poly(g,[[-.34,.732,-1.11],[.34,.732,-1.11],[.45,.715,-1.77],[-.45,.715,-1.77]],BLACK);
 for(let i=0;i<6;i++)g.beam([-.32,.744,-1.19-i*.085],[.32,.744,-1.19-i*.085],.012,CARBON);rearDiffuser(g,b.length,b.width);
}
function ferrari(g:Geometry,c:Color){
 const b=F40;shell(g,c,b);canopy(g,c,[[-.70,.64,.68,.49,1.01],[-.29,.64,.64,.50,1.015],[.19,.61,.62,.47,1.00]],.012);mirrors(g,c,.87,.60,.73);
 const rz=-b.length-.022;
 for(const s of [-1,1]){
  poly(g,[[s*.43,.518,1.56],[s*.73,.551,1.56],[s*.76,.609,1.29],[s*.45,.594,1.29]],shade(c,.69));
  poly(g,[[s*.446,.523,1.54],[s*.715,.553,1.54],[s*.74,.610,1.31],[s*.464,.596,1.31]],shade(c,1.05));
  frontPanel(g,s,b.length+.018,[[.44,.25],[.73,.25],[.73,.355],[.44,.355]],BLACK);
  frontPanel(g,s,b.length+.022,[[.465,.269],[.57,.269],[.57,.337],[.465,.337]],LED);
  frontPanel(g,s,b.length+.022,[[.59,.269],[.708,.269],[.708,.337],[.59,.337]],[.91,.64,.24]);
  poly(g,[[s*.18,.596,1.15],[s*.29,.606,.86],[s*.37,.61,.88],[s*.30,.599,1.16]],BLACK);
  poly(g,[[s*.886,.625,-.66],[s*.899,.51,-.85],[s*.863,.405,-.62],[s*.847,.45,-.29]],BLACK);
  line(g,[[s*.857,.62,.53],[s*.85,.32,.40],[s*.855,.29,-.48],[s*.881,.60,-.73]],.007,shade(c,.45));
  line(g,[[s*.875,.37,-1.99],[s*.929,.39,-1.65]],.013,BLACK);line(g,[[s*.91,.39,-.77],[s*.85,.36,.53]],.013,BLACK);line(g,[[s*.91,.36,1.59],[s*.79,.30,2.04]],.013,BLACK);
  poly(g,[[s*.83,.69,-2.01],[s*.83,1.16,-2.01],[s*.83,1.15,-1.70],[s*.83,.73,-1.61]],c);
  poly(g,[[s*.844,.69,-2.01],[s*.844,1.16,-2.01],[s*.844,1.15,-1.70],[s*.844,.73,-1.61]],shade(c,.78));
  for(const x of [.51,.71]){g.ellipsoid([s*x,.526,rz],[.088,.088,.022],BLACK,12,5);g.ellipsoid([s*x,.526,rz-.018],[.068,.068,.018],RED,12,5);}
  for(let i=0;i<4;i++)g.beam([s*.68,.744,-1.02-i*.13],[s*.87,.758,-1.10-i*.13],.015,BLACK);
 }
 g.box([0,1.145,-1.86],[1.70,.065,.34],c);poly(g,[[-.47,.724,-1.02],[.47,.724,-1.02],[.61,.725,-1.80],[-.61,.725,-1.80]],GLASS);
 for(let i=0;i<7;i++)g.beam([-.48-i*.012,.744,-1.08-i*.095],[.48+i*.012,.744,-1.08-i*.095],.016,BLACK);
 g.box([0,.45,rz],[.73,.24,.035],BLACK);
 for(const x of [-.13,0,.13]){g.ellipsoid([x,.286,rz-.015],[.055,.049,.026],CHROME,10,4);g.ellipsoid([x,.286,rz-.038],[.039,.034,.012],BLACK,10,4);}
 g.box([0,.25,b.length+.015],[.69,.095,.04],BLACK);g.beam([-.79,.19,b.length+.025],[.79,.19,b.length+.025],.024,CARBON);rearDiffuser(g,b.length,b.width);
}
function chiron(g:Geometry,c:Color){
 const b=CHIRON;shell(g,c,b,true);canopy(g,c,[[-.70,.67,.73,.48,1.06],[-.36,.69,.69,.54,1.12],[.11,.67,.68,.52,1.10],[.38,.61,.67,.44,1.00]],.03);mirrors(g,c,.89,.70,.79);
 const rz=-b.length-.022,z=b.length+.016;
 const horseshoe:Vec3[]=[[-.20,.235,z],[-.215,.34,z],[-.20,.45,z],[-.15,.515,z],[-.07,.54,z],[.07,.54,z],[.15,.515,z],[.20,.45,z],[.215,.34,z],[.20,.235,z]];
 poly(g,horseshoe,BLACK);line(g,horseshoe,.018,CHROME);g.beam([-.20,.235,z],[.20,.235,z],.012,CHROME);
 for(let i=-3;i<=3;i++)g.beam([i*.045,.25,z+.001],[i*.044,.465-Math.abs(i)*.008,z+.001],.005,shade(CHROME,.45));
 line(g,[[0,.55,2.04],[0,.63,1.61],[0,.68,1.05],[0,.69,.82]],.009,shade(c,1.45));line(g,[[0,1.15,-.36],[0,1.09,-.70],[0,.78,-1.11],[0,.76,-1.84]],.010,shade(c,.75));
 for(const s of [-1,1]){
  frontPanel(g,s,z,[[.28,.245],[.66,.245],[.66,.37],[.34,.39]],BLACK);
  poly(g,[[s*.33,.55,1.98],[s*.76,.58,1.86],[s*.79,.63,1.72],[s*.36,.61,1.84]],BLACK);
  for(let i=0;i<4;i++){const x=.40+i*.10,zz=1.94-i*.028;g.box([s*x,.579+i*.007,zz],[.062,.033,.058],LED);}
  const side:Vec3[]=[[s*.57,1.075,-.39],[s*.73,.97,-.61],[s*.88,.81,-.69],[s*.922,.63,-.65],[s*.911,.43,-.51],[s*.88,.29,-.26],[s*.86,.25,.11],[s*.855,.26,.60]];
  poly(g,[[s*.88,.81,-.69],[s*.922,.63,-.65],[s*.911,.43,-.51],[s*.88,.29,-.26],[s*.86,.25,.11],[s*.86,.52,.23],[s*.85,.68,-.14]],BLACK);line(g,side,.024,CHROME);
  line(g,[[s*.85,.67,.63],[s*.852,.48,.55],[s*.856,.30,.51]],.007,shade(c,.42));
  poly(g,[[s*.20,.78,-.96],[s*.65,.79,-1.01],[s*.69,.78,-1.73],[s*.20,.76,-1.82]],BLACK);
  for(let i=0;i<5;i++)g.beam([s*.26,.80,-1.08-i*.12],[s*.61,.80,-1.08-i*.12],.014,CARBON);
  g.ellipsoid([s*.25,.302,rz-.018],[.125,.047,.03],CHROME,10,4);g.ellipsoid([s*.25,.302,rz-.044],[.098,.028,.011],BLACK,10,4);
 }
 g.box([0,.515,rz],[1.46,.18,.035],BLACK);g.beam([-.72,.582,rz-.025],[.72,.582,rz-.025],.014,RED);g.box([0,.733,-1.94],[1.55,.042,.23],shade(c,.4));rearDiffuser(g,b.length,b.width);
}
/** True means the complete car including wheels has been supplied; skip generic geometry. */
export function buildExoticGarageRide(g:Geometry,color:Color,id:string):boolean{
 switch(id){case 'lamborghini':aventador(g,color);return true;case 'mclaren':mclaren(g,color);return true;case 'ferrari':ferrari(g,color);return true;case 'bugatti':chiron(g,color);return true;default:return false;}
}
