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

Checks: `npm run test:game`, `npm run test:room`, and `npm --prefix beerio-server test`. A production build needs `NEXT_PUBLIC_BEERIO_RELAY_URL` set to the public secure WebSocket URL for multiplayer. Without it, solo practice works but room creation and joining will report that a relay is required.
