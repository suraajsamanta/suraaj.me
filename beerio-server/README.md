# Beerio room relay

A small, self-hostable WebSocket relay for the Beerio page. No accounts, signup, database, or payment service is required. The laptop runs all race simulation and sends optional game-state updates; phones send only validated steer/throttle/brake controls. The relay routes those messages, assigns six-character room codes, reserves reconnecting racers, and enforces host-only actions.

**This is a separate long-running service.** Vercel supports WebSockets, but separate function instances do not share this relay's in-memory rooms. Shipping the site without a reachable relay does not enable internet multiplayer. Local solo play is independent of the relay.

## Local run

From the repository root:

```sh
npm --prefix beerio-server install
npm --prefix beerio-server test
# Optional browser-client unit tests, using the root TypeScript dev dependency:
node --test src/app/beerio/room/client.test.mjs
npm --prefix beerio-server start
# In another terminal:
npm run dev -- --hostname 0.0.0.0
```

The relay listens on `0.0.0.0:8787`. During Next development the client defaults to `ws://<the website hostname>:8787`. For LAN phones, open the laptop's LAN IP, not `localhost`, on each phone. The local firewall must allow the site and relay ports. Local development accepts any Origin unless an explicit allowlist is set. LAN testing does **not** verify internet/cellular connectivity.

## Internet/cellular deployment

1. Run this directory as a Node 20+ service on a server you already control. Install its independent dependency with `npm ci`; run `node server.mjs`. No Next runtime is needed.
2. Put it behind a TLS reverse proxy with WebSocket upgrade support and a public domain such as `relay.example.com`. Use one process/replica. Rooms live in process memory, with authenticated host-browser recovery after a restart as described below. Never round-robin multiple independent instances without a shared room router.
3. Set service environment variables:
   - `NODE_ENV=production`
   - `PORT=8787` (or your hosting service's supplied port)
   - `BEERIO_ALLOWED_ORIGINS=https://suraaj.me,https://www.suraaj.me` using the exact origins you actually deploy. Production startup refuses an empty allowlist. Add each authorized preview origin explicitly if you need previews; no wildcard matching.
4. Set **the Next site's build-time** environment variable `NEXT_PUBLIC_BEERIO_RELAY_URL=wss://relay.example.com/room`, then rebuild/redeploy the site. It is a public endpoint, not a secret. Do not use a localhost/private-IP URL for cellular players. HTTPS pages require WSS.
5. Verify `https://relay.example.com/health` responds, create a room on the laptop, and join it from a phone with Wi-Fi disabled. Then verify reconnect, deliberate Leave, host disappearance, and stale-input reset. This cellular deployment step has not been performed by the implementation.

Example Caddy reverse-proxy configuration, on a machine with DNS and inbound ports already set up:

```caddyfile
relay.example.com {
  reverse_proxy 127.0.0.1:8787
}
```

No external infrastructure or account has been created by this project. Deploying this service is an explicit remaining operator step.

## Restart recovery and safe releases

- Do not release or restart while people are playing. Obtain an agreed quiet window, verify `/health` has zero rooms immediately before release, and coordinate the site and relay versions. Recovery is crash protection, not permission to interrupt a live game.
- New clients keep an immutable room identity derived by SHA-256 from the private 192-bit host token. The host retains a private roster checkpoint containing controller-token hashes, appearance, race participants, lock state, and item sequence floors. These hashes never enter public rosters or controller messages. No database, paid storage, account, or persistent server key is needed.
- A new controller receives its welcome only after a recovery-capable host acknowledges retaining its checkpoint. A ten-second acknowledgment timeout fails that join safely. Legacy clients retain the previous join behavior.
- After a relay process disappears, only the matching host-token preimage can restore the room identity. Every controller still proves its own private token. Public codes are never recovery credentials. The restored room gets a fresh random public code; existing controllers follow the immutable identity automatically and update their deep links. New players should use the updated QR code.
- Race simulation stays on the existing host page and pauses during reconnect. After recovery, it stays paused until the originally connected race participants return, or the host explicitly chooses to continue without missing controllers. Old disconnected lobby reservations do not block that gate. Waiting participant seats remain reserved until that choice or room closure. All driving input is neutralized, and old item actions cannot replay.
- The client retries for a bounded period. If the relay or host is still unavailable, use **Retry connection**, which preserves the current race and credentials. Do not leave, refresh, or create a new room to recover an active race.
- `SIGTERM`/`SIGINT` announce a recoverable relay restart, never an intentional room closure. Explicit host Leave still closes the room and removes saved credentials.
- Recovery requires a checkpoint from the new protocol and a surviving host page. It cannot restore a room already lost on the old relay, recover a closed host tab's simulation, survive deleted browser credentials, or provide a shared router across independent replicas. Session storage helps restore credentials after reload, but the running race itself is not persisted. Storage-disabled browsers still recover a relay restart while the host page remains open.

Run `node --test src/app/beerio/room/recovery-integration.test.mjs` from the repository root for a real local-process test: six browser clients, an abrupt SIGKILL, a graceful SIGTERM, phones arriving before the host, neutral controls, exact identities/appearance, and preserved item sequence floors. It uses loopback test services only and never connects to the deployed relay.

## Safety and operational bounds

- Only the host's private 192-bit resume token authorizes publishing state or locking the lobby. A public room code only authorizes joining an unlocked lobby. Host never occupies a racer slot.
- Four to ten racer slots, ten by default. Names can contain up to 64 Unicode code points; longer names are rejected rather than truncated; each racer gets a stable unique color and ID.
- Inputs are finite steer `[-1, 1]` plus boolean `accelerate` and `brake`. The relay resets them after 500 ms without fresh input and immediately upon disconnect. The host browser adds a 600 ms local stale-input reset. Controllers also reset on blur/backgrounding. Game code must use only current room inputs and pause or finish safely when disconnected.
- The first create/join waits up to 90 seconds for a cold relay, with bounded retries for early connection failures and a waking-up hint after ten seconds. Explicit Leave cancels the wait. Existing-session reconnects keep shorter timeouts.
- Player slots survive disconnection for 90 seconds. Host room survives disconnection for 30 seconds. Reconnection requires the private session token, not just the room code. Explicit host Leave ends it immediately. Tokens are stored only in the browser's session storage; do not log or copy them into join links.
- Host state updates are capped at 20 Hz and 32,768 serialized characters; transport payload limit is 40 KiB. Inputs share a 60-message/second token bucket with 80-message burst allowance. Normal clients send roughly 10–40 messages/second. Queues over 256 KiB are disconnected. Ping/pong detects dead links.
- Maximum 250 rooms and 2,000 sockets per process. Unauthenticated sockets time out after 15 seconds. Idle rooms expire after two hours. Limit process/network resources and add ingress connection/rate limits for a public deployment.
- Upgrade throttle is 120 connections/minute per **TCP peer address**. Behind a reverse proxy that address can be shared by all users. Configure appropriate per-client ingress throttling and tune this bound before scaling. The service intentionally does not trust caller-supplied forwarded IP headers.
- `/health` returns counts and service status only. There is no room-list endpoint. Joining by room code means anyone with that code can take an available slot, so avoid publishing codes publicly. Lock the room when the race starts.

## Client API

The game uses `useBeerioRoom` from `src/app/beerio/room/useBeerioRoom.ts`. Keep one hook mounted across lobby/race transitions.

```tsx
const room = useBeerioRoom({ autoResume: true });
room.createRoom({ maxPlayers: 10 });
room.joinRoom({ code: 'ABC234', name: 'Avery' });
room.setInput({ steer: -0.3, accelerate: true, brake: false });
room.useItem();            // one press; the relay and host reject replayed sequences
room.resetInput();
room.setReady(true);        // player only, after choosing racer and ride
room.setLocked(true);       // host only; requires connected racers to be ready
room.publishState(state);  // host only, JSON-compatible state, capped to 20 Hz
const unsubscribe = room.onState(state => { /* controller HUD */ });
room.leaveRoom();
```

`createRoom` and `joinRoom` accept optional `relayUrl` for a deliberate operator override. State fields are `status`, `role`, `code`, `playerId`, `players`, `maxPlayers`, `locked`, `hostConnected`, `error`, and `relayUrl`. `players` include `{ id, name, color, character, vehicle, connected, ready, inRace, input }`. The relay atomically freezes `inRace` at the start, excluding disconnected or unconfirmed seats. In an unlocked lobby, changing appearance or reconnecting clears readiness; unlocking after a race and restoring an unlocked room require everyone to ready up again. A locked race can recover without a new ready-up.

Status is `idle`, `connecting`, `connected`, `reconnecting`, `error`, or `closed`. `recovering` pauses a restored race while the IDs in `recoveryWaitingFor` return; host-only `resumeRace()` explicitly continues without them. `canRetryConnection` identifies errors where `retryConnection()` can preserve the race. `onState` returns an unsubscribe callback. `leaveRoom` discards the saved session; unmount/reload preserves it to allow resume. A saved host session restores the lobby and a saved player session restores the controller. A join link targeting a different room skips restoration. Do not start authoritative simulation from a player session, a disconnected host, or a room with `recovering: true`.

The headless `BeerioRoomClient` class exposes the same commands, plus `getSnapshot()`, `subscribe(listener)`, `restoreSession(expectedCode?)`, and `destroy()` for non-React integration.
