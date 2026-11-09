import assert from 'node:assert/strict';
import test from 'node:test';
import { createRace, raceResults, stepRace, type GamePlayer } from './simulation';
import { ACTIVE_SHORTCUT, BARRIER_OFFSET, SHORTCUT_LENGTH, SHORTCUT_POINTS, TRACK_LENGTH, TRACK_POINTS, TRACKS, clamp, selectTrack, shortcutPose, trackCurve, trackPose, wrap, type TrackPoint, type Vec3 } from './track';
import { FOUNDRY_COURSE, FOUNDRY_SECTORS } from './foundryCourse';
import { addFoundryScenery, foundryCorridorClear, foundryPropLayout, FOUNDRY_GANTRY, type FoundryGeometry } from './foundryScenery';
import { racePose, routeOffset } from './renderer';
import { createCircuitMap, mapPoint } from './minimap';

const headingDelta = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
function minimumRadius(points: TrackPoint[]) {
  let result = Infinity;
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1], b = points[i], c = points[i + 1];
    const ab = Math.hypot(b.x-a.x,b.z-a.z), bc = Math.hypot(c.x-b.x,c.z-b.z), ac = Math.hypot(c.x-a.x,c.z-a.z);
    const cross = Math.abs((b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x));
    if (cross > 1e-8) result = Math.min(result, ab * bc * ac / (2 * cross));
  }
  return result;
}

test('Foundry is a longer, technically varied original course with safe geometry and a smooth start seam', () => {
  selectTrack('foundry');
  assert.equal(TRACKS.length, 6);
  assert.equal(FOUNDRY_COURSE.controlPoints.length, 35);
  assert.equal(FOUNDRY_COURSE.elevations?.length, 35);
  assert.ok(TRACK_LENGTH > 2200 && TRACK_LENGTH < 2300);
  assert.deepEqual(TRACK_POINTS[0], { ...TRACK_POINTS[TRACK_POINTS.length-1], distance: 0 });
  assert.ok(Math.max(...TRACK_POINTS.map(p => p.y)) > 38);
  assert.ok(Math.min(...TRACK_POINTS.map(p => p.y)) > 7.5);
  assert.ok(minimumRadius(TRACK_POINTS) > 11.2, 'the entire shoulder remains unfolded');
  let lastSign = 0, reversals = 0;
  for (let i = 0; i < 1000; i++) {
    const curve = trackCurve(i / 1000 * TRACK_LENGTH);
    if (Math.abs(curve) < 0.006) continue;
    const sign = Math.sign(curve);
    if (lastSign && lastSign !== sign) reversals++;
    lastSign = sign;
  }
  assert.ok(reversals >= 14, `genuine alternating bends, got ${reversals}`);
  for (let i = 0; i < TRACK_POINTS.length - 1; i++) {
    const a = TRACK_POINTS[i], b = TRACK_POINTS[i + 1];
    assert.ok(b.distance > a.distance);
    assert.ok(Math.abs(b.y-a.y) / Math.hypot(b.x-a.x,b.z-a.z) < .16);
    for (let j = i + 1; j < TRACK_POINTS.length - 1; j++) {
      const other = TRACK_POINTS[j], along = Math.abs(a.distance - other.distance);
      if (Math.min(along, TRACK_LENGTH - along) < 45) continue;
      assert.ok(Math.hypot(a.x-other.x,a.z-other.z) > 40, `no overlapping ribbons ${i}/${j}`);
    }
  }
  const before = trackPose(TRACK_LENGTH - .001), after = trackPose(.001);
  assert.ok(Math.hypot(...before.position.map((v, i) => v-after.position[i])) < .003);
  assert.ok(Math.abs(headingDelta(before.yaw, after.yaw)) < .06);
  assert.deepEqual(TRACKS.filter(t => t.id !== 'foundry').map(t=>t.id), ['sunset','canyon','brewery','seattle','space']);
});

test('maintenance bypass saves distance, has drivable bends, and never crosses another road', () => {
  selectTrack('foundry');
  const { start, end, side } = ACTIVE_SHORTCUT, span = (end - start) * TRACK_LENGTH;
  assert.ok(SHORTCUT_LENGTH > span * .65 && SHORTCUT_LENGTH < span * .75);
  assert.ok(minimumRadius(SHORTCUT_POINTS) > 19);
  // Check the surfaces, not just structural props: an overlapping elevated
  // deck can pass through a kart even when every beam and centerline is clear.
  for (const branch of SHORTCUT_POINTS) for (const main of TRACK_POINTS) {
    if (Math.hypot(branch.x-main.x,branch.z-main.z) < 23) {
      assert.ok(Math.abs(branch.y-main.y) < .10, 'main and branch merge on a common level deck');
    }
  }
  for (let i=0;i<=160;i++) for (const lane of [-9,-4,0,4,9]) {
    const p=shortcutPose((start+(end-start)*i/160)*TRACK_LENGTH,lane).position;
    for (const main of TRACK_POINTS) {
      if (Math.hypot(p[0]-main.x,p[2]-main.z)<11.2) {
        assert.ok(Math.abs(p[1]-main.y)<.10, 'every branch lane clears the main road surface');
      }
    }
  }
  for (const f of [start, end]) {
    const main = trackPose(f * TRACK_LENGTH), branch = shortcutPose(f * TRACK_LENGTH);
    assert.ok(Math.hypot(...main.position.map((v, i) => v-branch.position[i])) < 1e-6);
    assert.ok(Math.abs(headingDelta(main.yaw, branch.yaw)) < .04, 'junction tangents align');
    assert.ok(Math.abs(main.forward[1] - branch.forward[1]) < .02);
  }
  const entrance = trackPose(start * TRACK_LENGTH), first = SHORTCUT_POINTS[16];
  assert.ok(((first.x-entrance.position[0])*entrance.right[0]+(first.z-entrance.position[2])*entrance.right[2])*side > 0);
  const orient = (a: TrackPoint,b: TrackPoint,c: TrackPoint) => (b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
  for (let i = 2; i < SHORTCUT_POINTS.length - 3; i++) {
    const a = SHORTCUT_POINTS[i], b = SHORTCUT_POINTS[i+1];
    for (let j = 0; j < TRACK_POINTS.length - 1; j++) {
      const c = TRACK_POINTS[j], d = TRACK_POINTS[j+1], f = c.distance / TRACK_LENGTH;
      if (Math.min(Math.abs(f-start),Math.abs(f-end)) < .008) continue;
      assert.ok(!(orient(a,b,c)*orient(a,b,d)<0 && orient(c,d,a)*orient(c,d,b)<0), `crossing ${i}/${j}`);
      if (f < start-.025 || f > end+.025) assert.ok(Math.hypot(a.x-c.x,a.z-c.z) > 35);
    }
  }
  for (let i = 1; i < SHORTCUT_POINTS.length; i++) {
    const a=SHORTCUT_POINTS[i-1],b=SHORTCUT_POINTS[i];
    assert.ok(Math.abs(b.y-a.y)/Math.hypot(b.x-a.x,b.z-a.z) < .20);
  }
});

test('Foundry previews, kart dots and chase camera follow both elevated roads through their joins', () => {
  selectTrack('foundry');
  const map = createCircuitMap(FOUNDRY_COURSE), [x,y,w,h]=map.viewBox.split(' ').map(Number);
  assert.ok(!map.path.includes('NaN') && !map.branch.includes('NaN'));
  for (const point of [...TRACK_POINTS,...SHORTCUT_POINTS]) {
    const dot = mapPoint(point);
    assert.ok(dot.x>x && dot.x<x+w && dot.y>y && dot.y<y+h);
  }
  for (const f of [ACTIVE_SHORTCUT.start, ACTIVE_SHORTCUT.end]) {
    for (const delta of [-.001,.001]) {
      const at=f*TRACK_LENGTH+delta;
      const eye=racePose(routeOffset(at,-9,true),0,4.5,true), target=racePose(routeOffset(at,14,true),0,1.1,true);
      assert.ok([...eye.position,...target.position].every(Number.isFinite));
      assert.ok(Math.hypot(...eye.position.map((v,i)=>v-target.position[i])) < 28, 'camera uses physical route metres');
    }
  }
  assert.deepEqual(map.start,mapPoint(TRACK_POINTS[0]));
});

function sceneryProbe() {
  let vertices=0,calls=0,signature=0;
  const boxes: {center:Vec3;size:Vec3;yaw:number}[]=[];
  const beams: {a:Vec3;b:Vec3;width:number}[]=[];
  const inspect=(points:Vec3[],triangles:number)=>{
    calls++;vertices+=triangles*3;
    for(const p of points){assert.ok(p.every(Number.isFinite));signature+=p[0]*.17+p[1]*.3+p[2]*.43;}
  };
  const geometry:FoundryGeometry={
    triangle(a,b,c){inspect([a,b,c],1);},quad(a,b,c,d){inspect([a,b,c,d],2);},
    box(center,size,_color,yaw=0){assert.ok(size.every(n=>n>0));boxes.push({center,size,yaw});inspect([center,size],12);},
    cylinder(center,radius,height,_color,sides=8){assert.ok(radius>0&&height>0);inspect([center],sides*3);},
    sphere(center,radius,_color,slices=10,rings=6){assert.ok(radius>0);inspect([center],slices*rings*2);},
    beam(a,b,width){assert.ok(width>0);beams.push({a,b,width});inspect([a,b],8);},
    disc(center,rx,rz,_color,sides=20){assert.ok(rx>0&&rz>0);inspect([center],sides);},
  };
  return {geometry,result:()=>({vertices,calls,signature,boxes,beams})};
}

test('Foundry props, structural beams and gantry leave the complete main/branch driving corridor open',()=>{
  selectTrack('foundry');
  const props=foundryPropLayout();
  assert.ok(props.length>=18 && props.length<=40);
  assert.deepEqual(props,foundryPropLayout());
  for(const prop of props)assert.ok(foundryCorridorClear(prop.center,prop.radius));
  assert.ok(FOUNDRY_GANTRY.halfWidth>BARRIER_OFFSET+2);
  assert.ok(FOUNDRY_GANTRY.roofHeight>10);
  const probe=sceneryProbe();addFoundryScenery(probe.geometry);
  const {boxes,beams}=probe.result();
  for(const branch of [false,true])for(let i=0;i<280;i++)for(const lane of [-9,0,9]){
    const f=branch?ACTIVE_SHORTCUT.start+(ACTIVE_SHORTCUT.end-ACTIVE_SHORTCUT.start)*i/280:i/280;
    const p=(branch?shortcutPose:trackPose)(f*TRACK_LENGTH,lane,1.2).position;
    for(const box of boxes){
      const dx=p[0]-box.center[0],dy=p[1]-box.center[1],dz=p[2]-box.center[2];
      const x=dx*Math.cos(box.yaw)-dz*Math.sin(box.yaw),z=dx*Math.sin(box.yaw)+dz*Math.cos(box.yaw);
      assert.ok(!(Math.abs(x)<box.size[0]/2+.8&&Math.abs(dy)<box.size[1]/2+1&&Math.abs(z)<box.size[2]/2+.8),'kart clearance around boxes');
    }
    for(const {a,b,width} of beams){
      const d=b.map((n,j)=>n-a[j]),len=d.reduce((s,n)=>s+n*n,0);
      const t=clamp(d.reduce((s,n,j)=>s+n*(p[j]-a[j]),0)/(len||1),0,1);
      const dist=Math.hypot(...p.map((v,j)=>v-a[j]-t*d[j]));
      assert.ok(dist>width*1.5+1.25,`kart clearance around beams ${JSON.stringify({branch,f,lane,p,a,b,width,dist})}`);
    }
  }
});

test('Foundry scenery is deterministic and stays inside its single static mesh budget',()=>{
  selectTrack('foundry');
  const a=sceneryProbe(),b=sceneryProbe();addFoundryScenery(a.geometry);addFoundryScenery(b.geometry);
  assert.deepEqual(a.result(),b.result());
  const {vertices,calls}=a.result();
  assert.ok(vertices>20000 && vertices<65000,`vertices ${vertices}`);
  assert.ok(calls<2600,`calls ${calls}`);
  assert.equal(FOUNDRY_SECTORS[0].start,0);
  assert.equal(FOUNDRY_SECTORS.at(-1)?.end,1);
  FOUNDRY_SECTORS.slice(1).forEach((s,i)=>assert.equal(s.start,FOUNDRY_SECTORS[i].end));
});

test('ten Foundry drivers complete three legal laps deterministically on both physical routes',()=>{
  const run=()=>{
    selectTrack('foundry');
    const players:GamePlayer[]=Array.from({length:10},(_,i)=>({id:`foundry-${i}`,name:`Driver ${i}`,color:'#fa3',input:{steer:0,accelerate:true,brake:false}}));
    const race=createRace(players,3);race.countdown=0;
    const shortcuts=new Set<string>();
    for(let step=0;step<60*250 && !race.complete;step++){
      const previous=race.karts.map(k=>k.distance);
      race.karts.forEach((kart,i)=>{
        const toEntry=ACTIVE_SHORTCUT.start*TRACK_LENGTH-wrap(kart.distance);
        const target=i%2===0&&toEntry>0&&toEntry<45?ACTIVE_SHORTCUT.side*4:0;
        players[i].input.steer=clamp((kart.lane-target)*.6,-1,1);
        if(kart.onShortcut)shortcuts.add(kart.id);
      });
      stepRace(race,players,1/60);
      race.karts.forEach((kart,i)=>{
        assert.ok(kart.distance>=previous[i]&&kart.distance-previous[i]<2,'continuous monotone progress');
        assert.ok([kart.distance,kart.lane,kart.speed,kart.heading].every(Number.isFinite));
        assert.ok(Math.abs(kart.lane)<=BARRIER_OFFSET-1.15+1e-6);
        if(kart.finishTime!==null)assert.ok(kart.distance>=3*TRACK_LENGTH);
      });
    }
    assert.equal(race.karts.filter(k=>k.finishTime!==null).length,10);
    assert.equal(race.complete,true);assert.ok(shortcuts.size>=4&&shortcuts.size<10);
    return {results:raceResults(race),shortcuts:[...shortcuts]};
  };
  assert.deepEqual(run(),run());selectTrack('sunset');
});

test('Foundry can be driven without steering assist, with ordinary braking and no rail riding',()=>{
  selectTrack('foundry');
  const player:GamePlayer={id:'manual',name:'Manual',color:'#fc3',input:{steer:0,accelerate:true,brake:false}};
  const race=createRace([player],1);race.countdown=0;
  let maxLane=0;
  for(let step=0;step<60*120&&!race.complete;step++){
    const kart=race.karts[0];
    let nextCurve=0;
    for(let ahead=0;ahead<=35;ahead+=5)nextCurve=Math.max(nextCurve,Math.abs(trackCurve(kart.distance+ahead)));
    const targetSpeed=Math.min(40,1.7/Math.max(.001,nextCurve));
    player.input.accelerate=kart.speed<targetSpeed;
    player.input.brake=kart.speed>targetSpeed+1;
    // Deterministic test driver uses only the same steer/brake inputs as a human.
    player.input.steer=clamp((kart.heading*3+kart.lane*.2-trackCurve(kart.distance)*kart.speed)/(1.4+kart.speed*.025),-1,1);
    stepRace(race,[player],1/60,false);
    maxLane=Math.max(maxLane,Math.abs(kart.lane));
  }
  assert.equal(race.complete,true);
  assert.ok(race.karts[0].finishTime!==null);
  assert.ok(maxLane<3,'the legal manual line stays comfortably on the road');
  selectTrack('sunset');
});
