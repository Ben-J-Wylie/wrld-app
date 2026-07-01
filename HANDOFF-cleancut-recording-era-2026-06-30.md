# HANDOFF — Clean-cut to `Recording` + `Era` (the unified manifest, final form)

> **Ben decision, 2026-06-30 — testing mode, nothing to preserve → wipe + build the target schema
> directly.** This **supersedes the additive CU migration** (CU4-a…d / CU5, dual-write, soak, backfill,
> shadow columns, flags). No data or footage to keep → skip all migration scaffolding and land the
> refined **4→1** model in one coordinated breaking change. Canonical model: `CONTENT.md` §5 "Two
> entities — and exactly ONE rules object."
>
> **Lanes:** Aaron = backend schema + all read/write/reaper/discover + the mediasoup recorder. Ben = the
> app (types + every clip/buffer/discover/editor consumer). One coordinated deploy; DB + storage wiped.

---

## Why clean-cut (what disappears)
The entire additive apparatus exists only to protect prod data. With nothing to preserve, **delete** all
of it rather than extend it:
- `resolveClipAxes` (the resolver) · `materializedAxes` + the named shadow columns · dual-write ·
  `verifyCollapsed`/drift soak · `cu4MaterializeService`/`cu4ClipAxesService`/`cu4dCollapseService` ·
  the flags (`CU3_RETAIN_ONLY`, `CU4_UNIFIED_DISCOVER`, `PB*`, `CU4D_COLLAPSED`) · the legacy tables
  (`Clip`, `ClipRange`, `ClipTrack`, `DirectiveRange`) · `splitPoints`, `attributed`,
  `locDisplayPrecision`, `status`, `clipId`, `ordinal`, `storagePath`.
- **No projection → no staleness** (the whole CU1 saga was the projection). The `Era` row IS the truth
  every surface reads; an edit is one row write.

## 1. Schema (canonical)
```prisma
model Recording {                 // pure DATA — captured facts, nothing editable
  id           String  @id @default(cuid())
  hostId       String
  startedAt    DateTime
  endedAt      DateTime?          // null = live
  lat          Float?
  lng          Float?             // real capture coords
  kinds        String[]           // sources captured; footage on disk (see §2)
  eras         Era[]
  createdAt    DateTime @default(now())
}

model Era {                       // the ONE rules object — every per-era value, editable after the fact
  id           String  @id @default(cuid())
  recordingId  String
  recording    Recording @relation(fields: [recordingId], references: [id], onDelete: Cascade)
  startAtMs    BigInt
  endAtMs      BigInt
  // representation axes
  title        String?
  tags         String[] @default([])
  visibility   String  @default("public")    // public | private
  identity     String  @default("shown")     // shown | anon
  precision    String  @default("exact")     // exact | city | country | private
  sources      Json                          // { [kind]: bool }
  keep         String  @default("reapable")  // kept | reapable
  // access & rating (per-era, editable)
  subscribersOnly Boolean @default(false)
  ppvEventId   String?
  contentRating String  @default("general")  // general | adult
  // housekeeping
  thumbnailUrl String?
  viewCount    Int      @default(0)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  @@index([recordingId]) @@index([keep])
}
```
Inbound FKs (pins/reports/views) point at `Era.id`. `Recording` = immutable captured facts; `Era` = all
editable per-era values + housekeeping. There is **one rules type** — "clip/draft/saved" are `keep`/`title`
values, not types.

## 2. Disk layout — recording-first (created at go-live)
```
buffers/<userId>/<recordingId>/
  camera/  audio/  screen/     init.mp4 + *.m4s      (HLS segments)
  location/ chat/ gyro/ compass/ accel/ speed/ torch/   <chunkMs>.jsonl   (telemetry)
  thumbs/                      per-era frames (time-keyed → survive re-snips)
```
`Recording.kinds[]` = the subfolders present. **Replaces** the old kind-first
`buffers/<userId>/<kind>/<sessionId>/…`. On go-live: `mkdir <recordingId>/`, write each **armed** kind
into `<recordingId>/<kind>/`. Tokens/manifest/thumb URLs + the reaper's file walk all move to the new path.

## 3. API shapes (proposal — Aaron finalizes)
- **Discovery (globe live + time machine, ONE feed):** `GET /discover?planet&t&z&x&y` → pins (high zoom)
  / counts (low zoom). A pin = an `Era` alive at `t` (live if `t=now`), filtered by `visibility=public`
  ∩ access ∩ `contentRating`→planet ∩ **surviving-regions** (evicted spans excluded — the ex-time-machine
  ghost fix, built here once). Pin:
  ```
  { eraId, recordingId, startAtMs, endAtMs, lat, lng, seekOffsetSec,
    title, precision, identity, sources,
    host: {id,handle,displayName,avatarUrl} | null (null when identity=anon),
    access: { subscribersOnly, ppvEventId }, contentRating }
  ```
- **Era detail (viewer):** `GET /eras/:id` → the `Era` (all values) + `recording` (host, coords) +
  per-source footage manifest/data URLs (for the included `sources`). Access-gated (subs/ppv → 403).
- **My timeline (clips grid, owner):** `GET /me/recordings` → the user's `Recording`s + their `Era`s +
  **`survivingRegions`** per recording (the grid draws the eviction gaps). Owner-gated.
- **Edits — PATCH the value / structural op:**
  - `PATCH /eras/:id { title? tags? visibility? identity? precision? sources? keep? subscribersOnly? ppvEventId? contentRating? }`
  - `POST /recordings/:id/snip { atMs }` → split the covering era in two (new row inherits values)
  - `POST /recordings/:id/mend { atMs }` → drop a boundary (merge; guard if values differ)
  - `DELETE /eras/:id` → permanent (row + footage)
  - **"save"/"keep" is just** `PATCH /eras/:id { keep: 'kept' }` — no separate endpoint.

## 4. Plan
1. **Lock the contract** (this doc) — Ben + Aaron confirm the Prisma + API shapes. *(Critical path — it
   unblocks the parallel rewrite.)*
2. **Parallel rewrite:**
   - **Aaron (backend):** new Prisma → `prisma migrate reset` (wipe) → wipe `buffers/`+`clips/` storage →
     rewrite discover / era-serve / timeline / edit-snip-mend-delete / the reaper to read/write `Era`
     directly; delete all the scaffolding above.
   - **Aaron (mediasoup):** recorder creates a `Recording` + opening `Era` at go-live; writes footage
     recording-first; per-era thumbnails into `thumbs/`.
   - **Ben (app):** replace `SavedClip`/`ClipDetail`/`ClipPin`/`BufferSession`/`BufferTrack` types with
     one **`Era`** type (+ `Recording`); rewrite `ClipsScreen` (grid), the clip viewer, the discover/globe
     consumers, the settings drawer to read/write `Era`; delete the `clip.ts` adapters' legacy fallbacks +
     `resolvePinAxes`; point discover consumers at the one `/discover` feed.
3. **Deploy together + fresh device test** (breaking; DB wiped) → record · snip · edit each value · `keep`
   · reap · time-machine, from a clean slate.

## 5. Eviction — build it right from the start
The clean-cut removes the projection-staleness half of the eviction problem for free (the `Era` IS the
truth). Build the **representation** half correctly from day one so the ghosts never appear: the reaper
splits `survivingRegions` at interior holes, `GET /discover` intersects pins with surviving regions, edge
labels read the true frontier, and telemetry `.jsonl` is culled by the `ts`-precise straddle-rewrite
(CONTENT.md "Clean eviction = honest representation"). This *is* the Eviction Engine, folded into the
clean-cut rather than retrofitted.

## Supersedes
`HANDOFF-cu4-schema-collapse-2026-06-29.md` (the additive CU4-d/CU5) and the migration-scaffolding parts of
`HANDOFF-unified-manifest-2026-06-24.md`. Those stay as history; **this is the live plan.**

---

## ✅ Contract LOCKED (Ben + Aaron, 2026-06-30) → Phase 2 parallel rewrite is GO

### Ben / app-side rewrite scope (the full surface)
Layered — types/API first (the contract in TS), then hooks, then consumers, then delete the dead:

**Types + API client** (the contract embodied)
- `src/api/buffer.ts` + `src/api/clips.ts` → collapse to **`api/recordings.ts` + `api/eras.ts`**: the
  `Recording` + `Era` types + the endpoints (`/discover`, `/eras/:id`, `/me/recordings`, `PATCH /eras/:id`,
  `snip`/`mend`/`delete`). Drop `SavedClip`/`ClipDetail`/`ClipPin`/`BufferSession`/`BufferTrack`/`ClipRange`.
- `src/types/clip.ts` → **delete the adapters** (`fromClipPin`/…/`resolvePinAxes`) — there are no
  surface-specific shapes to adapt anymore; `Era` is the one type. Keep the vocab bridge only if still used.

**Hooks**
- `useBuffer`/`useRecordings`/`useSavedClips`/`useDrafts` → one **`useMyRecordings`** (the owner timeline:
  recordings + eras + `survivingRegions`).
- `useHistoricalClips`/`useHistoricalCells`/`useHistoricalAvailability` → one **`useDiscover`** (the single
  `/discover` cell feed, live + time-machine).
- `useDataTrack` stays (footage data track by `recording`/`kind`).

**Consumers** (the bulk)
- `ClipsScreen` (grid) — the big one: render `Era`s over `Recording`s; snip/mend/keep/edit → the new ops.
- `ClipViewerScreen` — play an `Era` (`/eras/:id`), source rail from `era.sources`.
- `GlobeScreenMapbox` — one `/discover` feed (drop `?at=`/windowed/cell duplication); pins = `Era`s.
- `SegmentSettingsSheet` + `SavedClipSettingsSheet` → **one `EraSettingsSheet`** (edit any `Era` value;
  access/rating rows now included).
- `MeProfileTab` (saved feed) · `DashboardScreen`/`StreamScreen` (go-live → a `Recording` + opening `Era`;
  `captureConfig` seeds the first era's values).

**Lib**
- `clipDirectives` + `segmentSettings` → **simplify/retire**: an edit is a direct `PATCH /eras/:id`; no
  directive-range mapping, no coalesce/inherit (values are concrete on the `Era`). `dataTrackRender` stays.

**Delete:** `resolvePinAxes`, the `clip.ts` legacy fallbacks, the `?at=`/windowed discover consumers, the
`Clip`/`Segment` adapter machinery.

### Sequencing (de-risk the 30-file swap)
The type swap breaks every consumer (tsc), so the app rewrite is one atomic change **and untestable
without the backend**. So: **Aaron's backend is the critical path.** Ben **pre-stages the foundation now**
(new `api/eras.ts`/`api/recordings.ts` + the `Era`/`Recording` types, as *new* modules — non-breaking,
tsc stays green, validates the contract in TS), then does the **big consumer swap against Aaron's running
backend** (so it's testable) rather than blind. Both land in the coordinated deploy.
