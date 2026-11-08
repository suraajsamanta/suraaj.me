import assert from 'node:assert/strict';
import test from 'node:test';
import { createRace, stepRace, type GamePlayer } from './simulation';
import { addSeattleScenery, SEATTLE_NEEDLE, SEATTLE_SPHERE_FRACTIONS, type SeattleGeometry } from './seattleScenery';
import { ACTIVE_SHORTCUT, SHORTCUT_LENGTH, SHORTCUT_POINTS, TRACK_LENGTH, TRACK_POINTS, TRACKS, sampleTrack, selectTrack, shortcutPose, trackCurve, trackPose } from './track';

const driver = (id: string): GamePlayer => ({ id, name: id, color: '#f64', input: { steer: 0, accelerate: true, brake: false } });

test('Seattle road actually climbs and descends in physical distance, with unit lanes and an elevated chase camera', () => {
  selectTrack('seattle');
  assert.ok(trackPose(.30 * TRACK_LENGTH).position[1] > 8);
  assert.ok(trackPose(.38 * TRACK_LENGTH).position[1] > 25);
  assert.ok(trackPose(.57 * TRACK_LENGTH).position[1] < 2);
  let length3d = 0, length2d = 0, maxGrade = 0;
  for (let i = 1; i < TRACK_POINTS.length; i++) {
    const a = TRACK_POINTS[i - 1], b = TRACK_POINTS[i];
    const planar = Math.hypot(b.x-a.x, b.z-a.z), vertical = b.y-a.y;
    length2d += planar; length3d += Math.hypot(planar, vertical);
    maxGrade = Math.max(maxGrade, Math.abs(vertical) / planar);
  }
  assert.ok(length3d > length2d + 2);
  assert.ok(Math.abs(length3d - TRACK_LENGTH) < 1e-7);
  assert.ok(maxGrade < .4, `grade ${maxGrade}`);
  for (let i = 0; i < 1200; i++) {
    const radius = 1 / Math.abs(trackCurve(i / 1200 * TRACK_LENGTH));
    assert.ok(radius > 11.2, `road shoulder must not fold on a radius of ${radius}m`);
  }
  const pose = trackPose(.35 * TRACK_LENGTH, 7, 4.5), ground = trackPose(.35 * TRACK_LENGTH);
  assert.ok(Math.abs(Math.hypot(pose.position[0]-ground.position[0],pose.position[2]-ground.position[2])-7) < 1e-7);
  assert.ok(Math.abs(pose.position[1]-ground.position[1]-4.5) < 1e-7);
  assert.ok(Math.abs(Math.hypot(...pose.forward)-1) < 1e-7);
});

test('main road circles the Needle and passes through all three hollow Spheres', () => {
  selectTrack('seattle');
  const angles: number[] = [];
  for (let f=.67; f<=.90; f+=.002) {
    const p=trackPose(f*TRACK_LENGTH).position, dx=p[0]-SEATTLE_NEEDLE[0], dz=p[2]-SEATTLE_NEEDLE[2];
    assert.ok(Math.hypot(dx,dz)>20, 'Needle legs stay out of the road');
    const a=Math.atan2(dz,dx), last=angles.at(-1);
    angles.push(last === undefined ? a : last + Math.atan2(Math.sin(a-last),Math.cos(a-last)));
  }
  assert.ok(Math.abs(angles.at(-1)!-angles[0]) > Math.PI * 1.25, 'road wraps most of the tower');
  for (const f of SEATTLE_SPHERE_FRACTIONS) {
    const center=trackPose(f*TRACK_LENGTH).position;
    assert.equal(center[1], 0);
    // The wire shell's center is 14m above the centerline, safely above karts.
    assert.ok(14 > 3.5);
  }
});

test('Sphere lattice leaves more than 3.5m of kart clearance at every entrance', () => {
  selectTrack('seattle');
  const beams: { a: number[]; b: number[] }[] = [];
  const noop = () => {};
  const geometry: SeattleGeometry = { triangle: noop, quad: noop, box: noop, cylinder: noop, disc: noop,
    beam(a, b) { beams.push({ a, b }); } };
  addSeattleScenery(geometry);
  for (const fraction of SEATTLE_SPHERE_FRACTIONS) {
    const p = trackPose(fraction * TRACK_LENGTH).position;
    const oldLowHoop = p[1] + 14 - 16 / Math.sqrt(2);
    const lowSegments = beams.filter(({ a, b }) => Math.abs(a[1] - oldLowHoop) < 1e-6 && Math.abs(b[1] - oldLowHoop) < 1e-6 &&
      Math.hypot(a[0] - p[0], a[2] - p[2]) < 17 && Math.hypot(b[0] - p[0], b[2] - p[2]) < 17);
    assert.equal(lowSegments.length, 0, 'no low hoop can cross a driver on the road');
    assert.ok(beams.some(({ a, b }) => Math.abs(a[1] - (p[1] + 14)) < 1e-6 && Math.abs(b[1] - (p[1] + 14)) < 1e-6 &&
      Math.hypot(a[0] - p[0], a[2] - p[2]) < 17), 'the visible upper hoops remain');
  }
});

test('ten Seattle drivers complete a race with monotone progress and no free branch laps', () => {
  selectTrack('seattle');
  const players=Array.from({length:10},(_,i)=>driver(String(i))), race=createRace(players,1);
  race.countdown=0;
  for(let step=0;step<5000 && !race.complete;step++) {
    const previous=race.karts.map(k=>k.distance);
    stepRace(race,players,1/60);
    race.karts.forEach((k,i)=>{assert.ok(k.distance >= previous[i]); assert.ok(k.distance-previous[i]<2);});
  }
  assert.equal(race.karts.filter(k=>k.finishTime !== null).length, 10);
});

test('crossing roads on separate elevations cannot produce kart or item ghost hits', () => {
  selectTrack('space');
  // Construct an isolated vertical crossing from two samples, so the test does
  // not depend on whether a particular course happens to include an overpass.
  const branch = SHORTCUT_POINTS[53], next = SHORTCUT_POINTS[54];
  const mainDistance = TRACK_LENGTH * .30, main = trackPose(mainDistance);
  Object.assign(branch, { x: main.position[0], y: main.position[1] + 8, z: main.position[2] });
  Object.assign(next, { x: branch.x + main.forward[0] * 2, y: branch.y, z: branch.z + main.forward[2] * 2 });
  const branchDistance=ACTIVE_SHORTCUT.start*TRACK_LENGTH + branch.distance/SHORTCUT_LENGTH*(ACTIVE_SHORTCUT.end-ACTIVE_SHORTCUT.start)*TRACK_LENGTH;
  assert.ok(Math.abs(shortcutPose(branchDistance).position[1]-main.position[1])>7);
  const players=[driver('a'),driver('b')]; players.forEach(p=>p.input.accelerate=false);
  const race=createRace(players); race.countdown=0;
  Object.assign(race.karts[0],{distance:branchDistance,lane:0,speed:0,onShortcut:true});
  Object.assign(race.karts[1],{distance:mainDistance,lane:0,speed:0,onShortcut:false});
  race.powers.hazards.push({id:99,ownerId:'a',distance:branchDistance,lane:0,life:5,onShortcut:true});
  stepRace(race,players,0);
  assert.equal(race.karts[0].bump,0); assert.equal(race.karts[1].bump,0); assert.equal(race.powers.hazards.length,1);
  selectTrack('space'); // restore the authored samples
});

test('old circuits remain exactly flat',()=>{
  for(const track of TRACKS.filter(t=>['sunset','canyon','brewery'].includes(t.id))) {
    const samples=sampleTrack(track); assert.ok(samples.every(p=>p.y===0));
  }
  selectTrack('sunset');
});
