# CONTENT.md — WRLD content-handling principles

> **What this is.** The principles for how WRLD captures, stores, edits,
> **represents**, and surfaces content — the *why* behind both the backend
> substrate and the app surfaces. It is the **content-principles** doc, the
> sibling to [`DESIGN.md`](DESIGN.md): DESIGN.md governs how WRLD *looks and
> composes* (tokens, tiers, motion); CONTENT.md governs how WRLD *handles
> content* (the one store + retention/visibility axes, the clip manifest, capture,
> representation, privacy, the time machine). Same role, different axis — principles + decided models,
> not an API reference (those live in `wrld-backend/docs/API.md`, the per-repo
> `CLAUDE.md` files, and the `HANDOFF-*.md` notes). When a content decision is
> made, the principle lands here; the implementation detail lands in the repo
> docs. A living doc — keep it honest against what's actually built.
>
> **Cross-repo.** Mirrored intent across `wrld-app` (capture + edit + represent
> surfaces), `wrld-backend` (durable store, clip manifests, discovery), and
> `wrld-mediasoup` (live media + the rolling-buffer recorder). **§2 is the
> content-handling directive** — the prerogative everything else serves. §9
> states the requirements the lower repos must robustly meet for the
> representation in §6 to hold. If a principle here and code disagree, that's a
> bug or a decision to log — not a thing to silently route around.

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
3. **Editing is non-destructive — and so is saving.** A clip is a *manifest* over
   **one footage store**, never a re-encode and never a copy. The only destructive
   act a user can take is **permanent delete** (which reclaims quota). Everything
   else — trim, reorder, source on/off, visibility, **and retention itself
   (reap ↔ keep)** — is reversible per-range metadata. "Saving" is just flipping a
   `retain` directive the reaper honours in place (§3); it moves bytes between
   accounting buckets, not between disks. Delete is real (off disk) **except**
   reported content, a copy of which the platform holds in the **Report Centre**
   for moderation beyond the user's reach (§3).
4. **Privacy is the creator's, and reversible.** Location precision and identity
   (attributed/anon) are **display-layer choices the creator can change in either
   direction, any time** — blur *or* sharpen, live or on a saved clip. Capture
   retains **full fidelity** (exact coords + real identity; the owner is known
   server-side), so sharpening later is always possible; replay and discovery read
   the clip's **current** choice, never a value frozen at capture. *(Decided
   2026-06-13 — supersedes the earlier "immutable ceiling, narrow-only" model; the
   shipped immutable-precision behaviour is the rework.)* The captured **set of
   sources** is a historical fact (you can't capture a source retroactively), but a
   clip may disable any of them (§5).
5. **Storage is honest and bounded.** One store, two accounting views — reapable
   footage bounded by a per-tier **time window**, retained footage bounded by the
   **saved-storage quota** — with explicit caps and visible usage. The system never
   quietly grows without bound, and it never silently drops content a user chose to
   keep.
6. **The representation never lies about the model.** What the UI shows — lane,
   lifecycle, precision, frame, state — must be true to the underlying content.
   Where it can't show the full truth it degrades visibly (thinner), never
   fabricates or misleads. (Section 6 is this principle, made concrete.)
7. **Every source is first-class — camera-parity.** The camera is not privileged;
   it is just the *default* source. Every source (audio, screen, location, gyro,
   compass, speed, chat, …) gets the **same treatment at every stage** the camera
   does: a **live self-preview for the broadcaster — broadcasting or not** (you
   monitor each source live, exactly as you monitor the camera, the moment it's
   armed); **live consumption by viewers**; a **write to the server buffer**; and
   **saveability** into clips. And it is **previewable on every viewer frame** —
   the stream page, the clips page, someone else's stream — switchable
   source-by-source, with the **now edge showing the live source feed** the way the
   camera does (§6). Where a source's live path isn't built yet it degrades visibly
   (principle 6), but the *model* treats all sources identically — nothing about the
   camera's pipeline is special to the camera.

---

## 2. The content-handling directive

> The prerogative the whole system serves: **a broadcast is not a video — it is
> a set of compartmentalized per-source captures, bound to one wall clock,
> continuously buffered at the behest of the reaper, fully scrubbable, and
> per-source editable, so any past moment can be retroactively saved as a
> non-destructive clip.** Every model, surface, and contract in this doc is
> downstream of this. When a new content decision comes up, check it here first:
> if it fights the directive, it's probably wrong.

1. **Many sources, each a compartmentalized capture.** A live session is N
   independent source streams (camera, audio, screen, location, gyro, compass,
   chat, …), each captured, stored, thumbnailed, and edited on its **own track**.
   The composite a viewer sees is a *view* over the tracks, never the storage
   shape. Sources arm, start, drop, and resume independently.
2. **One wall clock binds everything.** Every source obeys a single absolute
   **wall-clock** timeline. Alignment is by *time*, not by stream position — so
   independently-started/dropped sources still line up, and the same clock
   indexes the buffer, clips, discovery, and the time machine. Nothing is
   positioned by "frame N of stream X"; the wall clock is the universal key.
3. **Per-source representation.** Each source carries its **own thumbnail /
   visualizer and its own lane**. You see — and scrub — each source on its own,
   not only the composite.
4. **Independent per-source edit markers.** Trim (in/out) and removed ranges are
   recorded **per source**. A clip can keep camera while dropping audio for a
   window, reveal a record-only sensor, or carry a gap on one track and not
   another. Edits are markers over tracks, never re-encodes (the manifest, §5).
5. **At the behest of the reaper.** Everything captured lives in the one store
   under the reaper's eviction contract — **reaped unless a `retain` directive
   pins it.** Saving is that directive: it exempts a range from the reaper **in
   place** (no copy, no second pool) and shifts its bytes onto the saved quota.
   Ephemeral-by-default is the rule, not a failure mode; the reaper is a consumer
   of the manifest, not a separate lifecycle.
6. **Total scrub accessibility.** Every source and the whole buffer window are
   reachable by **scrub**. The user can land on any captured instant, on any
   track — the representation gets them there (best-effort where footage is thin).

### Where this came from (the evolution)

The directive wasn't designed up front — it was earned. The shape changed
several times; the principles above are what survived each change:

- **Whole-stream Record → always-on buffer.** v0.2 began with a single Record
  button capturing the whole stream. It became the **rolling buffer**: going live
  continuously buffers; there is no Record verb; the durable act is *"Save a
  clip"* (retroactive). Capture ⊆ broadcast.
- **One blob → per-source tracks.** A recording stopped being one file and became
  **per-source fMP4 tracks** — the compartmentalization that makes per-source
  thumbnails, lanes, visualizers, and edit markers possible at all.
- **Re-encode → non-destructive manifest.** Editing stopped cutting bytes and
  became a **manifest** (ranges + per-source enabled state) with a draft↔saved
  flip — reversible metadata; permanent-delete is the only destructive act.
- **Stream-position → wall clock.** Alignment moved to the absolute wall clock,
  which unlocked the **carve** (buffer minus saved), the **two-lane timeline**,
  the **time machine**, and codec-uniform playback across independently-captured
  spans.
- **Player-of-a-clip → a scrubbable substrate.** The UI stopped being "play this
  clip" and became a **navigable timeline** — collapsed-gap axis, fixed centre
  playhead, per-source lanes, buttery zoom, scrub-while-playing — the buffer made
  directly explorable.

The prerogative, in one line: **time-indexed, per-source, non-destructive,
ephemeral-by-default content the user navigates by wall clock and curates by
saving.**

---

## 3. The content store (one store, orthogonal axes)

> **Decided 2026-06-18 — supersedes the earlier "two physical pools / copy-on-save"
> framing.** There is **one append-only footage store**. "Buffered" vs "saved" and
> "public" vs "private" are not separate stores — they are two **independent
> per-range directives** in the manifest (§5) over that one store. Nothing is copied
> to "save"; saving flips a `retain` directive the reaper honours, in place.

**Two orthogonal axes, both expressed as per-range directives:**

- **Retention — reap ↔ keep** (the two lanes). By default a range is **reapable**:
  it lives under the rolling-buffer contract (a per-tier **time window** + byte
  backstop; the reaper evicts oldest-first). A **`retain` directive** exempts a
  range — the **saved lane**. Saving moves a range from *time-windowed* accounting
  into the user's **saved-storage quota** — the **same bytes, re-tagged, never moved
  or copied** — so it still decrements available storage exactly as before.
  Un-saving releases the range back to the reaper (which may evict it immediately if
  it's already past the window).
- **Visibility — public ↔ private** (time-machine discoverability), with a
  **per-user default of public**. **Public** ranges appear in the time machine
  (reapable *or* retained). **Private** ranges never appear in the time machine —
  watchable live in the now, kept if retained, but absent from the past.
  **Independent of retention: all four cells are valid, including private + saved**
  (a kept, undiscoverable keepsake).

The reaper is just a **manifest consumer**: a segment survives iff a `retain`
directive pins it (or it's in the live window); otherwise it's evicted, oldest-first,
under the byte cap. "Saving" and "publishing" are two distinct flips — neither copies
bytes.

**Live is public by policy, not by structure.** The model permits a *private live*
broadcast; the product simply doesn't offer that choice — a one-line product rule,
not a data-model assumption.

| axis | default | flip | bound by |
|---|---|---|---|
| **retention** | reapable (buffer lane) | `retain` → saved lane | saved-storage quota |
| **visibility** | public | private | discovery filter only |

**Per-tier caps** (capture pinned to tier — "cap produce", no server transcode):
Free 24h / 720p · Plus 72h / 1080p · Pro 7d / 1440p. The time window bounds the
reapable footage; the saved quota bounds retained footage — both are accounting
views over the one store, not separate disks.

**The only genuine copies.** Two acts ever move or duplicate bytes: **permanent
delete** (drop segments, reclaim) and the **Report Centre** moderation hold — which
*must* be a separate copy because it has to outlive the user's own deletion.

**A third, platform-side hold — the Report Centre.** When content is
**reported**, the platform copies it to a **separate moderation hold** (the
*Report Centre*) — not part of the user's store. The decided shape (2026-06-13):

- **What can be reported.** A **live stream** or a **public clip** (clips are
  public — they appear in the time machine and on profiles). Both produce a
  Report Centre record.
- **What gets copied.**
  - **Live stream →** a fixed window around the report instant T: **`[T − 60s,
    T + 30s]`**, retrospective-weighted because the infraction precedes the tap.
    The tail is grabbed shortly after T out of the still-writing buffer (no race —
    the buffer holds ≥24h, so the last minute is always still on disk). Clamp the
    head to session start if the session is younger than 60s.
  - **Clip →** the **whole clip** (it's already a bounded object — no window).
  - **All available sources** are copied (camera/audio/screen + location/chat/
    sensors), at **capture fidelity** — never the display layer.
- **Full fidelity; no hiding.** An offender cannot hide behind anon or private:
  the record stamps the **real `hostId` and the exact coordinates**, regardless
  of the content's current `attributed` / `locDisplayPrecision`. The platform
  always retained both (§1.4); the Report Centre reads *through* the reversible
  display choice.
- **Readership.** **Moderators only.** Never the public, never the owner — the
  pool is never tokenized to the creator and the owner has no read path to it.
- **Retention & authority.** Held **until a moderator acts**; **only moderators
  delete.** No reaper, no TTL, and no creator action reaches it — un-save,
  delete-clip, and account deletion must **not** cascade into it. It is a
  **standalone record that *names* the source by denormalized scalar value**
  (`targetType` + `targetId`, the captured `hostUserId` / `hostHandle` / exact
  coords) — **never a foreign-key relation** into the deletable
  `Clip`/`User`/`Stream` graph, so no `onDelete` path can ever reach it. The held
  bytes likewise live in a **platform-owned directory**, separate from the user's
  saved pool, so deleting the source's files can't remove the evidence copy. (Only
  the record's own internal children — its held ranges — cascade *from* it.) Past
  the rolling-buffer window it **does not count toward the creator's quota** (it's
  the platform's storage, not the user's). The concrete model is pinned in
  `wrld-backend/CLAUDE.md` + the handoff.
- **Many reports, one piece of content.** Reports accrete onto the content, not
  the other way round: a second report on the same infraction attaches to the
  **existing** Report Centre record rather than re-copying. If its `[T − 60s,
  T + 30s]` window **overlaps** what's already held, only the **additional head
  and tail** are copied to extend the span; disjoint windows add another range to
  the same record. One content record, N reports stored with it.

*(The review/takedown UI is v0.3; the copy-on-report retention + accretion is the
decided principle now.)*

---

## 4. Capture model

- **Sources are layers.** The v0.2 layer model: camera, audio, screen, location,
  gyro, compass, identity (+ chat as a source). Identity is an attributed/anon
  *flag*, not a recorded track. Non-camera sources get **visualizers** (Section
  6) so a data-only or audio-only stream is never a bare panel.
- **Air is the single arming control (app).** The dashboard arms what airs;
  recording is a single verb on the live view that captures whatever is on air
  (the per-source Rec toggle was retired). The cross-repo contract still models
  the broadcast set and the record set, but the app's v0.2 UX is air-arms-one.
- **Sensitive vs benign.** Camera / audio / location / screen are sensitive
  (consent-gated when consent is on); gyro / compass are benign. The tiering and
  the on-air indicator are the working form of principle #1.
- **Data-only is valid.** A location share, a telemetry feed, a torch channel —
  any armed source can go live; AV is not required for a live room.
- **The dashboard is the live (now-edge) editor.** Arming + every per-range setting
  change snips the live manifest at *now* and prints forward with the new value — the
  dashboard and the clip editor are the same editor at different edges. See §5.

---

## 5. The manifest model (recording → clip; draft ↔ saved)

- **A Recording** is the per-source tracks captured for a session.
- **A Clip is a manifest** over the one footage store: an ordered list of
  time-**ranges** + **per-range directives** — source **enabled** state, identity,
  location-precision, **visibility**, **retention**, tags. No bytes are re-encoded
  and none are copied. The manifest is the single source of truth.
- **Per-range directives, not per-clip.** Every directive lives on the range and
  travels with it, so a snip (split) gives each segment its own settings and a
  **mend (merge) needs no reconciliation when the adjacent ranges agree** — and when
  they differ, the mend is guarded (disabled / prompt-to-pick), with *keeping them
  snipped* always a valid answer. *(Decided 2026-06-18 — supersedes per-clip
  identity/precision.)*
- **Saved = a `retain` directive, in place** (no `saved`-copies-bytes promote):
  - **Reapable (buffer lane)** — the default; ages out with the window, costs no
    saved quota.
  - **Saved (retained)** — a `retain` directive exempts the range from the reaper
    **where it already lives**; it counts against the saved quota and survives
    eviction. Same bytes, re-tagged. Un-save removes the directive → reapable again.
- **The carve still holds.** The buffer view shows footage **minus** the retained
  ranges, so a given range reads in **exactly one lane**. The carve is now pure
  metadata (which ranges carry `retain`), not "which pool the bytes were copied to."
- **Mid-clip delete** = one clip with two ranges and a gap (an HLS
  discontinuity), not an auto-split into two entities.

**Clip ≡ segment (decided 2026-06-24).** A *clip* and a *segment* are the same thing —
a contiguous **range** of the one footage store carrying a self-contained set of
per-range directives. "Saved clip" and "buffer segment" are the same kind of object
differing only in their **lane** directive. Snip → two; mend → one. The raw
**recording / session** (one go-live = one continuous byte span) is the substrate
underneath, **not** a user-facing unit. We standardize on **"clip"** as the user word;
"segment" is a legacy synonym for the same range. *(The clips page's two lanes are just
the **retention axis rendered as two rows** — a visual cue for that one axis, not two
entity types.)*

### The invariants (the tight principles — guardrails)

The model is only as good as these holding **everywhere**. Treat them as guardrails;
a feature that breaks one is a bug against the model, not a new behaviour:

1. **One element, one truth.** A clip is a single server-side element — its ranges +
   per-range directives + the initial-state samples. Every surface (the clips-page
   drawer, the library drawer, the time-machine pin **and** its viewer, every clip
   reference) is a *rendering* of that one element. They show the same thing because they
   read the same element — never a per-surface copy of the truth.
2. **An edit proliferates everywhere.** Changing any preference writes that one element on
   the server; every rendering reflects it (after a refetch/invalidation). If an edit
   shows on one surface but not another, the surfaces are reading divergently — that's the
   bug to fix, not a place to special-case.
3. **Every axis is equal.** Title · tags · visibility · identity · location precision ·
   per-source on/off · lane — all are per-range directives, written the same way and read
   the same way. No axis gets a bespoke path. (Capture-fidelity coords + real identity are
   always retained server-side; precision/identity are reversible *display* choices over
   them.)
4. **Forward-only snips — the clip AHEAD, never the clip behind.** A snip — manual at the
   playhead, or at any **live edge** (**now**, **reaper**, **storage cap**) — applies to
   the range **forward** of the boundary. The range **behind keeps the permissions it had
   when it was printed.** Editing live changes the future, never rewrites the past; the
   reaper and cap edges are the *same* rule at the trailing end (a being-reaped or
   capped clip's edit lands on the surviving forward span). *(Confirmed 2026-06-25.)*

### The clip's data model (canonical reference)

The concrete enumeration of the model above — what a clip is made of. *(Canonized 2026-06-25;
matches the app's `BufferTrackKind` + the `DirectiveRange` axes.)*

- **Recorded tracks (the captured data) — 10 kinds (9 live, screen pending).** Each is a per-source
  track in the one store, with an **initial-state sample at every boundary** (go-live + each snip) so
  the track always registers: **camera** (video) · **audio** (sound; + a companion `audiolevel` data
  track → the scrubbable waveform) · **location** (GPS trail) · **compass** (heading) · **gyro**
  (orientation) · **accel** (3-axis; `motion` is a derived view) · **speed** (m/s) · **torch**
  (on/off — a signaled channel, not the LED; v0.3) · **chat** (the thread) · **screen** (capture not
  wired — v0.3). *Not tracks:* identity/profile is a **flag**; `temp` is deprecated (no sensor).
- **Preference axes (editable per-range directives) — 7, all equal.** **title** · **tags** ·
  **visibility** (public|private) · **identity** (shown|anon) · **location precision**
  (exact|city|country|off) · **per-source inclusion** (on/off per captured source — what a viewer may
  see) · **lane** (buffer|saved — the retention axis). Each is a `DirectiveRange` field, written + read
  identically.
- **Structural edits — 3 ops.** **trim** (in/out ranges) · **snip/mend** (split into eras / rejoin) ·
  **permanent delete** (whole clip; per-source track delete — the only destructive per-source op).
- **Immutable substrate (recorded, never user-editable).** The footage bytes; the wall-clock
  timestamps (when it was printed); the source session id; and the **capture-fidelity exact coords +
  real identity** — always retained server-side, so precision/identity are reversible *display*
  choices over them, never a re-capture.

### Preference unification — one path for every axis

The invariants only hold if **every axis travels the same path**. A preference is unified when all
three layers treat the **per-range directive as the one authority** — this is the general rule the
title saga is just the first instance of:

1. **Write — one path.** Every edit, on any surface, writes the per-range **directive**. No surface
   writes a parallel field. *(Lane is the outstanding exception — it rides `BufferSession.lane` +
   retain rows, not a directive; making it a directive is the server's **R2**, the twin of the app's
   "lane as a peer axis.")*
2. **Read — coalesce everywhere.** Every server read resolves the directive at the instant — discover
   pins, library, viewer, globe — so no read returns a stale parallel field (`Stream.title` /
   `.locationPrecision`, `Clip.title` / `.attributed` / …). *(discover ✓; library + viewer = **(2c)**,
   deploy-pending; lane = R2.)*
3. **Render — one resolved source.** Every app surface renders the resolved value the server returns,
   via a **single resolver** — never a local immutable field (the buffer-lane timeline label reading
   `Stream.title` is the classic violation). **One drawer, not two**, so there's one rendering of the
   resolved settings.

**The bridge (temporary).** While read-coalesce (2c) is undeployed, the app **dual-writes** the
directive + the clip-level field so the clip-level readers still update. The dual-write is scaffolding
— **deleted the moment (2c) deploys**, leaving directive-only writes. A new axis must never add its
own parallel field; it rides the directive from day one.

**The directive, by axis.** The per-range directive is a **`DirectiveRange`** (server row) /
`SegmentDirective` (wire shape) / `SegSettings` (the partial an edit emits). One field per axis — this
is the read/write/render unit:

| Axis | Directive field | Domain |
|---|---|---|
| title | `title` | free text |
| tags | `tags` | `string[]` |
| visibility | `visibility` | `public` \| `private` |
| identity | `attributed` | bool (`true` = shown / attributed) |
| location precision | `precision` | `exact` \| `city` \| `country` \| `off` |
| per-source inclusion | `sources` | `{ [kind]: bool }` |
| lane | *(R2 — not a directive yet: rides `BufferSession.lane` + retain rows; target = a `retain` directive the reaper reads)* | `buffer` \| `saved` |

**The three prerogatives — identical for every axis (that's the point):**

- **WRITE → the directive, one path.** *Retrospective* (a past clip/range): `PATCH
  /buffer/me/sessions/:id/directives` (app `bufferApi.patchDirectives`). *Live* (the now edge): `POST
  /buffer/me/sessions/:id/snip { settings }` (app `snipSession`) — closes the open era at the
  server's `now`, opens the next forward. The edit UI emits a `SegSettings` partial → the screen
  merges it into the covering range → PATCHes the authoritative list. *Bridge:* until (2c) a saved
  clip ALSO `patchClip`s the `Clip.*` mirror (deleted when (2c) ships). *Exception:* lane → save /
  un-save until R2.
- **READ → resolve the directive at the instant, on every feed.** The `DirectiveRange` covering T
  wins, falling back **directive → clip-level (`Clip.*`) → stream-level (`Stream.*`) → type
  default**. discover ✓ (`directiveAt`/`titleAt`); library + viewer = (2c). No feed returns a stale
  parallel field.
- **RENDER → one resolver, every surface.** `resolveClipSettings(clip)` returns the resolved 7 axes
  from the server's (coalesced) data; the timeline labels (both lanes), the one drawer, the viewer
  chrome, and the pin card **all render from it** — never a raw `Stream.title` / `Clip.name`. Every
  edit invalidates every surface's query.

### Snips — one boundary, planted by hand or by a live edge

A **snip** plants a manifest boundary; the range forward of it can carry different
settings. It's one operation with two families of trigger:

- **Manual — the scissors at the playhead.** Deliberate, at **any instant**, on any
  footage (past, retained, or buffered). The primary explicit editing cut.
- **Live edges — automatic, server-authoritative.** Three edges plant the same kind of
  boundary on the fly, where live activity crystallizes:
  - **Now edge** — incoming footage. The dashboard is its editor (below): change any
    setting → snip at *now* → keep printing forward with the new settings. A live
    broadcast is therefore a sequence of **settings-eras**, naturally segmented.
  - **Reaper edge** — the oldest footage being consumed, **symmetric to the now edge**.
    Any edit to a being-reaped clip applies **from the reaper edge forward** (the rest
    is already evicted) — a snip at that edge; if the forward range is *saved* it
    persists as its own clip. Toggling save↔buffer while reaping plants successive snips
    → **distinct saved clips with evicted gaps between them** (each gap-free internally,
    each independently editable). No *interior* gaps — the reaper only eats from the left.
  - **Storage cap** — a length bound. Live-to-saved that hits the cap snips at the cap,
    **auto-flips the lane to buffered**, and keeps printing there (a warning if the user
    tries to toggle back with no room).

A save's range is bounded by all three: `[max(start, reaperEdge), min(end, nowEdge,
edge + storageRemaining)]`. **The live edges are server-authoritative** — the client's
edge is stale by the round-trip, so the client sends *edge-relative intent* ("save from
the live edge forward") and the **server snips at its own edge at commit time**. A sliver
evicted during the round-trip may be lost; nothing is over-claimed.

### The dashboard is the live (now-edge) editor

The dashboard and the clip editor are **the same editor over the same per-range
manifest** — one scoped to the **now edge** (live), one to **any past range**
(retrospective), same toggles. At go-live the user picks the starting **lane** (buffer
or saved — a new dashboard toggle); the server tags the incoming clip accordingly.
Changing **anything** the server stores per-range — lane, a source on/off, **location
granularity**, identity, title, tags — snips at now and prints forward with the new
value. Every source is treated equally, **each in its own way**: a data source
(location, sensors, chat) snips as pure metadata; an **AV source (camera/audio) snips
with a real mediasoup renegotiation** (add/remove a producer) — different cost, same
manifest result.

**Visibility is the one per-range setting withheld from the dashboard** — not because
the server can't (it's wired identically) but by choice: **live is always public**
(§3), so there's nothing to choose live. Visibility becomes editable only **post-hoc**,
in the clip editor.

### Self-contained clips — each snip stamps its own initial state

Because every clip must stand alone (playable, editable, saveable without reaching into
its neighbour), **each snip stamps the new clip's initial state**: at the boundary,
every state-bearing source re-emits its **current value** as the new clip's first
sample — chat → empty-thread marker, location → current pin, compass/gyro/accel/speed →
current reading, torch → current on/off. Continuous media (camera/audio) just keeps
flowing — no first sample needed. This is the go-live "nothing reads blank" promise
**generalized to every snip**. **Mend** reverses it: reconcile the two clips' settings
(or keep them snipped), then **coalesce → one clip**.

### One source of truth — the server does the snipping

All snipping, saving, eviction, and clamping happen **server-side**; the client sends
intent and renders the result. The live edges move continuously and only the server sees
them authoritatively, so the server is the **single source of truth** for where a snip
lands and what persists. *(Decided 2026-06-24.)*

### Conformance status — how close the build is to these invariants (2026-06-25)

The U-series + the on-device findings (#13/#12/(2c)/#11) brought the backend most of the
way to the invariants. An honest read of where it holds and where it still diverges, so the
gaps are tracked as gaps, not silently lived with:

- **Invariant 1 (one element) — strong.** `DirectiveRange` is now the single read authority
  across all three discover feeds, the buffer pins (precision/identity/title), the saved-clip
  reads, and `GET /clips/:id`. PB2 retain-in-place means a save is a directive, not a copy —
  one footage store.
- **Invariant 2 (an edit proliferates) — strong, deploy-pending.** (2c) is exactly the change
  that lets a directive edit reach the library + viewer + pin from one write; until it deploys
  the app still dual-writes `Clip.*`.
- **Invariant 4 (forward-only) — holds** for the now + reaper edges. **Soft spot:** the
  **storage-cap edge is not yet a true server snip** — over-budget saves return `409
  storage_cap` and the *client* flips the lane, rather than the server snipping at the cap +
  auto-flipping + printing forward. Deferred behind a bytes↔time estimate.
- **Invariant 3 (every axis equal) — the real divergence.** **Lane is special-cased.** Every
  other axis (visibility · precision · identity · sources · title · tags) is a `DirectiveRange`
  field on one write/read path; **lane is not** — it rides `BufferSession.lane` (U1) *plus*
  retain `Clip`/`ClipRange` rows (U3 save). "Lane is just one of the per-range directives" is
  true in this doc but **not in the schema**. Closing this (a per-range `retain`/`lane`
  directive the reaper reads as *the* retain signal, collapsing the session-flag + retain-row
  duality) is the single highest-leverage step toward invariant 3, and the server-side twin of
  the app's "lane as a peer axis" thread.
- **Deeper structural gap (toward invariant 1's "clip ≡ segment").** A saved clip's manifest
  is still spread across **`ClipRange` (retain body) + `DirectiveRange` (per-segment settings)
  + `ClipTrack` (per-source)** — three representations reconciled by `splitRangeByDirectives`.
  It works, but a clip isn't yet *literally* "a named set of per-range directives over the one
  store." A long-term collapse, flagged as north-star, not scheduled.

### Target architecture (north star) — the done state

> **What this is:** the destination model — clean-slate, fully named. Today's schema has three
> levels (`Stream`/`Clip`/`DirectiveRange`) with duplicated, inconsistently-named fields and a
> resolution chain; the dual-write + fallback we run now is the **bridge** toward this. This is
> *not* current reality — it's the shape the migration (the R4 collapse) heads to. Canonized
> 2026-06-25 so the target is fixed and nothing drifts. *(See "Conformance status" above for how
> close the build is; the §12 bridge table below maps current → target.)*

**1. Three entities (named by role).**
- **`Track`** — captured per-source footage. The immutable substrate.
- **`Clip`** — the **one** manifest unit: a wall-clock range over the Tracks + the 7 axes. Snip →
  two clips; mend → one. (*Clip ≡ segment.*)
- **`Stream`** — the live broadcast's **identity + access only** (host, coords, `subscribersOnly`,
  `ppvEventId`, `contentRating`). Holds **no** settings axis.

**2. The substrate — what's recorded (10 sources; 9 live, screen pending).** Each captured
**source** is stored as a **`Track`** (drop "kind" — a source *is* the track's identity), with an
initial-state sample at every boundary (go-live + each snip) so it always registers:

| Source | What |
|---|---|
| camera | video |
| audio | sound (+ companion `audiolevel` track → the scrubbable waveform) |
| location | GPS trail |
| compass | heading |
| gyro | orientation |
| accel | 3-axis (motion is a derived view) |
| speed | m/s |
| torch | on/off (signaled channel, not the LED — v0.3) |
| chat | the message thread |
| screen | screen-share (capture not wired — v0.3) |

*Not tracks:* **identity** is an axis (a flag), not recorded data; `temp` is deprecated (no sensor).

**3. The manifest — the 7 axes (columns on `Clip`, all equal).** One name, one home (`Clip`), one
vocabulary each. Written only on the `Clip`:

| Axis | Column | Values |
|---|---|---|
| Title | `title` | free text |
| Tags | `tags` | `text[]` |
| Visibility | `visibility` | `public \| private` |
| Identity | `identity` | `shown \| anon` *(bool retired)* |
| Location precision | `precision` | `exact \| city \| country \| private` *(`private`, not "hidden"/"off")* |
| Source inclusion | `sources` | `{ [source]: shown }` — view-mask over the captured Tracks |
| Retention | `keep` | `kept \| reapable` *(UI lane: saved \| buffer)* |

**4. Structure — 3 ops (boundaries + destroy).**
- **snip** — add a boundary inside a clip → two clips.
- **mend** — remove a boundary between adjacent clips → one (coalesces when axes agree).
- **delete** — permanent: a whole clip, or one `Track` (the only destructive per-source op; reclaims).

**`trim` is not a primitive** — trimming = **snip + the off-cut reverts to `keep: reapable`**
(non-destructive). It stays a user gesture, composed of the above; nothing "trim" is stored. So
structure = **boundaries + `keep`**, nothing else (no `splitPoints` field).

**5. Immutable substrate (recorded, never user-editable).** The footage bytes (the `Track`s); the
wall-clock timestamps (`startMs`/`endMs` — when it was printed); the source session id; and the
**capture-fidelity exact coords + real identity** — always retained server-side; `precision` /
`identity` are reversible **display choices** over them, never a re-capture.

**6. The flow — read / write / render (one path, identical for all 7 axes).**
- **WRITE → `editClip(range, patch)`** writes the axis column on the `Clip` (splitting as needed);
  the live now-edge edit is the same verb at the now edge. **One write path; no parallel field,
  ever.** Only **two writers**: the **drawer** (all 7 axes) and the **timeline block** (`keep` via
  lane-drag + the structural ops). Every other surface is read-only.
- **READ → select, then read current.** A **selector** finds the clip (`clipAt(t)` for a past/live
  instant, or the clip itself); the axes are then read as the clip's **current** values. **No
  resolution chain** — the `Clip` is the sole home. *(✅ Implementation LOCKED 2026-06-28: **resolve-at-write
  / materialized segments** — every era is ONE full standalone rule object with all 7 axes concrete (no
  `null`/inherit, even identical neighbours stay distinct objects); a read is a plain column read, the
  resolver collapses away. This is the CU4 schema — supersedes the interim resolve-at-read/fallback.)*
- **RENDER → one resolver** feeds every surface; every edit invalidates every surface's query.

**7. The time-machine rule (selection vs. value — keeps replay honest about edits).** Two times are
involved; only one is the playhead. **`t` (or `now`) selects *which* clip** is shown (capture-span
overlap, filtered by **current** `visibility`); **every axis is read as the clip's *current*
value** — never frozen at `t` (§1.4 reversibility). So renaming, sharpening precision, flipping a
source, or going private **proliferates to the past pin immediately**, because the pin reads the
current clip object — `t` only chose it. `clipAt(t).title` means **(the clip alive at `t`) . (its
current title)** — not "title as it was at `t`." The **only** things tied to `t` are the footage
bytes + the retained capture-fidelity substrate. (Edits are per-range: editing the era covering `t`
updates that range; an un-snipped clip edits wholesale.)

**8. The surface × axis read map.** Every non-dash cell reads the **same field** — `clip.<axis>` —
selected by `t`/`now` for time-indexed surfaces, or the clip directly otherwise:

| Surface | title | tags | visibility | identity | precision | sources | keep |
|---|---|---|---|---|---|---|---|
| Live globe pin | label | — | listed? + planet | — | placement + halo | — | — |
| Time-machine pin | label | — | listed? + planet | — | placement + halo | — | — |
| Discovery card (tap) | ✓ | — | access badge\* | host ✓ | location caption | — | — |
| Clips timeline block | label | — | — | — | — | lane fill | lane ✓ (write) |
| Clip / Library drawer (editor) | ✓ rw | ✓ rw | ✓ rw | ✓ rw | ✓ rw | ✓ rw | ✓ rw |
| Library entry | ✓ | (✓) | — | — | — | — | (kept) |
| Live stream viewer | chrome | — | access gate\* | host ✓ | location chrome | source rail | — |
| Time-machine clip viewer | chrome | (✓) | access gate\* | host ✓ | location chrome | source rail | — |
| Analytics — top clips | ✓ | — | — | — | — | — | — |

\* **Access** (`subscribersOnly`/`ppvEventId`) + the **host avatar/@handle** are **`Stream`-level**,
not clip axes — `visibility` only decides public/private (→ listed + which planet); `identity` only
decides shown-vs-anon. **Compose inputs** (dashboard + stream-preview title fields) read/write
`captureConfig.title` — the *next* clip's title at go-live, the one legitimate title input that isn't
`clip.title`.

**9. Planet / realm — derived routing, not a precision value.** Which globe a clip lands on is a
**read-time discovery decision** over single-meaning axes, never baked into `precision`:
`precision: private` → **Haven**; `contentRating: adult` → **Venus**; else → **Earth** (at the
`precision` blur); a new planet → **a new routing rule**, never a new `precision` value or any change
to stored clip data. *(If a creator ever picks a planet explicitly, that becomes its own `realm`
axis beside `precision` — not inside it. Today it's fully derived, so no `realm` axis yet.)*

**10. The count.** 3 entities · 10 sources/Tracks (9 live) · 7 equal axes · 3 structural ops · 1
read · 1 write (2 writers) · 1 resolver. No second copy of any fact → no resolution chain, no name
collision, no vocab tangle. The naming enforces it: there's nowhere else to put a `title`.

**11. The one-line model.** A **`Clip`** is a wall-clock range over the footage **`Track`s**,
carrying seven axes — `title` · `tags` · `visibility` · `identity` · `precision` · `sources` ·
`keep`. `snip`/`mend`/`delete` change its shape; `editClip` changes its axes; a selector
(`t`/`now`/the clip) finds it and every axis is read **current**; the **`Stream`** is just live
identity + access; the planet is derived. One home per fact, rendered everywhere.

**12. North-star vs. built (the bridge — so this isn't mistaken for reality).**

| Target (this section) | Today | Bridge |
|---|---|---|
| `Clip` is the sole home; no chain | `Stream`/`Clip`/`DirectiveRange` each copy axes; `?? clip ?? stream` chain | reads coalesce the directive (#13 ✓; 2c deploy-pending) |
| `editClip` only writes the directive | dual-write directive + `Clip.*` | dual-write is scaffolding — deleted when 2c ships |
| `keep` is the one retention signal | `BufferSession.lane` + retain rows + `DirectiveRange.retain` OR'd | R2 collapses to one |
| `Clip` ≡ range + axes (one entity) | `Clip` + `ClipRange` + `DirectiveRange` + `ClipTrack` | R4 north-star collapse |
| consistent names: `precision\|…\|private`, `identity: shown\|anon`, `keep` | `precision`/`locDisplayPrecision`/`locationPrecision`; `visibility: public\|anon\|draft`; bool `attributed`; `lane` | rename + vocab split during the collapse |

> **Field-by-field fragmentation + the exact read paths to collapse** (the two `DirectiveRange`
> row-sets `clipId=null`/`clipId`-set, every feed's current resolution, the pin coverage nuance, the
> buffer-session dedup, the write targets, and the DO/DON'T) are itemized in
> `HANDOFF-unified-manifest-2026-06-24.md` → **"CU1 — THE PEDANTIC DETAIL."** That's the CU1
> work-order; this section is the principle.

---

## 6. Content representation (how it's shown, honestly)

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
- **Playback is playhead-driven — one authoritative wall clock.** A single
  playhead *instant* is the source of truth; the video player and the timeline
  are **followers** (the player seeks/plays to match it, the timeline scrolls to
  centre it, the viewer shows the footage at it). The playhead advances by REAL
  time — 1× over footage, a fixed rush rate across a gap — and is driven by the
  finger while scrubbing (and by inertia until the scroll settles). "Advances by
  real time" means it **reads** elapsed time off the one wall clock
  (`playStartInstant + (serverNow() − playStartClock)`), **not** by accumulating
  per-frame deltas — an accumulator is a second clock that drifts (see *The
  universal wall clock* below). It is
  **never** derived from the video's stream position (a lagging, VOD-bounded
  signal), and **never** reset by incidental state changes (a lane drag, a
  re-layout). A clip / lane / gap boundary is a *seek for the follower* (reload
  the next VOD), **not a stop for the playhead** — the playhead crosses
  boundaries continuously and the video catches up. This is §2 principle 2
  ("alignment is by time, not stream position") made operational; **stalls,
  snap-backs, and 1969 clocks are all symptoms of inverting it** (letting the
  video drive the playhead).
- **Gap traversal is fixed-duration, for every frontier — not time-linear.** The
  timeline collapses empty time to a fixed-width marker (above); the temporal
  analogue is that *every* frontier crosses a gap in a fixed `GAP_RUSH_MS` (≈3s),
  never at wall-clock rate. The **playhead** rushes a gap the moment it enters
  one. The **reaper frontier** (the eviction edge, pinned to the real boundary
  `now − window`) can't take 3s on entry without lying about what's gone, so it
  parks at the just-eaten edge through the gap's long empty span and rushes the
  collapsed pixels in the *final* 3s before the footage on the gap's far side
  begins evicting — arriving at each clip exactly as it ages out. Footage is
  always consumed at 1×. This holds for the leading gap (rushes 3s before the
  first clip evicts), interior gaps, and the trailing gap. The reaper edge also
  **never passes the centre playhead**: parked at the edge, the frontier stays at
  centre and the now edge is pulled toward it as footage is eaten, until the
  window is fully evicted (head meets now → the no-clips state). Both frontiers
  obey one law — the collapsed gap is crossed in fixed time, footage in real
  time — so consumption reads identically whether played or reaped.
- **The two edges are symmetric, and bound the playhead.** Footage **grows from
  the right** at the now edge (the live clip extends, rounded-right corner + the
  dark tail cap beyond) and **shrinks from the left** at the reaper edge (the
  oldest clip's left edge tracks the eviction boundary, showing its own
  rounded-left corner + the dark void beyond) — never a hard crop; the geometry
  is the clip's, both ends. The playhead **cannot be dragged past either edge**:
  it clamps at the reaper edge (can't enter the reaped void) and at the now edge
  (can't outrun live).
- **Frontiers are magnetic — one ride-state, read from geometry.** The playhead is
  either FREE (static, or playing footage between the edges) or STUCK TO A FRONTIER.
  The two frontiers behave **identically**: whenever the playhead comes within reach
  of one — by a drag in *any* state (play or pause), by the reaper catching up to a
  parked playhead, or by playback reaching now — it **snaps to and sticks** to it
  *exactly* (no sliver). While stuck the clock **ticks** (NOW at the now edge, THEN
  at the reaper edge) and footage playback **yields** to the ride. "Which frontier
  the playhead is on" is decided in **one** place — the timeline's geometry (is the
  centre within the snap zone of an edge) — and the clock + transport icon **mirror**
  that single truth; they are never set independently, guessed from the play state,
  or left to a race. *(This is why the reaper ride must not depend on an autonomous
  latch firing at the right instant: a drag-while-playing would defeat it, leaving a
  sliver and the wrong icon. Geometry is the source of truth; the latch is just one
  way to enter it.)*
- **Riding a frontier is playing; the reaper can't be paused.** Stuck on either edge
  the clock ticks and the playhead moves vs the footage, so the transport reads as
  *playing*: a **pause** icon at the now edge (pausable → freeze to a static THEN), a
  distinct **slashed-pause** at the reaper edge ("playing, can't pause" — the reaper
  eats on a timer regardless of the user; the icon is a status indicator, pressing it
  does nothing). You leave either ride only by *moving* — a drag away, a forward
  transport step, or wheeling the clock ahead — never by the play button.
- **Derive the rendered position; never snapshot it.** This is the *universal wall
  clock* rule (read, don't copy) carried from *time* to *position*. The picture's
  scroll/translate must be **computed at render time from the same clock the footage
  uses** (the UI-thread clock + the live layout), so the playhead and the footage move
  **together**. A separately-written copy of the position — a JS-thread scroll pushed
  across to the UI thread, or a value snapshotted a frame before the layout it's drawn
  against recomputed — lands out of phase with the render and shows up as **jitter**
  (a constant high-zoom shimmer, or the whole content jittering in sync). The reaper
  ride was always smooth because it derives from `reaperEdgeX`; the now-edge ride and
  1× footage **playback** must derive the same way (`anchorInstant + (clock − anchorClock)`
  on the UI thread), not render the JS scroll. *(The JS scroll is still kept current for
  gesture/centre logic; the picture just no longer depends on it while riding/playing.)*
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

### The Clips-timeline north star (the definitive target)

The five invariants the live/reaper timeline must satisfy. These are the bar — if
the build disagrees, the build is wrong. (Current status + the gaps to close are
tracked in CLAUDE.md "Clips timeline — north star vs current gaps".)

1. **Live build is immediate and smooth.** The instant you go live, opening Clips
   shows a clip **building on the now edge in real time** — growing continuously,
   frame by frame, on the device's own clock. No wait for a fetch to "discover" the
   clip; no 5-second length steps. The footage block tracks `nowUI` as it's recorded.
2. **Stop → a trailing gap forms and grows.** When you stop the stream, a gap
   appears between the clip's tail and the now edge, and it grows ("since last
   broadcast"). The now edge keeps advancing; the footage doesn't.
3. **Play · drag · resume stays smooth.** Scrubbing, playback, drag-to-save, and
   resume-after-scrub remain fluid — never regressed by the live/reaper machinery.
4. **The clock tells the truth at both edges, and ticks.** Drag to the **now edge**
   → the clock reads **NOW** and is **ticking**. Drag to the **reaper edge** → it
   reads **THEN** and is **ticking** (counting toward eviction). A parked clock at an
   edge is never frozen — both edges advance with real time.
5. **The reaper consumes smoothly, always.** Once reaping starts, the reaper edge
   (red sickle on buffer · black save on saved) consumes footage smoothly — **while
   you drag the timeline and while playback runs** — with no jumps. One monotonic
   clock drives it; nothing makes it stutter or retreat.
6. **Reaping + playing + broadcasting are locked in sync.** When all three happen at
   once, the **reaper edge, the playhead, and the now edge advance together** — same
   clock, same frame. None of them steps every ~1s while another glides; there is no
   visible 1-second cadence anywhere. The single monotonic UI clock drives every
   frontier on the UI thread; JS-side state (the playhead value, the window boundary,
   refetches) is throttled/decoupled so it never imposes its tick rate on the motion.

### ⛳ Milestone — the Clips-timeline clock is solved (2026-06-15, tag `clips-timeline-clock-v1`)

**This is the reference baseline. Future content-handling work springboards from
here and may only improve the principled code and the user experience — never
regress below this bar.** All six north-star invariants above are **confirmed
smooth on device** ("definitely smoother on all fronts" — Ben). The long
bounce/stall/jitter saga is closed.

The model that got us here — the thing to *keep*, and to apply to every new
time-bearing surface (the clip editor, multi-source lanes, the time machine):

1. **One clock, read — never accumulated.** Everything reads `serverNow()` (the
   universal wall clock, §"read it, never keep your own" below). No surface keeps
   its own stopwatch; no surface reads raw `Date.now()`. A frame-timer accumulator
   was tried and **retired** because it froze during video playback — the clock is
   a JS `requestAnimationFrame` loop (`setNowUi`) pushing `serverNow()` to the UI
   thread, robust to the playback main-thread stall.
2. **The playhead is the single source of truth *during playback*.** While playing
   it advances by *elapsed wall time* (1× footage, fixed rush across a gap) and the
   video + timeline **follow** it — position is never derived from the video's
   `currentTime` (which stalls on a VOD reload). In the other modes the *input*
   drives and the playhead follows: while **scrubbing** the finger owns the scroll
   (the playhead settles to where it lands), and while **riding an edge** the now /
   reaper frontier owns the motion. The truly universal invariant is #1 — every
   mode reads the one clock; *which thing* leads just changes with the mode.
3. **Derive the rendered position; never snapshot it.** The visual anchor
   (`effScrollSv`) is a `useDerivedValue` off the layout-atomic clock — not a JS
   `scroll` value sampled a frame ago. Snapshotting across the JS↔UI thread boundary
   was the high-zoom jitter; deriving removed it.
4. **Frontiers are magnetic and symmetric.** The now edge and reaper edge are one
   geometric ride-state, read from position (`getCenter().atNow/atReaper`), not a
   timing-dependent latch. Riding a frontier *is* playing; the reaper can't be paused
   (slashed-pause). No "bump" verbs — drag to an edge and it rides.
5. **The scrub-end is guaranteed.** A cancelled pan (a pinch takes over) fires only
   `onFinalize`, so `onFinalize` backstops `notifyScrubEnd` when `onEnd` didn't run —
   the gate that gives playback its turn back can never get stuck.

Code anchors (the spine — read these first when resuming): `src/lib/serverClock.ts`
(the clock), `src/components/screens/ClipsScreen.tsx` (the playhead transport + the
`setNowUi` RAF loop + scrub/edge state), `src/components/features/clip/ClipsTimeline.tsx`
(`effScrollSv` derivation, the magnetic frontiers, the reaper mask, the gesture
backstop). The matching git tag `clips-timeline-clock-v1` marks the exact tree.

### Clean eviction = honest representation (the principled follow-on to CU)

The clock saga solved the timeline's **live/now edge**. The **other edge — the eviction
frontier — and the ghosts/slivers are the symmetric, still-open half**: a surface is only
truthful if it represents what has *actually been evicted*. This is contingent on **eviction**,
**not** the manifest — so the **Canonical Unification (CU) does not fix it, and the residual
anomalies survive CU untouched**:

- grid **ghost blocks**, time-machine **ghost pins**, **stale head / reaper-edge labels** (the
  head label *is* the eviction frontier), and boundary **slivers** are all surfaces reading an
  eviction state that is **imprecisely culled and/or inaccurately reported**. CU (manifest/axes)
  never touches eviction, so none of these are CU bugs — they resolve only when eviction is clean.

Clean eviction has **two layers, both required**:
1. **Precise cull** — the bytes/samples are genuinely gone: a **unified straddle rewriter** —
   `ts`-precise rewrite for data tracks; whole-segment delete + (preferably) **lossless keyframe
   re-cut** for AV (no transcode). Frame-accurate boundaries straddle a chunk/segment of *any* size,
   so the rewriter is mandatory, not a chunk-size workaround.
2. **Accurate reporting** — `survivingRegions` splits at interior holes; discover ∩ surviving-regions;
   edge labels read the true frontier.

**THE FOLLOW-ON (do this after CU): a principled Eviction Engine initiative** — one evicted-range →
a per-track **cull strategy** (data rewrite · AV delete+report) + accurate surviving-regions
reporting, with the **unified straddle rewriter** at its core. Build it **after CU** (against the
collapsed CU4-d schema/feed, so CU stays clean and the engine targets the final shapes). It is the
**necessary successor to CU**, not optional polish — the timeline + time machine are only honest once
it lands. Full scope: `HANDOFF-unified-manifest-2026-06-24.md` → "Eviction Engine — its OWN initiative."

### The universal wall clock — read it, never keep your own

The most-violated principle in this codebase, stated plainly so we stop
rediscovering it: **there is exactly one clock — the server-aligned wall clock
(`serverNow()` = device time + the measured server offset) — and everything that
represents a *position in time* must be computed by READING it, never by keeping its
own running count.**

There are two ways to "track time," and only one is allowed:

- **Read the clock (allowed).** Your position is a pure function of the current
  reading: `position = f(serverNow())`. The now edge *is* `serverNow()`; the reaper
  edge is `serverNow() − window`; the playhead during 1× playback is
  `playStartInstant + (serverNow() − playStartClock)`. Ask any time and you're
  correct — a dropped frame or a hitch can't make you wrong, because the next read is
  the truth again. Nothing drifts.
- **Accumulate your own ticks (forbidden).** You hold a running total and nudge it
  each frame (`pos += elapsedSinceLastFrame`). That's a *stopwatch*, not a clock — a
  second clock. Miss a nudge and you're behind forever; cap the nudge (our
  `min(80, …)`) and you can never catch back up. Stopwatches always eventually drift,
  and *every* symptom we've chased — the fronts overtaking the playhead, the 1-second
  step, the bounce — has been a stopwatch diverging from the wall clock.

Consequences we keep getting wrong:

- **"Single source of truth" ≠ "keeps its own time."** The playhead is the source of
  truth for *position* — the one thing the video chases — but it, too, is only a
  *reader* of the wall clock. It does not get its own stopwatch.
- **The video is the only follower, and is never a clock.** The physical decoder has
  its own messy pace (it buffers, stalls on a seek, runs a hair fast/slow). That is
  fine and unavoidable — *as long as we never ask the video what time it is.* The
  abstraction (edges, playhead, timeline, the bottom clock) is one clock; the video
  pixels are a dog on a leash that may briefly trail and catch up. (This generalises
  the existing rule: *never derive the playhead from the video's position.*)
- **One clock — not merely "a clock."** Reading is necessary but not sufficient: you
  must read the *same* clock as everything else. Raw device `Date.now()` and
  server-aligned `serverNow()` are two different clocks; a readout drawn on the device
  clock skews against edges drawn on the server clock. The universal clock is the
  **server-aligned** one.

Realistic expectation: one clock for every *time position* — every edge, every
playhead, every digital readout — is achievable and is the bar. The only thing that
will never be perfectly on the clock is the *video itself*, and it doesn't have to
be, because it follows the playhead rather than telling it the time.

#### Robustness — going offline does not disturb the clock

The universal clock is **local, not a live network read**: `serverNow() = Date.now()
+ serverOffset`, where `serverOffset` is a *cached* value measured the last time a
`/buffer/me` response carried `serverNowMs` (`serverOffset = serverNowMs − Date.now()`).
This is deliberate, and it's why a connectivity blip is harmless:

- **Offline keeps ticking.** The device clock doesn't stop when the network drops, so
  `serverNow()` keeps advancing smoothly on `Date.now()` + the frozen offset. No stall,
  no jump. (Were `serverNow()` a live server call, offline *would* freeze it — the
  local-clock-plus-offset design is what makes it robust.)
- **Offline is a *data* event, not a *clock* event.** What pauses is the footage — the
  buffer stops growing, segments stop arriving — so the now edge keeps marching
  (correctly: real time is passing) while the live footage stops extending and a **gap
  forms**. That gap is the right behaviour, not a bug.
- **Reconnect eases, never snaps.** The next fetch re-measures the offset and blends
  toward it (0.25 ease, not a jump), and the now-clock is **monotonic** (forward-only),
  so any drift accrued while offline is absorbed gently and can never visibly retreat.
- **The genuine edge cases are adjacent, and minor.** (1) The *device clock itself*
  jumping — a manual time change, time-zone/DST shift, or OS NTP correction moves
  `Date.now()`, hence `serverNow()`; a backward jump is caught by the monotonic clamp,
  a forward jump is a transient until the next fetch nets it out via the offset. (2) A
  small *latency bias* — `serverNowMs` is the server's time at response build, read
  after the return trip, so the offset is biased by ~the response leg (tens of ms);
  irrelevant at second-scale footage alignment, and the easing smooths the jitter. (The
  NTP-style fix — measure round-trip, subtract half — exists if precision ever matters;
  it doesn't here.)

#### Inventory — surfaces that must follow the universal wall clock

Every time-position keeper in the app and whether it obeys. **All flagged items were
resolved 2026-06-15** — the universal clock now lives in `src/lib/serverClock.ts`
(`serverNow()` / `feedServerNow()`) and every surface reads it. (Network polls, sensor
sampling, animation timers, and pure *duration* deltas are out of scope — a delta is
offset-invariant, so device vs server doesn't matter there.)

- ✅ **`serverNow()` — `src/lib/serverClock.ts`** — the master, now a shared module:
  device time + measured, eased server offset; fed `serverNowMs` by `ClipsScreen` and
  `ClipEditScreen`. The one clock everything reads.
- ✅ **Now edge + reaper edge — `ClipsTimeline`** — driven SOLELY by `serverNow()` via
  the JS-RAF `setNowUi`. *The frame-timer accumulator (`reaperNowSv += timeSinceFirstFrame`)
  is RETIRED* — it stalled during playback and let the edges run ahead of the JS-clock
  playhead during a hitch; now edges + live build + playhead ride one clock and
  stall/resume together. (A 1s server-read floor remains only to bootstrap before the
  first `setNowUi` push.)
- ✅ **Clips playhead — `ClipsScreen` play tick** — now advances by the WALL-CLOCK delta
  (`serverNow() − lastClock`), which telescopes to `playStart + (serverNow() − startClock)`
  — i.e. it IS the read, drift-free. The lossy `min(80)` clamp is gone, replaced by a
  `max(0, min(PLAYHEAD_MAX_STEP_MS=1000, …))` backgrounding/backward-tick guard that
  never bites on routine jank. *(Was the active divergence — the fronts overtaking it.)*
- ✅ **Clips clock readout + card countdowns — `ClipsScreen`** — `offsetForClock`,
  "footage clears in", "since last broadcast", and the dial-scrub seek-back read
  `serverNow()`. (The 1-second `secondTick` is only a re-render trigger — left as is.)
- ✅ **The bottom ticking clock — `TimeScrubber`** — reads `serverNow()` throughout
  (instant = `serverNow() − offsetMs`), so the readout no longer skews against the
  edges. Covers both uses — the globe time-machine and the clip-editor buffer clock.
- ✅ **Clip editor — `ClipEditScreen`** — reads `serverNow()` for every "now"/live-edge/
  playhead position (bounds, follow, offset, cards, gap ends, transport, dial-scrub, and
  its internal playback clock), and feeds the shared clock from its own buffer query.
- ✅ **`useBroadcasterClock`** — the time-of-day readout now formats `serverNow()` rather
  than raw `new Date()`, so even it matches the universal clock.
- ✅ **`broadcastStore.setLive` → `liveSince`** *(missed surface, fixed 2026-06-16)* — the
  go-live timestamp that anchors the Clips timeline's OPTIMISTIC live clip start was stamped
  with raw `Date.now()`, so under any device↔server skew the optimistic block's start sat in
  the wrong clock domain (mispositioned against the `serverNow()`-aligned axis). Now reads
  `serverNow()`. The last straggler off the universal clock.

Legend: ✅ reads the universal clock. *Out of scope (intentionally left on `Date.now()`):*
pure duration/timestamp measures — seek-throttle stamps, thumbnail-gen timing, the
reverse-scrub frame delta — because a delta cancels the offset and is rate-identical.

### Editing the model is orthogonal to playing it

Snip, mend, and lane membership (save / un-save) are mutations of the **representation**
— the manifest of split points + which lane a clip lives in — not of the media. The model
is always yours and always live, so these edits must behave **identically whether the
playhead is parked or advancing, broadcasting or not.** Playback state is never a gate on a
model edit; the only thing playback complicates is the *grab target*, not the edit itself.

- **A snip is a pin dropped in a river.** Cutting drops a permanent mark at an instant; the
  playhead keeps flowing; the mark stays put and recedes behind it. Cutting never stops the
  flow, the flow never erases the cut. (Snip/mend are ungated — they work mid-playback as-is.)
- **A lane-drag holds the camera, not the clock.** The one obstacle to dragging a clip across
  lanes mid-playback is that the block scrolls out from under the finger. So for the duration
  of the grab the *view* holds (the auto-camera — riding / following / playback-drive — yields)
  while the clock keeps its truth; on release the follow re-latches. Nothing is lost — the
  rolling buffer keeps recording server-side regardless of the app's playhead. (`ClipsTimeline`
  `holdCamera` + `ClipBlock` `onDragActive`; decided 2026-06-16.)
- **The now-frontier segment can't be saved — but a snip frees the rest.** The one piece still
  *growing* at the now edge has no fixed end, so it isn't a saveable unit — its drag doesn't even
  initiate (rendered with no gesture). Snipping it, though, carves off a *bounded* earlier piece
  that drags to the saved lane like any other clip. So you save the ongoing broadcast by cutting a
  fixed length off its tail, never by grabbing the live edge itself. (The timeline detects the
  growing piece — the one reaching the newest end — and only that one is pinned; everything behind
  a snip is free. Same for a live broadcast as for a past clip.)

This is the same spine as the universal clock above: the representation leads and is always
editable; the media is a follower. (See also §3 — saving a still-growing live clip is a model
edit allowed now; the byte-level promotion of in-flight buffer bytes is the server seam.)

### Every source is a live surface, on every frame (camera-parity)

This is §1 principle 7 made concrete for representation. A **frame** is any place the app shows
a source's picture — the stream page (broadcaster preview *and* live), the clips-page viewer, and
someone else's stream. The rule: **every frame can show any available source, switchable
source-by-source via a rail, and each shows that source live in the moment** — the same way the
camera frame does. There is no "camera frame plus some lesser sensor widgets"; there is one frame
that renders whichever source is selected, and the camera is just the default selection.

- **The broadcaster self-previews every source, broadcasting or not.** The moment a source is
  armed (or armable) it has a live readout the broadcaster can monitor — the camera preview, the
  mic level, the compass needle, the speed dial — before Go Live and during it. A source's live
  feed never fans back from the server to its own sender, so the broadcaster's self-preview reads
  the device **locally**; the viewer reads the **fan-out**. Same frame, same component, two data
  taps chosen by role.
- **Selecting a source is a view switch, never a capture change.** Monitoring audio doesn't stop
  the camera; what airs/records is the armed set, independent of which source you're looking at
  (§2 — the composite is a *view* over the tracks).
- **Honest degradation (principle 6).** Where a source has no real-time source on a device (e.g.
  ambient temperature) or its live path isn't wired yet, the frame shows that source's **idle**
  state — never a faked reading. A source with no live preview in a given state (e.g. mic level
  before a WebRTC sender exists in preview) reads as idle, not as broken.

### The live edge's media is the live source, not the recording

A recording always trails real-time: the buffer's HLS is encoded + segmented + flushed seconds
behind "now," so asking the *recorded VOD/track* for the live instant can never look right — you get
data from a few seconds ago, or nothing. So **the media for a given instant depends on which
instant it is**: the *past* is served by the recording (the VOD/track, seeked); the *live edge* is
served by the **live source itself** — the low-latency feed already in hand (the camera stream, the
live audio level, the live telemetry / location / chat sample). On the Clips page, when the playhead
rides the now edge while you're broadcasting, the viewer shows the **actual live source — the same
view as the stream page** — and the instant you scrub back into the past it swaps to the
recording. One playhead, two media sources per source-kind, chosen by where you are. (Camera shipped:
`broadcastStore.liveStreamUrl` published by `StreamScreen`; shown by `ClipsScreen` when `followLive`;
decided 2026-06-16. Generalising the now-edge swap to the non-camera sources is the open work.)

### The recording lag & the dead zone (OPEN — the live-replay quandary, needs Aaron)

> **Status: understood, not yet handled. Captured 2026-06-16 to address with Aaron (it's cross-repo —
> the real cure is recorder/backend-side).** This is the heart of why "scrub the recent past while
> broadcasting" doesn't show what you expect.

**The core fact.** While you broadcast, your video exists as two completely different things with two
completely different latencies:

1. **The live feed** (WebRTC) — real-time, sub-second. "Now."
2. **The recording** (HLS on disk) — every segment must be **encoded → uploaded → written →
   finalized → added to the playlist**, and players deliberately **hold back** the newest segment or
   two so they don't run off the end. Net: the **freshest *recorded* frame is routinely 20–40s behind
   the live moment.**

So at any instant while live, footage lives in **three zones**:

```
[ ——— recorded & available ——— ][ ——— DEAD ZONE ——— ][ now ]
  older footage, seeks & plays    already happened, but        live feed
  fine (this is the VOD)           NOT written/served yet        only (WebRTC)
```

- **Now** is covered by the live feed (the `followLive` swap above).
- The **recorded VOD** covers footage old enough to have finished writing.
- The **dead zone** (~the recording lag, tens of seconds) is time that *has already happened* but
  whose recording **isn't ready yet**. There is **no frame to show there** — the VOD doesn't have it,
  and the live feed is "now," not the trailing instant.

**Why this is THE quandary (the honest constraint).** The representation (the playhead/clock) can sit
anywhere — but the *media* simply does not exist for the dead-zone instants yet. This is the sharpest
case of "the representation leads, the media follows": here the media can't follow at all, for a
bounded recent window, by physics of the pipeline. We cannot make it show "2 seconds ago" because
2-seconds-ago footage hasn't been recorded/served yet.

**How it manifests** (both are the same root cause):
- *Playhead a couple seconds behind now → shows footage from ~30s ago.* The playhead is in the dead
  zone; the player shows the newest frame it actually has, which is the far (old) edge of the
  available zone.
- *No preview of the building clip until you snip it.* Scrubbing near the live edge sits in the dead
  zone (nothing recorded). Snipping and looking at the **earlier** piece shows footage old enough to
  have finished recording. The snip unlocks nothing — you just moved to footage that exists.

**A second, compounding contributor (app-side, partly fixable):** the player loads the recording's
playlist **once** and can hold a **stale snapshot** of "what's been written." So even footage that
*did* finish recording after the load stays invisible until the playlist is re-read. This **widens**
the dead zone beyond the true recorder lag. (A live/EVENT-type playlist that the player refreshes —
or a periodic app-side reload — shrinks this half; see options below.)

**The handling options (decide with Aaron):**
- **(A) Extend the live feed** to cover the last few seconds before now (not just the exact edge).
  Accurate-ish for a *small* window; misleading if the dead zone is large (the live feed is "now," not
  the trailing instant).
- **(B) Treat the dead zone as a gap** — a "recording catching up…" state instead of a stale,
  lying frame. Honest (CONTENT.md's whole spine), and it degrades the dead zone the way real gaps
  already degrade. *Leading candidate.*
- **(C) Shrink the dead zone** — refresh the playlist app-side (kills the stale-snapshot half) and,
  recorder-side, shorter segments + less hold-back + faster finalize (kills the real-lag half). Costs
  a reload hitch app-side; the recorder change is the durable cure.
- **The real cure is server-side** (`wrld-mediasoup` + `wrld-backend`): the dead zone is *manufactured*
  by the recording pipeline's latency. App-side handling can only mask it; the substrate decides how
  wide it is. See §9.

**Next step when Aaron is online:** measure the actual dead-zone width on our setup, and split it into
(i) true recorder flush/hold-back lag vs (ii) the app's stale-playlist snapshot — the fixes differ.
Then pick **B** (honest placeholder) for whatever lag remains + **C** (shrink it at both ends).

---

## 7. Privacy & consent

- **The indicator is non-negotiable.** While broadcasting, the on-air-vs-
  recording state is always visible.
- **The consent step is the relaxable half.** Currently parked for friends-and-
  family; the `RecordConsentSheet` and sensitive/benign badges are shipped and
  re-enabled before any wider exposure.
- **Precision is per-range and reversible** (exact / city / country / off): set at
  go-live but **editable in either direction afterward** per range; the globe and
  replay render the range's **current** choice. Capture keeps the exact coordinate so
  it can be sharpened later. `off` never reaches a client while it is set to `off`.
  *(Reversibility decided 2026-06-13 — see §1.4; per-range decided 2026-06-18 — §3/§5.)*
- **Visibility is per-range, public by default** (decided 2026-06-18, §3). The buffer
  is **public in the time machine by default** — what you aired is replayable in the
  past. **Private** is the per-range opt-out: still watchable live in the now, kept if
  retained, but **never in the time machine**. Visibility is **orthogonal to
  retention** (a range can be public-or-private in either lane). A **per-user default**
  sets the starting value.
- **Live is public by policy, not structure.** A private *live* broadcast is
  structurally valid (visibility is just a directive) but the product does **not**
  offer it — live is always public. This is a one-line product rule, deliberately not
  baked into the data model, so it can be revisited.
- **Anonymous is truly anonymous.** No device IDs, no local UUIDs, no backend
  row for a viewer. Identity actions (go live, chat, react, follow, save) are
  what require an account.

---

## 8. Time, discovery & the globe

- **The past is the surviving public footage.** The time machine replays the globe
  at a past instant from **everything still on disk that is public** — the **public
  rolling buffer** (default) *plus* retained (saved) public clips — not just
  deliberately-saved clips *(broadened 2026-06-18, §3)*. It's still thinner than live
  (private ranges excluded; reapable footage only reaches back the tier window and
  shrinks as it's reaped; retained clips persist). A single `offsetMs` behind now
  drives a real-time playhead (NOW / THEN).
- **Forward-only data.** Audience geo, activity heatmaps, analytics — all accrue
  from new activity; nothing is backfilled. The honest story beats a fabricated
  history.
- **The globe encodes the privacy choice visually.** Location precision renders
  as a sharp pin (exact), a soft halo (city), or a diffuse haze (country),
  centred on the *obfuscated* coordinate — the representation respects the clip's
  **current** precision (reversible, §7). Subscription status reads by colour; the broadcaster's own
  live stream is a black self-pin (excluded from the join drawer; tapping returns
  to the broadcast); pin counts are clusters-only and exclude your own stream.
- **One pin type for live + past.** A unified `DiscoveryPin` (`stream | clip`) so
  live and historical items share one renderer — the only difference is the CTA
  (Join vs Watch).

---

## 9. What the substrate must guarantee (cross-repo)

The directive (§2), the model (§3–5), and the representation (§6, §8) only hold if the lower repos
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
  contract (the buffer's self-overwriting promise) **while honouring per-range
  `retain` directives** — a retained range is exempt from eviction in place, never
  copied out (§3). The eviction unit stays the media segment; a segment survives
  iff a retain range overlaps it or it's in the live window.
- **Minimise the recording lag / dead zone** (§6 "The recording lag & the dead
  zone" — OPEN). The gap between the live moment and the freshest *recorded*
  frame is manufactured here: segment duration + finalize/flush latency + the
  player hold-back set how wide the dead zone is (the recent-past window the app
  *cannot* replay while live). **Shorter segments + faster finalize + less
  hold-back shrink it at the source** — the only durable cure; app-side handling
  can only mask what's left. Pairs with a **live/EVENT-type playlist the player
  can refresh** (so newly-written segments become visible without a full reload),
  which kills the app's stale-snapshot half of the gap.
- **Server-generated buffer thumbnails** (interval JPEGs / sprite / WebVTT) —
  client-side frame extraction *hangs* on a `-c:v copy` HLS VOD, so posters and
  timeline frames must come from the server (the §6 "honest thumbnails" rule
  depends on this).
- **Telemetry relay** for aired sensor sources (so a viewer's visualizer has
  data, not just a label).
- **A live tap for every armed source (§1 principle 7).** Each armed source must
  be **consumable live by viewers** and at the **now edge** of the clips frame —
  camera/screen as WebRTC media, audio as a level, and sensor / **location** / chat
  over the relay — *and* written to the buffer *and* promotable into a saved clip.
  Same obligation for every source; the camera's path is not a special case.
  (Sensor + chat relays shipped; the **live location** relay and the non-camera
  now-edge swap are the open pieces.)

### Backend — `wrld-backend`

- **One store, retain-in-place** (2026-06-18, §3): the non-destructive clip
  **manifest** (ranges + per-range enabled / identity / precision / **visibility** /
  **retention** / tags) over a single footage store. Saving sets a **`retain`
  directive** the reaper honours **in place** — no `promote`-copy, no second pool.
  Retained bytes shift to the saved-storage quota (still decrements available
  storage); un-save releases them to the reaper.
- **Public buffer serving (Path A).** A regular user's buffer is **public by
  default** and fetchable by any viewer for **public** ranges — a public serve path
  + token-mint policy beyond today's owner-gated / ext-cam-only routes. Private
  ranges + the owner's editing views stay owner-gated. (Self-authorizing tokenized
  HLS — segment URLs carry their own token, refreshable — remains the mechanism;
  what changes is *who* may mint for a session.)
- `GET /buffer/me`: the owner's buffer descriptor (sessions, playable kinds,
  manifest/poster URLs, **codec-uniform groups**) + storage accounting
  (`usedStorageBytes` retained · `bufferSizeBytes` reapable · `bufferEarliestAt`)
  so the reach hint + storage meters are real.
- **Clip CRUD:** create draft · patch manifest (incl. `retain` + `visibility` per
  range) · list · delete. (No separate "promote/materialise" step — save is a patch.)
- `clips/discover?at=<ISO>` returns the surviving **public** footage at the instant —
  the **public rolling buffer** *and* retained public clips (2026-06-18, §8) —
  honouring each range's **current** visibility + location precision; excludes
  `private` and `off`. Returns the unified `DiscoveryPin` union; computes the
  **seek offset** server-side.

### Shared contracts

- `SourceType` / `FeedKind` is the seven-source (+ chat) union.
- Location precision (and identity) **travel with the clip and are reversible** —
  the clip's *current* value, not the user's account setting, editable in either
  direction. Backend stores full fidelity (exact coords + real identity) so a clip
  can be sharpened; the manifest carries the display choice.
- The `DiscoveryPin` discriminated union + the seek-offset math are the live↔past
  contract.

---

## 10. The seam

Ben owns the component library (`primitives/`, `features/`, `sections/`) +
DESIGN.md + CONTENT.md §6 (representation). Aaron owns `screens/`, `hooks/`,
`api/` + the backend / recorder (§9). Content **presentation** is Ben's; content
**data wiring** is Aaron's. They meet at typed props and the manifest contract.

---

## 11. Pointers (the weeds live here)

- App detail + decisions: `wrld-app/CLAUDE.md` (Rolling Buffer, Clips, Time
  Machine, and the dated Update sections) and `wrld-app/DESIGN.md` (Section 3 +
  decision log).
- **Camera-parity for every source** (§1 principle 7 / §6 / §9) — the staged
  build-out is the **"Source-parity rollout (SP0–SP6)"** section in
  `wrld-app/CLAUDE.md`.
- Backend detail: `wrld-backend/CLAUDE.md` (C-series + R-series) and
  `wrld-backend/docs/`.
- Recorder detail: `wrld-mediasoup/CLAUDE.md`.
- **Public buffer + one-store / retain-in-place** (§3, decided 2026-06-18) — the
  staged build-out (PB0–PB4) + Ben/Aaron split is
  `HANDOFF-public-buffer-onestore-2026-06-18.md`.
- Live handoffs: `HANDOFF-aaron-2026-06-13.md` (cross-initiative todo, status-tracked),
  `HANDOFF-ben-frontend-2026-06-13.md` (front-end components still needed),
  `HANDOFF-c4-clip-editor-*.md`, `HANDOFF-clips-saved-persistence-*.md`,
  `HANDOFF-source-visualizers-*.md`, `HANDOFF-time-machine-aaron-2026-06-18.md`.
