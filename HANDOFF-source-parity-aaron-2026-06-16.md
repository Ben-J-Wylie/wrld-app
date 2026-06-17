# HANDOFF — Source-parity, what's needed from Aaron (2026-06-16)

**From:** Ben (`design`) · **To:** Aaron (`wrld-mediasoup` + `wrld-backend` + `main` `hooks/`/`screens/`)

The principle: **CONTENT.md §1 principle 7 + §6 + §9 — camera-parity for every source.** The camera
is just the *default* source; every source must get the same treatment at every stage (live
self-preview · live consume · write to server · saveable · previewable on every frame · now-edge
shows the live source). The staged rollout is **`wrld-app/CLAUDE.md` → "Source-parity rollout
(SP0–SP6)"**. This doc is the *index of the parts that are yours* — exactly what we need from you,
in priority order. It does not restate Ben's design/app work.

## ← BACK TO BEN (2026-06-17, Aaron): backend slice COMPLETE + deployed — only on-device verify owed
**All four backend items are built, pushed, and live on `api.wrld.cam` + `media.wrld.cam`** (api
container rebuilt, mediasoup restarted on the Hetzner box). **There is no remaining backend code
work for this initiative.** Including the `audiolevel` `dataUrls` gap you confirmed on-device — fixed
+ deployed (`b3258c5`, see item 4). Your `AudioVisualizer` history-mode wiring should now light up
the moment a session has `audiolevel` samples.

**Over to you, Ben — two on-device verifications (CI can't run mediasoup, so these are the real proof):**
1. **Data-only clip (item 1):** arm ONLY location (no camera/audio) → go live → stop → confirm the
   session shows in the Clips timeline with non-zero width + persists, and saving it yields a clip
   with the `location` `.jsonl` track.
2. **Audio waveform replay (item 4):** on a **new app build**, do an audio go-live → stop → confirm
   `GET /buffer/me` now returns `dataUrls.audiolevel` (it does post-`b3258c5`) AND the recorded
   samples drive your `AudioVisualizer` history mode. (Sessions from old builds will have the URL but
   an empty track — see the note in item 4.)

If either fails on-device, send me the `GET /buffer/me` payload for the session and I'll dig in.
Separately: **v0.3** still has SP6b (screen share + real device torch LED). Original item list below.

---

## ✅ OPEN ITEMS FOR AARON — ALL DONE on `main` (2026-06-17)
The app side of source-parity is done + on `main` (armed/captured rails, clip-source replay through
the live visualizers sampled at the playhead, now-edge default, camera-off preview). The backend
items below are now **all built + deployed** (api rebuilt, mediasoup restarted, all 3 repos pushed).
**The data-only path can only be confirmed on-device (CI can't run mediasoup) — see done-bar below.**

1. ✅ **Data-only / single-source streams record a saveable clip.** Two real gaps, both fixed:
   - **mediasoup** (`8b347eb`): `maybeAutoStartRecording` was only called from `'produce'` (a media
     event), so a data-only go-live never started recording. `createRoom` now triggers it once the
     Stream row exists when the armed set has data sources but no media (`isDataOnlySourceSet`).
   - **backend** (`9693cde`): `GET /buffer/me` returned `durationSec: 0` for a media-less session (the
     desync fix made it media-only); it now falls back to **wall-clock** `((endedAt ?? now) − startedAt)`
     so the clip has width and persists. `mediaDurationSec` stays 0.
2. ✅ **Dropped `temp` from `VALID_SOURCES`** (backend `9693cde`) — and incoming `sources` are now
   **stripped of unknown values** rather than rejected, so a legacy client still arming `temp`/`motion`
   keeps going live.
3. ✅ **`accel` confirmed the armed/recorded kind; `motion` dropped from `VALID_SOURCES`** (same commit).
4. ✅ **Audio-amplitude track** (`8b347eb` mediasoup + `dbcacc2` app; backend generic, no change):
   when audio is recorded, mediasoup opens an `audiolevel` `.jsonl` companion; the broadcaster emits
   `{kind:'audiolevel',ts,level}` (~10 Hz, `useAudioLevelCapture`) which records generically.
   **→ Ben follow-up ✅ DONE (2026-06-17):** `AudioVisualizer` gained a playback `history` mode and
   the clip audio view feeds it the recorded `audiolevel` window at the playhead (scroll + rewind,
   same as live). The clips timeline reads it from **`session.dataUrls.audiolevel`** (the buffer
   path the other data tracks use). `audiolevel` is a companion of the audio source (filtered out of
   the rail via `KIND_TO_FEEDKIND`) — rendered inside the audio waveform, not as a standalone rail item.
   **✅ GAP RESOLVED + DEPLOYED (2026-06-17, Aaron — `b3258c5`; Ben confirmed working on-device).**
   Root cause: the per-session `dataUrls` map in `GET /buffer/me` (and the `/buffer/stream/:id/:kind/
   data.jsonl` serve route) are both gated by a single `DATA_KINDS` constant in `buffer.ts` that
   didn't list `audiolevel` — so the track recorded + showed in `kinds`, but its URL was filtered out.
   Added `audiolevel` to `DATA_KINDS` (+ `KNOWN_KINDS`); one constant, both effects —
   `session.dataUrls.audiolevel` is now present AND the serve route streams it (route +
   `readSessionData` are kind-generic). **Live on `api.wrld.cam`.** Note: sessions from an old app
   build have the URL but an empty `.jsonl` (only the new build's `useAudioLevelCapture` writes
   samples) — so the waveform fills for an audio go-live on a new build.

> **On-device done-bar (item 1 — Aaron/Ben to verify):** arm ONLY location (no camera/audio) → go live
> → stop → the location-only session appears in the Clips timeline with non-zero width and persists,
> and saving it produces a clip carrying the `location` `.jsonl` track. (Item 4: confirm an audio
> go-live's saved clip carries an `audiolevel` track via `GET /buffer/me/clips` `tracks[]`.)

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
