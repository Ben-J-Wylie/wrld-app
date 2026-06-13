# HANDOFF — Aaron, consolidated todo (2026-06-13)

**From:** Ben (`design`/`profile`) · **To:** Aaron (`main` + `wrld-backend` + `wrld-mediasoup`)

A single cross-initiative view of what's on your plate. The **detail** lives in the per-initiative
docs (linked below) and in **`CONTENT.md`** (the content north-star — updated today) + `CLAUDE.md`.
This doc is the index + the priority order, not a re-statement.

## Doc map
- **`CONTENT.md`** — content-handling principles (north star). **Updated 2026-06-13** with the two
  decisions below. The lowercase `content.md` Ben drafted in parallel was a duplicate (case-collision
  on macOS) — **discarded**; CONTENT.md is canonical.
- **`HANDOFF-source-visualizers-2026-06-12.md`** — the telemetry data path (sensors) + the
  camera/audio wiring already shipped. Has its own START-HERE checklist.
- **`HANDOFF-c4-clip-editor-2026-06-12.md`** — editable manifest (draft↔saved); the open gap is
  `removedByLane`.
- **`HANDOFF-clips-saved-persistence-2026-06-11.md`** — R3 promote-on-publish + saved-clip list.

---

## Where you are (in flight)
- **Clip editor** — C4 (editable manifest, draft↔saved) shipped; now the **scissor/snip** tool
  (cut at playhead → draggable pieces, un-snip, snip/gap), the **fullscreen viewer**, and the
  **external-cam HLS viewer**. Open clip-editor gap: **`removedByLane`** (per-lane mid-clip deletes)
  + the scissor/snip PATCH-trim cases & snip persistence.
- **Chat persistence** — making chat durable.

---

## Priority queue (across initiatives)

1. ✅ **DONE (Aaron, 2026-06-13)** — the clip-editor backend pass is complete:
   snip persistence (opaque `splitPoints` on `BufferSession`/`Clip`), all PATCH-trim cases
   (incl. gapped + trim-after-evict, incl. un-save-a-middle-piece after evict), and
   **`removedByLane`** (per-source removed ranges → real manifest backing). Wiring contracts
   in `HANDOFF-clips-saved-persistence-2026-06-11.md` + `HANDOFF-c4-clip-editor-2026-06-12.md`;
   backend detail in `wrld-backend/CLAUDE.md`. *Owes Ben's on-device pass + the app wiring.*

2. ✅ **DONE (Aaron, 2026-06-13)** — chat persists into the buffer. The mediasoup `.jsonl` chat
   sink + durable `ChatMessage` store shipped 2026-06-12; the app seam — sending the **armed
   source set** (AV + chat/location) to `createRoom` so `room._meta.sources` reaches the recorder
   (`StreamScreen.recordedSourcesFromConfig` + the `VALID_SOURCES` widen in `wrld-backend`) — is
   wired. Chat (and location) now record; the clip chat track is real on save. The chat **source
   *view*** in the rail is still the `SourceStage` swap in item 3. *Needs an on-device pass.*

3. ☐ **Sensor telemetry data path** (lights up the 7 sensor visualizers — all shipped on `main`):
   mediasoup `telemetry`→`telemetryUpdate` relay (Option A, like `chatMessage`); `useTelemetryCapture`
   (broadcaster, **`expo-sensors`** → EAS rebuild); `useStreamTelemetry` (viewer); **swap
   StreamScreen's inline cam/audio switch → `SourceStage`**; widen `SourceType` → `FeedKind`; advertise
   aired sensor kinds via `Stream.sources`. *(source-visualizers handoff, Part 2)*

4. ☐ **Make every source SAVE, not just stream** (CONTENT.md §2/§6 — "a source isn't done until it
   both streams and saves"):
   - **Highest-leverage:** route aired telemetry (+ chat) → the buffer's per-source **`.jsonl`
     track** (the sidecar exists from C1; nothing writes to it yet). This is what turns "flows live"
     into "persists" + makes the clip telemetry/loc/chat tracks real.
   - Prisma: confirm `BufferTrack.kind` covers loc/gyro/compass/motion/accel/speed/temp/torch/chat.
   - **C6:** play those saved `.jsonl` tracks back in the clip viewer (the design renderers exist:
     `SourceTelemetryGraph`, `SourceLocationTrail`, `SourceChatLog`).

5. ☐ **Content decision A — reversible precision/identity** *(DECIDED 2026-06-13; supersedes the
   immutable model + the shipped behaviour; CONTENT.md §1.4/§7/§8/§9 updated)*:
   - Backend **always stores exact coords + real identity** (full fidelity).
   - **Drop the `≤`-ceiling clamp** on the `Clip` manifest's `locDisplayPrecision` / identity.
   - Globe / replay / discovery read the clip's **current** `locDisplayPrecision`, not the immutable
     `stream.locationPrecision`. `off` excludes only while set to `off`.
   - App edit UI already exists (Ben's `LocationGranularityPicker` + identity segment) — just remove
     the bound; it drives `locDisplayPrecision` both ways.

6. ☐ **Content decision B — moderation hold** *(DECIDED 2026-06-13; CONTENT.md §3)*:
   - On **report**, copy the content to a **separate platform-side moderation hold** (not one of the
     user's two pools). It **survives the creator's deletion**; **excluded from the user's quota**
     once past the rolling-buffer window; held until a moderator acts.
   - Extend the existing report flow (reports + snapshots, Phase 5/22). The **review/takedown UI** is
     v0.3; the **copy-on-report retention is decided now.**

---

## The throughline
Items 2–4 are one principle (CONTENT.md §2 directive / §6): **every source is an equal,
wall-clock-aligned track that must both stream *and* save.** Camera/audio clear that bar; chat is
in flight; the 7 sensors + location are the gap. The single most impactful move is **the telemetry
path + routing it into the `.jsonl` sidecar** — that takes the sensors from "shipped UI" to "real,
saved sources."

## Seam (unchanged)
Ben owns `primitives/`/`features/`/`sections/` + DESIGN.md + the content principles in CONTENT.md;
Aaron owns `screens/`/`hooks/`/`api/` + backend + mediasoup. If a **component API** needs a change
to wire cleanly, flag it — Ben adjusts the component rather than you working around it in the screen.
