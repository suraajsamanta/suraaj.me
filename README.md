# suraaj.me

A quiet, dark landing page for Suraaj Samanta, built with Next.js App Router, React, and TypeScript. Black and white design with a centered name, a simple learning/building/exploring tagline, and GitHub and LinkedIn links. Responsive and reduced-motion aware, with no analytics, tracking, or backend services.

## Development

```sh
npm install
npm run dev
```

Open http://localhost:3000.

## Checks

```sh
npx eslint src/app
npm run build
```

## Deployment

Deploy the GitHub repository on Vercel, then add `suraaj.me` in the project domain settings. Follow Vercel's exact DNS instructions at the domain registrar. Account authentication and access to the domain's DNS are required.

## Editing

- Copy, links, and logos: `src/app/page.tsx`
- Styles and mobile layout: `src/app/globals.css`
- Search and social metadata: `src/app/layout.tsx`
- Favicon: `src/app/icon.svg`

## Beerio

`/beerio` is a split-screen kart racer. Solo practice runs in the browser; internet play also requires the separately hosted room relay described in [beerio-server/README.md](beerio-server/README.md). The laptop is authoritative and phones send controller inputs only. For local development, run the relay and Next app in separate terminals as documented there.

Choose one of seven courses in the host lobby or before solo practice: Sunset Circuit, Canyon Switchback, Brewery Run, Seattle Skyline, Orbital Overdrive, Foundry Frenzy, or Prism Skyway. Prism Skyway is an exposed rainbow road where racers fall and respawn after missing an edge. Seattle Skyline climbs a mountain road, circles the Needle, and runs through the Spheres. Orbital Overdrive winds through a space station and asteroid field. Foundry Frenzy is a 2.25 km technical circuit with alternating switchbacks, two elevated crests, a maintenance-bridge shortcut, and glowing industrial scenery. For multiplayer, the host screen shows the QR code, settings and 30-character grid together. Drivers join with a name and color and can choose immediately using a four-way phone joystick and SELECT; their names appear over their choices. No character is assigned until chosen. Once everyone has picked, the host starts an authoritative eight-second countdown. Each racer is an original 3D model, with matching full-body selection artwork. The animal racers have friendly first names alongside six guest racers. All appearance choices are cosmetic. Solo practice retains the full character/vehicle/color garage. On a phone, drag the steering joystick and hold GO or BRAKE; drive through pickup boxes, then double-tap GO or tap USE ITEM (or press E in solo practice). Collected boxes vanish immediately and pickups/activations have stronger sound, burst and text feedback. Dance Break makes the racer immediately ahead hop out and dance; Twerk Trap does the same to the racer immediately behind with a twerk animation. Storm Spark briefly slows every rival, while Berry Blot covers most of their racing view. Diddy Mode sends glossy baby oil across every rival’s racing view for four seconds, keeping names, maps, items and controls readable. Guards and other protection can block these attacks. Steering assist is optional. After the race, the leaderboard shows each driver's item count and offers a rematch or a return to the lobby. Race music and sound effects are original synthesizer audio and can be muted on the race screen.

Checks: `npm run test:game` (includes the course suites), `npm run test:room`, `npm run test:presentation`, `npm run test:view`, `npm run test:audio`, and `npm --prefix beerio-server test`. Production builds default to the public Beerio relay; set `NEXT_PUBLIC_BEERIO_RELAY_URL` at build time to use another secure WebSocket endpoint. Development defaults to the local relay. Room recovery limitations and deployment guidance are documented in the relay README.

### Original race audio

The seven courses use six original 16-bar fight-song arrangements (Prism Skyway shares the space score): a strong brass hook, lower-ensemble answers, driving bass, marching snare flams and fills. Each course has its own key, arrangement and timbre:

- **Sunset / Golden Hour Rally:** 148 BPM stadium brass and a soaring ensemble hook.
- **Canyon / Red Rock Regiment:** 144 BPM low horns, stomping toms and canyon echoes.
- **Brewery / Brass on Tap:** 148 BPM bouncing bass, playful low-brass answers and drumline.
- **Seattle / Skyline Sound:** 144 BPM electric keys, warm brass and a city breakbeat.
- **Space / Orbital Anthem:** 148 BPM softer synth horns, wide suspended pads, shimmering stereo arpeggios and longer echoes.
- **Foundry / Ironworks Uprising:** 152 BPM heavy low brass, pulsing bass and metallic percussion.

No recordings, samples, quotations, Nintendo music or other third-party audio are used. The musical material, instruments and percussion are synthesized locally from authored note data.

- Arrangement metadata: `src/app/beerio/game/audioTracks.ts`. Score source: `src/app/beerio/game/audioScore.ts`. Rebuild all six deterministic assets with `npm run generate:race-audio` (Node + the existing TypeScript dependency; no audio packages or downloads).
- Published assets: six WAVs in `public/beerio/audio/`, 15,017,964 bytes total, 25.26–26.67 seconds each, 24 kHz stereo 16-bit PCM. WAV preserves the exact loop seam and broad Web Audio/Safari support. Synthesis and mastering run offline, not on the race's main thread.
- The host fetches and decodes only the selected course asynchronously. A three-course LRU cache reuses buffers for rematches while bounding retained mobile memory. Playback uses one looping source on the audio clock, independent of graphics frames or player count. Switching courses fades the old score and invalidates stale loading results. Effects still work if a music asset fails; the sound control exposes **Retry music**.
- Every arrangement is level-matched to 0.110 linear RMS, with measured peaks from 0.535 to 0.612 and a maximum master target of 0.72. DC removal, short seam smoothing and stereo room reflections polish the score without squeezing drum transients. Live cues briefly duck music and retain the existing compressor/soft limiter.
- Mute is remembered locally. Hidden tabs and host connection pauses fade the mix; resuming preserves the musical position. Interrupted browser audio shows **Resume sound** instead of falsely reporting playback. Leaving the race releases its graph; late downloads cannot restart it. The sound button tooltip identifies the selected original score.
- `npm run test:audio` checks all six assets against regenerated PCM, levels/DC/stereo/seams, per-course loading/cache eviction, rapid course switches, stale success/failure responses, cue deduplication for ten racers, quiet idle, bounded effect retriggers, load failures/retries, pause/mute/rematch/disposal, and browser-context lifecycle with deterministic doubles. These checks do not replace listening on real desktop and mobile hardware.
