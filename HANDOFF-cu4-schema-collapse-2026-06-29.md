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
