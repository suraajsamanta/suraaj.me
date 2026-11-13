# Madfun party games (held, not published)

New routes: `/madfun/bump-club`, `/madfun/floor-is-trouble`. Hub upgrades from future cards to playable game links. Existing Beerio and Ricochet routes preserved.

Bump Club: 2–10 humans/bots, slippery inertial bumper physics, directional shove, dash impact, falling off shrinking circular platform, three arenas, five-second countdown, first-to-five scoring, KO attribution and rematches.

Floor Is Trouble: 2–10 humans/bots, three tile-pattern arenas, flashing warnings before floor drops, joystick movement and timed jump, round scores and rematches. Both reuse private legacy relay rooms, with separate state markers and wrong-game code rejection. No relay/server change or paid service.

Validation: 39 Madfun tests, full lint and production build pass. Local real WebSocket integration runs 30 controllers in three simultaneous game rooms with capacity, movement/state isolation, rematch, reconnect and wrong-game checks. Desktop browser practice, countdown, renderer and exit verified for both new games. Physical phone/cellular and audible sound quality remain unverified.

Transport incorporates the separate Ricochet rate-limit hotfix: sparse state/HUD updates, bounded input cadence, no queued stale snapshots, token-preserving reconnect on rate_limit. Host simulation remains 60Hz. Host refresh or relay restart still requires a new game room; brief network reconnect supported.

Release scope excludes all held Beerio gameplay changes and must not restart the relay. Publish only after user instruction, with `[skip render]`. Ricochet hotfix is tracked as a separate commit/release.
