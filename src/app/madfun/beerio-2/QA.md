# Beerio 2: physical phone acceptance test

Seattle Night is separate from the original game. Its web route is `/madfun/beerio-2`; do not alter the live Beerio route or relay for this test. Use a separate **HTTPS preview** of the exact commit on both phones. A plain HTTP laptop LAN address is not a valid WebGPU compatibility test: WebGPU is exposed only in a [secure context](https://www.w3.org/TR/webgpu/#gpu).

1. Open the preview on a physical iPhone in Safari and on a physical Android phone in Chrome. Record model, OS, browser, network, commit, and the renderer shown in the footer: **WebGPU**, **WebGL 2**, or **Compatibility**. Do not infer the renderer from browser age.
2. In each orientation, hold Gas and drag the steering pad with a second finger, then brake and release both inputs. Complete a lap: verify that the timer starts on throttle, records Best only after crossing the ordered gates and finish line, and starts a new lap. Hold Drift while turning and look for **BOOST** when released after a charged drift. Check that Reset clears the current run and keeps Best.
3. Repeat several laps. Switch apps or lock the phone with Gas held, wait, then return. Gas must not remain held. The view should resume or offer a usable recovery path; record any black canvas, context loss, or notable stutter. [WebKit device-loss report](https://bugs.webkit.org/show_bug.cgi?id=331130) motivates this check but does not establish a Beerio 2 issue.
4. Run again with `?webgl=1` in the URL to deliberately skip WebGPU. Verify **WebGL 2** on capable devices or **Compatibility** if neither accelerated renderer is available. Test a real accelerator run separately from this fallback.
5. Record what passed, the renderer, and what was never exercised. Browser emulation does not certify physical touch controls or GPU stability.

The solo prototype was exercised in Chromium’s software view on desktop and at phone width. The current online suite uses isolated relay rooms and checks concurrent races, the ten-driver cap, reconnecting, the wrong-game-code path, three complete laps with real WASM physics, results, and rematches. Neither accelerated rendering nor a physical phone session is verified by these tests.

## Neon Orbit upgrade

- **Renderer:** Seattle Night and Neon Orbit both support WebGPU, WebGL 2 and the CPU compatibility view. GPU view adapts pixel density to frame time. Check distant/nearby rival LOD and wheel animation, orbital gates and planet, boost trail and drift sparks; use reduced-motion preference to confirm streak/lean reduction.
- **Input:** Try portrait and landscape. Hold Gas and drag the steering pad with separate fingers; add Drift, release it after the meter fills and check the boost and sound. Repeat with keyboard and background/restore. Sound starts after a trusted gesture and is independently mutable. Input Ack is elapsed send → host applies input → returned snapshot, not network ping.
- **Solo:** Try both circuits in Time Trial (reset retains circuit-specific best); then Race AI, verify countdown, grid and finish/rematch. AI and guests use the actual three-lap WASM simulation.
- **Online:** Host chooses the circuit; invite opens the same circuit on guest. Room protocol and shared relay are unchanged. Host draws its authoritative 60 Hz state without waiting for its own snapshot. Guests use the latest authoritative own-car pose; only rivals use a 100 ms smoothing buffer. Active matches stay in their original browser session.
- **Benchmarks:** Deterministic 10-driver simulation, 25 ms each way with ±12 ms jitter: input-to-authoritative-update mean 107 → 90 ms, p95 160 → 126 ms (54 events); snapshot rate remains 15 Hz. Loopback integration verified 10 drivers connected and receiving frames. NullEngine geometry audit: hero 54 → 27 draw-ready meshes, rivals 9 → 6 near / 1 far. These are synthetic / headless measurements, not claims about gameplay FPS or latency on a real phone.

## Phone host and optional TV companion

- Host & Drive creates a race on the same phone the host uses to drive. Start, Pause/Resume, and Back to Starting Grid stay on the host phone. An optional platform screen wake lock is held while hosting/watching and released on exit; keep the host tab visible.
- Optional TV view uses a separate private link. Open it on one TV browser or TV-connected computer, select Open TV View once, then no controls are needed. In the lobby the display surfaces the normal driver QR; in-race it follows the host's view; results/rematch follow automatically.
- The TV uses the existing invitation-zoned non-player relay seat, not a driver's slot. Race packets never contain the TV invite; credentials stay in the URL fragment until the spectator connects. The spectator cannot send racing commands. In-tab reconnect resumes, but reload can require waiting up to 90 seconds for the prior leased slot; explicit Exit TV View releases it immediately.
