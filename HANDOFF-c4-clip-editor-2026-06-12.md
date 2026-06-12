# HANDOFF — C4 clip editor: editable manifest (draft ↔ saved)

**Date:** 2026-06-12 (updated) · **From:** Aaron (backend) · **To:** Ben (app: grid + `ClipEditScreen`)
**Backend status:** **C4.1 → C4.4.1 are ALL shipped + verified live on prod** (real auth,
real buffer footage) — the entire draft→edit→save→edit-saved→trim-after-evict lifecycle is
done and the backend is **fully ready to integrate**. Full design + as-built:
`wrld-backend/docs/design/c4-clip-manifest-editing.md` and the `wrld-backend/CLAUDE.md`
"C4.1 + C4.2" / C4.3 / C4.4 / C4.4.1 updates.

---

## ✅ C4.5 APP WIRING — DONE (Ben, `design` → `main` 2026-06-12, `bc1d07a`)

The app side of the draft↔saved lifecycle is **integrated + merged to `main`** against the
real endpoints below. Pure JS/TS — no native rebuild. As wired:

- **`src/api/buffer.ts`** — `createDraft` → `POST /buffer/me/clips/draft`; `patchClip` →
  `PATCH /buffer/me/clips/:id`; `listClips(lane)` → `GET /buffer/me/clips?lane=`; `saveDraft`
  → bodyless `POST /buffer/me/clips/:id/save`; `deleteSavedClip` → `DELETE`. (`saveClip` still
  uses the R3 `POST /buffer/me/clips` path for a fresh buffer-window save.)
- **`ClipEditScreen`** — editing a buffer interval lazily `createDraft`s and debounce-PATCHes
  its manifest (trim ranges + per-source on/off) as you edit. Reopening a draft from the grid
  passes a `draftId` param → continues editing the **same** draft (no duplicate spawn). Saved
  clips PATCH in place; explicit Save materialises a draft via `saveDraft`.
- **Grid (`ClipsScreen` + `useDrafts`)** — `GET …?lane=draft` drafts render as **dashed accent
  blocks** in the buffer lane, carved out of their source session (same carve as saved ranges).
  Drag a draft down → `saveDraft` (materialise, no re-copy). Tap-tap → reopen in the editor.

**Verified:** `c4smoke.mjs` 24/24 + `tsc` clean. **Owes only an on-device pass** (draft block
renders dashed, carve looks right, reopen-continues-same-draft persists across reload).

### ⏳ The one remaining app↔backend gap — `removedByLane` (per-lane mid-clip deletes)
The editor can mark a **mid-clip removed range on a single source lane** (e.g. drop 4–7s of
*audio only* while camera plays through). That's still **mock-only in the app** — it has no
manifest backing. To make it real I need the `PATCH` `ranges`/`sources` model to express
**per-source** removed ranges (today `ranges` is whole-clip + `sources` is whole-clip on/off;
there's no "this source is absent for this sub-window" shape). If that's out of scope for C4,
say so and I'll keep it mock / drop the affordance. Everything else round-trips for real.

---

## The model (what changed)

A clip is now a **manifest** (ordered time-**ranges** + per-source **enabled** state) and
that manifest is the **single source of truth**. The same `Clip` row lives in two states,
flipped by a `saved` boolean:

- **Draft** (`saved:false`) — a manifest over the buffer, **no copy**, private, editable.
  Costs no saved-clip quota. Plays straight from the buffer. Ages out with its footage.
- **Saved** (`saved:true`) — its in-bounds footage **materialised** to durable
  `/media/clips/`, public-eligible, still buffer-linked. Survives buffer eviction.

Editing is non-destructive to the buffer — only the buffer's own reaper ever deletes
buffer footage. A mid-clip delete = one clip with **two ranges and a gap** (HLS
discontinuity); auto-splitting into two clip entities is deferred.

---

## Endpoints to wire (C4.5) — all owner-gated (Clerk JWT)

| Call | Body | Returns | Purpose |
|---|---|---|---|
| `POST /buffer/me/clips/draft` | `{ startAtMs, endAtMs, name? }` | `{ clip: { id } }` | Make a **draft** from a buffer window. No copy, no quota. |
| `PATCH /buffer/me/clips/:id` | `{ ranges?, sources?, attributed?, locDisplayPrecision?, title?, visibility? }` | `{ ok: true }` | Edit a **draft's OR a saved clip's** manifest. On a saved clip: metadata is instant; a trim/source-drop frees bytes; a range edit / source-add re-materialises (`409` only if the buffer footage has fully evicted **and** you're adding/widening). |
| `GET /buffer/me/clips?lane=saved\|draft\|all` | — | `{ clips: SavedClip[] }` | `saved` (default, the saved grid lane, unchanged) · `draft` (buffered-lane drafts) · `all`. |
| play `clip.manifestUrl` | — | HLS | Draft → tokenized **buffer-stitched** HLS; saved → durable `/media/clips/`. |
| `POST /buffer/me/clips/:id/save` | **none** | `{ clip: { id } }` | Promote a **draft → saved** (carries its edits). |
| `DELETE /buffer/me/clips/:id` | — | `{ ok: true }` | Discard a draft / un-save a clip (hard-delete for now). |

**`PATCH` field shapes:**
- `ranges`: `[{ bufferSessionId, startAtMs, endAtMs }]` — the **authoritative full list**
  (you own the trim/gap math). Server replaces the manifest + recomputes outer bounds.
- `sources`: `{ camera: true, audio: false, … }` — per-kind inclusion.
- `attributed` (identity shown), `locDisplayPrecision` (`'exact'|'city'|'country'|'off'`),
  `title`, `visibility` (`'public'|'anon'|'draft'`).

**`GET` clip shape (additive over the old SavedClip — your existing fields all still there):**
```ts
{ id, name, startAtMs, endAtMs, thumbnailUrl, manifestUrl, bufferSessionId, kinds,
  saved: boolean,
  ranges: [{ bufferSessionId, startAtMs, endAtMs, ordinal }],
  sources: { [kind]: boolean },      // enabled state per source
  attributed: boolean,
  locDisplayPrecision: string | null }
```
`kinds` is now the **enabled** sources only.

---

## How to TEST it works

### A. Fast API smoke test (~5 min, no app changes)

1. Grab a fresh JWT from the running app (`Authorization: Bearer eyJ…` from any
   `api.wrld.cam` request, or log `clerkToken`). Clerk tokens expire ~60s — run immediately.
2. `node c4smoke.mjs "eyJ…"`:

```js
const BASE='https://api.wrld.cam', tok=process.argv[2]
const H={Authorization:`Bearer ${tok}`,'Content-Type':'application/json'}
const j=async r=>{const t=await r.text();try{return JSON.parse(t)}catch{return t}}
const s=((await j(await fetch(`${BASE}/buffer/me`,{headers:H}))).sessions||[]).find(x=>x.playableKind&&x.mediaDurationSec>14)
const st=new Date(s.startedAt).getTime(), a=st+(s.mediaStartOffsetMs||0)+3000
const id=(await j(await fetch(`${BASE}/buffer/me/clips/draft`,{method:'POST',headers:H,body:JSON.stringify({startAtMs:a,endAtMs:a+6000,name:'smoke'})}))).clip.id
await fetch(`${BASE}/buffer/me/clips/${id}`,{method:'PATCH',headers:H,body:JSON.stringify({title:'edited',sources:{camera:false}})})
const d=((await j(await fetch(`${BASE}/buffer/me/clips?lane=draft`,{headers:H}))).clips||[]).find(c=>c.id===id)
console.log('DRAFT:',{saved:d.saved,sources:d.sources,ranges:d.ranges.length,plays:!!d.manifestUrl})
console.log('draft HLS:',(await fetch(d.manifestUrl)).status,'(200 = plays from buffer)')
console.log('SAVE:',(await fetch(`${BASE}/buffer/me/clips/${id}/save`,{method:'POST',headers:H})).status)
const sv=((await j(await fetch(`${BASE}/buffer/me/clips?lane=saved`,{headers:H}))).clips||[]).find(c=>c.id===id)
console.log('SAVED:',{saved:sv.saved,kinds:sv.kinds,durable:sv.manifestUrl.includes('/media/clips/')})
console.log('cleanup:',(await fetch(`${BASE}/buffer/me/clips/${id}`,{method:'DELETE',headers:H})).status)
```

**Expected:** `DRAFT saved:false, sources:{camera:false,audio:true}, plays:true` → `draft HLS: 200`
→ `SAVE: 200` → `SAVED saved:true, kinds:["audio"], durable:true` → `cleanup: 200`.
It creates + deletes a throwaway draft on your account — nothing left behind.

### B. The real test — on-device journey (after you wire C4.5)

Each step, and what you should **see**:
1. Make a selection in the buffered lane → it **persists as a draft across an app reload**
   (today a drag is ephemeral and lost — drafts fix that).
2. The draft **scrubs/plays from the buffer** in the editor (its `manifestUrl`).
3. Trim it / toggle a source off → re-fetch → **playback + `sources` reflect the edit**;
   the storage meter is **unchanged** (drafts cost nothing).
4. Save → it **moves to the saved lane**, gets a **real poster**, plays from a **durable**
   URL, and storage **ticks up**.
5. **Reload** → the saved clip is still there and plays — and **survives even after its
   buffer footage evicts** (the durability win).
6. A clip is in **exactly one lane** — saving moves it; the draft is gone from the buffered lane.

---

## Caveats
- `POST /:id/save` takes **no body** — `axios.post(url)` with no data is correct (don't
  send an empty `{}` with a JSON content-type → Fastify rejects empty-JSON-body).
- A draft's `manifestUrl` carries a **6h token** — refetch `GET /buffer/me/clips` for a
  fresh one on a long editing session (same token pattern as `GET /buffer/me`).
- A **single-session trim plays robustly** (one uniform HLS group); a multi-session draft
  (camera-flip span) has the known mixed-init AVPlayer seek caveat — your existing
  group-swap handling from `allGroups` covers it.
- **Drafts are private** (`saved:false`) — they never appear on the globe / `clips/discover`.

---

## Editing a SAVED clip (C4.4 — done, also via `PATCH`)

The same `PATCH /buffer/me/clips/:id` works on a saved clip — wire it the same way as the
draft edit; the backend picks the cheapest correct path:
- **metadata** (title/attributed/loc/visibility) → instant, no re-encode.
- **source removal** (`sources: { camera: false }`) → drops that track + frees its bytes
  (works even after the buffer evicts); `kinds`/`sources` + storage update.
- **trim / range edit** → re-materialises (from the buffer while it survives, else re-cuts
  the clip's own copy), freeing bytes on a narrow. `manifestUrl` stays the durable
  `/media/clips/` one; `usedStorageBytes` drops — refetch `/auth/me` for the meter.
- **widen / add a source after the buffer evicted** → `409` (genuinely impossible — the
  footage is gone). Trim-after-evict works; widen/add does not.

Verified live: save camera+audio → trim 12s→5s (freed 7.5 MB) → `camera:off` (freed 10 MB,
`kinds:["audio"]`) → trim again after a (simulated) buffer evict (re-cut the owned copy) →
delete (exact reclaim). No orphan files, quota exact.

## What's still backend-side (not Ben's lane)
- **C4.5 reconciliation** — `clips/discover` will honour `saved`+visibility (drafts never
  on the globe). No app change needed for that.
- **Per-source removed ranges** — needed to make the editor's `removedByLane` real (see the
  ⏳ gap under the C4.5 status block above). Aaron's call on whether this is in C4 scope.
- **Deferred (rare):** mid-clip-delete (gapped) *after* the buffer has evicted → `409`.

**The whole backend (C4.1–C4.4.1) is shipped + verified; the app side (C4.5) is integrated +
merged to `main`.** Remaining: Ben's on-device pass (Section B) + the `removedByLane` decision.
