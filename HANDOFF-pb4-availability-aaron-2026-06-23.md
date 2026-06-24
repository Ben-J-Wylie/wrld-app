# Aaron — full build: PB4 manifest persistence + scalable availability

Two **independent** backend lanes (Ben + Aaron signed off 2026-06-23). Model + rationale live
in `HANDOFF-public-buffer-onestore-2026-06-18.md` → **Contract A** (PB4 per-segment manifest) +
**Contract B** (time-tiles + push). This doc is the ordered, buildable checklist + the exact
shapes Ben builds the app to, so they integrate.

Current state to build on: PB1/PB2/PB3 live; PB3.5 windowed feed live (`AVAILABILITY_FEED`
on); per-segment privacy is interval-arithmetic on the app side; `DirectiveRange` carries
visibility/precision/attributed; `directives[]` already fold into `GET /buffer/me`.

---

> **✅ LANE A BACKEND DONE + DEPLOYED (Aaron, 2026-06-24, `wrld-backend` `a1c48bc` + `5423527`).**
> A1–A4 are live on prod. Exact shapes Ben builds against:
> - **A1 snips:** `PATCH /buffer/me/sessions/:id/snips { snips: [{ atMs }] }` (authoritative
>   replace; mend = send the reduced list / `[]`). `snips: [{ atMs }]` is returned on every
>   `GET /buffer/me` session **and** each `GET /buffer/me/clips` saved clip; saved-lane snips
>   also persist via `PATCH /buffer/me/clips/:id { snips }`. Storage is the existing
>   `splitPoints` slot — `splitPoints` + `/splits` stay as **back-compat aliases**; switch the
>   app to `snips`/`/snips` and we retire the aliases after your build ships.
> - **A2 multi-axis:** `PATCH /buffer/me/sessions/:id/directives` (still PB3_PER_RANGE-gated,
>   authoritative replace) now accepts a per-range **`sources?: { [kind]: boolean } | null`**
>   alongside `visibility`/`precision`/`attributed` (null/absent = inherit/enabled). `GET
>   /buffer/me` `directives[]` now carries `sources`. (Saved clips keep using per-track
>   `enabled` + `removedRanges` — already built — so A2's new axis is the BUFFER-session twin.)
> - **A3:** the reaper deletes a session's standalone directives + snips when its footage
>   evicts — no orphaned manifest metadata. Saved (retained) content keeps its manifest.
> - **A4 (first cut):** `GET /buffer/session/:id` returns **`sourceWindows: [{ startAtMs,
>   endAtMs, sources }]`** (only ranges with a `sources` map) so the time-machine viewer
>   filters its rail per segment. Private windows are already excluded from the served HLS;
>   **full server-side manifest exclusion of source-off windows is the deferred fuller A4 cut**
>   — flag it if app-side rail filtering isn't enough.
>
> Remaining for Lane A is the **app side** (Ben): derived segmentation from `session.snips` ∪
> directive boundaries, the multi-axis per-segment settings panel + mend, and honouring
> `sourceWindows` in the viewer rail.

## LANE A — PB4 manifest (persist snips + multi-axis directives)

**Model:** the manifest is a piecewise-constant function over the wall clock. **Snips** =
explicit boundaries (persisted, incl. no-op); **directive ranges** = per-range settings.
Current-state (mend = a snip absent from the list), full durable manifest, evicted footage's
metadata cleaned with it.

**A1 — Persist snips (server-authoritative).** *[do first — unblocks Ben's derived segmentation
+ kills the reload straddle, edge #1]*
- Store per session/clip in the existing `splitPoints` slot.
- New `PATCH /buffer/me/sessions/:id/snips  { snips: [{ atMs: number }] }` — **authoritative
  replace** (mend = the snip simply absent next PATCH). Owner-gated.
- Include **`snips: [{ atMs }]`** on each session in `GET /buffer/me` (next to `directives[]`)
  and on saved-clip responses.
- *App contract:* Ben reads `session.snips` to rebuild segmentation on load; PATCHes on
  snip/mend.

**A2 — Multi-axis directives.** Extend `DirectiveRange` + the existing
`PATCH /buffer/me/sessions/:id/directives` body so each range carries the FULL settings,
all axes equal:
```
{ startAtMs, endAtMs,
  visibility?: 'public'|'private',
  precision?: 'exact'|'city'|'country'|'off'|null,
  attributed?: boolean,
  sources?: { [kind: string]: boolean } }   // per-source on/off for a time-machine viewer
```
Authoritative-replace (as today). `sources` is the new axis (which captured sources a viewer
may see over that range).

**A3 — Cascade-clean on eviction.** When the reaper evicts a session's footage, delete its
`DirectiveRange`s **and** its snips (no orphaned metadata for footage that's gone). Saved
(retained) content keeps its manifest until the user deletes the clip.

**A4 — Per-segment serve.** *[stage after A1/A2]* Playback must honour per-segment `sources`:
a viewer watching over a range where a source is toggled off must not receive that track.
Either the clip/buffer-session detail returns the per-range source enablement (app filters
the rail), or the served manifest excludes disabled sources per range. (Simplest first cut:
return the per-range `sources` in the detail; the app's source rail already renders from a
kinds set — it can honour per-segment.)

---

> **✅ LANE B BACKEND DONE + DEPLOYED (Aaron, 2026-06-24, `wrld-backend` `cdc6cd0` + `597f35c`).**
> B1–B3 live on prod. Exact shapes Ben builds the cell manager against:
> - **Time-tile size:** `AVAILABILITY_TILE_MS = 3_600_000` (1h) is a **shared constant in
>   `src/lib/tiles.ts`** (NOT RemoteConfig — keeps it off /admin/config and lets client +
>   server compute the same `t`). **Mirror it in the app `tiles.ts`** (that file is already
>   "keep byte-identical"). `t = floor(T_ms / AVAILABILITY_TILE_MS)`. Cell key =
>   `availabilityCellKey(planet,t,z,x,y)` → `"planet/t/z/x/y"` (also added to `tiles.ts`).
> - **B1 cell GET:** `GET /clips/discover?planet=earth&t&z&x&y` → one cacheable cell.
>   - **high zoom** (`z ≥ PIN_ZOOM_THRESHOLD`): `{ planet,t,z,x,y, tileMs, mode:'pins',
>     clips:[…], bufferPins:[…] }` — same pin shapes as the `?from&to` feed, each with
>     `intervals`, geo-bounded to the tile + time-bounded to `[t·TILE, (t+1)·TILE)`.
>   - **low zoom**: `{ …, mode:'counts', bucketMs:60000, counts:number[] }` — a 60-entry
>     per-minute distinct-pin alive-count; read `counts[floor((T − t·TILE)/bucketMs)]` at
>     the playhead. (A scalar would over-count; the series is the right shape.)
>   - `Cache-Control: public, max-age=30` + `ETag` (304 on `If-None-Match`) — cells are
>     identical per viewer → edge/CDN-cacheable. Unknown planet → empty cell (Earth is the
>     only geo-tiled time-machine content today). `?at=` + `?from&to` still work.
> - **B2 push:** `wss://api.wrld.cam/clips/availability` (no auth). Client →
>   `{type:'subscribe',cells:[…]}` (authoritative replace) / `{type:'add',cells}` /
>   `{type:'remove',cells}`. Server → `{type:'cell_changed', cell:"planet/t/z/x/y"}` when an
>   edit touches a held cell → refetch that B1 cell. Replaces the 60s poll (keep a long poll
>   only as a socket-down backstop).
> - **B3:** the per-segment **directives PATCH** emits `cell_changed` for every cell the
>   edited session's footage occupies (best-effort). Snips don't change availability so they
>   don't push.
>
> **Scale follow-up (noted, not built):** the push registry is in-memory (single-server,
> correct now). Multi-server needs Redis fan-out of invalidations (the `emitCellsChanged`
> seam), mirroring `discoveryService`. Build when the box goes multi-instance.
>
> Remaining for Lane B is the **app side** (Ben): the cell manager (fetch/hold/evict cacheable
> `(planet,t,z,x,y)` cells over planet × viewport × scrub-time; resolve pins high-z /
> playhead-count low-z locally; reuse the live count/pin rendering) + the push subscription per
> held cell, replacing the window + poll in `useHistoricalAvailability`.

## LANE B — Scalable availability: **zoom-adaptive SPACE-TIME tiles + push** (the live P2 viewport protocol, plus a time coordinate)

**Model (amended 2026-06-23 — 2D zoom-adaptive + a planet partition).** The time machine becomes
the **live globe protocol with a time coordinate.** A tile is a **cell `(planet, t, z, x, y)`**:
`planet` = the top-level content partition (Earth default; Venus/Haven/… — a `planet`/world key on
the content; keep it planet-agnostic), `t = floor(T_ms / TILE_MS)` (time), `z/x/y` = the slippy
geo-tile from the **existing `tiles.ts`**. A viewer is always on exactly **one** planet, so the
planet dimension doesn't grow per-viewer load — it just partitions content (and distributes
viewers across planets). Same **zoom-adaptive count/pin regime** as live:
- **High zoom** (`z ≥ PIN_ZOOM_THRESHOLD`): individual **pins + their public `intervals`**,
  bounded to the geo-tile *and* the time-tile.
- **Low zoom** (the live `counts` regime): a compact **count-over-time aggregate** per cell — so
  a planet-zoom viewer fetches a handful of coarse count tiles, not the world.

Why this is the 500k-correct shape: read load = **O(on-screen tiles)**, independent of viewer
count *and* total content; and **planet-zoom-spin is the cheapest, most-cache-shared state**
(every zoomed-out viewer hits the *same* coarse global tiles). Edits stay **O(edits)**.

**B1 — Zoom-adaptive space-time tiled discover (cacheable).** *[do first — app drops the poll]*
- `GET /clips/discover?planet=<p>&t=<t>&z=<z>&x=<x>&y=<y>` → that cell (content filtered
  to `planet`):
  - **high z →** the pins (geo+time bounded) + their public `intervals`.
  - **low z →** a **count-over-time** series per cell — e.g. a per-minute "alive-count" across the
    tile's hour (≈60 ints) — so the client reads the count **at the exact playhead locally** and
    the response stays **instant-independent + cacheable**. (A single per-tile count over-counts
    badly — 1000 one-minute clips in an hour ≠ ~17 alive at an instant — so carry the series, not
    a scalar.)
- **Cacheable:** `Cache-Control: public, max-age=<short>` + `ETag` (a cell is identical for every
  viewer). `TILE_MS` = RemoteConfig, default **3_600_000 (1h)**, floor-aligned; `z/x/y` +
  thresholds reuse `tiles.ts` (same as live).
- Keep `?from&to` + `?at=` alive during the transition (retired later, edge #3).
- *App contract:* Ben fetches the cells covering **viewport × scrub-time**, holds/evicts them,
  and resolves **pins (high z) / the count at the playhead (low z) locally** — reusing the live
  globe's count/pin rendering.

**B2 — Push channel.** A WebSocket where a viewer **subscribes to the cells it holds**; on any
edit, the server emits **"cell `(planet,t,z,x,y)` changed"** to its subscribers → they refetch that
cell. Reuse the live discovery socket if clean (it already speaks viewport tiles) — this is the
same channel with a `t`. O(edits), not O(viewers×polls).

**B3 — Invalidate-on-edit.** The directives/snips PATCH (A1/A2) must **bust the affected
cell(s)' cache + emit the B2 push** for every `(planet,t,z,x,y)` the edited range touches (across the
zoom pyramid for that lat/lng + the time-tiles the range spans).
- *App contract:* Ben subscribes to held cells; on "cell changed" → refetch it (drops the 60s
  poll; keep a long poll only as a socket-down backstop).

---

## Sequencing
- **A and B are independent** (A = clip-editor manifest; B = globe availability, which reads
  only `visibility`). Build in either order / parallel.
- Within A: **A1 → A2 → A4**. Within B: **B1 → B2/B3**.
- A1 + B1 are the highest-value first steps (unblock Ben's derived segmentation, and let the
  app drop the poll).

## Done-bars
- **A1:** snip a clip, reload → snip persists (no straddle); second device → same segmentation.
- **A2:** set precision / identity / a source-toggle per segment → persists + round-trips.
- **A4:** a source toggled off over a range → not served/played there.
- **B1:** time machine fetches per **space-time cell**; **planet-zoom shows count bubbles**
  (few coarse tiles), **zoom-in shows pins**; responses cache (verify `Cache-Control`/`ETag`
  hits); app poll removable.
- **B2/B3:** another viewer's edit → "cell changed" → holders update with no poll wait.

## App side (Ben, in parallel)
- A: generalize the interval lib → piecewise settings; per-segment settings panel; derived
  segmentation from `session.snips` ∪ directive boundaries; multi-axis mend; persist via the
  snips + directives PATCHes.
- B: a **cell manager** (fetch/hold/evict cacheable `(planet,t,z,x,y)` cells over the current
  planet × viewport × scrub-time) reusing `tiles.ts` + the live count/pin rendering; resolve pins (high z)
  / playhead-count (low z) locally; push subscription per held cell; replace the window+poll in
  `useHistoricalAvailability`.

---

## Follow-up (Ben, 2026-06-23) — title + tags on directives

The per-segment settings sheet now also edits a **title** + **tags** per segment, sent on the
same `PATCH /buffer/me/sessions/:id/directives` body:

```
{ startAtMs, endAtMs, visibility?, precision?, attributed?, sources?,
  title?: string,          // per-segment title (absent = none)
  tags?: string[] }        // per-segment tags (absent/empty = none)
```

App already sends + re-seeds these (authoritative replace, same as the other axes). **Backend
TODO:** add `title` + `tags` to `DirectiveRange` and echo them in `GET /buffer/me` `directives[]`.
Until then they round-trip in-session only (lost on reload). Also worth carrying onto the saved
`Clip`/promoted manifest so a saved clip keeps its segment titles/tags.

> **✅ DONE + DEPLOYED (Aaron, 2026-06-24, `wrld-backend` `5344b42`).** `DirectiveRange` gained
> `title String?` + `tags String[] @default([])` (migration `20260624010000`, additive). The
> directives PATCH body accepts `title?`/`tags?` and persists them; `GET /buffer/me`
> `directives[]` now echoes `title` + `tags`, so they survive reload (no longer in-session
> only). Display metadata — no reaper/serve/availability impact (no B3 push).
>
> **✅ CARRY-THROUGH-PROMOTE DONE + DEPLOYED (Aaron, 2026-06-24, `wrld-backend` `51e52c9`).**
> Per-segment settings are now first-class through save, like the other axes. Promote builds
> the saved clip's OWN per-segment directives FROM the buffer's clipId=null directives
> (`splitRangeByDirectives` splits each retain range at the segment boundaries, carrying
> visibility/precision/identity **+ title/tags** per segment; gaps → clip defaults; full
> retention coverage preserved). Both promote paths (window-save + draft→save) + the
> re-materialise (edit-saved-clip) path (preserves from the clip's own rows across the
> footage edit). They live on the clip's `clipId`-set rows so they **survive the A3
> cascade-clean** of the buffer's clipId=null directives. **`GET /buffer/me/clips` now
> returns each saved clip's per-segment `directives[]`** (`{startAtMs,endAtMs,visibility,
> precision,attributed,title,tags}`) so the editor reloads them on a saved clip. Gated on
> `PB3_PER_RANGE` (as the rest of the directive write-path). On-device verify owed: save a
> clip with per-segment titles/tags → reload → they persist on the saved clip.

---

## Follow-up (Ben, 2026-06-24) — every armed source records a FIRST STATE at go-live

**Decision (Ben):** an armed source must never read as "armed-but-empty / disabled" in the clip
editor. Instead it should **capture at least an initial state at the start of the broadcast**, so
it always has a real track and shows normally — empty chat thread, initial location pin, initial
compass bearing, initial torch state, etc.

**App side — DONE (Ben):** on go-live, the broadcaster now emits one baseline sample per armed
**client-sourced** kind so a track always exists even with no movement/signal/interaction:
- `useTelemetryCapture` — gyro/accel `0`, speed `unknown`, compass via `getHeadingAsync` (0
  fallback so the compass track exists even indoors);
- `StreamScreen` — torch's initial state (it's a control, not a continuous sensor).

**Backend TODO (Aaron) — the SERVER-sourced kinds the app can't emit cleanly:**
- **chat** — chat is recorded server-side (the mediasoup chat sink → `chat/<session>.jsonl`), so
  the app can't seed it without sending a *visible phantom message*. When chat is armed, the
  recorder should write an **initial empty-chat state** at session start so the chat track exists
  (and the chat source shows) even with zero messages.
- **location** — confirm the broadcaster's first `locationUpdate` at go-live is recorded as the
  initial pin (so the location track always exists from the start).
- Make sure `GET /buffer/me` lists a track for any armed kind that has only the baseline sample
  (so the editor's captured-only shelf shows every armed source). This — plus the app baselines —
  is how we deliver "show all armed sources" without a separate `armedSources` field or disabled
  placeholders.
