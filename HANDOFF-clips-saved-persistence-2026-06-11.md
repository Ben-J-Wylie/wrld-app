# HANDOFF — Clips landing grid: durable saved-clip persistence (R3 + C5)

**Date:** 2026-06-11 · **From:** Ben (`design`) · **To:** Aaron (backend + `screens`/`hooks`/`api`)
**App side:** the Clips landing grid + viewer + transport are all built and on `main`. Drag-to-save,
un-save, the optimistic lane move, and the sticky viewer all work. The items below are the
**backend gaps** that keep saved clips from being fully self-sufficient (the app has stopgaps where
noted). Detail for each is in the spec sections further down.

---

## ✅ DONE (Aaron, landed)

- **R3** — `POST /buffer/me/clips` promotes a wall-clock window across sessions into a durable `Clip`.
- **C5** — `GET /buffer/me/clips` (list) + `DELETE /buffer/me/clips/:id` (un-save).
- **P1** — `Clip.thumbnailUrl` set on promote + `manifestUrl` returned on the clips list
  (`wrld-backend` `7db83d2`). Saved clips now own a durable poster + playable HLS.
- **P2** — `bufferSessionId` returned on the clips list (`7db83d2`) + session `title` from
  `Stream.title` on `GET /buffer/me` (`dd9bd88`).
- **Zod 500→400** — save validation errors now return `badRequest` (`7db83d2`).
- **App wired (Ben, this commit):** `SavedClip` gained `manifestUrl` + `bufferSessionId`; the grid
  prefers the real poster/manifest (borrow now just a fallback) and hides the buffer session via the
  **exact** `sourceSessionId` (window-match is the legacy fallback). `title` + `thumbnailUrl` needed
  no change — they flow. The ClipViewer plays saved clips now; the profile feed shows real posters.

## ☐ AARON TO-DO (open)

**P3 — editing persistence (C4).**
- [ ] **Non-destructive manifest writes** for trim / delete-source / per-source visibility, in either
      lane — the single source of truth at time-machine playback. Editor UI + tools exist (scaffold).
- [ ] **Model call (together):** editing a *buffered* (not-yet-saved) clip → promote-on-edit, or hold
      a draft manifest? *(§ "Model refinement", item 3)*

**Minor / confirm.**
- [ ] Zod validation failures (e.g. the `kinds` reject) return **500** — should be **4xx**.
- [ ] Confirm saving **copies** (buffer footage NOT consumed) so un-save needs no rewrite — the schema
      comment implies it; just verify nothing deletes the buffer segments on save.

**Broader (not blocking the grid — from the clips C0–C6 rollout).**
- [ ] **R2** — `GET /auth/me` dual-pool (`usedStorageBytes` + `bufferSizeBytes` + `bufferEarliestAt`)
      for the storage display.
- [ ] **C6** — telemetry tracks playback (loc / gyro / compass overlays).

**Resolved / moot.**
- ~~A `clip_ready` push to replace the app's save→refetch poll~~ — the `POST` is synchronous (returns
  once `ready`), so the clip lands on the immediate refetch. No push needed.
- ~~Model decision: saved lane = clips / recordings / both~~ — **decided: `Clip` rows** (recordings
  were purged; `Clip` unifies buffer-promoted + recording-sourced).

### Backend fast-path — where each open item lives (`wrld-backend`, line #s approx)

- **P1 `Clip.thumbnailUrl`** — `src/services/bufferClipService.ts` `promoteBufferClip` returns
  `{ tracks, primaryManifestUrl, totalBytes }` (~L472); add a `thumbnailUrl` (generate from the
  clip's in-point frame, or copy the source session's poster). Then set it in the route:
  `src/routes/buffer.ts` ~L913, the `clip.update` `data: { status:'ready', manifestUrl: …, … }` →
  add `thumbnailUrl: result.thumbnailUrl`.
- **P1 `manifestUrl` + P2 `bufferSessionId`** — `src/routes/buffer.ts`, `GET /buffer/me/clips`
  `saved.map(...)` (~L976). Add `manifestUrl: c.manifestUrl` and `bufferSessionId: c.bufferSessionId`
  to the returned object — both are already scalar columns on the `Clip` (the `findMany` returns them).
- **P2 `title`** — `src/routes/buffer.ts`, `GET /buffer/me` session mapping (~L512, where
  `thumbnailUrl` is built). Needs `Stream.title`: add `stream Stream? @relation(...)` on
  `BufferSession` in `schema.prisma` (+ `prisma generate`, **no migration** — the `streamId` FK
  already exists), `include: { stream: { select: { title: true } } }` on the sessions, return
  `title: s.stream?.title ?? null`.
- **Minor Zod 500→400** — the `SaveClipBody.parse(req.body)` in `POST /buffer/me/clips` throws raw →
  500. Wrap it (or add a ZodError → 400 handler) so validation failures are `badRequest`.

> **App consumption status (land in any order):**
> - **`Clip.thumbnailUrl`** and **session `title`** — **zero app change**; both fields are already
>   declared + consumed, so the moment you populate them every surface lights up (and the
>   thumbnail one supersedes my borrow stopgap).
> - **`manifestUrl` + `bufferSessionId` on `SavedClip`** — need a tiny app follow-up (add the two
>   fields to the `SavedClip` type, prefer the real `manifestUrl` over the session-borrow, swap the
>   window-match to the exact `bufferSessionId`). **Ping me when they're in and I'll do it same-day.**

---

## What shipped (on `main`)

- **Clips landing grid** — `app/(app)/clips.tsx` → `ClipsScreen`. Two-lane, time-ordered grid:
  **buffered** recording sessions (left) and **saved** clips (right) on a shared vertical axis,
  **newest at the top**. Per-clip collapsed-gap layout (each clip a readable block, empty stretches
  → gap markers), pinch-to-zoom, **double-tap → editor**, **drag a clip across lanes to
  save / un-save**, a sticky **ClipViewer** + **transport/clock** preview the selected clip, and the
  **Me → Public Profile** feed lists saved clips.
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

> **Update (2026-06-11, Aaron):** all three backend pieces are now built. **R3
> was already done** in `wrld-backend` `883abfb` (the "currently 501" note below
> was stale) — `POST /buffer/me/clips` promotes the wall-clock window across
> covered buffer sessions into durable `Clip` rows. **C5** (`GET /buffer/me/clips`
> + `DELETE /buffer/me/clips/:id`) added co-located in `buffer.ts`. **Model
> decision: saved lane = `Clip` rows** (not unified clips+recordings — recordings
> were purged in the buffer pivot; `Clip` already unifies buffer-promoted +
> recording-sourced). The original spec below stands as the contract.

### 1. R3 — persist the save · `POST /buffer/me/clips` (~~currently 501~~ ✅ done, `883abfb`)

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

> **✅ WIRED + WORKING (Ben, 2026-06-11 eve).** App consumes the real endpoints
> (`bufferApi.listSavedClips()` / `deleteSavedClip()`, `useSavedClips()` = `['buffer','clips']`).
> Saved lane reads `useSavedClips` (recordings dropped). Drag-right = `saveClip` (a COPY — the
> buffer block springs back); drag-left = `deleteSavedClip` (optimistic). `ClipEditScreen` focus
> resolves a saved clip via `useSavedClips`. **On-device verified: saves persist, the list grows,
> clips stay in the saved lane.**
>
> One contract fix on the way: the save was 500ing because `SaveClipBody.kinds` requires ≥1
> element but the app sent `[]`. **The app now sends the covered sessions' actual kinds** (e.g.
> `["camera","audio"]`), so it works. Reconcile when convenient — either accept `[]` = "all" (as
> this doc originally said) or keep non-empty; the app is fine either way.
>
> **Remaining for you (Aaron):**
> 1. **THE one that matters for UX — buffered-lane titles.** `GET /buffer/me` sessions don't carry
>    `title`, so both lanes label by start time. Add `title` via `BufferSession.streamId →
>    Stream.title` (relation/lookup, **no migration** — see the "clip titles" section below). App
>    already consumes `session.title`. *(New saves made after this lands inherit the title as their
>    clip name; clips already saved keep their time-name.)*
> 2. *(minor, optional)* the Zod reject returns **500** — should be **400**.
> 3. ~~A `clip_ready` push to replace the poll~~ — **MOOT**: your `POST` is synchronous (returns once
>    `ready`), so the clip shows on the immediate refetch. No push needed.

---

## Model refinement (2026-06-11, Ben) — a clip lives in exactly ONE lane

Decided UX model (and partly wired on the front end now): **a clip is a single entity in one
state** — buffered (ephemeral) OR saved (durable) — not a copy shown in both. Saving is a
**move**: a saved clip's source buffered session is **hidden from the buffer lane**; un-saving
brings it back. **No sub-lanes** (one source of truth per time region; the app dropped the
sub-column rendering). The clip is **editable in either lane** (trim / delete / per-source
visibility), and that source-visibility state is the single truth used at time-machine playback.

**Front end now (Ben):** the grid hides a buffered session when a saved clip's **window covers it**
(`savedClipCovers`, ±1.5s) — exact for the current whole-session save flow. Sub-columns removed.

**Backend asks (Aaron):**
1. **Expose the clip's source `bufferSessionId`** on `GET /buffer/me/clips` (it's already on the
   `Clip` row). Then the app hides the **exact** source session instead of window-matching — robust
   once clips can be trimmed to sub-windows. Add it to the `SavedClip` shape: `bufferSessionId: string | null`.
2. **Confirm (likely already true): saving COPIES, the buffer footage is NOT consumed.** The schema
   comment says the promoted clip is a durable copy that outlives the session, so un-save = delete
   the copy and the session reappears in the buffer lane (until it ages out) with no re-write. This
   is exactly the desired behaviour — just confirm nothing deletes the buffer segments on save.
3. **Edit persistence (C4 manifest).** Trim / delete-source / per-source-visibility on a clip (in
   either lane) needs to write the non-destructive **manifest** (the single source of truth). The
   editor UI + tools exist (scaffold); the persistence is yours. Editing a *buffered* (not-yet-saved)
   clip implies promoting-on-edit or holding a draft manifest — worth a quick model call together.

## Saved clips lose their thumbnail + can't play — two promote/list gaps

A saved clip shows **no poster and can't play** on every surface that reads the saved pool — the
Clips-grid saved lane, the sticky **ClipViewer** + bottom transport, and the **Me → Public Profile
saved-clips feed**. Two distinct backend gaps, **both on the durable `Clip`** — which is exactly why
no app-side fix can be robust: the borrow-from-buffer-session trick (below) breaks the instant the
rolling buffer evicts that session, and the profile feed can't even borrow (it doesn't load the
buffer), so it always shows placeholders today.

1. **`Clip.thumbnailUrl` is never set on promote.** `POST /buffer/me/clips` creates the row and the
   ready-update writes `manifestUrl` / `sizeBytes` / `tracks` but **never `thumbnailUrl`**, so it's
   `null` and `GET /buffer/me/clips` returns `thumbnailUrl: null`. **Fix (robust):** during promote,
   generate a poster from the clip's **own in-point frame** (correct for trimmed + multi-session
   clips) into `clips/<id>/`. Copying the source session's poster is an OK first cut but only correct
   for whole-session saves.
2. **`GET /buffer/me/clips` doesn't expose the manifest.** The `Clip` *has* `manifestUrl`
   (`result.primaryManifestUrl`) — the list just omits it. **Fix:** add `manifestUrl: string | null`
   to the `SavedClip` response (bundle with the `bufferSessionId` add above).

App-side stopgap shipped (Ben), **temporary bridge only:** on the Clips grid, a saved clip borrows
its source buffered session's poster + manifest while that session is still in the buffer (matched by
window) — degrades to none on eviction, and the profile feed has no equivalent. The two items above
are the real fix.

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
