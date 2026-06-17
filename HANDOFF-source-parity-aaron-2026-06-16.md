# HANDOFF — Source-parity, what's needed from Aaron (2026-06-16)

**From:** Ben (`design`) · **To:** Aaron (`wrld-mediasoup` + `wrld-backend` + `main` `hooks/`/`screens/`)

The principle: **CONTENT.md §1 principle 7 + §6 + §9 — camera-parity for every source.** The camera
is just the *default* source; every source must get the same treatment at every stage (live
self-preview · live consume · write to server · saveable · previewable on every frame · now-edge
shows the live source). The staged rollout is **`wrld-app/CLAUDE.md` → "Source-parity rollout
(SP0–SP6)"**. This doc is the *index of the parts that are yours* — exactly what we need from you,
in priority order. It does not restate Ben's design/app work.

## ✅ OPEN ITEMS FOR AARON — start here (updated 2026-06-17)
The app side of source-parity is done + on `main` (armed/captured rails, clip-source replay through
the live visualizers sampled at the playhead, now-edge default, camera-off preview). What's left is
backend, in priority order — detail in the dated sections below:

1. **Data-only / single-source streams must record a saveable clip** (highest — blocks camera-less
   capture). A location-only (or any non-AV) go-live must create a buffer **session** + record the
   armed data tracks + set the session's wall-clock `durationSec`. The app already allows the go-live,
   sends the full armed set to `createRoom`, and now renders a media-less session by its `durationSec`
   so it persists in the Clips timeline — **but only if `GET /buffer/me` RETURNS that session.** If a
   camera-less broadcast creates no session, the clip vanishes when the broadcast stops. → update (c).
2. **Drop `temp` from `VALID_SOURCES`** — ambient temp deprecated (no phone instrument); don't
   record/promote a `temp` track. → update (a).
3. **Confirm `accel` is the armed/recorded kind** (not `motion`); drop `motion` from `VALID_SOURCES`
   if present (`motion` is a viewer-derived view of `accel`). → update (a).
4. **(lower)** an **audio-amplitude `.jsonl` track** so clip audio replays its waveform. → update (b).

Already done by you: **SP5 live location relay** ✅. **v0.3** (deferred): SP6b — screen share + the
real device torch LED (native-capture spike).

## ⚠️ Update 2026-06-17 (c) — data-only / single-source streams must record a clip
The rails are now **armed-only** and identity + location are always armed, so a broadcaster can go
live with **no camera/audio** — e.g. **location-only** (or any single source). The app already
allows it (`anyAirArmed` gates go-live, not camera/audio) and sends the full armed set to
`createRoom({ sources })` (incl. `location`/sensors/`chat`, no AV). **Your side:** confirm a
**data-only room (zero AV producers) is accepted as live AND creates a buffer session that records
the armed data tracks**, so a clip can be saved from a camera-less broadcast. (CLAUDE.md already
lists "data-only room support" + "non-AV layer producers" as assumed follow-ups — this is the
concrete need: location-only must produce a saveable clip.) If a data-only stream currently creates
no buffer session / no recording, that's the gap.

**Timeline persistence (app side done):** the Clips timeline previously dropped a media-less session
(it sized clips by media duration → zero width → vanished on stop). Fixed 2026-06-17 — `sessionEndMs`
now uses the session's **wall-clock `durationSec`** when there's no media. So the session must come
back from `GET /buffer/me` with `durationSec` set (and `mediaDurationSec` 0/absent for data-only);
then a location-only clip shows + persists. The `.jsonl` data tracks must be on `session.dataUrls`
(already the shape for camera sessions).

## ⚠️ Update 2026-06-17 (b) — NEW ask: a recorded AUDIO AMPLITUDE track (for clip replay)
Clip playback now replays every source through the live visualizers, sampled at the playhead (compass
circle, gyro horizon, accel xyz traces that scroll + rewind, torch, location trail, chat). **Audio is
the one that can't replay its waveform** — there's no per-sample loudness recorded (audio is the HLS
track only), so the clip audio falls back to a static placeholder waveform (the VOD audio still plays).
To make the clip audio waveform **scroll/rewind exactly like the live viewer**, the recorder needs to
write a small **audio-amplitude `.jsonl` track** — the broadcaster's `audioLevel` (0..1) sampled over
time (≈10 Hz, same shape as the telemetry tracks: `{ ts, level }`), exposed on `session.dataUrls.audio`
(or a sibling kind). Once it lands, the app feeds it into `AudioVisualizer`'s new playback `history`
mode (same pattern just shipped for accel) — small app change. **Until then audio clip-replay is a
placeholder.** Flagging so it's on your radar; low priority vs SP5/SP6.

## ⚠️ Update 2026-06-17 — two model changes on `design` (heads-up + one ask)
- **Ambient temp is DEPRECATED — please deprecate the data path.** There's no ambient-temperature
  instrument on real phones (iOS has no API; the Android sensor is absent on ~all devices), so it
  could never show data. Ben removed `temp` from the **dashboard** and the **source rail** (both
  surfaces) on `design`. **Your side:** drop `temp` from `VALID_SOURCES` / the recordable kind set
  and don't record/promote a `temp` track (it would only ever be empty). No migration needed — temp
  was never armable in practice. The `TemperatureVisualizer` component stays parked (unused) in case
  a future external/BLE thermometer ever provides a real source.
- **Accelerometer is ONE source, keyed `accel`** (not `motion`). `accel` (raw 3-axis) and `motion`
  (its derived magnitude) are the same instrument; the dashboard now arms it once as **`accel`**
  ("Accelerometer", 3-axis) and the rail shows the xyz readout. The recorded track is already
  `accel` (a `BufferTrackKind`), so this matches your substrate — just be aware the armed/recorded
  kind from the app is **`accel`**, and `motion` is a viewer-derived view, never armed/recorded on
  its own. (If `VALID_SOURCES` had `motion`, it can go; keep `accel`.)

## What's already shipped (so you don't redo it)
- **Sensor + chat live relays** (`telemetry`/`telemetryUpdate`, chat) — done (your work, June 2026).
- **Per-source recording** of the armed set (camera/audio/sensors/chat/location) → buffer `.jsonl`
  tracks; **promote-on-publish** into saved clips — done (item 2 + C6).
- **App, on `design`:** the always-present stream-view source rail (AV + sensors), the broadcaster
  **local** self-preview (`useLocalTelemetry`), the viewer fan-out decode (`useStreamTelemetry`), and
  clip-view source switching over recorded tracks (`ClipSourceView`). Camera now-edge live feed on the
  clips page (`broadcastStore.liveStreamUrl`).

So at parity today: **camera** (full) and **sensors** (mostly). The gaps below are what's left.

---

## ▶ START HERE — priority order

### 1. SP5 — **Live location relay** (the one true substrate gap — unblocks the most)
**Why it's first:** `loc` is the only source with NO live path to viewers, and it blocks the `loc`
parts of SP3 (loc in the stream rail) **and** SP4 (loc at the clips now-edge). Everything else for
loc (the recorded `.jsonl` track, the `SourceLocationTrail` renderer, the trail mapper) already
exists — only the **live** fan-out is missing.

**Current state:** the broadcaster already sends `{ type: 'locationUpdate', lat, lng }` (for globe
discovery), but it is **not fanned out to room peers** and `useStreamTelemetry` has no `location`
kind, so a viewer can't build a live trail.

**Decided contract (recommended): fold location into the existing telemetry path** so the viewer's
single decode point (`useStreamTelemetry`) handles it exactly like the other sensors:
- Add to `TelemetryPayload` (in `src/lib/mediasoupSignaling.ts`, mirror in the server):
  `{ kind: 'location'; ts: number; lat: number; lng: number; accuracy?: number }`.
- **mediasoup:** in the `telemetry` case, accept `kind:'location'` and fan out `telemetryUpdate` to
  room peers **except the sender** (same path/auth as compass/gyro — broadcaster-authored only).
- **Broadcaster emit:** the app can emit `location` telemetry from the existing position watch
  (Ben wires `useTelemetryCapture` to emit it; flag if you'd rather drive it off `locationUpdate`).
- **Viewer:** `useStreamTelemetry` keeps the latest `location`; Ben accumulates the trail
  (a capped `[lng,lat][]`) for `SourceLocationTrail`. **No backend round-trip; live is fire-and-forget.**
- Privacy: the **live** trail is the broadcaster's real position to in-room viewers (same as the live
  camera). The reversible precision/blur (CONTENT.md §1.4/§7) is a *clip/discovery* concern, not the
  live relay — don't obfuscate the live fan-out.

*(Alternative if you prefer not to widen `TelemetryPayload`: fan out the existing `locationUpdate`
to room peers and add a viewer subscription. Same outcome; the telemetry-kind route is cleaner
because the viewer decode + idle/stale handling already exists for that path.)*

### 2. SP6a — **Persist/save parity audit** (small, do anytime)
Confirm **every armed source** both writes a track AND promotes into a saved clip. Known-good:
camera/audio/sensors/chat/location ✓. **Gaps to close:**
- **torch** — it's a control, not a sensor: the broadcaster should emit `{ kind:'torch', on }` on
  every toggle (app TODO — flag who owns it), and the recorder should write a `torch` `.jsonl` track
  when armed so a saved clip carries it. Confirm the promote path includes `torch`.
- Confirm the recorder writes a track for **any** armed kind (not a hardcoded subset) so new sources
  don't silently fail to record.

### 3. SP6b — **v0.3 native-capture slice: screen share + real device torch** (DEFERRED, decided 2026-06-17)
Build these two together — both need native capture work RN-WebRTC doesn't expose:
- **Screen share** has no path today: no capture/produce (mediasoup), no record track, no live
  consume. Scope: `getDisplayMedia`/screen producer → live consume (the `screen` rail view already
  exists as a slot) → record track → promote.
- **Real device torch (LED).** The toggle already works as a **signaled on/off channel** (lamp UI +
  viewer sync + record — done). The remaining piece is lighting the **physical LED**, which
  RN-WebRTC 124 doesn't expose: it needs a native module that controls the torch on the WebRTC-owned
  `AVCaptureDevice` (or coexists with it) **without resetting the pinned capture resolution** (that
  pin is what keeps the buffer codec-uniform — don't break it). iOS Control Center can't toggle it
  either while the app holds the camera, so the app must own it. The lamp UI + record path are done,
  so this spike only swaps the physical LED in behind the existing toggle.

Both are **v0.3** + need an **EAS rebuild**. Until then the rail shows `screen` honest-idle and torch
as the signaled channel.

---

## Not your lane (context, so the seam is clear)
- **SP2** (audio/preview idle states), **SP3** chat+profile rail views, **SP4** generalising the
  clips now-edge to all sources are **Ben/app (`design`)**. SP4's *loc* part and the live-tap data
  it needs at the clips now-edge depend on **SP5** above — that's the only thing SP4 needs from you.
  If you'd rather own the shared "live source provider" that exposes live audio-level + telemetry to
  the clips page (today only `broadcastStore.liveStreamUrl` (camera) is exposed), say so; otherwise
  Ben extends `broadcastStore`/a provider on `design`.

## Done-bar (your slice)
A viewer in-room sees the broadcaster's **live location** trail when they pick the Location source;
every armed source (incl. torch, and screen if in scope) **records and promotes**; and the live
location tap is reachable so Ben can show it at the clips now-edge. Mirror the decided `location`
telemetry contract into `wrld-mediasoup/CLAUDE.md` + `wrld-backend/CLAUDE.md` per convention.
