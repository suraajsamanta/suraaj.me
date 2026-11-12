# Madfun / Ricochet release

Scope: new `/madfun` hub, `/madfun/beerio` alias sharing the existing Beerio implementation (old `/beerio` still works), original `/madfun/boomerang` game. Bump Club and Floor Is Trouble are future concepts, not playable.

Ricochet: shared TV arena; up to ten phone players; private QR/code rooms; three maps; optional bots; movement joystick, throw/recall, dash; countdown, sudden death, round scores, first-to-five matches, rematch; original host-side action audio and mute; fullscreen where the browser supports it.

Safety: based on live main `7fd4c3e06444d5f0e6b54f13a76891411aa82ab3`. No files under Beerio, public assets, or beerio-server changed. The separately held Beerio countdown/fullscreen/steering/finish release is NOT part of this release. Use `[skip render]`; no relay deploy/restart or infrastructure change.

Validation: existing Beerio suite 414 tests passed; new engine and actual-loopback relay tests cover ten-player capacity, a second simultaneous room, routing isolation, reconnect, neutral inputs, rematch actions, Beerio compatibility and gameplay. Production Next build and ESLint checked. Desktop hub/menu/practice/countdown animated canvas and compact invite form reviewed in cloud browser. Physical phone layout, cellular latency and audible sound quality not verified. Local preview forwards the app only, so browser multiplayer was not verified against its local relay.

Operational limitations: free relay may cold-start. Keep host browser open. Brief network reconnects supported within relay grace periods, but a relay restart/closed host/reloaded host needs a new Ricochet room. No public random matchmaking for Ricochet in this version. Existing Beerio recovery and matchmaking untouched.
