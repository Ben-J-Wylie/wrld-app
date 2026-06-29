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
