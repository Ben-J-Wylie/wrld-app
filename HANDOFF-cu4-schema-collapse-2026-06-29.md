# HANDOFF — CU4: the structural collapse (clip ≡ range + axes) → schema + app-types

> **Aaron → Ben, 2026-06-29.** CU1–CU3 (behavioural unification) + the CU4 *discover*
> read path are **delivered and verified** in prod. This handoff opens **CU4-structural**
> (the schema collapse) and **CU5** (delete the old). It is the one explicitly-coordinated,
> hard-to-reverse phase: **Aaron = schema/backend, Ben = app types**, landed in lockstep.
> Canonical WHAT: `CONTENT.md` §5 "Target architecture (north star)". The HOW is below +
> the CU1 detail in `HANDOFF-unified-manifest-2026-06-24.md`.

---

## Where we are (verified, not asserted)

| Phase | State | Signal |
|---|---|---|
| **CU1** one authority + one resolver + reaper guarantee | ✅ deployed | drift soak **0** (41 authority eras checked) |
| **CU2** app: one resolver / render / drawer | ✅ (Ben) | — |
| **CU3** lane-as-axis + live edges (D1–D4) | ✅ built + `CU3_RETAIN_ONLY` **on** | retain parity **17/17 covered, 0 under-retention gaps** |
| **CU4 read** unified discover from the materialized column | ✅ `CU4_UNIFIED_DISCOVER` **on** | drift soak **0** |

So the **behaviour** is unified and proven: one authority (`clipId=null` `DirectiveRange`),
one resolver (`resolveClipAxes` → `ResolvedAxes`), one retain signal, no feed can diverge.
What remains is the **structural** collapse + cleanup.

---

## CU4 target (CONTENT.md §5)

Collapse the **four** models that today spread one manifest across the DB:

- `Clip` — the named saved entity (provenance, window, storage, status)
- `ClipRange` — the range body (which buffer-session windows + ordinal)
- `DirectiveRange` — **range + the 7 axes** (already ~80 % canonical) — both `clipId=null`
  (authority over the buffer) and `clipId`-set (a saved clip's frozen carry)
- `ClipTrack` — per-source (`kind`, `enabled`, `removedRanges`, urls, bytes)

…into **one `Clip = range + 7 axes` over `Track` footage**, with the clean **rename**:

| Canonical (§5) | Replaces | Shape |
|---|---|---|
| `precision` | `Clip.locDisplayPrecision`, `Stream.locationPrecision` (read-fallback) | `exact｜city｜country｜private` |
| `identity` | bool `attributed` | `shown｜anon` |
| `keep` | bool `retain` / `BufferSession.lane` / `ClipRange`-as-retain | `kept｜reapable` |
| `sources` | `ClipTrack.enabled` (+ `removedRanges`) | `{ [kind]: boolean }` |
| `title` · `tags` · `visibility` | already named | — |

Drop: `splitPoints`, `lane`, `motion`/`temp` (stale kinds), the `ClipRange`/`ClipTrack`
tables, the `clipId`-set carry directives, the per-feed coalesce scaffolding.

The locked output shape is **`ResolvedAxes`** (`src/lib/resolveClipAxes.ts`) — this is the
type contract you code against:

```ts
type ResolvedAxes = {
  title: string | null
  tags: string[]
  visibility: 'public' | 'private'
  identity: 'shown' | 'anon'
  precision: 'exact' | 'city' | 'country' | 'private'
  sources: Record<string, boolean>
  keep: 'kept' | 'reapable'
}
```

---

## Strategy: additive-first, prove, then destructive

The §5 collapse is destructive (drops tables/columns) and breaks the app if the schema
moves without your types. So we do it the way every prior cutover went (PB2, CU3, CU4-read):
**add the canonical surface additively → backfill → verify with a soak → flip reads → only
then drop the old (CU5).** Reversible at every step until CU5.

### ✅ Started this session (additive, deployed) — the shadow-axes foundation

Both `DirectiveRange` **and** `Clip` now carry the canonical resolved 7-axis object as a
derived shadow column — the thing Phase C explodes into the named columns:

- `DirectiveRange.materializedAxes` (CU4 phase A, already live + drift-0).
- **`Clip.materializedAxes`** (NEW, `20260629000000_cu4_clip_materialized_axes`) — the
  clip's **headline** axes, *projected from the authority directive era covering the clip's
  start* (no new resolver logic → cannot diverge from the per-range authority). A clip with
  no covering authority era stays `NULL` (honest, not guessed).
- Backfilled + drift-verified on startup **and** hourly, alongside the directive twin
  (`materializeClipAxes` / `verifyClipAxes`, `src/services/cu4ClipAxesService.ts`). Same
  soak you've seen: `checked / unmaterialized / drift`.
- Additive + nullable + derived (no writer changes) → **reversible** (drop the column).

Net: the canonical `ResolvedAxes` is now available *on the Clip itself*, not only via a
DirectiveRange join — the first concrete step of "Clip carries its axes."

---

## The phases from here (owner · depends · done-bar)

1. **CU4-a (DONE) — shadow axes on Clip.** Aaron. ✅ deployed; soak running.
2. **CU4-b — explode the shadow into named columns (additive).** Aaron. Add
   `precision｜identity｜keep｜tags｜sources` to `Clip` (and the same rename on the canonical
   range row), backfilled from the shadow `materializedAxes`. Still additive — old columns
   stay. **Done-bar:** every saved clip has the named canonical columns populated; a soak
   proves column == resolver.
3. **CU4-c — app reads the canonical columns (Ben).** `resolveClipSettings` returns the
   `ResolvedAxes` from the canonical columns; drop the `Stream.title`/`Clip.name`/
   `locDisplayPrecision`/`attributed` field reads. **Done-bar:** every app surface reads the
   one shape; no surface-specific field reads. *(Pairs with — and finishes — CU2.)*
4. **CU4-d — collapse the range/track tables (Aaron schema + Ben types, LOCKSTEP).** Fold
   `ClipRange` + `ClipTrack` into the canonical range-with-axes row (`DirectiveRange` is the
   spine). One discover feed (retire the legacy/windowed/tiled split). Backfill historical
   (small: 17 clips, 44 directives). **Done-bar:** the schema *is* §5; `resolveClipAxes`
   collapses to a column read (no fallback).
5. **CU5 — delete the old.** Both. Drop the legacy tables/columns/feeds/dual-writes + the
   now-redundant flags (`CU3_RETAIN_ONLY`, `CU4_UNIFIED_DISCOVER`, `PB*`). **Done-bar:** one
   home per fact, one read, one write, one render.

---

## Decisions (pinned — don't re-litigate)

- **Authority = `clipId=null` `DirectiveRange`** (CU1↔CU2 contract). Clip-level + stream-level
  fields are read-fallbacks, deleted in CU4-d/CU5.
- **Headline rule:** a clip's clip-level axes = the authority era covering its **start**
  (half-open `[start, end)`), exactly what the reads already coalesce — so `Clip.materializedAxes`
  is a faithful projection, not a new policy.
- **Live edges** stay as shipped (snip-at-now HTTP, `fromReaperEdge`/`toNow` edge-relative,
  AV pause/resume, app-side debounce). CU4 is structure, not behaviour.
- **Reversible until CU5.** Every CU4 step is additive; CU5 is the only destructive one.

## Open for the joint kickoff (CU4-d)

- The final **range-with-axes** table name + whether `Clip` survives as a thin grouping
  (id + name + provenance) over range rows, or folds entirely.
- The **one discover feed** shape that retires `?at=` / windowed / tiled.
- Historical **backfill** ordering for the destructive step (snapshot first).

---

## Your move (Ben)

Nothing is blocked on a destructive change yet — CU4-a/b are additive and Aaron-owned. The
first **app** step is **CU4-c**: point `resolveClipSettings` at the canonical columns once
CU4-b lands them (Aaron will ping with the column set + a soak-clean signal). Until then the
resolver result is unchanged, so CU2's pass-through keeps working.

Verification convention continues: each phase ships behind its additive surface with a
`checked / unmaterialized / drift` soak before any read flips — same gate that cleared CU3
and CU4-read.

---

## ⮕ Ben → Aaron, 2026-06-29 — GREEN LIGHT for CU4-b

Plan approved — the additive-first / soak-gated / reversible-until-CU5 sequence is exactly right, same
gate that cleared CU3 + CU4-read. **Proceed with CU4-b: explode `materializedAxes` into the named
`precision｜identity｜keep｜tags｜sources` columns (additive; old columns stay).** No app dependency — go.

- **CU4-c is mine, on your ping.** When CU4-b lands the named columns + the `checked/unmaterialized/drift`
  soak is clean, ping with the **exact column set** and I'll point `resolveClipSettings` at them + drop the
  `Stream.title`/`Clip.name`/`locDisplayPrecision`/`attributed` field reads (finishes CU2). Until then
  CU2's pass-through holds — nothing flips early.
- **CU4-d open questions** (final range-with-axes table name + whether `Clip` survives as a thin grouping ·
  the one-discover-feed shape · destructive backfill ordering) → the **joint kickoff after b+c soak clean**.
  Nothing to decide now; don't block b on them.
- **Reminder (separate lane):** the Gap-4 recorder fixes (`04b6f60` baseline-flush + `7f658a0`
  chain-isolation) are **built, not deployed** (manual restart). Deploy when a live broadcast won't be
  interrupted → I'll re-test (arm torch/location/chat → folders fill). Not a CU4-b blocker.

Verification convention continues: additive surface + soak before any read flips. Go.

---

## ⮕ Aaron → Ben, 2026-06-29 — CU4-b LANDED → CU4-c is GO

CU4-b shipped + deployed (`wrld-backend 3a4dbc0`). The named §5 columns are live on `Clip`,
backfilled + drift-clean. **Point `resolveClipSettings` at them and drop the legacy reads.**

**The exact column set (the `ResolvedAxes` you read off `Clip`):**

| Axis | Column | Values | Replaces (drop) |
|---|---|---|---|
| precision | `clip.precision` | `exact｜city｜country｜private` | `locDisplayPrecision`, `Stream.locationPrecision` |
| identity | `clip.identity` | `shown｜anon` | bool `attributed` |
| keep | `clip.keep` | `kept｜reapable` | — |
| sources | `clip.sources` | `{ [kind]: boolean }` | `ClipTrack.enabled` |
| tags | `clip.tags` | `string[]` | (per-range directive tags) |
| title | `clip.title` | `string｜null` | `Stream.title`, `Clip.name` |
| visibility | `clip.visibility` | `public｜anon｜draft` | — |

- **title + visibility are the existing canonical columns** (not new) — read them directly.
  Note `clip.visibility` is the richer `public｜anon｜draft`; the resolver's 2-state
  `public｜private` is `visibility === 'private' ? 'private' : 'public'` (anon/draft → public on
  the visibility axis; anon lives on the `identity` axis). So your read: `identity` for anon,
  `visibility` only for explicit private.
- **The five new columns are derived shadow** (no writer sets them directly) — projected from the
  authority directive era covering the clip's start, refreshed on startup + hourly, **self-healing**
  (a directive edit re-projects next pass). So a per-segment precision/identity/title edit already
  shows in these columns — verified live (2 clips `city/anon`, 2 `exact/anon`, the rest
  `exact/shown`; all `keep: kept`).

**Soak (the gate you asked for):** `checked 17 · unmaterialized 0 · drift 0` — every saved clip's
named columns equal the resolver. Clean across the flag-on state.

**Caveat to honor in CU4-c:** `clip.title` is the clip's own title; a *per-segment* directive title
that differs from it is the directive-title case (CU5 fully resolves it). For CU4-c the column read is
correct for the common case — don't special-case it, it collapses in CU4-d.

**Reminder back at you:** the recorder fixes ARE deployed — I restarted mediasoup this session, PID
14497 runs `7f658a0` (chain-isolation) + the baseline-flush. Re-test torch/location/chat whenever; no
deploy owed.

CU4-d open questions still wait for the joint kickoff (after your CU4-c soak clean). Go.

---

## ⮕ Ben → Aaron, 2026-06-29 — CU4-c seam check (one decision, then I execute)

Got the column set — but CU4-c is blocked on a seam: **the app reads API RESPONSES, not DB columns.**
CU4-b added `clip.precision｜identity｜keep｜sources` to the DB + shadow-verified them, but the clip-bearing
responses still surface **legacy** (`SavedClip` → `name`/`attributed`/`locDisplayPrecision`; pins/detail →
**directive-level** `precision`/`attributed`/`title`, which the app resolves at the playhead via
`resolvePinAxes`). Per your own CU4-b note, *"reads still go through the resolver."* So `clip.precision/
identity/keep` aren't in any payload for the app to read. Two ways to land CU4-c — **which do you intend?**

- **(a) RECOMMENDED — surface the named canonical axes on the clip responses** (additive: add
  `precision｜identity｜keep｜tags` + canonical `title`/`visibility` to **`GET /buffer/me/clips`** (`SavedClip`)
  and **`GET /clips/:id`** (`ClipDetail`), keep legacy alongside). Then I switch the `src/types/clip.ts`
  adapters (`fromSavedClip`/`fromClipDetail`) to read the canonical fields + **drop** the legacy reads
  (`c.name`/`c.attributed`/`c.locDisplayPrecision`). This matches "read off Clip," truly drops client-side
  resolution, and is a clean app diff. **I execute the moment the responses carry the columns.**
- **(b) the app resolves the headline from the already-surfaced `directives[]`** (covering era at clip
  start). Possible today with no backend change, BUT it keeps resolution **client-side** — the opposite of
  CU4-c's "drop the resolver" goal. Not recommended (it's a detour CU4-d would undo).

I'm ready to do (a) — just need the two responses to carry the columns (additive, behind nothing — they're
shadow-clean). Ping when surfaced + I'll switch the adapters same session. (Time-machine PINS stay on
`resolvePinAxes` — they're per-range/playhead, a different axis from the clip-level headline; their
collapse is CU4-d's one-feed work, not CU4-c.)

---

## ⮕ Aaron → Ben, 2026-06-29 — CU4-c option (a) DONE: the responses carry the columns → flip the adapters

Did option (a). Both clip-bearing responses now surface the named canonical §5 axes (additive;
legacy fields kept alongside). Deployed `wrld-backend cd77ea9`. **Switch `src/types/clip.ts`
`fromSavedClip`/`fromClipDetail` to read these + drop the legacy reads.**

**`GET /buffer/me/clips` (`SavedClip`) + `GET /clips/:id` (`ClipDetail`) — new fields:**

| Field | Value | Drop (legacy, still present) |
|---|---|---|
| `title` | `string｜null` — CU1-resolved headline (honours per-segment title edits) | `name` (resolved + 'Untitled' fallback) |
| `precision` | `exact｜city｜country｜private` | `locDisplayPrecision` |
| `identity` | `shown｜anon` | `attributed` (bool) |
| `keep` | `kept｜reapable` | — |
| `tags` | `string[]` | — |
| `visibility` | `public｜anon｜draft` (map to your private/public axis on `identity` + explicit-private) | — |

Verified live on the open `GET /clips/:id` — e.g. `{ title:"45", precision:"exact", identity:"shown",
keep:"kept", tags:[], visibility:"public" }` with `locDisplayPrecision:"exact"`/`attributed:true`
agreeing alongside.

**Notes for the adapter flip:**
- `title` is the **resolved** headline (same source as `name`, sans 'Untitled'); use `clip.title ??
  'Untitled clip'` if you want the old display fallback. It's consistent across both surfaces.
- `precision｜identity｜keep｜tags` come straight off the CU4-b columns (drift soak `0` — they equal the
  resolver). `visibility` is the clip enum (`public｜anon｜draft`); `identity` carries anon.
- **Time-machine PINS are unchanged** — still `resolvePinAxes` over `directives[]` at the playhead
  (per-range, a different axis from the clip-level headline). Their one-feed collapse is CU4-d, not now.
- Per-segment-title edge holds as noted: `title` resolves the directive covering the clip START
  (CU5 fully unifies). Fine for CU4-c.

Ping me when the adapters are flipped + you've soaked — then we line up the joint **CU4-d** kickoff
(collapse `ClipRange`/`ClipTrack`, the one discover feed, the rename + historical backfill). Go.

---

## ⮕ Ben → Aaron, 2026-06-29 — CU4-c APP HALF DONE

Adapter flip shipped (`design`→`main`). `fromSavedClip` + `fromClipDetail` (`src/types/clip.ts`) now read
the canonical §5 axes off the responses — `precision｜identity｜keep｜tags｜title｜visibility` — in preference
to the legacy fields. App types `SavedClip` (`api/buffer.ts`) + `ClipDetail` (`api/clips.ts`) gained the
canonical optional fields. `visibility` axis = `=== 'private' ? private : public` (per your note).
- **Legacy kept as a fallback** (`c.precision ?? <legacy>`, etc.) — safe pre-deploy / older backend, and
  it's the **only remaining legacy read** → dropped at **CU5** when you remove the legacy fields from the
  responses. (Aligned with your "legacy stays until CU5.")
- **`sources` stays on the legacy per-kind map** — you didn't surface it as a canonical column; collapses
  in **CU4-d**.
- tsc clean (0 errors) · 69 tests green.
- **Done-bar pending two confirms:** (1) `cd77ea9` **deployed** on the box (so the canonical fields
  actually flow — until then the app safely falls back to legacy); (2) **Ben device check** — saved-clip
  drawer + clip viewer read correct precision/identity/keep/title (should be identical to today, since
  column == resolver). Then CU4-c is closed → CU4-d joint kickoff.

---

## ⮕ Aaron → Ben, 2026-06-29 — NOTE (separate lane): telemetry `.jsonl` reaping granularity

On-device finding (Ben's live test) — **not CU4**, parking it here so it's tracked. An **interior
reap** (head + tail retained, ~26s middle dropped) removed the camera/audio/screen **media** for that
window but left the **telemetry `.jsonl`** for the same window fully intact.

**Evidence** (reaped media window `[1782700819000, 1782700845000]`, session `cmqym0rnr…`):
- gyro **261**, accel **261**, audiolevel **208** samples sitting *inside* the reaped window, largest
  inter-sample gap ~164–237 ms → continuous, no hole. (speed/compass/location/chat are just naturally
  sparse, not reaped.)

**Root cause — granularity mismatch (by design, but worth knowing):**
- **Media** reaps per **~2 s segment** → interior eviction is fine-grained (segs 13–24 gone).
- **Telemetry** chunks at **5 min** (`DATA_CHUNK_MS`) and the reaper evicts each chunk **whole, by
  mtime**. A short (<5 min) session is **one chunk**; its mtime sits at the **retained tail**, so
  `coveredByRetain(mtime)` protects the whole chunk → the middle-era samples inside it survive.
- A reaped middle large enough to span a **whole unretained 5-min chunk** *would* drop it (interior
  eviction does apply to `.jsonl` — `isTrimmable` covers both). So it's **coarser**, not broken.

**Impact:** not a privacy/serving issue — the unretained middle isn't referenced by any clip, so the
surviving telemetry is never served; it's **storage coarseness**, eventually consistent (the chunk
reaps once it ages out of the window or the tail's retain lifts). At 5-min resolution.

**If we want telemetry interior-eviction to match the media** (line-filter a *sealed* chunk to its
retained sub-ranges): a deliberate reaper enhancement — the design avoided trimming an **open** `.jsonl`
mid-file (unsafe under append), but a sealed chunk could be filtered. Scoped, not started — Aaron's lane
(`wrld-backend bufferService.reapBuffers`), no app/CU4 dependency. Flagging for the backlog; flag if you
want it prioritized.

---

## ⮕ Ben → Aaron, 2026-06-29 — VERIFIED this session + YOUR PENDING QUEUE

**Verified on device (closed):**
- **Gap 4 — recorder data-track persistence ✅ CLOSED.** Torch/location/chat/sensors now print to the
  server (your race-flush `04b6f60` + chain-isolation `7f658a0` work).
- **CU4-c ✅ working** — era-preference edits proliferate to every surface (canonical read path live;
  the app adapter flip `57fd72f` + your `cd77ea9` surface). *(Assumes `cd77ea9` deployed — the app falls
  back to legacy safely if not; confirm it's on the box.)*

**Your pending queue (priority):**

1. **🔴 Eviction representation (ghosts) — TOP, device-confirmed.** Evicted eras still render in the
   **timeline + time machine**. Two backend surfaces (app render is verified-ready, no app change owed):
   - **(a) grid:** `GET /buffer/me` `survivingRegions` must **split at interior holes** (Ben's
     `reapedClaims`→`carveBuffer` auto-removes the block once it returns ≥2 regions). **Diagnostic:** read
     `survivingRegions` for a ghosted session — **1 region = the walk isn't splitting** (strong expectation).
   - **(b) time machine:** the discover feeds (`?at=`/windowed/tiled/cell) must **intersect each pin's
     interval with the session's surviving regions** (drop/clip evicted spans).
   - Detail: `HANDOFF-unified-manifest-2026-06-24.md` → "Eviction representation gap" + backlog #3. (Also
     subsumes the re-gate-#3 ~2s boundary slivers — same surviving-regions accuracy.)
2. **🔴 Telemetry cull on eviction — PRIVACY.** Reaper evicts media but leaves the telemetry `.jsonl`, so
   a reaped unkept era's location/chat/sensors persist on disk. Cull the shared chunked store. → backlog #2.
3. **🟡 Directive GC/trim on eviction — cruft.** Reaper leaves `DirectiveRange` rows for fully-evicted
   reapable eras. → backlog #4.
4. **🟡 Per-era thumbnails — enhancement.** Needs the server frame pipeline (client gen hangs on
   `-c:v copy`). App consumer trivial once URLs exist. → backlog #5.
5. **CU4-d — the structural collapse (joint, when you're ready).** Fold `ClipRange`+`ClipTrack` into the
   canonical range-with-axes row + one discover feed; `resolveClipAxes` collapses to a column read. Open
   questions (table name · one-feed shape · destructive backfill order) at the top of this doc — needs a
   joint kickoff (Ben in lockstep for the app types). Then CU5 deletes the old + the flags.

App lane is clean — nothing owed from Ben until the grid `survivingRegions` returns ≥2 (auto-draws) or
the CU4-d kickoff. Ben can device-spot-check C6 (scrub a saved clip → data source replays) anytime.

---

## ⮕ Ben → Aaron, 2026-06-29 — COMPLETE THE REMAINING CU (CU4-d + CU5)

Everything through **CU4-c is done + verified on device** (Gap 4 data persists; era-preference edits
proliferate to every surface). The remaining CU deliverables are **CU4-d** (structural collapse) + **CU5**
(delete the old). Close-out plan below. Keep CU **pure manifest work** — the eviction engine is a separate
initiative (scope guard at the bottom).

### Status
| Phase | State |
|---|---|
| CU1 — one authority + resolver + reaper-retain | ✅ deployed (drift soak 0) |
| CU2 — app: one resolver / render / drawer | ✅ |
| CU3 — lane-as-axis + live edges (D1–D4), `CU3_RETAIN_ONLY` on | ✅ |
| CU4-a — `Clip` shadow axes | ✅ |
| CU4-b — named §5 columns (additive) | ✅ |
| CU4-c — responses surface canonical + app reads them | ✅ verified on device |
| **CU4-d — collapse tables + one discover feed** | ⬜ remaining |
| **CU5 — delete the old + the flags** | ⬜ remaining |

### CU4-d — structural collapse (Aaron schema + Ben types, LOCKSTEP)
Target (CONTENT.md §5): fold `ClipRange` + `ClipTrack` into the canonical **range-with-axes** row
(`DirectiveRange` is the spine) → one **`Clip = range + 7 axes over Track`**; `resolveClipAxes` collapses
to a **column read** (no fallback chain); **ONE discover feed** (retire legacy `?at=`/windowed/tiled).
Backfill historical (small — ~17 clips / ~44 directives), **snapshot first**.
- **The ONE eviction piece that rides IN:** **discover ∩ surviving-regions** (the time-machine ghost) —
  CU4-d builds the one feed, so do the intersection there, once (don't patch the feeds you're retiring).
- **Settle at the joint kickoff before the destructive migration:** (1) final range-with-axes **table
  name** + whether `Clip` survives as a thin grouping (id/name/provenance) over range rows or folds
  entirely; (2) the **one-feed shape** that retires `?at=`/windowed/tiled; (3) **backfill ordering**
  (snapshot first).
- **Ben (app, lockstep):** consolidate the surface types toward the **one canonical clip type**
  (`src/types/clip.ts` is the start); switch the historical consumers (`useHistoricalClips` / cells /
  `?at=`) to the one feed; the adapters already read canonical (CU4-c) — they just shed the legacy
  fallback at CU5.

### CU5 — delete the old (both)
Drop the legacy tables/columns/feeds/dual-writes + the now-redundant flags (`CU3_RETAIN_ONLY`,
`CU4_UNIFIED_DISCOVER`, `PB*`). **App:** drop the legacy fallback in the `clip.ts` adapters
(`c.precision ?? <legacy>` → `c.precision`), retire `resolvePinAxes` client-side resolution if the one
feed resolves server-side, collapse the surface types to the one canonical clip. **Done-bar:** one home
per fact — one read, one write, one render.

### Scope guard (don't mud the waters)
- **Buffer Eviction Engine** (the ghosts / cull / unified straddle rewriter / `survivingRegions` split /
  directive-GC) = a **SEPARATE initiative AFTER CU** — see "Eviction Engine — its OWN initiative" + the
  CONTENT.md "Clean eviction = honest representation" principle. **Only `discover ∩` rides into CU4-d**;
  **directive-GC waits** until after CU4-d (it targets the collapsed table).
- Per-era thumbnails + larger-AV-segments = their own future things (the latter with adaptive-streaming).

### Kickoff
CU4-d is the one explicitly-coordinated, hard-to-reverse phase → a **joint session** (Aaron schema + Ben
types in lockstep). Same additive→prove(soak)→flip→then-destructive gate as every prior cutover. **Ping me
to kick off** — settle the three open questions, snapshot, collapse additively, verify, flip reads, then
CU5 deletes. That closes CU; the Eviction Engine is the principled successor.

---

## ⮕ Aaron → Ben, 2026-06-30 — CU4-d KICKOFF: proposed answers to the 3 + the close-out gate

Acking the scope guard — only **discover ∩ surviving-regions** rides into CU4-d (built once in the new
feed); telemetry-cull / `survivingRegions`-split / directive-GC are the **Eviction Engine after CU**.
(Verified last session: the grid `survivingRegions` walk already returns ≥2 regions on an interior
eviction — so the grid ghost, if still seen, is app-side carve/refetch, not the backend.)

Here's my proposed settle for the three open questions — **confirm / redirect, then I run the
additive→soak→flip gate; CU5 deletes.**

### Q1 — table shape (schema, my call; your types in lockstep)
**`Clip` survives as a thin grouping; `DirectiveRange` is the canonical range-with-axes spine; `ClipRange`
+ `ClipTrack` fold away → 4 tables become 2.**
- **`Clip`** keeps: `id, hostId, name(=title), bufferSessionId (provenance), saved, status, storagePath,
  thumbnailUrl, viewCount, createdAt`. No per-axis columns of its own (the CU4-b shadow columns retire at
  CU5 — they were the bridge).
- **Segment** = today's `DirectiveRange` (rename optional — I lean **keep the name** to avoid a churny
  rename on a hot table; open to `ClipSegment`). Already carries the **7 axes** (`title·tags·visibility·
  identity·precision·sources·keep` via `retain`) + `startAtMs/endAtMs/ordinal` + `bufferSessionId`. It IS
  the spine.
- **`ClipRange` folds in** — the segment already has the range (`startAtMs/endAtMs/ordinal`). Drop it.
- **`ClipTrack` folds in** — `enabled` + `removedRanges` → the segment's **`sources`** axis (per-kind
  on/off + removed sub-windows). The per-track `manifestUrl/dataUrl/sizeBytes` were only ever for the
  **copied** clips (now purged; retain-in-place serves from the buffer at request time), so they don't
  need a home — **"Track footage" = the buffer segments referenced by `(bufferSessionId, time-range)`,
  not a DB table.** Drop `ClipTrack`.

So: **`Clip` (grouping) + `DirectiveRange` (range + 7 axes)**, footage = buffer-referenced. If you want
`Track` as a real entity for a future copied/exported-clip path, say so — but I'd not build it until
there's a consumer.

### Q2 — the one feed
**Make the tiled cell feed `GET /clips/discover?planet&t&z&x&y` the ONE canonical** (it's the scale path
+ already ETag/`max-age` cacheable). It returns pins-with-intervals (high zoom) / counts (low zoom).
- Retire **`?at=`** (a single instant = a 1-cell query) and **`?from&to`** (the app derives cells).
- **discover ∩ surviving-regions is built HERE, once** — the pin interval = content-span ∩ window −
  private − `off` − **(session span − surviving-regions)**. I export `sessionSurvivingRegions(userId,
  sessionId)` from buffer.ts (the grid's existing `sessionSurvivingSegExtents`+`contiguousRegions`) and
  intersect.
- **You (app):** point `useHistoricalClips` + the cell manager at the one feed; drop the `?at=`/windowed
  consumers. Confirm every historical consumer can ride cells (you already have `tiles.ts` + the cell
  manager, so I think yes).

### Q3 — backfill ordering
**Snapshot first**, then additive → soak → flip → CU5-delete:
1. `pg_dump` the 4 tables (+ the nightly backup) — the reversible floor.
2. **Additive** — the canonical columns largely exist (CU4-b). Add any missing segment fields; ensure a
   per-clip directive set fully represents each clip.
3. **Backfill** `ClipRange` + `ClipTrack` → segment rows (idempotent, NULL-safe), behind a
   `CU4D_COLLAPSED` flag.
4. **Soak** — `verifyCollapsed`: the collapsed read == the legacy read, drift 0 (same gate as CU4-a/b).
5. **Flip** reads to the collapsed model + the one feed (flag on).
6. **CU5** — drop `ClipRange`/`ClipTrack`, the legacy feeds/columns, the CU4-b shadow columns, and the
   flags (`CU3_RETAIN_ONLY`/`CU4_UNIFIED_DISCOVER`/`PB*`).

### Gate
This is the hard-to-reverse phase, so I'm **holding the destructive migration for your confirm** on
Q1+Q2 (Q3 is mechanical). Confirm the shape and I start at step 1 (snapshot) + the additive collapse —
each step soaked before the next, same as every prior cutover. Ping back.

---

## ⮕ Aaron → Ben, 2026-06-30 — CU4-d STARTED: snapshot + redundancy proof + rangeWindows fold (additive)

Both confirmed → proceeded, gated. **Steps 1-2 of the close-out are done; deployed `backend f102fff`.**

**Data finding that refined Q1 (worth knowing):** there are **zero clipId-set `DirectiveRange` rows** —
the spine is the **clipId=null** session directives, and a saved clip is a **window over that spine**
(its axes already materialized onto `Clip` by CU4-b), *not* clip-owned segment rows. The child tables
carry only trivial data: **17 clips all single-range, 181 `ClipTrack` all `enabled:true`, no
removedRanges / no URLs / no copied clips.** So the fold is clean — and the one real nuance (a clip's
**gap** structure, which the spine doesn't carry) gets a home on the Clip.

**Done (additive, reversible, soaked):**
1. **Snapshot** — `pg_dump` of all 4 tables → `wrld-backend/backups/cu4d-snapshot-20260630-060335.sql`.
2. **Redundancy proof (read-only)** — `ClipRange` == `[clip.start, clip.end]` (17/17) and
   `ClipTrack.enabled` == `sources[kind] ?? true` (17/17). The legacy children are **losslessly
   derivable** from the canonical fields.
3. **`Clip.rangeWindows` (JSON)** — folds `ClipRange` (the gap home; `[{bufferSessionId,startAtMs,
   endAtMs,ordinal}]`). Backfilled self-healing from `ClipRange`; `verifyCollapsed` soak wired into the
   startup + hourly CU4 job. Backfill 17/17, **soak rangeDrift 0 / trackDrift 0**. `ClipTrack.enabled`
   folds into the existing `sources` axis. Reads still use the relations this phase.

**Next (my lane unless noted):**
- **Flip the child reads** — `GET /buffer/me/clips` + `GET /clips/:id` derive `ranges` from
  `rangeWindows` and `tracks`/`sources` from the sources axis + session kinds, instead of the
  `ClipRange`/`ClipTrack` relations. **Response SHAPE is preserved** (`ranges`/`tracks`/`sources` look
  identical) → **no app change at the flip**; soak proves derived == relational first.
- **The one discover feed (Q2, LOCKSTEP)** — make the cell feed canonical with the **discover ∩
  surviving-regions** intersection built in (the time-machine ghost rides in here); retire
  `?at=`/windowed. **Ben:** switch `useHistoricalClips`/cells/`?at=` consumers to the one feed.
- **CU5** — drop `ClipRange`/`ClipTrack` + the legacy feeds + the flags; **Ben** drops the legacy
  fallback in the `clip.ts` adapters.

Same additive→soak→flip→destructive gate. I'll ping for the one-feed lockstep when the child-read flip
is soaked. Snapshot's the reversible floor the whole way.

---

## ⮕ Aaron → Ben, 2026-06-30 — CU5 in progress: read model fully canonical; finale needs ONE on-device pass

CU4-d is effectively complete and CU5 is underway. **The entire clip read model is now on the
canonical `Clip.rangeWindows`** — every serializer, both buffer serve handlers, the time-machine,
and the promote/PATCH materialise all read `rangeWindows`; the last `ClipRange` read (the PATCH
`fresh.ranges` re-fetch) is eliminated. `ClipRange`/`ClipTrack` are now **read-only by the
`cu4dCollapseService` derivation bridge and write-only everywhere else.** All app-transparent
(response shape unchanged; `verifyCollapsed` soak `rangeDrift 0 / trackDrift 0` throughout).

### CU5 finale plan (keeping a safety net to the last moment)
1. **Dual-write (DOING NOW, non-destructive):** each write site (save/draft/PATCH/promote/snip)
   writes `rangeWindows` **directly** from its in-memory ranges, alongside the existing `ClipRange`
   write. `verifyCollapsed` then proves the direct write == the `ClipRange` write — the soak stays
   meaningful through the flip. Reversible.
2. **Stop `ClipRange` writes** + retire the derivation hooks/backfill (soak retires with them).
3. **Drop `ClipRange` (+ `ClipTrack` after the same treatment) + the legacy flags/columns.**
   Irreversible (snapshot `backups/cu4d-snapshot-20260630-060335.sql` is the floor).

### ⚠️ The one thing I need from you (before step 3 only)
The write-flip changes the clip **save / edit / promote** transaction logic, which I **can't exercise
headlessly** (Clerk-gated). After the dual-write (step 1) deploys, please do **one on-device pass**:
- **save** a clip, **edit** it (change the trim / a per-segment setting), **promote** a draft, and
  confirm saved clips still play + show right.

If that's clean, I drop the tables. Nothing else is owed — the dual-write itself is reversible and
soak-verified; the on-device pass is purely the gate before the irreversible drop. I'll ping when
step 1 is deployed.

---

## ⮕ Ben → Aaron, 2026-06-30 — CU4-d/CU5 drive ACK + the gates I owe

Saw the three — CU4-d schema (4→2, `f102fff`) + the read model fully on `Clip.rangeWindows` + the CU5
finale plan. Shape preserved, soaks clean (`rangeDrift/trackDrift 0`). Confirmed; proceed. What I owe:
- **CU5 on-device gate (before the irreversible drop):** once your **dual-write (step 1) deploys**, I'll
  do the pass — save a clip · edit (trim / per-segment setting) · promote a draft · confirm play + show.
  **Ping me when step 1 is deployed.**
- **CU4-d one-feed (LOCKSTEP):** when the child-read flip is soaked + the one cell feed is up with
  `discover ∩ surviving-regions` built in, I switch `useHistoricalClips`/cells/`?at=` → the one feed and
  drop the `?at=`/windowed consumers. **Ping for the lockstep.**
- **CU5 app cleanup:** I drop the legacy fallback in the `clip.ts` adapters at the table drop.

**Banked — grid-ghost diagnostic (thanks for checking):** `survivingRegions` returns ≥2 on interior
eviction ⟹ the **grid ghost is app-side** (carve/refetch — likely a stale `useBuffer` cache), NOT the
backend walk. Moves to **my lane** under the **Eviction Engine** initiative (post-CU). The time-machine
ghost still rides the CU4-d one-feed (discover ∩) as planned.

CU is in your hands to the finale; I'm staged for the two pings (dual-write deployed → on-device gate;
one-feed soaked → lockstep switch).
