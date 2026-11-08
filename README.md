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

Choose one of three courses in the host lobby or before solo practice. The garage lets drivers pick an original character, vehicle and color. On a phone, drag the steering joystick and hold GO or BRAKE; drive through pickup boxes, then tap USE ITEM (or press E in solo practice). Dance Break is a playful item that stops your kart briefly. Steering assist is optional. After the race, the leaderboard shows each driver's item count and offers a rematch or a return to the lobby. Race music and sound effects are original synthesizer audio and can be muted on the race screen.

Checks: `npm run test:game`, `npm run test:room`, `npm run test:presentation`, `npm run test:view`, `npm run test:audio`, and `npm --prefix beerio-server test`. Production builds default to the public Beerio relay; set `NEXT_PUBLIC_BEERIO_RELAY_URL` at build time to use another secure WebSocket endpoint. Development defaults to the local relay. Room recovery limitations and deployment guidance are documented in the relay README.

### Original race audio

The race uses an original 16-bar, 132 BPM instrumental, “Soda Pop Sprint,” with a rounded engine, soft drums, plucked melody, bass, chords, and original item cues. No Nintendo music, recordings, samples, or other third-party audio is used.

- Score source: `src/app/beerio/game/audioScore.ts`. Rebuild its deterministic asset with `npm run generate:race-audio` (Node + the existing TypeScript dependency; no audio packages or downloads).
- Published asset: `public/beerio/audio/soda-pop-sprint.wav`, 2,792,772 bytes, 29.09 seconds, 24 kHz stereo 16-bit PCM. WAV preserves the exact loop seam and broad Web Audio/Safari support. Generation runs offline, not on the race's main thread.
- The host fetches/decodes once asynchronously and reuses the decoded buffer for rematches. Playback follows the audio clock, independent of graphics frames. Sound effects still work if music loading fails; the sound control exposes **Retry music**.
- Mute is remembered locally. Hidden tabs and host connection pauses fade the mix; resuming preserves the musical position. Interrupted browser audio shows **Resume sound** instead of falsely reporting playback. Leaving the race releases its graph; a late download cannot restart it.
- `npm run test:audio` checks loop reproducibility/headroom, cue deduplication for ten racers, quiet idle, bounded effect retriggers, load failures/retries, pause/mute/rematch/disposal, and browser-context lifecycle with deterministic doubles. These tests do not replace listening on real desktop and mobile hardware.
