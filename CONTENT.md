# CONTENT.md — WRLD content-handling principles

> **What this is.** The principles for how WRLD captures, stores, edits,
> **represents**, and surfaces content — the *why* behind both the backend
> substrate and the app surfaces. It is the **content-principles** doc, the
> sibling to [`DESIGN.md`](DESIGN.md): DESIGN.md governs how WRLD *looks and
> composes* (tokens, tiers, motion); CONTENT.md governs how WRLD *handles
> content* (the two pools, the clip manifest, capture, representation, privacy,
> the time machine). Same role, different axis — principles + decided models,
> not an API reference (those live in `wrld-backend/docs/API.md`, the per-repo
> `CLAUDE.md` files, and the `HANDOFF-*.md` notes). When a content decision is
> made, the principle lands here; the implementation detail lands in the repo
> docs. A living doc — keep it honest against what's actually built.
>
> **Cross-repo.** Mirrored intent across `wrld-app` (capture + edit + represent
> surfaces), `wrld-backend` (durable store, clip manifests, discovery), and
> `wrld-mediasoup` (live media + the rolling-buffer recorder). Section 8 states
> the requirements the lower repos must robustly meet for the representation in
> Section 5 to hold. If a principle here and code disagree, that's a bug or a
> decision to log — not a thing to silently route around.

---

## 1. First principles (the promises)

1. **Nothing is captured silently.** Recording is always a visible, chosen
   state, with a persistent on-air-vs-recording indicator while broadcasting.
   This is the durable promise (the "Capture Privacy Constitution", pre-launch).
   The consent *step* is currently relaxed for the friends-and-family build; the
   indicator is not.
2. **Capture ⊆ broadcast.** You cannot record what you are not broadcasting.
   Going live is what fills the buffer; there is no record-without-broadcast and
   no standalone Record verb. The durable user verb is **"Save a clip"**
   (retroactive, over the buffer).
3. **Editing is non-destructive.** A clip is a *manifest* over footage, never a
   re-encode. The only destructive act a user can take is **permanent delete**
   (which reclaims quota). Everything else — trim, reorder, source on/off,
   visibility — is reversible metadata.
4. **The user owns the privacy ceiling at capture time.** Location precision,
   identity (attributed/anon), and which sources air are chosen per go-live and
   are immutable for that recording. Edits can only ever *narrow* below the
   captured ceiling, never widen past it.
5. **Storage is honest and bounded.** Two pools, explicit caps per tier, visible
   usage. The system never quietly grows without bound, and it never silently
   drops content a user chose to keep.
6. **The representation never lies about the model.** What the UI shows — lane,
   lifecycle, precision, frame, state — must be true to the underlying content.
   Where it can't show the full truth it degrades visibly (thinner), never
   fabricates or misleads. (Section 5 is this principle, made concrete.)

---

## 2. The two pools

Content lives in exactly one of two stores, with opposite lifecycles:

| | **Rolling buffer** | **Saved-clip pool** |
|---|---|---|
| Purpose | always-on rewind of what you aired | the bits you chose to keep |
| Lifecycle | self-overwriting ring; the **reaper** evicts by a time-window + byte-backstop contract | **permanent until deleted** |
| Privacy | private to the owner; never on the globe | public-eligible (visibility per clip) |
| Time machine | **not** in it | **in** it (surviving clips are what the past is made of) |
| Cost | a generous per-tier budget (not user-managed) | counts against the user's saved quota |

**Per-tier caps** (capture is pinned to the tier — "cap produce", no server
transcode): Free 24h / 720p · Plus 72h / 1080p · Pro 7d / 1440p. Byte backstops
are sized worst-case-plus-cushion.

---

## 3. Capture model

- **Sources are layers.** The v0.2 layer model: camera, audio, screen, location,
  gyro, compass, identity (+ chat as a source). Identity is an attributed/anon
  *flag*, not a recorded track. Non-camera sources get **visualizers** (Section
  5) so a data-only or audio-only stream is never a bare panel.
- **Air is the single arming control (app).** The dashboard arms what airs;
  recording is a single verb on the live view that captures whatever is on air
  (the per-source Rec toggle was retired). The cross-repo contract still models
  the broadcast set and the record set, but the app's v0.2 UX is air-arms-one.
- **Sensitive vs benign.** Camera / audio / location / screen are sensitive
  (consent-gated when consent is on); gyro / compass are benign. The tiering and
  the on-air indicator are the working form of principle #1.
- **Data-only is valid.** A location share, a telemetry feed, a torch channel —
  any armed source can go live; AV is not required for a live room.

---

## 4. The manifest model (recording → clip; draft ↔ saved)

- **A Recording** is the per-source tracks captured for a session.
- **A Clip is a manifest** over a recording / the buffer: an ordered list of
  time-**ranges** + per-source **enabled** state + identity / location-precision
  / visibility / tags. No bytes are re-encoded. The manifest is the single
  source of truth.
- **One row, two states** (a `saved` boolean):
  - **Draft** — a manifest over the buffer. No copy, private, costs no saved
    quota, editable, **ages out with its footage**. Plays straight from the
    buffer.
  - **Saved** — its in-bounds footage **materialised** to durable storage
    (promote-on-publish), public-eligible, **survives buffer eviction**.
- **The carve.** The buffer view shows footage **minus** the saved + draft
  ranges. A saved/trimmed clip carves its range out of its source session; the
  remainder stays as buffer. So a given range shows in **exactly one lane**, and
  a carved range can't be re-saved. (App-side display computation today; the
  durable promote is the backend's job.)
- **Mid-clip delete** = one clip with two ranges and a gap (an HLS
  discontinuity), not an auto-split into two entities.

---

## 5. Content representation (how it's shown, honestly)

The presentation rules that keep the UI true to the model. These are decided
nuances, not styling — styling lives in DESIGN.md.

- **The timeline is footage-dense, not wall-clock-linear.** Empty time collapses
  to thin gap markers; clips are packed. The x-axis measures *footage*, so the
  representation foregrounds what exists — a long dead gap reads as a marker, not
  a void you scroll through. Oldest/reaper on the left, now on the right.
- **Two lanes, one axis, the carve made visible.** Buffer (footage minus saved +
  draft ranges) above; saved below; sharing one collapsed-gap axis and one
  time→x mapping — they never overlap, so the carve is literally one render. The
  lane titles state the lifecycle truth ("Buffer · not public · reaper clears
  it" / "Saved · public · reaper-safe"). Drafts read as dashed-outline blocks.
  Saved clips read the *same* paper as buffer clips — the lane + title carry the
  distinction, not colour.
- **The centre playhead is the reference.** A fixed vertical rule at screen
  centre that runs under the title bands; content scrolls beneath it, and there's
  half-a-viewport of slack on each end so the reaper edge and the live/now edge
  can each reach centre. Play plays *from the playhead* and the timeline follows
  it frame-by-frame. Scrolling **blurs the selection** and the viewer follows
  whatever clip is under the playhead (best-effort).
- **Zoom rescales time, never content.** Pinch is a layout rescale of the time
  axis (clip widths grow/shrink) — *not* a transform scale — so thumbs and labels
  never distort. It's anchored to centre (scales evenly left/right), runs on the
  UI thread (buttery, no jitter), and a 2nd finger always takes over (scroll
  stops, a half-dragged clip springs back to its lane).
- **Thumbnails are honest and uniform.** Every clip poster occupies the **same
  square footprint**, `contain`-fit (letterbox/pillarbox) so portrait and
  landscape both show whole — never cropped, never stretched. When a clip is too
  narrow at the current zoom for a poster, it swaps to the clip glyph (the
  rotated film icon) in the same footprint. The poster *is* the clip's
  representative frame.
- **The viewer shows the truth of state.** The poster (the thumb) when
  paused/selected; the video when playing; letterbox/pillarbox over black so
  nothing is cropped. Tap a clip → its thumb; press play → its footage.
- **Non-camera sources are represented, not blank.** Each source kind has a
  visualizer (audio orb/waveform, compass, gyro, motion, accelerometer, speed,
  temperature, torch, chat log) so an audio-only or data-only stream is a legible
  panel. Camera/screen are video; everything else is a rendered representation of
  its data, switchable from a source rail.
- **Orientation is fixed at capture, never faked in the app.** If footage plays
  rotated, that is a capture-side orientation bug (CVO not baked) — the app must
  **not** counter-rotate (it would double-rotate once capture is fixed).
- **Degrade gracefully, never mislead.** A missing poster / thumbnail / segment
  falls back along a defined ladder (session poster → sprocket filmstrip → glyph;
  missing/expired manifest → poster + tap-to-retry) and seeks use tolerant
  keyframe seeks. The representation is allowed to be *thinner*, never broken or
  wrong. "As best it can" is a stated stance.

---

## 6. Privacy & consent

- **The indicator is non-negotiable.** While broadcasting, the on-air-vs-
  recording state is always visible.
- **The consent step is the relaxable half.** Currently parked for friends-and-
  family; the `RecordConsentSheet` and sensitive/benign badges are shipped and
  re-enabled before any wider exposure.
- **Precision is per-stream, set at go-live** (exact / city / country / off),
  immutable for that recording; the globe renders the broadcaster's *captured*
  choice, not their current account setting. `off` never reaches a client.
- **Anonymous is truly anonymous.** No device IDs, no local UUIDs, no backend
  row for a viewer. Identity actions (go live, chat, react, follow, save) are
  what require an account.

---

## 7. Time, discovery & the globe

- **The past is thinner than live, on purpose.** The time machine replays the
  globe at a past instant from **surviving clips only** — not everything that
  aired. A single `offsetMs` behind now drives a real-time playhead (NOW / THEN).
- **Forward-only data.** Audience geo, activity heatmaps, analytics — all accrue
  from new activity; nothing is backfilled. The honest story beats a fabricated
  history.
- **The globe encodes the privacy ceiling visually.** Location precision renders
  as a sharp pin (exact), a soft halo (city), or a diffuse haze (country),
  centred on the *obfuscated* coordinate — the representation itself respects the
  captured precision. Subscription status reads by colour; the broadcaster's own
  live stream is a black self-pin (excluded from the join drawer; tapping returns
  to the broadcast); pin counts are clusters-only and exclude your own stream.
- **One pin type for live + past.** A unified `DiscoveryPin` (`stream | clip`) so
  live and historical items share one renderer — the only difference is the CTA
  (Join vs Watch).

---

## 8. What the substrate must guarantee (cross-repo)

The model (§2–4) and the representation (§5, §7) only hold if the lower repos
provide the following. These are the robust, non-negotiable supports — if one
regresses, the app's content surfaces degrade or lie.

### Recorder — `wrld-mediasoup`

- **Always-on rolling buffer while live:** per-source fMP4 tracks (`-c:v copy`,
  no transcode), namespaced per owner.
- **Codec-uniform groups.** Capture is pinned per tier (deterministic
  width/height/level via `getUserMedia` max constraints) so the concatenated
  buffer VOD never changes decoder config mid-stream — a mid-VOD config change
  wedges AVPlayer/ExoPlayer after a seek. When a stitch must span differing
  codecs, expose **codec-uniform group descriptors** so the player swaps source
  at the boundary instead of seeking across it.
- **CVO orientation baked at capture** — so the app never rotates footage.
- **Wall-clock-chunked telemetry** (`.jsonl`) per data source, aligned to the
  media timeline, so sensor overlays replay in sync.
- Per-track `recordingReady`; the **reaper** enforces the window + byte-cap
  contract (the buffer's self-overwriting promise).
- **Server-generated buffer thumbnails** (interval JPEGs / sprite / WebVTT) —
  client-side frame extraction *hangs* on a `-c:v copy` HLS VOD, so posters and
  timeline frames must come from the server (the §5 "honest thumbnails" rule
  depends on this).
- **Telemetry relay** for aired sensor sources (so a viewer's visualizer has
  data, not just a label).

### Backend — `wrld-backend`

- The **durable saved-clip pool** + the non-destructive clip **manifest** (ranges
  + per-source enabled + identity / precision / visibility / tags), draft↔saved
  with **promote-on-publish** (in-bounds bytes copied out of the rolling buffer so
  a saved clip survives eviction).
- **Owner-gated, self-authorizing tokenized HLS** — segment URLs carry their own
  token (no Clerk header on segment fetches), TTL long enough for an editing
  session and refreshable.
- `GET /buffer/me`: the buffer descriptor (sessions, playable kinds,
  manifest/poster URLs, **codec-uniform groups**) + **dual-pool storage**
  (`usedStorageBytes` saved pool · `bufferSizeBytes` · `bufferEarliestAt`) so the
  reach hint + storage meters are real.
- **Clip CRUD:** create draft · patch manifest · save (promote) · list
  (`lane=saved|draft|all`) · delete.
- `clips/discover?at=<ISO>` honours `saved` + visibility + the **captured**
  location precision (never the user's current setting); excludes `off`. Returns
  the unified `DiscoveryPin` union; computes the **seek offset** server-side.

### Shared contracts

- `SourceType` / `FeedKind` is the seven-source (+ chat) union.
- Location precision is **immutable at capture** and travels with the
  stream/clip, not the user.
- The `DiscoveryPin` discriminated union + the seek-offset math are the live↔past
  contract.

---

## 9. The seam

Ben owns the component library (`primitives/`, `features/`, `sections/`) +
DESIGN.md + CONTENT.md §5 (representation). Aaron owns `screens/`, `hooks/`,
`api/` + the backend / recorder (§8). Content **presentation** is Ben's; content
**data wiring** is Aaron's. They meet at typed props and the manifest contract.

---

## 10. Pointers (the weeds live here)

- App detail + decisions: `wrld-app/CLAUDE.md` (Rolling Buffer, Clips, Time
  Machine, and the dated Update sections) and `wrld-app/DESIGN.md` (Section 3 +
  decision log).
- Backend detail: `wrld-backend/CLAUDE.md` (C-series + R-series) and
  `wrld-backend/docs/`.
- Recorder detail: `wrld-mediasoup/CLAUDE.md`.
- Live handoffs: `HANDOFF-c4-clip-editor-*.md`,
  `HANDOFF-clips-saved-persistence-*.md`, `HANDOFF-source-visualizers-*.md`.
