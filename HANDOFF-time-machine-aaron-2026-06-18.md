# Handoff — Time Machine (globe replay) → Aaron

**From Ben (`design`), 2026-06-18.** The Time Machine **app consumer is built**. What's
left is mostly **push + deploy** (one backend commit) + an **on-device pass**. The
backend replay query was already yours and is largely done (C4.5).

---

## ⏱️ START HERE (Aaron)

1. **Push + deploy `wrld-backend` `81eb83b`** — `GET /clips/:id` now `include`s the
   clip's enabled `tracks` (`kind` / `manifestUrl` / `dataUrl`). **It is committed
   LOCAL-ONLY on `main` (not pushed).** Push it, then pull on the Hetzner box.
   *Without it the clip viewer's source rail is camera + identity only* (the app
   degrades gracefully — see below).
2. **Confirm `clips/discover` C4.5 is deployed on the box.** It's already on
   `origin/main` (the LEFT-JOIN version that surfaces buffer-promoted clips +
   honours the clip's current precision/identity). If the box hasn't pulled it,
   the rolled-back globe will be empty.
3. **On-device verify the done-bar** (below).

> Ben's app commits are on `design` (ahead 4, unpushed). Ben pushes `design → main`
> on his sign-off per the usual protocol; coordinate so the deploy + the app land
> together.

---

## What Ben built (app, `design`)

Pure app work on the existing clip-playback foundation — no new native module, no
EAS rebuild. `tsc` clean (only the pre-existing `stream/${string}` typed-route
errors).

- **`src/api/clips.ts`** — `clipsApi.discover(atISO)` → `GET /clips/discover`;
  `clipsApi.get(id)` → `GET /clips/:id`. `ClipDetail` now expects `startAtMs` /
  `endAtMs` / `tracks[]`.
- **`src/hooks/useHistoricalClips.ts`** — TanStack, disabled at offset 0, 5s-bucketed
  playhead so pins refresh as the playhead advances.
- **`GlobeScreenMapbox` TIME MACHINE SEAM** (implemented): `timeOffsetMs > 0` swaps
  the live viewport pins for `clipPins.map(clipToStream)` (clips mapped into the
  `Stream` shape, reusing the whole pin/cluster/card path). Clip pins get a "Watch"
  card → `/(app)/clip/[id]?seekSec=N`. Count bubbles + self-pin suppressed in the past.
- **`app/(app)/clip/[id].tsx` → `ClipViewerScreen`** — plays the clip's primary
  manifest (expo-video), seeks to `seekSec`. **Switchable source rail** of the clip's
  CAPTURED sources, each replaying at the playhead through the live `SourceStage`
  visualizers (`useDataTrack` + `dataTrackRender` sampling — same machinery as
  `ClipsScreen`). Bottom chrome, bottom-up above the footer: **clock · transport ·
  rail**. A passive `TimeScrubber` (`interactive={false}`) reads the real wall-clock
  time the footage was captured, ticking with playback. Subscribers-only (403),
  no-media, and load-error blocked states.

## What you (Aaron) already shipped for this

- **`GET /clips/discover?at=<ISO>` (C4.5)** — LEFT JOINs Recording **and**
  BufferSession so both clip provenances surface; honours the clip's CURRENT
  `locDisplayPrecision` + `attributed` (anon → host 'anonymous'); excludes `off`.
  On `origin/main`.
- **`GET /clips/:id`** — base route (manifestUrl + host + the subscribers-only 403)
  was already live; `81eb83b` only ADDS the `tracks` include (additive, non-breaking).
  `startAtMs`/`endAtMs` ride the existing `convertBigInts` preSerialization hook.

## Done-bar (on device, after deploy)

1. Scrub the globe clock back → only **surviving public clip pins** at the playhead
   appear (live streams hidden); pins replay forward as the playhead advances and a
   clip's pin vanishes when its window passes.
2. Tap a clip pin → **Watch** card → the replay viewer lands at the right instant.
3. The viewer's **source rail** shows the clip's captured sources (camera/audio/
   sensors/location/chat/identity) and switching replays each at the playhead; the
   **broadcast clock** ticks the captured wall-clock time; the **transport** drives
   playback.
4. `THEN → NOW` (offset 0) restores the live viewport feed cleanly.

## Notes / possible follow-ups (yours)

- **Graceful degrade before `81eb83b` deploys:** the viewer still plays (primary
  manifest = camera) and the rail shows **camera + identity** only; the rest of the
  rail populates once the tracks include is live.
- **Track URLs are durable `/media/clips/<id>/<kind>/…`** (saved clips), served
  publicly by Caddy — so any viewer fetches them, and a buffer-evicted clip still
  replays its data tracks from the durable copy.
- **C4.5 anon identity** on discover is already handled; the clip-viewer host chrome
  trusts whatever `clips/:id` returns (no extra anon handling needed there yet).
- Seek hardening on the viewer is light (one landing seek + tolerant `seekBy` on the
  transport) — if a `-c:v copy` saved clip wedges after many transport seeks, port
  the `ClipsScreen` recovery controller. Not seen yet; flagging only.
