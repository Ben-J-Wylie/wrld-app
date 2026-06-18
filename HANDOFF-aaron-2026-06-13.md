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
- **`HANDOFF-source-parity-aaron-2026-06-16.md`** — camera-parity for every source (CONTENT.md §1.7).
  SP5 live location relay ✅ (done by you). **Open backend items (see its "OPEN ITEMS FOR AARON"
  top section):** (1) data-only/single-source streams must create a session + record a saveable clip
  (camera-less clips vanish otherwise); (2) drop `temp` from `VALID_SOURCES` + confirm `accel` (not
  `motion`); (3) lower: an audio-amplitude `.jsonl` track. v0.3: screen + real torch LED. Rollout
  table in `CLAUDE.md` ("Source-parity rollout").
- **`HANDOFF-time-machine-aaron-2026-06-18.md`** — globe replay (Time Machine). App consumer BUILT
  by Ben (`design`). **Your part: push + deploy `wrld-backend` `81eb83b` (`GET /clips/:id` tracks
  include — local-only on `main`); confirm `clips/discover` C4.5 is deployed; on-device verify.**
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

3. ✅ **DONE (Aaron, 2026-06-13)** — sensor telemetry data path. mediasoup `telemetry`→
   `telemetryUpdate` relay (Option A) + buffer `.jsonl` record; `useTelemetryCapture` (broadcaster —
   compass/speed via expo-location, gyro/accel via DeviceMotion; **`expo-sensors` already in the dev
   client → NO EAS rebuild**); `useStreamTelemetry` (viewer, motion derived from accel); StreamScreen's
   3 media surfaces swapped to **`SourceStage`** with `buildSource`; `SourceType`→`FeedKind`; aired
   sensor kinds flow via `Stream.sources` (item 2). Also fixed the `ts`/`t` data-sample bug (was
   promoting ALL data tracks empty). *temp=data-absent, motion=derived, torch-on-toggle/loc-trail/
   chat-view deferred. Needs an on-device pass. See `wrld-app/CLAUDE.md` "Sensor telemetry data path".*

4. ✅ **DONE (Aaron, 2026-06-13)** — make every source SAVE + C6 playback.
   - ✅ Aired telemetry/chat/location record to the buffer per-source `.jsonl` (items 2+3); the
     **`ts`/`t` data-sample fix** makes them actually *promote* into a saved clip (was empty before).
   - ✅ `BufferTrack.kind`/`ClipTrack.kind` are plain `String` → cover every kind (no migration).
   - ✅ **C6 playback:** tokenized buffer `.jsonl` serve route + per-session `dataUrls` on `GET /buffer/me`
     (+ per-track `dataUrl` on `GET /buffer/me/clips`); `useDataTrack` + `lib/dataTrackRender` feed the
     **already-wired** `ClipEditScreen` renderers (location trail / compass+gyro graph / chat log) real
     samples at the playhead, replacing the `MOCK_*`. *Edge: fully-saved-clip-after-evict telemetry
     would read the clip API `dataUrl` (exposed) — a small follow-up. Needs an on-device pass.*

5. 🔶 **Content decision A — reversible precision: MODEL REWORK DONE (Aaron, 2026-06-13).**
   - ✅ Backend always stored exact coords + real identity (capture is full-fidelity; obfuscation is
     read-time) — no change needed.
   - ✅ **No `≤`-ceiling clamp to drop — there was none.** PATCH already accepted any `locDisplayPrecision`;
     the "immutable ceiling" was a documented intent never enforced in code (app `patchClip` +
     `LocationGranularityPicker` are also unbounded).
   - ✅ **`GET /clips/discover` now reads the clip's CURRENT precision** (`COALESCE(c.locDisplayPrecision,
     s.locationPrecision, 'exact')`) for the coords + the `off` exclusion. Globe/time-machine honour it;
     `off` excludes only while currently off. *(see `wrld-backend/CLAUDE.md` "Content decision A".)*
   - ✅ **Aaron-lane edit-UI prep:** `saveClip(name, privacy?)` accepts + persists
     `{ locDisplayPrecision, attributed }` (omitted = leave current); seam documented at the
     `SaveClipSheet` usage. **Ben's lane (remaining):** surface the picker + an identity toggle in
     `SaveClipSheet` (a `features/` component) and emit them via `onSave` — then the one-line forward
     `onSave={(n, privacy) => saveClip(n, privacy)}` lights it up.
   - ✅ **C4.5 discover-completeness DONE (Aaron):** `clips/discover` rewritten — surfaces buffer-promoted
     clips (LEFT JOIN Recording **+** BufferSession → Stream; clip window via `COALESCE(startAtMs, …)`),
     filters `visibility='public'`, and honours the clip's current identity (anon → anonymous host) +
     precision. SQL validated against the test DB. *(App: the time-machine clip-pin consumer
     (`useHistoricalClips`/`DiscoveryPin`) is still unbuilt; `recordingId` is nullable for buffer clips.)*

6. 🔶 **Content decision B — the Report Centre: COPY-ON-REPORT RETENTION DONE (Aaron, 2026-06-13).**
   The decided-now backend retention is built (commit `e8fc9c5`): `ReportEvidence` +
   `ReportEvidenceRange` + `Report.evidenceId` (`SetNull`, no FK into the deletable graph — FK
   actions verified on a fresh DB); `reportEvidenceService.captureReportEvidence` (clip → whole-clip
   copy; live stream → `[T−60s, T+30s]` via `promoteBufferClip` → `moderation/`, scheduled at T+30s);
   accretion (one record per content, covered window reused); real owner + exact coords stamped through
   the reversible display layer; bytes outside the user's quota + survive deletion. `POST /streams/:id/report`
   extended + new `POST /clips/:id/report` (public clips). *(detail: `wrld-backend/CLAUDE.md` "Content
   decision B".)* ☐ **v0.3:** moderator read/resolve routes + review/takedown UI + an app clip-report
   button (net-new FE). On-device pass owed. The original full spec follows ↓
   *(FULLY SPECIFIED 2026-06-13;
   CONTENT.md §3 is canonical; app detail in `wrld-app/CLAUDE.md` "Content decision B — the Report
   Centre")*. The **third pool**: on report, copy the content to a platform-owned hold that survives
   the creator's deletion. **Review/takedown UI is v0.3; the copy-on-report retention is decided now.**
   - **Reportable:** a **live stream** or a **public clip** (clips are public — time machine + profiles).
   - **Copy unit:** live stream → **`[T − 60s, T + 30s]`** (retrospective; tail grabbed after T from the
     still-writing buffer — no race, buffer ≥24h; head clamps to session start if < 60s old). Clip →
     **the whole clip**. **All sources**, at **capture fidelity** (reuse `promoteBufferClip` copy-out
     into a platform pool, not the user's saved pool).
   - **Full fidelity / no hiding:** stamp the **real `hostId` + exact coords** regardless of the content's
     current `attributed`/`locDisplayPrecision`.
   - **Readership:** moderators only (never the owner/public; never tokenized to the creator).
   - **Retention/authority:** held until a moderator acts; **only moderators delete**; no reaper/TTL;
     **outside the creator's quota**.
   - **Model SETTLED (no-FK rule fixed; see `wrld-app/CLAUDE.md` + `wrld-backend/CLAUDE.md`):** standalone
     `ReportEvidence` (one per content) → `ReportEvidenceRange[]` (held spans) ← `Report.evidenceId?`
     (`onDelete: SetNull`, many reports → one record). The source is named by **denormalized scalar
     columns** (`targetType`/`targetId`, captured `hostUserId`/`hostHandle`/`capturedLat`/`capturedLng`),
     **never a `@relation`** into `Clip`/`User`/`Stream` — so no `onDelete` can reach the evidence. Held
     bytes live in a **platform-owned dir**, not the saved pool. Only the internal `ranges` cascade *from*
     the record.
   - **Accretion:** a 2nd report on the same infraction attaches to the **existing** record (no re-copy);
     overlapping window → copy only the **additional head/tail**; disjoint → another range on the same
     record. One content record, N reports.
   - **Lane:** extends Phase 5/22 (`Report` row + base64 `snapshotUrl`) — which today holds **no footage
     copy**; this closes that. Backend owns the model + copy job + accretion; mediasoup needs no new
     capture (copy is backend-side out of the buffer).

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
