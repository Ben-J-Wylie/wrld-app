# Handoff → Ben: torch source toggle (SP6a, ~small, design-lane UI)

**From:** Aaron · **Date:** 2026-06-17 · **Status of everything else:** the torch
data path is **100% done** — relay, record, and clip-promote all work the instant
something emits `telemetry{kind:'torch',on}` while torch is armed. The only missing
piece is an **interactive broadcaster toggle**, which lives in your component lane
(`sections/SourceStage` + `features/stream/TorchVisualizer`), so it's yours. This
doc is the complete spec.

## What's already wired (don't touch)
- **Type:** `TelemetryPayload` has `| { kind: 'torch'; ts: number; on: boolean; level?: number }`
  ([src/lib/mediasoupSignaling.ts:12](src/lib/mediasoupSignaling.ts#L12)).
- **Emit API:** `signalingClient.sendTelemetry(payload)`
  ([src/lib/mediasoupSignaling.ts:277](src/lib/mediasoupSignaling.ts#L277)) — mediasoup
  fans it to viewers via `telemetryUpdate` (broadcaster excluded) and records it when
  torch is armed. **No mediasoup or backend change needed** (audited 2026-06-17).
- **Viewer side:** `useStreamTelemetry` already decodes `kind:'torch'` → `tel.torch`,
  which drives `TorchVisualizer` on the viewer. So viewers light up automatically.
- **Persist:** the recorder writes `armed ∩ DATA_KINDS` (torch ∈ DATA_KINDS) and
  `bufferClipService` promotes the `torch` `.jsonl` into saved clips generically.

## The gap
Nothing emits `{kind:'torch',on}`, and on the **broadcaster** `monitorTel.torch` is
never set (torch isn't a phone sensor, so `useLocalTelemetry` can't produce it).
So the broadcaster needs a **local on/off state** that both (a) drives its own
`TorchVisualizer` and (b) emits to viewers/recorder.

## The change (StreamScreen + a toggle affordance)
In [src/components/screens/StreamScreen.tsx](src/components/screens/StreamScreen.tsx):

1. **Local state:** `const [torchOn, setTorchOn] = useState(false)`.
2. **Toggle handler:**
   ```ts
   const toggleTorch = useCallback(() => {
     setTorchOn((on) => {
       const next = !on
       signalingClient.sendTelemetry({ kind: 'torch', ts: Date.now(), on: next })
       return next
     })
   }, [])
   ```
3. **`buildSource('torch')`** (currently `~449`): for the broadcaster, source the
   `on` from `torchOn` instead of `monitorTel.torch?.on`:
   ```ts
   case 'torch':
     return { kind: 'torch', on: isNew ? torchOn : (monitorTel.torch?.on ?? false), level: monitorTel.torch?.level }
   ```
   (`isNew` = broadcaster/own-stream; keep the viewer path reading `monitorTel`.)
4. **`sourceActive`** torch check (`~487`): the broadcaster's torch source is always
   active (it's a control, not a sensor that may be absent):
   `selectedKind === 'torch' && (isNew || !!monitorTel.torch)`.
5. **The affordance.** Cleanest: give `TorchVisualizer` an optional
   `onToggle?: () => void` and, when present, wrap the lamp in a `Pressable`
   ([src/components/features/stream/TorchVisualizer.tsx:24](src/components/features/stream/TorchVisualizer.tsx#L24)).
   Then in `buildSource`/`SourceStage`, pass `onToggle={toggleTorch}` **only** when
   the broadcaster is viewing torch (so viewers get a read-only lamp). If you'd
   rather not thread a prop through `SourceStage`'s `source`/`SourceRender`, an
   overlay `Pressable` in StreamScreen over the torch stage works too — your call,
   it's your component.

## Out of scope (separate, later)
- **Real device LED.** react-native-webrtc 124 has no torch API, and
  `applyConstraints` would reset the pinned capture resolution. So this toggle is a
  **signaled on/off channel** (state/morse) — the lamp UI, not the physical
  flashlight. The real LED is its own device-specific native spike (a module that
  contends with WebRTC's camera) — not part of this.
- **SP6b screen source** — deferred to v0.3.

## Done-bar
Broadcaster taps torch → its own lamp lights → viewers' `TorchVisualizer` lights →
toggling while live writes a `torch` track that promotes into the saved clip.
