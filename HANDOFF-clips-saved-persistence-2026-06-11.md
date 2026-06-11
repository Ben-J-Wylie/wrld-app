# HANDOFF — Clips landing grid: durable saved-clip persistence (R3 + C5)

**Date:** 2026-06-11 · **From:** Ben (`design`) · **To:** Aaron (backend + `screens`/`hooks`/`api`)
**Status of the app side:** shipped to `main` (`581ce6a`); drag-to-save is wired but **non-durable** —
it's blocked on the two backend pieces below.

---

## What shipped (on `main`)

- **Clips landing grid** — `app/(app)/clips.tsx` → `ClipsScreen`. Two-lane, time-ordered grid:
  **buffered** recording sessions (left) and **saved** clips (right) on a shared vertical axis,
  now at the bottom. Per-clip collapsed-gap layout (each clip a readable block, empty stretches
  → gap markers), pinch-to-zoom, **double-tap → editor**, **drag a clip across lanes to
  save / un-save**.
- **Shared `[Clips | Editor]` top tabs** across the grid and `ClipEditScreen` (sibling `href:null`
  tab routes → instant swap).
- **Phase C** — double-tapping a clip scopes `ClipEditScreen` to that clip's own window (`clipId`
  param → single segment over `[start,end]`, no eviction gap / live tail, playhead bounded,
  bracket defaulted to the whole clip).
- **Library screen retired** — the grid is the saved-clips surface now.

## The gap (what this handoff fixes)

`ClipsScreen.moveClip` does two things on a drag-to-save:
1. `setLaneOverride(...)` — **local React state, ephemeral** (gone on reload).
2. `bufferApi.saveClip(...)` → `POST /buffer/me/clips` — which **returns 501 today** (R3 not built);
   the call's `.catch(() => {})` swallows it.

So a dragged clip *looks* saved until reload, then snaps back to the buffer lane — nothing was
persisted, and the **saved lane reads `useRecordings`** (whole-stream recordings), not saved clips,
so a persisted clip wouldn't appear there anyway.

---

## Backend work (Aaron)

### 1. R3 — persist the save · `POST /buffer/me/clips` (currently 501)

The app already calls this exactly:
```
POST /buffer/me/clips
body: { startAtMs: number, endAtMs: number, name: string, kinds: string[] }
→ { clip: { id: string } }          // app reads res.data.clip.id
```
- **Must promote the byte range out of the rolling buffer into the permanent saved-clip pool.**
  This is the real durability: the rolling buffer **evicts**, so a manifest-only save vanishes when
  the window rolls past it. Copy/pin the segments into the curated GB saved-clip quota
  (permanent-until-deleted), per the decided two-pool model.
- `kinds: []` currently means "all captured" — confirm that default, or I'll have the grid pass the
  explicit captured set.

### 2. C5 — saved-clips list so it survives reload · `GET /buffer/me/clips` (NEW)

The grid's saved lane needs a real source. Minimal shape the grid consumes:
```
GET /buffer/me/clips → { clips: SavedClip[] }
SavedClip = {
  id: string
  name: string
  startAtMs: number      // wall-clock
  endAtMs: number        // wall-clock (durationMs derivable)
  thumbnailUrl: string | null
  kinds: string[]
}
```
Grid mapping → `LaneClip { id, startMs: startAtMs, endMs: endAtMs, label: name, sublabel: <dur>, posterUrl: thumbnailUrl }`.

### 3. Un-save / delete · `DELETE /buffer/me/clips/:id` (NEW)

For dragging a saved clip back to the buffer lane — reclaims the saved-clip quota.
```
DELETE /buffer/me/clips/:id → 200
```

### Model decision you need to make (the one thing that blocks the API shape)

**Does the saved lane show saved buffer-clips, the existing recordings, or both unified?**
The grid replaced the Library (which showed recordings), and the buffer-trim flow creates a new
saved-clip entity. Options:
- **(rec) Unified list** — `GET /buffer/me/clips` returns saved buffer-clips **and** recordings with a
  `source: 'clip' | 'recording'` discriminant, so the saved lane shows everything saved in one place.
- **Clips only** — the lane shows buffer-trim clips; recordings live elsewhere.

Recommendation: **unified list with a `source` field** (one saved surface, least surprise). Your call.

---

## App-side wiring (Ben — ready to do the moment the contract is agreed)

- `bufferApi.listSavedClips()` + `useSavedClips()` (TanStack, invalidated on save/delete).
- Grid **saved lane source → `useSavedClips()`** (replacing/augmenting `useRecordings`).
- `moveClip`: **to saved** → `saveClip` then invalidate the saved-clips query (drop the local
  `laneOverride` once the server confirms); **to buffered** → `DELETE` + invalidate. Reload then
  reflects server truth, not ephemeral state.
- The editor's `SavedClip` seam is already shaped for this.

> Seam note: this crosses into `screens`/`hooks`/`api` (your lane). Happy to wire the consumption
> against the agreed contract so it's live when your routes land, or leave it to you — just say which.

---

## Also needed: clip titles on sessions + recordings (small, additive)

The grid now labels each clip by the **stream title** instead of its start time. **No DB
migration is needed** — `Stream.title` already exists and both tables already reference the
stream. Just surface it as `title: string | null` in the responses:
- **recordings list** — `Recording` already has `streamId` + a `stream` relation → `include`
  the stream and return `recording.stream.title`.
- **`GET /buffer/me` sessions** — `BufferSession.streamId` is the (nullable) FK column, but there's
  **no `stream` relation defined yet**. Add the relation annotation (`schema.prisma` +
  `prisma generate`, no data migration — the column already exists) then `include` it, or just
  look up `Stream.title` by `streamId`. Nullable `streamId` → no title → grid falls back to time
  (already handled).
- **`GET /buffer/me/clips`** saved clips — `SavedClip.name` already covers this.

The app types already declare the optional `title` (`src/api/buffer.ts`, `src/types/index.ts`) and
consume it — no app change needed once the payloads include it.

## Rollout mapping

This is the **C3 save payload finalisation + R3 (persist) + C5 (saved-lane source)** from the
clips-initiative C0–C6 rollout in `CLAUDE.md`. Mirror the backend contract into
`wrld-backend/CLAUDE.md` when you build it (your convention).
