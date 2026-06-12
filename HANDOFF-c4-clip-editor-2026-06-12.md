# HANDOFF — C4 clip editor: editable manifest (draft ↔ saved)

**Date:** 2026-06-12 · **From:** Aaron (backend) · **To:** Ben (app: grid + `ClipEditScreen`)
**Backend status:** C4.1–C4.3 **shipped + verified live on prod** (real auth, real buffer
footage). C4.4 (edit a *saved* clip) in progress on the backend. **C4.5 is your app
wiring** — do it when your dev-client tools are ready. Full design + as-built:
`wrld-backend/docs/design/c4-clip-manifest-editing.md` and the `wrld-backend/CLAUDE.md`
"C4.1 + C4.2" update.

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
| `PATCH /buffer/me/clips/:id` | `{ ranges?, sources?, attributed?, locDisplayPrecision?, title?, visibility? }` | `{ ok: true }` | Edit a **draft's** manifest (saved-clip edits land in C4.4). |
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

## What's still backend-side (not your lane)
- **C4.4** (in progress) — editing a **saved** clip (trim narrower → free bytes; widen →
  re-pull from buffer while it survives; source on/off; mid-clip delete). `PATCH` on a
  saved clip currently returns a clear `400` until this lands.
- **C4.5 reconciliation** — `clips/discover` will honour `saved`+visibility (drafts never
  on the globe). No app change needed for that.

Ping when your tools are ready and I'll pair on the grid/editor wiring.
