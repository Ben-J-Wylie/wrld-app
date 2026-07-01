# HANDOFF — Clean-cut backend is UP (Recording + Era) — Aaron → Ben, 2026-07-01

> **The backend is deployed + running on the Recording + Era model. DB + footage
> storage are wiped. mediasoup records recording-first. You can swap the app
> consumers against `https://api.wrld.cam` now.** This is the "get the backend up
> and ping when it's deployable" you asked for.

Backend commit `4ddac43` (deployed, migrate `0_init` applied on a fresh DB, health
200). mediasoup commit `9cd5e34` (built + `systemctl restart`ed). Both pushed to
`main`.

---

## What shipped (my lane)

- **Schema** — `Clip`/`ClipRange`/`ClipTrack`/`DirectiveRange` + the old `Recording`/
  `RecordingTrack` + `UserBuffer`/`BufferSession`/`BufferTrack` are **gone**, replaced by
  **`Recording`** (immutable captured facts) + **`Era`** (the one rules object) exactly
  per the locked contract. The 55 drifted migrations are squashed into ONE clean baseline
  (`0_init`) that carries the PostGIS geom/GIST + pg_trgm bits — a from-scratch rebuild
  now works (H2 is retired).
- **Recorder (recording-first)** — go-live creates a `Recording` + opening `Era`; footage
  writes to `buffers/<userId>/<recordingId>/<kind>/` (media `init.mp4`+`*.m4s`, telemetry
  `<chunkMs>.jsonl`). `keep` starts `kept` for a `saved`-lane go-live, else `reapable`.
- **Reaper/eviction** — recording-first age+byte trim honouring `keep:'kept'` eras;
  `survivingRegions` computed from on-disk PDT (split at interior holes); `/discover`
  intersects pins with surviving regions; middle-era delete does a ts-precise segment +
  telemetry cull. No projection — the `Era` row IS the truth.

## API contract (as-built) — base `https://api.wrld.cam`

**Discovery (one feed, live + time machine):**
`GET /discover?planet&t&z&x&y` (optional auth)
- `t` = `floor(T_ms / 3_600_000)` (1h time-tile — shared `AVAILABILITY_TILE_MS`); `z/x/y`
  = web-mercator tile. `planet` = `earth` (general) | `venus` (adult).
- `z < 4` → `{ planet,t,z,x,y, count, pins:[] }` (count bubble). `z ≥ 4` → `pins:[]` with:
  ```
  { eraId, recordingId, startAtMs, endAtMs|null, lat, lng, title, precision, identity,
    sources, intervals:[{startMs,endMs}], host:{id,handle,displayName,avatarUrl}|null,
    access:{ subscribersOnly, ppvEventId } }
  ```
  `host` is null when `identity==='anon'`. `endAtMs` null = live. `intervals` = the pin's
  surviving footage ∩ the time-tile (evicted spans excluded). Missing params → 400.

**Viewer:** `GET /eras/:id` (optional auth, access-gated: private→owner only,
subscribersOnly→active sub/admin, ppv→PpvAccess) → `{ era, recording:{…,lat,lng}, host,
sources:[{kind,manifestUrl,dataUrl}], thumbnailUrl }`. Media `manifestUrl` +
`thumbnailUrl` carry a 6h HMAC token (`?t=`); the native player fetches segments with it.

**Owner timeline:** `GET /me/recordings` (auth) → `{ recordings:[{ id, startedAt, endedAt,
lat, lng, kinds, survivingRegions:[{startMs,endMs}], eras:[{ …all Era values…,
thumbnailUrl }] }] }`.

**Edits (all owner-gated):**
- `PATCH /eras/:id { title? tags? visibility? identity? precision? sources? keep?
  subscribersOnly? ppvEventId? contentRating? }` — **save = `PATCH { keep:'kept' }`**.
- `POST /recordings/:id/snip { atMs }` — split the covering era (new row inherits values).
- `POST /recordings/:id/mend { atMs }` — drop a boundary (merge two eras).
- `DELETE /eras/:id` — permanent: last era → the whole recording + footage; a middle era
  → ts-precise cull of just that window.

**Serving (tokenised, `?t=`):** `GET /eras/:id/:kind/index.m3u8` (era-window HLS stitch,
VOD when ended / live when open), `GET /eras/:id/:kind/:file` (range-aware init/segment),
`GET /eras/:id/:kind/data.jsonl` (telemetry culled to the era window), `GET /eras/:id/thumb.jpg`.

**`GET /auth/me`** — `bufferEarliestAt` now = oldest recording start; `bufferUsedBytes` is
0 (byte usage is enforced on disk by the reaper, not tracked in the DB under the clean-cut);
`bufferWindowHours`/`bufferByteCapBytes` unchanged.

## Notes / deferred (call these out if they bite)

- **Config not re-seeded.** Squashing the migrations dropped the RemoteConfig seed rows;
  the app runs on code fallbacks (fee rates, buffer window/cap, tier prices, etc. all have
  fallbacks) so nothing breaks, but `/admin/config` starts empty. I'll re-seed the config
  keys as a follow-up (or say the word and I'll do it now).
- **Tip/Gift `clipId`** attribution now resolves against an `Era` id (field name unchanged).
- **`activeBroadcastSec`** (creator "hours streamed") is not stamped by the new recorder
  path yet — deferred (kept the mediasoup diff minimal). Analytics reads 0 until wired.
- **Moderation footage hold** copies recording-first footage windows now; the review UI is
  still v0.3.
- **Old handoffs superseded:** `HANDOFF-cleancut-recording-era-2026-06-30.md` (the contract)
  is now built; the CU4-d/CU5 handoffs are dead.

Ping me on anything that doesn't match what you pre-staged. — Aaron
