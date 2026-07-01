# HANDOFF — Clean-cut backend is UP (Recording + Era) — Aaron → Ben, 2026-07-01

> **The backend is deployed + running on the Recording + Era model against
> `https://api.wrld.cam`. Swap the app consumers now.** This is the full report +
> your app-lane roadmap. Backend `4ddac43`, mediasoup `9cd5e34` (both on `main`).

---

## 1. Status / TL;DR

- **DONE + LIVE:** schema is `Recording` + `Era` (4→1); the whole CU/PB/clip-manifest
  apparatus is deleted (no resolver, no shadow columns, no projection — the `Era` row
  IS the truth). The 55 drifted migrations are squashed into one clean `0_init`
  baseline; the H2 broken-from-scratch chain is retired.
- **Data wiped + selectively restored:** DB + footage storage were wiped. I restored
  the 330 external cams (+ their host users), all 7 real user accounts with their
  Plus/Pro tiers + subscription plans, and the 96 RemoteConfig values (then pruned the
  7 now-inert CU/PB flags). So prod has cams, config, and your accounts back; it does
  NOT have old clips/buffer data (there is none — that's the point).
- **Recorder is recording-first:** go-live creates a `Recording` + opening `Era`;
  footage lands at `buffers/<userId>/<recordingId>/<kind>/`. **Your go-live flow is
  unchanged** — you still `createRoom` with `lane` + `sources`; the backend creates
  the Recording+Era for you. No app call to "start recording."
- **Deferred (one item):** `Stream.activeBroadcastSec` isn't stamped by the new
  recorder path yet (creator "hours streamed" reads 0). Small backend follow-up on me.

## 2. The model (what an app dev needs to hold in their head)

- **`Recording`** = immutable captured facts of one go-live: `{ id, hostId, startedAt,
  endedAt, lat, lng, kinds[] }`. `endedAt = null` → still live. Nothing on it is
  editable. Footage lives on disk keyed by `recordingId`.
- **`Era`** = the ONE rules object, a `[startAtMs, endAtMs)` window over a recording's
  footage, with every editable value on it: `title, tags[], visibility(public|private),
  identity(shown|anon), precision(exact|city|country|private), sources({[kind]:bool}),
  keep(kept|reapable), subscribersOnly, ppvEventId, contentRating(general|adult),
  thumbnailUrl, viewCount`.
- **"clip / draft / saved" are gone as types.** They're `keep`/`title` VALUES on an Era.
  A recording starts as ONE era spanning the whole go-live. **Snip** splits it into two
  eras; **edit** is a PATCH of one era; **save** = `PATCH { keep:'kept' }`;
  **mend** merges two eras back. There is no separate draft/save entity or endpoint.
- `endAtMs = null` in responses ⟺ a live/open era (its end is "now").

## 3. API contract (as-built) — base `https://api.wrld.cam`

### Discovery — `GET /discover?planet&t&z&x&y` (optional auth)
The ONE era feed (time-machine + non-moving live pins). `planet` = `earth`(general) |
`venus`(adult). `t` = **`floor(T_ms / 3_600_000)`** (1h time-tile). `z/x/y` =
web-mercator tile. **`z < 4` → count bubble; `z ≥ 4` → pins.**
```jsonc
{ "planet":"earth","t":495241,"z":8,"x":128,"y":85,
  "count": 3,
  "pins": [{
    "eraId","recordingId","startAtMs","endAtMs": <ms|null(live)>,
    "lat","lng",                      // DISPLAY coords (already obfuscated by precision)
    "title","precision","identity","sources",
    "intervals":[{"startMs","endMs"}], // surviving footage ∩ time-tile (render gaps for evicted spans)
    "host": {"id","handle","displayName","avatarUrl"} | null,  // null when identity==='anon'
    "access": {"subscribersOnly","ppvEventId"}   // pin FLAG only — pin shows, view is gated
  }]}
```
Missing params → 400. `precision==='private'` pins are dropped server-side. `ETag`/
`Cache-Control: private, max-age=15` — cacheable per tile.

### Viewer — `GET /eras/:id` (optional auth; access-gated)
403 if `visibility=private` and not owner / `subscribersOnly` w/o active sub / `ppv`
w/o access. Owner sees real host + exact coords; public sees the era's display axes.
```jsonc
{ "era": { id, recordingId, startAtMs, endAtMs|null, title, tags, visibility, identity,
           precision, keep, sources, subscribersOnly, ppvEventId, contentRating,
           thumbnailUrl, viewCount },
  "recording": { id, kinds, startedAt, endedAt|null, lat|null, lng|null },
  "host": {id,handle,displayName,avatarUrl} | null,
  "sources": [{ kind, manifestUrl|null, dataUrl|null }],   // per included source
  "thumbnailUrl": "…/eras/:id/thumb.jpg?t=…" }
```
`manifestUrl` (media) + `dataUrl` (telemetry) + `thumbnailUrl` carry a **6h HMAC token**
(`?t=`) — the native player fetches segments/data with it, no Clerk header per request.

### Owner timeline — `GET /me/recordings` (auth)
```jsonc
{ "recordings": [{ id, startedAt, endedAt|null, lat, lng, kinds,
    "survivingRegions":[{startMs,endMs}],   // the footage frontier — draw eviction gaps
    "eras":[{ id, startAtMs, endAtMs|null, title, tags, visibility, identity, precision,
              keep, sources, subscribersOnly, ppvEventId, contentRating, thumbnailUrl }] }]}
```

### Edits (all owner-gated)
- `PATCH /eras/:id { title? tags? visibility? identity? precision? sources? keep?
  subscribersOnly? ppvEventId? contentRating? }` (strict body) → `{ ok, era:{id,keep} }`.
  **Save = `PATCH { keep:'kept' }`. Unsave = `PATCH { keep:'reapable' }`.**
- `POST /recordings/:id/snip { atMs }` → split the covering era → `{ ok, eras:[leftId,rightId] }`
  (new era inherits all values). 400 if no era covers `atMs`.
- `POST /recordings/:id/mend { atMs }` → drop a boundary (merge) → `{ ok, era:leftId }`.
- `DELETE /eras/:id` → permanent. Last era of a recording → the whole recording + footage;
  a middle era → ts-precise cull of just that window.

### Serving (tokenised — you just consume the URLs from the responses above)
`GET /eras/:id/:kind/index.m3u8?t=` (era-window HLS; **VOD when the era is ended, live/no-
ENDLIST when open**), `…/:kind/:file?t=` (range-aware init/segment), `…/:kind/data.jsonl?t=`
(telemetry culled to the era window), `…/thumb.jpg?t=`.

### `GET /auth/me` deltas
`bufferEarliestAt` = oldest recording start (rewind-reach hint). `bufferUsedBytes` = 0
(byte usage is enforced on disk by the reaper now, not tracked in DB). `bufferWindowHours`
/`bufferByteCapBytes` unchanged.

## 4. LIVE vs TIME-MACHINE — the one split to internalise

**The live globe layer is UNCHANGED — do not rebuild it.** `GET /streams/discovery` (WS)
+ `GET /streams/near` + the Stream lifecycle are untouched. They carry **real-time
position** (heartbeat), viewer counts, and room-join — which the Era feed does NOT (a live
Era's `lat/lng` is frozen at go-live). So:
- **Live "now" layer → keep the existing `streams/discovery` WS + `/streams/near`.**
- **Time-machine + clips/library/viewer → the new Era surface (`/discover`, `/eras/:id`,
  `/me/recordings`).** `/discover` is **fetch/poll per visible cell** (ETag-cacheable);
  there is no cell-push channel in the clean-cut (the old B2/B3 `cell_changed` WS went
  away with the buffer machinery — reintroduce later only if poll cost bites).

## 5. Your app-lane roadmap (do it in this order)

**Layer 0 — pre-stage types/API (non-breaking, tsc stays green):**
- New modules `src/api/recordings.ts` + `src/api/eras.ts` with the `Recording` + `Era`
  types (§2) and the endpoints (§3). Mirror `src/lib/tiles.ts` **byte-identical** to the
  server's (`MAX_TILE_ZOOM=14`, `PIN_ZOOM_THRESHOLD=4`, `AVAILABILITY_TILE_MS=3_600_000`)
  or your tile keys won't match server keys.

**Layer 1 — hooks:**
- `useBuffer`/`useRecordings`/`useSavedClips`/`useDrafts` → one **`useMyRecordings`**
  (`GET /me/recordings`: recordings + eras + `survivingRegions`).
- `useHistoricalClips`/`useHistoricalCells`/`useHistoricalAvailability` → one
  **`useDiscover`** (poll `/discover` cells for the time-machine layer). `useDataTrack`
  stays (fetch a source's `dataUrl`).

**Layer 2 — consumers (the bulk, one atomic swap):**
- **`ClipsScreen` (grid):** render `Era`s over their `Recording`s; the grid clip IS an
  era. snip → `POST /recordings/:id/snip`; keep/unsave → `PATCH {keep}`; edit → `PATCH`;
  mend → `POST …/mend`; delete → `DELETE /eras/:id`. Draw eviction gaps from
  `survivingRegions` + per-era `intervals`.
- **`ClipViewerScreen`:** play an `Era` via `GET /eras/:id`; source rail from `era.sources`
  (each with `manifestUrl`/`dataUrl`); play `sources[].manifestUrl` (already tokenised).
- **`GlobeScreenMapbox`:** live layer stays on `streams/discovery`; the time-machine
  scrub layer points at `useDiscover`/`/discover` (drop `?at=`/windowed/cell duplication).
  A pin = an `Era`; `intervals` tells you when it's actually visible.
- **`SegmentSettingsSheet` + `SavedClipSettingsSheet` → one `EraSettingsSheet`** — edits
  ANY era value via `PATCH /eras/:id` (visibility/identity/precision/sources/title/tags +
  the access/rating rows: `subscribersOnly`/`ppvEventId`/`contentRating`).
- **`MeProfileTab`:** the saved feed = `GET /me/recordings` filtered to `keep==='kept'`
  eras (or a public projection when you add one).
- **`DashboardScreen`/`StreamScreen`:** go-live is **unchanged** — `createRoom` with
  `lane` (`'saved'`→ the opening era is `keep:'kept'` from the start) + `sources`. The
  opening `Era` inherits the go-live params (title/visibility/precision/subscribersOnly).

**Layer 3 — delete the dead:** `resolvePinAxes`, the `clip.ts` adapters/legacy fallbacks,
the `SavedClip`/`ClipDetail`/`ClipPin`/`BufferSession`/`BufferTrack`/`ClipRange` types, the
`?at=`/windowed discover consumers, `clipDirectives`/`segmentSettings` (an edit is a direct
`PATCH` — no directive-range mapping / coalesce/inherit; values are concrete on the era).
`dataTrackRender` stays.

## 6. Deviations from the original proposal (worth knowing)

- **No separate `/recordings/:id/clips` save endpoint** — save is `PATCH /eras/:id {keep}`.
- **No cell-push WS** for `/discover` — it's poll + ETag (see §4).
- **Live pin position is frozen** on the Era feed — use the Stream feed for the moving-live
  layer (§4). If we want one truly-unified live+past feed with live position, that's a
  follow-up (feed live location into the Recording).
- **Thumbnails** are generated on first request (per era) and cached; expect a small first-
  hit delay, then instant.

## 7. How to test (minted-JWT recipe still works)
Clerk session token (~60s TTL) as `Authorization: Bearer` for the authed routes. `/discover`,
`/eras/:id` (public eras), and the serving routes need no Clerk header (serving uses `?t=`).
Empty DB today → `/discover` returns `count:0,pins:[]` until someone goes live and an era
exists; `/me/recordings` → your own once you've broadcast.

Ping me on anything that doesn't match what you pre-staged, or if you want the unified-live-
position follow-up or the `activeBroadcastSec` stamp prioritised. — Aaron
