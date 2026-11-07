import assert from 'node:assert/strict';
import test from 'node:test';
import { createRace, stepRace, type GamePlayer } from './simulation';
import { ACTIVE_SHORTCUT, SHORTCUT_LENGTH, TRACK_LENGTH, TRACKS, sampleShortcut, selectTrack, shortcutPose, trackPose } from './track';

const driver = (id: string): GamePlayer => ({ id, name: id, color: '#fff', input: { steer: 0, accelerate: true, brake: false } });

test('each authored branch is genuinely shorter and joins the correct side smoothly', () => {
  for (const track of TRACKS) {
    selectTrack(track.id);
    const { start, end, side } = ACTIVE_SHORTCUT;
    const points = sampleShortcut(track);
    assert.ok(SHORTCUT_LENGTH < (end - start) * TRACK_LENGTH, track.name);
    assert.ok(SHORTCUT_LENGTH > 0);
    assert.equal(points.length, 129);
    const mainStart = trackPose(start * TRACK_LENGTH), mainEnd = trackPose(end * TRACK_LENGTH);
    const first = shortcutPose(start * TRACK_LENGTH), last = shortcutPose(end * TRACK_LENGTH);
    assert.ok(Math.hypot(first.position[0] - mainStart.position[0], first.position[2] - mainStart.position[2]) < 0.01);
    assert.ok(Math.hypot(last.position[0] - mainEnd.position[0], last.position[2] - mainEnd.position[2]) < 0.01);
    const angleDiff = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
    assert.ok(angleDiff(first.yaw, mainStart.yaw) < 0.1);
    assert.ok(angleDiff(last.yaw, mainEnd.yaw) < 0.1);
    const next = points[16];
    const lateral = (next.x - mainStart.position[0]) * mainStart.right[0] + (next.z - mainStart.position[2]) * mainStart.right[2];
    assert.ok(lateral * side > 0, `${track.id} should branch on marked side`);
    // Offset-lane transition can only be as large as the tangent sample mismatch.
    const laneA = trackPose(start * TRACK_LENGTH, side * 5).position;
    const laneB = shortcutPose(start * TRACK_LENGTH, side * 5).position;
    assert.ok(Math.hypot(laneA[0] - laneB[0], laneA[2] - laneB[2]) < 0.5);
  }
  selectTrack('sunset');
});

test('entrance requires crossing forward in the marked lane and cannot award free laps', () => {
  for (const track of TRACKS) {
    selectTrack(track.id);
    for (const correctSide of [false, true]) {
      const players = [driver('a')], race = createRace(players, 3); race.countdown = 0;
      const kart = race.karts[0], start = ACTIVE_SHORTCUT.start * TRACK_LENGTH;
      Object.assign(kart, { distance: start - 0.1, lane: (correctSide ? 1 : -1) * ACTIVE_SHORTCUT.side * 4, speed: 20 });
      stepRace(race, players, 1 / 60);
      assert.equal(kart.onShortcut, correctSide, track.id);
      if (!correctSide) continue;
      const progress = kart.distance;
      kart.speed = 0; players[0].input.accelerate = false;
      stepRace(race, players, 1 / 60);
      assert.equal(kart.distance, progress, 'stationary branch kart gets no progress');
      players[0].input.accelerate = true;
      const exit = ACTIVE_SHORTCUT.end * TRACK_LENGTH;
      for (let i = 0; i < 1000 && kart.onShortcut; i++) {
        kart.lane = 0; kart.lateral = 0; kart.speed = 25;
        const before = kart.distance;
        stepRace(race, players, 1 / 60);
        assert.ok(kart.distance - before < 2, 'no jump at exit');
      }
      assert.equal(kart.onShortcut, false);
      assert.ok(kart.distance >= exit && kart.distance < exit + 2);
      assert.equal(kart.finishTime, null);
      const after = kart.distance;
      for (let i = 0; i < 20; i++) stepRace(race, players, 1 / 60);
      assert.equal(kart.onShortcut, false, 'cannot farm the same entrance before the next lap');
      assert.ok(kart.distance < after + 20);
    }
  }
  selectTrack('sunset');
});

test('ten racers may take the route and remote parallel roads do not collide', () => {
  selectTrack('sunset');
  const players = Array.from({ length: 10 }, (_, i) => driver(String(i)));
  const race = createRace(players); race.countdown = 0;
  const start = ACTIVE_SHORTCUT.start * TRACK_LENGTH;
  race.karts.forEach((kart, i) => Object.assign(kart, { distance: start - 1 - Math.floor(i / 2) * 4.5, lane: ACTIVE_SHORTCUT.side * (3 + i % 2), speed: 25 }));
  for (let i = 0; i < 90; i++) stepRace(race, players, 1 / 60);
  assert.ok(race.karts.some(kart => kart.onShortcut));
  const pair = createRace(players.slice(0, 2)); pair.countdown = 0;
  const mid = (ACTIVE_SHORTCUT.start + ACTIVE_SHORTCUT.end) / 2 * TRACK_LENGTH;
  Object.assign(pair.karts[0], { distance: mid, lane: 0, speed: 0, onShortcut: true });
  Object.assign(pair.karts[1], { distance: mid, lane: 0, speed: 0, onShortcut: false });
  for (const player of players) player.input.accelerate = false;
  stepRace(pair, players, 1 / 60);
  assert.equal(pair.karts[0].lane, 0);
  assert.equal(pair.karts[1].lane, 0);
});

test('Jet does not choose an entrance, but follows and exits a branch already chosen', () => {
  selectTrack('sunset');
  const players = [driver('rear'), driver('leader')], race = createRace(players); race.countdown = 0;
  const rear = race.karts[0], leader = race.karts[1];
  const start = ACTIVE_SHORTCUT.start * TRACK_LENGTH, end = ACTIVE_SHORTCUT.end * TRACK_LENGTH;
  Object.assign(rear, { distance: start - 0.1, lane: ACTIVE_SHORTCUT.side * 4, speed: 40 });
  rear.power.jet = 2; leader.distance = start + 100;
  stepRace(race, players, 1 / 60);
  assert.equal(rear.onShortcut, false, 'automatic steering must not choose a shortcut');
  Object.assign(rear, { distance: end - 0.1, lane: 0, speed: 40, onShortcut: true });
  rear.power.jet = 2; leader.distance = end + 100;
  const before = rear.distance;
  stepRace(race, players, 1 / 60);
  assert.equal(rear.onShortcut, false);
  assert.ok(rear.distance >= end && rear.distance - before < 2, 'jet merges normally without a progress jump');
});

test('all nine laps cross branch junctions monotonically despite floating-point rounding', () => {
  for (const track of TRACKS) {
    selectTrack(track.id);
    for (let lap = 0; lap < 9; lap++) {
      for (const offset of [0.1, 0.00000001]) {
        const players = [driver('seam')], race = createRace(players, 9); race.countdown = 0;
        const kart = race.karts[0];
        const entrance = lap * TRACK_LENGTH + ACTIVE_SHORTCUT.start * TRACK_LENGTH;
        Object.assign(kart, { distance: entrance - offset, lane: ACTIVE_SHORTCUT.side * 4, speed: 43 });
        const before = kart.distance;
        stepRace(race, players, 1 / 60);
        assert.equal(kart.onShortcut, true, `${track.id} lap ${lap + 1}`);
        assert.ok(kart.distance > before && kart.distance - before < 2, `${track.id} lap ${lap + 1} entrance is continuous`);
        const exit = lap * TRACK_LENGTH + ACTIVE_SHORTCUT.end * TRACK_LENGTH;
        Object.assign(kart, { distance: exit - offset, lane: 0, lateral: 0, speed: 43 });
        const justBeforeExit = kart.distance;
        stepRace(race, players, 1 / 60);
        assert.equal(kart.onShortcut, false, `${track.id} lap ${lap + 1} merges`);
        assert.ok(kart.distance >= justBeforeExit && kart.distance - justBeforeExit < 2, `${track.id} lap ${lap + 1} exit is continuous`);
      }
    }
  }
  selectTrack('sunset');
});

test('branch kart collisions use physical positions, including mixed-route junctions', () => {
  for (const track of TRACKS) {
    selectTrack(track.id);
    const ratio = (ACTIVE_SHORTCUT.end - ACTIVE_SHORTCUT.start) * TRACK_LENGTH / SHORTCUT_LENGTH;
    const players = [driver('a'), driver('b')];
    players.forEach(p => { p.input.accelerate = false; });
    const pair = createRace(players); pair.countdown = 0;
    const middle = (ACTIVE_SHORTCUT.start + ACTIVE_SHORTCUT.end) / 2 * TRACK_LENGTH;
    Object.assign(pair.karts[0], { distance: middle, lane: 0, speed: 0, onShortcut: true });
    Object.assign(pair.karts[1], { distance: middle + 2 * ratio, lane: 0, speed: 0, onShortcut: true });
    stepRace(pair, players, 0);
    assert.ok(pair.karts[0].bump > 0 && pair.karts[1].bump > 0, `${track.id}: 2 physical metres apart collide`);

    const merge = createRace(players); merge.countdown = 0;
    const entrance = ACTIVE_SHORTCUT.start * TRACK_LENGTH;
    Object.assign(merge.karts[0], { distance: entrance + 2 * ratio, lane: 0, speed: 0, onShortcut: true });
    Object.assign(merge.karts[1], { distance: entrance - 0.1, lane: 0, speed: 0, onShortcut: false });
    stepRace(merge, players, 0);
    assert.ok(merge.karts[0].bump > 0 && merge.karts[1].bump > 0, `${track.id}: close karts on different routes collide at the junction`);
  }
  selectTrack('sunset');
});

test('branch and junction contact resolution is invariant under reversed roster order', () => {
  for (const track of TRACKS) {
    selectTrack(track.id);
    const players = [driver('a'), driver('b')];
    players.forEach(p => { p.input.accelerate = false; });
    const start = ACTIVE_SHORTCUT.start * TRACK_LENGTH, end = ACTIVE_SHORTCUT.end * TRACK_LENGTH;
    for (const lap of [0, 7, 8]) {
      for (const branchDistance of [start + 2, start + 4, (start + end) / 2, end - 4, end - 2]) {
        for (const offset of [-4, -2, 0, 2, 4]) {
          for (const [branchLane, mainLane] of [[0, 0], [-3, -3], [3, 0]]) {
            const race = createRace(players, 9); race.countdown = 0;
            Object.assign(race.karts[0], { distance: lap * TRACK_LENGTH + branchDistance, lane: branchLane, speed: 0, onShortcut: true });
            Object.assign(race.karts[1], { distance: lap * TRACK_LENGTH + branchDistance + offset, lane: mainLane, speed: 0, onShortcut: false });
            const reversed = structuredClone(race); reversed.karts.reverse();
            stepRace(race, players, 0); stepRace(reversed, players, 0);
            const byId = (r: typeof race) => r.karts.map(({ id, lane, bump, speed }) => ({ id, lane, bump, speed })).sort((a, b) => a.id.localeCompare(b.id));
            assert.deepEqual(byId(race), byId(reversed), `${track.id} lap ${lap + 1}, junction ${branchDistance}, offset ${offset}`);
          }
        }
      }
    }
  }
  selectTrack('sunset');
});

test('stationary branch contacts separate rather than drift together toward a rail', () => {
  for (const track of TRACKS) {
    selectTrack(track.id);
    const ratio = (ACTIVE_SHORTCUT.end - ACTIVE_SHORTCUT.start) * TRACK_LENGTH / SHORTCUT_LENGTH;
    const players = [driver('a'), driver('b')];
    players.forEach(p => { p.input.accelerate = false; });
    for (const lap of [0, 7, 8]) {
      const race = createRace(players, 9); race.countdown = 0;
      const middle = lap * TRACK_LENGTH + (ACTIVE_SHORTCUT.start + ACTIVE_SHORTCUT.end) / 2 * TRACK_LENGTH;
      Object.assign(race.karts[0], { distance: middle, lane: 0, speed: 0, onShortcut: true });
      Object.assign(race.karts[1], { distance: middle + 2 * ratio, lane: 0, speed: 0, onShortcut: true });
      const reversed = structuredClone(race); reversed.karts.reverse();
      for (let i = 0; i < 5; i++) { stepRace(race, players, 0); stepRace(reversed, players, 0); }
      const byId = (r: typeof race) => r.karts.map(({ id, lane }) => ({ id, lane })).sort((a, b) => a.id.localeCompare(b.id));
      const result = byId(race);
      assert.ok(result[0].lane * result[1].lane < 0, `${track.id} lap ${lap + 1} must move into opposite lanes`);
      assert.ok(Math.abs(result[0].lane - result[1].lane) >= 1.5, `${track.id} karts must separate`);
      assert.deepEqual(result, byId(reversed), 'separation is roster-order independent');
    }
  }
  selectTrack('sunset');
});
