/** Original, baked vertex-colour meshes. +Z is the nose; no remote models/textures.
 * Proportion references: Ducati MY2024 V4 (1469 mm wheelbase), BMW S1000RR
 * (1457 mm wheelbase), Tesla Cybertruck owner's dimensional drawing and 2017 Roadster.
 * Deliberately separate silhouettes, not accessories on a common car shell.
 */
type V = [number, number, number];
type C = [number, number, number];
export interface BikeEvGeometry {
  triangle(a: V,b: V,c: V,color: C,glow?: boolean): void;
  quad(a: V,b: V,c: V,d: V,color: C,glow?: boolean): void;
  box(center: V,size: V,color: C): void;
  beam(a: V,b: V,width: number,color: C): void;
  ellipsoid(center: V,radius: V,color: C,slices?: number,rings?: number): void;
}
const black:C=[.025,.033,.045], rubber:C=[.045,.052,.062], metal:C=[.57,.61,.65], glass:C=[.065,.13,.18], led:C=[.83,.97,1], red:C=[1,.035,.055];
const shade=(c:C,k:number):C=>c.map(v=>Math.min(1,v*k)) as C;
// Closed longitudinal ring loft. Each station is z, half-width, bottom, shoulder, crown.
type Station=[number,number,number,number,number];
function loft(g:BikeEvGeometry, stations:Station[],color:C) {
  const ring=([z,w,b,s,t]:Station):V[]=>[[-w*.65,b,z],[-w,s,z],[-w*.62,t,z],[0,t+.012,z],[w*.62,t,z],[w,s,z],[w*.65,b,z],[0,b,z]];
  for(let i=1;i<stations.length;i++) {
    const a=ring(stations[i-1]),b=ring(stations[i]);
    for(let j=0;j<8;j++)g.quad(a[j],b[j],b[(j+1)%8],a[(j+1)%8],shade(color,[.78,.98,1.13,1.13,.98,.78,.6,.6][j]));
  }
  for(const st of [stations[0],stations[stations.length-1]]) {const p=ring(st);for(let j=1;j<p.length-1;j++)g.triangle(p[0],p[j],p[j+1],color);}
}
/** Axle-oriented rounded tyre, open spoke wheel and visible brake rotor. */
function wheel(g:BikeEvGeometry,x:number,y:number,z:number,r:number,width:number,bike=false,truck=false) {
  const n=20, point=(xx:number,rr:number,a:number):V=>[x+xx,y+Math.cos(a)*rr,z+Math.sin(a)*rr];
  const sections=[[-width*.5,r*.77],[-width*.5,r*.91],[-width*.33,r],[width*.33,r],[width*.5,r*.91],[width*.5,r*.77]];
  for(let i=0;i<n;i++) {
    const a=i*2*Math.PI/n,b=(i+1)*2*Math.PI/n;
    for(let j=1;j<sections.length;j++)g.quad(point(sections[j-1][0],sections[j-1][1],a),point(sections[j][0],sections[j][1],a),point(sections[j][0],sections[j][1],b),point(sections[j-1][0],sections[j-1][1],b),rubber);
    for(const s of [-1,1]) {
      const xx=s*width*.505;
      g.quad(point(xx,r*.77,a),point(xx,r*.68,a),point(xx,r*.68,b),point(xx,r*.77,b),truck?black:metal);
      if(!bike||i%2===0)g.quad(point(xx*.92,r*.60,a),point(xx*.92,r*.28,a),point(xx*.92,r*.28,b),point(xx*.92,r*.60,b),shade(metal,.64));
      if(truck) g.triangle(point(xx,0,a),point(xx,r*.7,a),point(xx,r*.7,b),i%3===0?metal:black);
    }
  }
  for(const s of [-1,1]) for(let i=0;i<(bike?5:10);i++) {
    const a=i*2*Math.PI/(bike?5:10);
    g.beam(point(s*width*.52,r*.12,a),point(s*width*.52,r*.70,a+.13),bike?.017:.025,truck?black:metal);
  }
}
function bike(g:BikeEvGeometry,color:C,ducati:boolean) {
  const axle=ducati?.91:.92, r=.385;
  // A MY2024 Panigale single-sided arm vs contemporary RR twin-arm and side can.
  wheel(g,0,r,-axle,r,.27,true); wheel(g,0,r,axle,r,.165,true);
  for(const s of [-1,1]) {
    g.beam([s*.115,r,axle],[s*.135,1.10,.54],.033,[.69,.52,.25]);
    g.beam([s*.12,r+.05,axle-.02],[s*.13,.67,.79],.046,metal);
    g.box([s*.14,.47,.82],[.055,.16,.10],ducati?[.65,.19,.13]:metal);
    if(!ducati||s===-1)g.beam([s*.17,.40,-axle],[s*.20,.57,-.10],.064,shade(metal,.66));
    g.beam([s*.16,.64,-.23],[s*.20,.94,.30],.036,metal);
    g.beam([s*.15,.73,-.20],[s*.20,1.02,-.65],.027,black);
    g.beam([s*.24,.53,-.22],[s*.35,.55,-.32],.023,metal);
  }
  g.ellipsoid([0,.60,.06],[.21,.23,.31],shade(metal,.53),10,5);
  // Tank is a shaped metal volume, leaving a real saddle valley and daylight under tail.
  loft(g,[[-.36,.17,.88,.97,1.00],[-.14,.26,.77,1.08,1.17],[.18,.28,.83,1.13,1.22],[.40,.19,.90,1.09,1.12]],color);
  loft(g,[[-1.14,.075,1.02,1.07,1.09],[-.86,.19,.98,1.11,1.14],[-.63,.22,.91,1.01,1.06],[-.35,.18,.90,.95,.98]],color);
  loft(g,[[-.70,.16,1.015,1.035,1.055],[-.48,.18,.95,.98,1.00],[-.25,.16,.94,.96,.98]],black);
  // Broad upper fairing tapers to chin; separate dark vents, belly pan and nose bridge.
  for(const s of [-1,1]) {
    const q=(p:V[]):void=>g.quad(p[0],p[1],p[2],p[3],color);
    q([[s*.09,1.12,.98],[s*.35,1.17,.71],[s*.36,.99,.40],[s*.16,.94,.83]]);
    q([[s*.35,1.17,.71],[s*.32,1.05,.23],[s*.28,.65,-.28],[s*.36,.78,.38]]);
    g.quad([s*.361,.99,.45],[s*.33,1.02,.20],[s*.275,.72,-.20],[s*.33,.77,.35],black);
    q([[s*.33,.77,.35],[s*.275,.72,-.20],[s*.22,.32,-.30],[s*.27,.34,.43]]);
    g.quad([s*.276,.70,-.20],[s*.225,.34,-.29],[s*.13,.28,-.17],[s*.19,.29,.44],shade(color,.72));
    // Front recessed headlight pockets and eyebrow DRLs.
    g.beam([s*.105,1.105,.989],[s*.29,1.135,.80],.043,black);
    g.beam([s*.108,1.128,.999],[s*.29,1.156,.805],.013,led);
    g.beam([s*.28,1.14,.62],[s*.47,1.23,.44],.015,black);
    g.ellipsoid([s*.48,1.23,.43],[.075,.035,.049],black,8,4);
    // Carbon aero blades read from the front and the chase camera.
    g.quad([s*.32,1.02,.63],[s*(ducati?.51:.46),1.00,.56],[s*(ducati?.50:.45),.98,.36],[s*.32,1.00,.41],black);
    g.beam([s*.04,1.072,-1.155],[s*.15,1.098,-1.02],.014,red);
    g.beam([s*.14,1.09,.32],[s*.35,1.07,.27],.022,black);
    if(!ducati) {
      // RR shark-gill cutouts, Motorsport blue/red separated from customizable paint.
      for(let i=0;i<3;i++)g.beam([s*.365,1.02-i*.07,.36],[s*.34,.99-i*.07,.12],.012,black);
      g.quad([s*.365,1.06,.58],[s*.365,1.02,.42],[s*.283,.65,-.18],[s*.28,.76,-.16],[.04,.27,.73]);
      g.beam([s*.366,.99,.40],[s*.285,.66,-.17],.019,red);
    }
  }
  loft(g,[[.77,.12,.95,1.12,1.17],[.65,.24,.97,1.20,1.25],[.40,.145,1.10,1.29,1.31]],glass);
  g.box([0,1.13,.35],[.17,.07,.07],black);
  // Front mudguard hugs the tyre rather than a floating rectangular fender.
  for(let i=0;i<8;i++) {const a=-1.02+i*.23,b=a+.23;g.quad([-.12,r+Math.cos(a)*.43,axle+Math.sin(a)*.43],[.12,r+Math.cos(a)*.43,axle+Math.sin(a)*.43],[.12,r+Math.cos(b)*.43,axle+Math.sin(b)*.43],[-.12,r+Math.cos(b)*.43,axle+Math.sin(b)*.43],color);}
  if(ducati) {for(const s of [-1,1]) {g.beam([s*.14,.30,.10],[s*.22,.32,-.39],.065,metal);g.box([s*.22,.32,-.44],[.12,.10,.06],black);}}
  else {g.beam([.24,.38,-.25],[.32,.63,-.89],.071,metal);g.beam([.32,.63,-.89],[.33,.66,-.96],.057,black);}
}
function cybertruck(g:BikeEvGeometry,color:C) {
  const c:C=[.60+color[0]*.13,.63+color[1]*.13,.66+color[2]*.13];
  const w=.98, front=2.33,rear=-2.33, axle=1.47,r=.43;
  // Flat stainless side panels with polygonal wheel openings. No rounded generic body.
  const zs=[-2.33,-2.02,-1.96,-1.83,-1.47,-1.11,-.98,-.90,0,.90,.98,1.11,1.47,1.83,1.96,2.02,2.33];
  const bottom=(z:number)=>{const d=Math.abs(Math.abs(z)-axle);return d<.49?(d<.36?.91:.91-(d-.36)*3.6):.39;};
  const upper=(z:number)=>1.06-.04*Math.max(0,z)/2.33;
  for(const s of [-1,1]) {
    for(let i=1;i<zs.length;i++) {const a=zs[i-1],b=zs[i];g.quad([s*w,bottom(a),a],[s*w,bottom(b),b],[s*w,upper(b),b],[s*w,upper(a),a],shade(c,s===1?.91:1));}
    for(const z of [-axle,axle]) {
      wheel(g,s*.87,r,z,r,.25,false,true);
      const path:V[]=[[s*1.005,.40,z-.51],[s*1.005,.72,z-.51],[s*1.005,.94,z-.35],[s*1.005,.94,z+.35],[s*1.005,.72,z+.51],[s*1.005,.40,z+.51]];
      for(let i=1;i<path.length;i++)g.beam(path[i-1],path[i],.044,black);
    }
    g.beam([s*.99,.38,-.89],[s*.99,.38,.89],.04,black);
    // Single roof apex, straight sloped windscreen and rear sail.
    g.quad([s*.98,upper(-1.38),-1.38],[s*.77,1.65,-.20],[s*.77,1.65,.06],[s*.98,1.17,1.52],c);
    g.quad([s*.958,1.12,-1.22],[s*.788,1.61,-.19],[s*.788,1.61,.055],[s*.958,1.23,1.29],glass);
    g.beam([s*.965,1.12,-.22],[s*.79,1.61,-.22],.022,black);
    g.beam([s*.983,.44,-.22],[s*.983,1.26,-.22],.007,shade(c,.5));
    g.beam([s*.983,.43,.94],[s*.983,1.20,.94],.007,shade(c,.5));
    g.quad([s*.94,1.24,1.05],[s*1.14,1.20,.91],[s*1.10,1.14,.86],[s*.94,1.16,.94],black);
  }
  g.quad([-.96,1.17,1.49],[.96,1.17,1.49],[.76,1.65,.06],[-.76,1.65,.06],glass);
  g.quad([-.76,1.65,.06],[.76,1.65,.06],[.76,1.65,-.20],[-.76,1.65,-.20],black);
  g.quad([-.96,1.17,1.49],[.96,1.17,1.49],[.98,1.02,front],[-.98,1.02,front],shade(c,1.13));
  // Closed ribbed tonneau slopes down into the squared tailgate.
  g.quad([-.76,1.65,-.20],[.76,1.65,-.20],[.90,1.04,rear],[-.90,1.04,rear],shade(c,.67));
  for(let i=1;i<13;i++){const t=i/13,z=-.20-2.13*t,y=1.65-.61*t+.004;g.beam([-.76-.14*t,y,z],[.76+.14*t,y,z],.006,shade(c,.45));}
  for(const z of [rear,front]) {g.box([0,.71,z],[1.96,.61,.055],c);g.box([0,.42,z],[1.86,.19,.10],black);}
  g.box([0,1.012,front+.03],[1.88,.034,.032],led);
  g.box([0,1.027,rear-.035],[1.87,.035,.035],red);
  for(const s of [-1,1])g.box([s*.78,.71,front+.035],[.17,.042,.03],led);
  g.box([0,.66,rear-.041],[.35,.16,.025],black);
}
function roadster(g:BikeEvGeometry,color:C) {
  const r=.335,axle=1.24;
  // Sculpted hip shoulders and arched side skins, explicitly open above each tyre.
  const zs=[-1.94,-1.80,-1.65,-1.54,-1.42,-1.24,-1.06,-.94,-.82,-.6,0,.6,.82,.94,1.06,1.24,1.42,1.54,1.65,1.80,1.94];
  const section=(z:number)=>{const u=Math.abs(z)/1.94,w=.94-.20*Math.pow(u,5)-.065*Math.exp(-z*z*2),deck=.70-.17*Math.pow(Math.max(0,z)/1.94,2)-.07*Math.pow(Math.min(0,z)/1.94,4);return {w,deck};};
  for(let i=1;i<zs.length;i++) {
    const za=zs[i-1],zb=zs[i],a=section(za),b=section(zb);
    const arch=(z:number)=>{const d=Math.abs(Math.abs(z)-axle);return d<.39?r+Math.sqrt(.39*.39-d*d):.19;};
    for(const s of [-1,1]) {
      g.quad([0,a.deck,za],[s*a.w*.78,a.deck+.035,za],[s*b.w*.78,b.deck+.035,zb],[0,b.deck,zb],shade(color,1.1));
      g.quad([s*a.w*.78,a.deck+.035,za],[s*a.w,a.deck-.045,za],[s*b.w,b.deck-.045,zb],[s*b.w*.78,b.deck+.035,zb],color);
      g.quad([s*a.w,a.deck-.045,za],[s*a.w*.97,Math.min(arch(za),a.deck-.045),za],[s*b.w*.97,Math.min(arch(zb),b.deck-.045),zb],[s*b.w,b.deck-.045,zb],shade(color,.85));
    }
  }
  for(const s of [-1,1]) {
    for(const z of [-axle,axle])wheel(g,s*.79,r,z,r,.27);
    g.beam([s*.87,.20,-.80],[s*.87,.20,.80],.027,black);
    // Window outline has no upright sedan B-pillar: a low continuous glass canopy.
    g.quad([s*.70,.72,-1.09],[s*.54,1.08,-.54],[s*.53,1.09,.21],[s*.69,.69,.92],glass);
    g.beam([s*.70,.72,-1.09],[s*.54,1.08,-.54],.024,color);
    g.beam([s*.53,1.09,.21],[s*.69,.69,.92],.021,color);
    g.beam([s*.54,1.08,-.54],[s*.53,1.09,.21],.018,color);
    g.beam([s*.71,.73,.68],[s*.94,.76,.54],.019,black);
    g.ellipsoid([s*.96,.76,.54],[.10,.035,.067],color,8,4);
    g.beam([s*.883,.60,-.34],[s*.883,.60,-.13],.009,metal);
    g.beam([s*.885,.58,-.49],[s*.87,.24,-.60],.006,shade(color,.55));
    // Narrow swept headlights mounted on the sloping front shoulders.
    g.quad([s*.47,.57,1.945],[s*.72,.585,1.88],[s*.76,.66,1.60],[s*.61,.65,1.64],black);
    g.beam([s*.49,.582,1.95],[s*.72,.598,1.885],.012,led);
    g.beam([s*.72,.598,1.885],[s*.745,.65,1.66],.010,led);
    g.beam([s*.38,.58,-1.955],[s*.71,.61,-1.88],.015,red);
    g.beam([s*.71,.61,-1.88],[s*.85,.60,-1.67],.013,red);
  }
  // Longitudinal canopy bands with crown rather than a flat windscreen slab.
  const bands=[-1,-.66,-.33,0,.33,.66,1];
  const p=(t:number,z:number,w:number,y:number):V=>[t*w,y+(1-t*t)*.035,z];
  for(let i=1;i<bands.length;i++) {const a=bands[i-1],b=bands[i];
    g.quad(p(a,.92,.69,.69),p(b,.92,.69,.69),p(b,.21,.53,1.09),p(a,.21,.53,1.09),glass);
    g.quad(p(a,.21,.53,1.09),p(b,.21,.53,1.09),p(b,-.54,.54,1.08),p(a,-.54,.54,1.08),shade(glass,.75));
    g.quad(p(a,-.54,.54,1.08),p(b,-.54,.54,1.08),p(b,-1.09,.70,.72),p(a,-1.09,.70,.72),glass);
  }
  for(const z of [-1.94,1.94]) {const a=section(z);g.quad([-a.w,.20,z],[a.w,.20,z],[a.w*.78,a.deck+.035,z],[-a.w*.78,a.deck+.035,z],color);}
  g.box([0,.28,1.96],[1.12,.12,.045],black);
  g.beam([-.66,.19,1.95],[.66,.19,1.95],.025,black);
  g.box([0,.28,-1.96],[1.36,.18,.055],black);
  for(const x of [-.48,-.24,0,.24,.48])g.box([x,.20,-1.87],[.028,.13,.27],black);
  g.beam([-.71,.655,-1.89],[.71,.655,-1.89],.018,shade(color,.75));
}
/** Returns false only for an ID not owned by this module. */
export function buildBikeEv(g:BikeEvGeometry,color:C,id:string):boolean {
  if(id==='ducati'||id==='bmw-bike')bike(g,color,id==='ducati');
  else if(id==='cybertruck')cybertruck(g,color);
  else if(id==='tesla-roadster')roadster(g,color);
  else return false;
  return true;
}
