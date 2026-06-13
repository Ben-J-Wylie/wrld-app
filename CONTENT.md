# CONTENT.md — WRLD content-handling principles

> **What this is.** The principles for how WRLD captures, stores, edits, and
> surfaces content — the *why* behind both the backend substrate and the app
> surfaces. It is the **content-principles** doc, the sibling to
> [`DESIGN.md`](DESIGN.md): DESIGN.md governs how WRLD *looks and composes*
> (tokens, tiers, motion); CONTENT.md governs how WRLD *handles content* (the
> two pools, the clip manifest, capture, privacy, the time machine). Same role,
> different axis — principles + decided models, not an API reference (those live
> in `wrld-backend/docs/API.md`, the per-repo `CLAUDE.md` files, and the
> `HANDOFF-*.md` notes). When a content decision is made, the principle lands
> here; the implementation detail lands in the repo docs. A living doc — keep it
> honest against what's actually built.
>
> **Cross-repo.** Mirrored intent across `wrld-app` (capture + edit surfaces),
> `wrld-backend` (durable store, clip manifests, discovery), and
> `wrld-mediasoup` (live media + the rolling-buffer recorder). If a principle
> here and code disagree, that's a bug or a decision to log — not a thing to
> silently route around.

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
  *flag*, not a recorded track. Non-camera sources get **visualizers** in the
  viewer so a data-only or audio-only stream is never a bare panel.
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

## 5. Privacy & consent

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

## 6. Time & discovery

- **The past is thinner than live, on purpose.** The time machine replays the
  globe at a past instant from **surviving clips only** — not everything that
  aired. A single `offsetMs` behind now drives a real-time playhead.
- **Forward-only data.** Audience geo, activity heatmaps, analytics — all accrue
  from new activity; nothing is backfilled. The honest story beats a fabricated
  history.

---

## 7. Where it lives (and the seam)

- **App surfaces** (`wrld-app`): the **Clips grid** (two lanes on a shared
  collapsed-gap timeline, fixed centre playhead, drag-between-lanes to save/
  un-save), the **clip editor** (manifest editing), the **viewer** (poster when
  paused, plays from the playhead), the **dashboard** (arming) and live view
  (recording verb + indicator).
- **Backend substrate** (`wrld-backend`): the durable saved-clip pool, the clip
  manifest model + promote-on-publish, owner-gated tokenized HLS, discovery
  (`clips/discover` honouring saved + visibility).
- **Recorder** (`wrld-mediasoup`): the always-on rolling buffer — per-source
  fMP4 tracks, wall-clock-chunked telemetry, codec-uniform groups, the reaper
  (window + byte cap).
- **The seam.** Ben owns the component library (`primitives/`, `features/`,
  `sections/`) + DESIGN.md; Aaron owns `screens/`, `hooks/`, `api/` + the
  backend. Content data wiring is Aaron's; content presentation is Ben's. They
  meet at typed props and the manifest contract.

---

## 8. Pointers (the weeds live here)

- App detail + decisions: `wrld-app/CLAUDE.md` (Rolling Buffer, Clips, Time
  Machine, and the dated Update sections) and `wrld-app/DESIGN.md` (Section 3 +
  decision log).
- Backend detail: `wrld-backend/CLAUDE.md` (C-series + R-series) and
  `wrld-backend/docs/`.
- Recorder detail: `wrld-mediasoup/CLAUDE.md`.
- Live handoffs: `HANDOFF-c4-clip-editor-*.md`,
  `HANDOFF-clips-saved-persistence-*.md`, `HANDOFF-source-visualizers-*.md`.
