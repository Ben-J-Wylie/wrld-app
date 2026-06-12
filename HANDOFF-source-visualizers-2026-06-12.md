# HANDOFF — Source visualizers (audio + sensor telemetry)

**Date:** 2026-06-12 · **From:** Ben (`design`) · **To:** Aaron (mediasoup + backend + `hooks/` + `screens/`)
**Status of the app side:** all visualizer components **shipped on `design`** (components +
gallery + DESIGN.md). They are **presentational only** — each renders a typed data prop and does
not touch WebRTC. Making them react to real data is the wiring below.

This doc has two parts:

- **Part 1 — Audio.** Audio's data (the WebRTC audio track + `getStats`) already flows; the work
  is a small app-side seam (no backend / mediasoup change).
- **Part 2 — Sensor telemetry** (compass · gyro · motion · accel · speed · temp · torch). These need
  a **telemetry data path that does not exist yet** — broadcaster sensor capture → mediasoup relay →
  viewer. This is the cross-repo work: mediasoup, backend, Prisma, and app hooks/screens.

---

## The initiative

A visualizer for each broadcast source, shown to a **viewer** when that source is on air without
a camera (so there's no video frame to fill). An audio-only or data-only stream currently shows
the bare control panel.

---

## ▶ START HERE (Aaron)

**One-line goal:** make the 7 non-AV sensor visualizers light up from real device data. Camera +
audio are **already wired both sides** (Part 1 ✅); the remaining work is the **telemetry data
path** across all three repos.

**Decide the transport first → Option A (recommended): relay telemetry over the existing signaling
WebSocket, exactly like `chatMessage`.** Everything below assumes A. Option B (SCTP DataChannels)
is documented as the scale path; the app decode + visualizer props are identical for both, so you
can switch later without touching the UI.

### Current baseline in YOUR lane (pull `design` → `main` before starting)

Ben crossed into `hooks/` + `screens/` for Part 1 (at Ben's direction). Get on top of these so you
build on them, not against them:
- `src/hooks/useMediasoup.ts` — returns **`audioLevel`** (0..1); shared `startAudioLevelPoll` helper
  drives it from the consumer (viewer) and the producer (broadcaster mic).
- `src/components/screens/StreamScreen.tsx` — viewer + broadcaster media surfaces switch source via
  `SourceRail`; currently an **inline 2-case (cam/audio) switch**. Your job: widen it to
  `SourceStage` so sensors slot in.
- **Design layer = done, do not edit** (`primitives/`/`features/`/`sections/` + DESIGN.md): the 8
  visualizers, the `SourceStage` section, the `SOURCE_META` map.
- `SourceType` is still `'camera' | 'audio'` — you widen it (or map to `FeedKind`).

### The work, by repo — do in this order

1. ☐ **wrld-mediasoup** — add a `telemetry` inbound case → fan out `telemetryUpdate` to room peers
   (mirror `chatMessage`; broadcaster-authored only). Confirm data-only rooms are valid. *(§ mediasoup)*
2. ☐ **wrld-backend + Prisma** — advertise the aired sensor kinds via `Stream.sources`. No new
   tables, no new endpoints for live telemetry. *(§ backend, § Prisma)*
3. ☐ **wrld-app — types** — widen `SourceType` to the `FeedKind` set (or map at the screen). *(§ viewer step 5)*
4. ☐ **wrld-app — broadcaster** — `useTelemetryCapture` reads the sensors (**`expo-sensors`** → EAS
   rebuild), throttles, emits `telemetry`. *(§ broadcaster capture)*
5. ☐ **wrld-app — viewer** — `useStreamTelemetry` (latest sample per kind) + **swap StreamScreen's
   inline switch for `SourceStage`**. *(§ viewer consume + render)*
6. ☐ **(later)** route aired telemetry into the buffer `.jsonl` for clip playback (C6). *(§ mediasoup recording)*

### Conventions
- **Mirror the DECIDED contract** (below) into `wrld-backend/CLAUDE.md` + `wrld-mediasoup/CLAUDE.md`,
  same as other initiatives.
- **Merge protocol unchanged:** Ben's Part-1 wiring is on `design`; pull it into `main` first.
- If a **component API** needs a change to wire cleanly, flag it — Ben adjusts the component rather
  than you working around it in the screen.

The contract + per-repo detail follow.

---

# Part 1 — Audio

**Status: ✅ WIRED END-TO-END (2026-06-12).** Not just the component — the audio seam + the
viewer render are done. Remaining: an **on-device pass** (see below). App-side only; no
backend/mediasoup change.

**What got wired (Ben, crossing into Aaron's lane at Ben's direction — flag for merge):**
- **`useMediasoup.ts`** — exposes a real `audioLevel` (0..1). It retains the **audio consumer** and
  polls `consumer.getStats()` for inbound-rtp `audioLevel` every ~120ms (the only loudness signal
  RN-WebRTC gives — no AnalyserNode). Cleared in `cleanup()`. This **is** the `useAudioLevel` seam
  the original plan described, built inline in the hook.
- **`StreamScreen.tsx`** — the viewer now always uses the dark media surface + overlay; the selected
  source fills the media box (`cam` → remote `RTCView`; `audio` → `AudioVisualizer` fed by
  `audioLevel`); the old `SOURCE_LABELS` text-pill switcher is replaced by **`SourceRail`** (shown
  when >1 source); tap toggles controls for camera AND audio.
- **Broadcaster source monitor (parity).** The live broadcaster gets the SAME switch: a floating
  `SourceRail` (right-centre, when >1 source) flips which source they *monitor* — `cam` shows the
  camera preview (iOS gimbal / Android RTCView), `audio` shows `AudioVisualizer` fed by the
  broadcaster's **own mic level**. `useMediasoup` now also polls the audio **producer's** getStats
  (`media-source.audioLevel`) and reuses the same `audioLevel` (one role active per screen). **This
  is a local monitor only — it does NOT change what's broadcast** (camera + audio keep flowing to
  viewers regardless of which source the broadcaster is looking at). The audio-level poll helper is
  shared by the consumer (viewer) and producer (broadcaster) paths.

**⚠️ On-device checks owed (couldn't verify headlessly):**
- Confirm `getStats().audioLevel` is actually populated on our RN-WebRTC (124.0.7) build — if a
  given build only exposes it on a different stat entry, the waveform stays flat (graceful, not
  broken). The poll scans every stat entry for a numeric `audioLevel`, so it's tolerant, but verify
  it moves with real speech. (Two stats to verify: viewer = inbound-rtp `audioLevel`; broadcaster =
  media-source `audioLevel` from the producer.)
- Camera↔audio switch + tap-to-reveal feel (viewer), and the broadcaster's floating monitor rail +
  camera-preview remount when toggling back to `cam` (the camera keeps broadcasting throughout).

---

## What shipped (on `design`)

- **`AudioVisualizer`** — `src/components/features/stream/AudioVisualizer.tsx`. Pure Views +
  plain `Animated`. Two variants:
  - `waveform` — scrolling amplitude history (a live `SourceWaveform`).
  - `orb` — central glow that scales + brightens with loudness.
  - Props: `level` (0..1), `variant`, `active?`, `label?` (default `'AUDIO'`), `barCount?`, `style?`.
  - Internal envelope smoothing (fast attack / slow decay) + a steady self-ticker for the
    waveform scroll, and a perceptual `GAIN` to lift speech into range. Native-driver
    transform/opacity only (CALayer-rule safe).
- **Gallery** — `FeatureGallery.tsx` `AudioVisualizer` section, both variants driven by a
  synthetic speech-like envelope + an idle state.
- **DESIGN.md** — Section 3 `AudioVisualizer` entry (the why, API, and this seam).

---

## The honest constraint (please preserve)

`react-native-webrtc` (we're on **124.0.7**) has **no Web Audio / `AnalyserNode`**. The only
real loudness source is **`getStats().audioLevel`** — a single **0..1 scalar (~10 Hz), not a
frequency spectrum**. The component is built around that: it visualizes one amplitude value
over time (waveform) or as glow (orb). **Don't fake a multi-bar EQ spectrum from it** — it reads
as synthetic, which is why neither variant tries.

---

## Part 1 is DONE — don't rebuild it

The original plan here was a `useAudioLevel` hook + retaining the consumer + a render branch.
**Ben already built all of that** (see "What got wired" at the top of Part 1). Current state of
your lane, so you build on it rather than redo it:
- `useMediasoup.ts` — returns `audioLevel`; shared `startAudioLevelPoll` helper drives it from the
  consumer (viewer) AND the producer (broadcaster mic). Torn down in `cleanup()`.
- `StreamScreen.tsx` — viewer + broadcaster media surfaces switch source via `SourceRail`; the old
  `SOURCE_LABELS` pills are gone.

The **only** Part 1 to-do left is the on-device verification above + the variant decision below.

### Decision for Ben (after an on-device pass)

- **`waveform` vs `orb` as the default** — and whether it's user-toggleable. Both are honest for a
  single-scalar source; pick on device once it's wired. (Variant is just a prop, so this is a
  one-line default + optional toggle.)

---

# Part 2 — Sensor telemetry (compass · gyro · motion · accel · speed · temp · torch)

**Status:** all seven sensor visualizer components shipped on `design` (each takes a typed data prop). The
**telemetry data path is brand-new** and is the bulk of this handoff. CLAUDE.md already anticipates
it ("Backend follow-ups this build assumes" → *Non-AV layer producers* / *Data-only room
support*) — this section is the concrete contract.

## Components shipped (on `design`) — what each prop expects

| Component | Prop(s) | Units / range |
|---|---|---|
| `CompassVisualizer` | `heading` | degrees 0..360, true |
| `GyroVisualizer` | `pitch`, `roll` | degrees (pitch clamped ±45 in the view) |
| `MotionVisualizer` | `intensity` | 0..1 (normalised accel magnitude) |
| `AccelerometerVisualizer` | `x`, `y`, `z` | m/s² per axis (3-line graph) |
| `SpeedVisualizer` | `mps` (+ `unit`) | metres/second (converted to km/h \| mph) |
| `TemperatureVisualizer` | `celsius` (+ `unit`) | °C |
| `TorchVisualizer` | `on` (+ `level`) | boolean (+ 0..1 brightness) |

All share `active?` (false → dim/idle), `label?`, `style?`, and the `VisualizerFrame` chrome. They
smooth internally, so feed them **raw decoded samples** — no need to pre-smooth on the wire.

---

## Architecture decision: how telemetry travels (broadcaster → viewer)

Two viable transports. **Recommendation: Option A (signaling-WS relay) for v0.2**, with Option B
as the documented scale path. Flagging the trade rather than silently picking — your call since the
mediasoup + backend lanes are yours.

### Option A — relay over the existing signaling WebSocket (recommended for v0.2)

Reuse exactly the path `chatMessage` / reactions / `viewerCountUpdated` already take: broadcaster
sends a WS message to the mediasoup signaling server, which fans it out to all room peers.

- **Pros:** trivial — mirrors a pattern that already works; no SCTP/DataChannel setup; works with
  the existing data-only-room intent; one code path for every source.
- **Cons:** telemetry rides the signaling process (not the media plane); at high fan-out it loads
  that process. Fine at friends-and-family scale.
- **Rates are modest** (see per-source table) so WS volume is low.

### Option B — SCTP DataChannels via mediasoup DataProducer/DataConsumer (scale path)

The "proper" media-plane route: enable SCTP on the WebRTC transports, broadcaster
`transport.produceData()`, viewers `transport.consumeData()`.

- **Pros:** scales with the media layer, off the signaling process; the real home for high-rate
  telemetry.
- **Cons:** more wiring both ends — `enableSctp: true` + `numSctpStreams` on transport creation,
  `sctpCapabilities` exchange, DataProducer/DataConsumer lifecycle, and `react-native-webrtc`
  `RTCDataChannel` plumbing through `mediasoup-client`. More moving parts to debug.

**Suggested path:** ship Option A now (unblocks all the visualizers end-to-end), migrate to Option
B if/when telemetry rate or room fan-out demands it. The **app-side decode + the visualizer props
are identical for both** — only the transport under `useStreamTelemetry` changes.

---

## The wire contract (transport-agnostic)

One message type carries every source (discriminated by `kind`). Same JSON whether it rides WS
(Option A) or a DataChannel (Option B).

**Broadcaster → server:**
```jsonc
{ "type": "telemetry", "payload": { "kind": "compass", "ts": 1733980000000, /* …fields */ } }
```

**Server → room peers (fan-out):**
```jsonc
{ "type": "telemetryUpdate", "payload": { /* same payload, unchanged */ } }
```

**Per-`kind` payload + suggested send rate (broadcaster throttles/coalesces to these):**

| kind | payload fields | rate |
|---|---|---|
| `compass` | `heading: number` (0..360 true), `accuracy?: number` | ~5 Hz |
| `gyro` | `pitch: number`, `roll: number`, `yaw?: number` (deg) | ~10–15 Hz |
| `motion` | `intensity: number` (0..1) | ~10 Hz |
| `accel` | `x: number`, `y: number`, `z: number` (m/s²) | ~15 Hz |
| `speed` | `mps: number` (≥0; <0 ⇒ unknown), `accuracy?: number` | ~1 Hz |
| `temp` | `celsius: number` | ~0.2 Hz (on-change) |
| `torch` | `on: boolean`, `level?: number` (0..1) | on-change |

`ts` is broadcaster wall-clock ms (lets the viewer drop stale/out-of-order samples and lets the
recorder timestamp). Keep payloads flat + tiny.

---

## mediasoup (`wrld-mediasoup`) — Aaron

### Option A (recommended)
- In the room message handler (where `chatMessage` is handled today), add a `telemetry` case:
  validate the sender is the **broadcaster** of that room (telemetry is broadcaster-authored, like
  going live — don't let viewers spoof it), then fan out `telemetryUpdate` to all room peers
  **except** the sender. Mirror the existing chat fan-out exactly.
- **Data-only rooms must already be valid** (a stream with no camera/audio producers). CLAUDE.md
  lists this as an assumed follow-up — confirm a send transport with zero AV producers is accepted
  as a live room (the app sets it up that way today for data-only go-lives).
- **No persistence here** — this is real-time fan-out.

### Option B (if/when you go SCTP)
- `enableSctp: true` + `numSctpStreams` on `createWebRtcTransport` (both send + recv).
- Exchange `sctpCapabilities`; broadcaster `produceData({ label: 'telemetry', … })`; on a new
  DataProducer, create a `DataConsumer` for each viewer (same fan-out lifecycle as media consumers,
  incl. cleanup on leave). One multiplexed `telemetry` channel carrying all kinds is simplest.

### Recording (either option) — feeds the clip editor's telemetry tracks (C6)
- CLAUDE.md C1 says the buffer substrate already writes **wall-clock-chunked `.jsonl` telemetry**
  per source. Route the aired telemetry into that same sidecar so saved clips carry it (the clip
  editor's `SourceTelemetryGraph` / `SourceLocationTrail` and C6 "telemetry tracks playback"
  consume it). Confirm the `.jsonl` schema matches the `payload` shape above (or note the mapping).

## backend (`wrld-backend` / Fastify) — Aaron

The **live path needs no backend round-trip** — telemetry never touches the API; it flows
broadcaster → mediasoup → viewers. Backend involvement is limited to:

- **Aired-sources advertisement.** Discovery (`/streams/near`, `/streams/:id`, the globe feed)
  should expose **which sensor sources are on air** so the viewer knows which visualizer(s) to show
  before any sample arrives, and the globe can hint a data-only stream. `Stream.sources String[]`
  already records armed sources — confirm the aired sensor kinds are included there (the `air` set
  already lists non-AV layers) and surfaced on the stream payloads the app reads.
- **No new endpoints** for live telemetry.
- **(If recording)** whatever `Recording`/`BufferTrack` rows already represent telemetry tracks
  (C1) — no change unless the kind set expands.

## Prisma — Aaron

**Live telemetry needs no schema change** (it's ephemeral fan-out). Audit only:

- `Stream.sources String[]` — confirm it can hold the sensor kinds (`compass`/`gyro`/`motion`/
  `speed`/`temp`/`torch`) so discovery can advertise them. If the app sends an `air` set that's a
  superset of what's persisted, widen what's stored. **No new column likely required.**
- **Recording side:** if buffer telemetry tracks are modelled as `BufferTrack` rows with a `kind`,
  make sure the kind enum/string covers these six. (Per CLAUDE.md the telemetry sidecar is already
  `.jsonl` per source, so this may already be fine.)
- **Not needed:** a `Telemetry` table / last-known-value column. Don't add one for v0.2 — live is
  fire-and-forget; history lives in the clip `.jsonl`.

## App — broadcaster capture (`src/hooks/`, Aaron's lane)

New hook `useTelemetryCapture(airedSources)` that, while live, reads the device sensors for each
aired sensor source, throttles to the rates above, and emits `telemetry` messages over the chosen
transport.

- **Dependency: `expo-sensors`** (new) — `Magnetometer`/`DeviceMotion` (compass heading, gyro
  attitude, accelerometer→motion intensity). **Native module → EAS dev-client rebuild required.**
  Install with `npx expo install expo-sensors` (per CLAUDE.md dependency hygiene — never plain
  `npm install`).
- **compass:** `expo-location` `watchHeadingAsync` gives `{ trueHeading, magHeading, accuracy }`
  (preferred — already a dep), or `Magnetometer` + math. → `heading`.
- **gyro (attitude):** `DeviceMotion` `rotation` (`alpha/beta/gamma` → yaw/pitch/roll, radians →
  degrees). Throttle via `DeviceMotion.setUpdateInterval`.
- **accel + motion (same sensor — capture once):** `DeviceMotion` (or `Accelerometer`) gives one
  reading `{ x, y, z }` m/s². From it:
  - **`accel`** — send `{ x, y, z }` raw (typically gravity-included; the visualizer's ±range
    default 20 assumes that — if you send gravity-removed `userAcceleration` instead, pass a
    smaller `range`).
  - **`motion`** — the same vector collapsed to a magnitude (≈ `√(x²+y²+z²)` minus the gravity
    baseline), normalised to 0..1. **Derive it from the one accelerometer reading** — don't run a
    second sensor. Two valid placements: (a) broadcaster computes + sends both `accel` and `motion`;
    or (b) broadcaster sends only `accel` and the **viewer** derives `motion` from it (saves wire +
    keeps them perfectly consistent). Recommend (b) unless `motion` is armed without `accel`.
  - Both components also smooth internally, so a light touch upstream is fine.
- **speed:** `expo-location` `watchPositionAsync` → `coords.speed` (m/s, can be `-1`/null when
  unknown → send `mps: -1`). Already a dep.
- **temp:** ⚠️ **no reliable source.** iOS exposes no ambient-temp API; Android
  `Sensor.TYPE_AMBIENT_TEMPERATURE` exists but is **absent on almost all phones**. Options: (a) ship
  the visualizer UI-present but **data-absent** for now (don't arm temp, or arm it and send nothing →
  viewer shows idle); (b) a small native Android module for the rare devices that have it; (c) drop
  temp from the shippable set and keep the component for later. **Recommend (a)/(c)** — decide and
  note it. Everything else has a real source.
- **torch:** the broadcaster already controls the camera torch. Emit `{ on }` on every toggle. If a
  dedicated "torch channel / morse" mode lands, that same toggle stream drives it.
- **Permissions:** heading/position already gated by the existing location permission; motion may
  need the iOS motion-usage permission (`NSMotionUsageDescription`) — add to `app.json` if so.

## App — viewer consume + render (`src/hooks/` + `src/components/screens/`, Aaron's lane)

> **Current state (2026-06-12):** the viewer render is **already wired for camera + audio** — see
> Part 1. `StreamScreen` renders the selected source in the media box (`cam` → `RTCView`; `audio` →
> `AudioVisualizer` via the real `audioLevel`) and uses `SourceRail` to switch. It does this with an
> **inline 2-case switch + SourceRail**, NOT the `SourceStage` section, because only camera/audio
> exist today. When you add the sensor sources below, **swap that inline block for `SourceStage`**
> (the full dispatch) and the new kinds slot straight in — that's the intended convergence point.

The design layer ships a **drop-in switchboard** so the screen doesn't hand-wire each visualizer:
the **`SourceStage` section** (`src/components/sections/SourceStage.tsx`). It renders the selected
source full-bleed and overlays the `SourceRail` to switch between the stream's available sources.
Glyphs/labels come from the shared **`SOURCE_META`** map
(`src/components/features/stream/sourceMeta.ts`). The full sensor wiring is then:

1. **`useStreamTelemetry()` hook** — subscribe to `telemetryUpdate` (Option A: via the signaling
   client's message subscription, like chat; Option B: via the telemetry `DataConsumer`), keep the
   **latest sample per kind** in state (drop samples with older `ts`), return e.g.
   `{ compass, gyro, motion, accel, speed, temp, torch }` (each `null` until first sample). Single
   decode point shared by both transports. (Audio's level still comes from the Part 1 `getStats`
   seam; merge it in alongside.)
2. **Build a `SourceRender` for the selected source** and render `SourceStage`:
   ```tsx
   const tel = useStreamTelemetry()
   const [selected, setSelected] = useState<FeedKind>(airedSources[0])
   const source: SourceRender = useMemo(() => {
     switch (selected) {
       case 'cam':   return { kind: 'cam', slot: <RTCView streamURL={remoteStream.toURL()} .../> }
       case 'audio': return { kind: 'audio', level: audioLevel }
       case 'compass': return { kind: 'compass', heading: tel.compass?.heading ?? 0 }
       case 'loc':   return { kind: 'loc', path: locPath }        // accumulate live positions
       case 'profile': return { kind: 'profile', displayName, handle, avatarUrl, attributed }
       // …gyro/motion/accel/speed/temp/torch from tel
     }
   }, [selected, tel, audioLevel, remoteStream, locPath])
   <SourceStage sources={airedSources} selected={selected} onSelect={setSelected}
                source={source} active={/* first sample arrived? */} style={StyleSheet.absoluteFill} />
   ```
   Place full-bleed behind the existing controls overlay (same slot the `RTCView` uses today). This
   **replaces the inline `SOURCE_LABELS` pill switcher** in `StreamScreen` (which is hardcoded to
   `camera`/`audio`).
3. **Camera & screen are the `slot`** — `SourceStage` does not import `RTCView`; you pass the
   `<RTCView>` (or screen-share view) in as `source.slot`. Keeps the design layer WebRTC-free.
4. **Location needs a live path** — `SourceLocationTrail` takes a `path: [lng,lat][]`; accumulate
   the broadcaster's incoming `loc` telemetry into a growing array (cap it) and pass it. A single
   position renders as a pin; movement renders as the trail.
5. **`SourceType` widening (types lane)** — `SourceType` is `'camera' | 'audio'` today; the rail +
   stage key off the wider `FeedKind` (`cam|audio|screen|loc|gyro|compass|profile|speed|torch|temp|
   motion|accel|chat`). Decide whether to widen `SourceType` to match `FeedKind`, or map between
   them at the screen. The persisted/advertised aired-source list must carry the sensor kinds either
   way (see backend/Prisma above).

## Decisions for Ben (after wiring + an on-device pass)

- **Multi-sensor layout:** `SourceStage` already answers this with **one-at-a-time + the rail to
  switch**. If you'd rather show several sources at once (split-pane / PiP), that's a new SourceStage
  variant (Ben's lane), not a screen change. Confirm one-at-a-time is the v0.2 answer.
- **Temperature:** ship UI-present-but-data-absent, native module, or drop for v0.2 (see above).
- **Per-source visual confirmation:** gyro-as-horizon vs 3-axis dials, motion ladder vs ripple —
  cheap to swap once real data is flowing.

## Seam note

Standing split: Ben owns `primitives/` / `features/` / `sections/` + DESIGN.md; Aaron owns
`screens/` / `hooks/` / `api/` (+ mediasoup + backend). All visualizer **components** are Ben's and
done. Everything in Part 2's mediasoup/backend/Prisma/hooks/screens sections is Aaron's lane. If a
component **API** needs to change to wire cleanly (extra prop, different idle semantics, a new
visual variant), flag it and Ben adjusts the component rather than working around it in the screen.

## Sequencing

1. Confirm data-only rooms are accepted by mediasoup (may already be true).
2. Pick transport (Option A recommended) → mediasoup `telemetry`/`telemetryUpdate` fan-out.
3. App: `useTelemetryCapture` (broadcaster) + `useStreamTelemetry` (viewer) + `expo-sensors`
   (→ EAS rebuild).
4. `StreamScreen` render wiring + advertise aired sensor sources in discovery.
5. (Later) route aired telemetry into the buffer `.jsonl` for clip playback (C6).
6. (Scale) migrate transport to Option B SCTP if needed.

Audio (Part 1) is independent and can land first — it needs none of the telemetry path.
