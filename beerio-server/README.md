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
room.beginCharacterSelection(); // host only, once everyone has joined
room.chooseCharacter({ direction: 'right' }); // player joystick: up/down/left/right
room.chooseCharacter({ confirm: true }); // player SELECT; last pick starts five seconds
room.chooseCharacter({ confirm: false }); // change pick; cancels an active countdown
room.skipOfflineDrivers(); // explicit host choice before a race
room.setLocked(false);     // host returns to joining/rematch; no manual start lock
room.publishState(state);  // host only, JSON-compatible state, capped to 20 Hz
const unsubscribe = room.onState(state => { /* controller HUD */ });
room.leaveRoom();
```

`createRoom` and `joinRoom` accept optional `relayUrl` for an operator override. New hosts negotiate `characterSelectionVersion: 2`; deploy this relay before deploying the matching site, and create a new room. The new UI explains an older relay instead of silently falling back to ready-up. Version 1 selection rooms and recovered checkpoints keep their original 24-character navigation. Version 2 rooms expose 30 characters and require current phone clients; outdated clients receive a refresh-required message rather than an unseen selection. Resume capability errors preserve existing credentials and cannot allocate a recovered room. Legacy rooms without character selection retain the earlier ready protocol.

Public room state includes `characterSelection`, `characterSelectionVersion`, `selectionPhase` (`gathering`, `selecting`, `countdown`, `racing`), `countdownEndsAt`, and `serverTime`. Clients normalize the deadline to their own clock when receiving a snapshot. Players include `characterConfirmed` alongside identity, appearance, connection, and `inRace`.

The host opens character selection once everyone has joined with a name and color. The 6×5 grid uses the supplied 24 animal portraits at `public/beerio/characters.jpg` with Indian first names, plus six original vector portraits at `public/beerio/portraits/`: Bezos, Trump, Musk, Zuckerberg, Ye and Huang. Their requested outfits and accessories are cosmetic and grant no gameplay advantage. The portraits reflect each individual’s skin tone, hair, face, requested costume and accessories. Direction wrapping derives its row count from the negotiated roster. Phone joystick messages change the authenticated player's cursor in four directions. SELECT confirms that character, with no separate ready-up. Shared characters are allowed and every driver's name stays visible above their chosen card. Once all joined players have confirmed, the relay begins a full five-second countdown. The relay sweeper atomically locks the race and freezes the roster at the end, after rechecking every player is connected, confirmed and acknowledged. The host starts only from that lock acknowledgment, and uses an initial simulation countdown of zero, so no extra three seconds are added.

New arrivals, an unconfirmed choice, disconnected phones, pending checkpoint acknowledgments or a disconnected host cancel the countdown. After resolution, a fresh five seconds starts. Missing drivers can reconnect with the same identity and pick, leave explicitly, expire after the existing grace period, or be omitted by the host's explicit Continue without disconnected drivers action. New joins after the race lock are refused. A non-participating returning controller cannot drive in an already-started race. Host Back to joining and post-race unlock clear picks for the next selection.

Relay restart checkpoints preserve character picks, but a recovered countdown always restarts with a full five seconds once everyone returns. Reloading the host page intentionally reopens joining because the browser's race simulation cannot be recovered. Disconnect/reconnect without reload preserves the active selection/race and neutralizes controls. Finish or Back to lobby while offline is reconciled on reconnect, so the relay cannot stay stuck locked.

Status is `idle`, `connecting`, `connected`, `reconnecting`, `error`, or `closed`. `recovering` pauses a restored race while the IDs in `recoveryWaitingFor` return; host-only `resumeRace()` explicitly continues without them. `canRetryConnection` identifies errors where `retryConnection()` can preserve the race. `onState` returns an unsubscribe callback. `leaveRoom` discards the saved session; unmount/reload preserves it to allow resume. A saved host session restores the lobby and a saved player session restores the controller. A join link targeting a different room skips restoration. Do not start authoritative simulation from a player session, a disconnected host, or a room with `recovering: true`.

The headless `BeerioRoomClient` class exposes the same commands, plus `getSnapshot()`, `subscribe(listener)`, `restoreSession(expectedCode?)`, and `destroy()` for non-React integration.
