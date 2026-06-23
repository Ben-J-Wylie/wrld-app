# Aaron — full build: PB4 manifest persistence + scalable availability

Two **independent** backend lanes (Ben + Aaron signed off 2026-06-23). Model + rationale live
in `HANDOFF-public-buffer-onestore-2026-06-18.md` → **Contract A** (PB4 per-segment manifest) +
**Contract B** (time-tiles + push). This doc is the ordered, buildable checklist + the exact
shapes Ben builds the app to, so they integrate.

Current state to build on: PB1/PB2/PB3 live; PB3.5 windowed feed live (`AVAILABILITY_FEED`
on); per-segment privacy is interval-arithmetic on the app side; `DirectiveRange` carries
visibility/precision/attributed; `directives[]` already fold into `GET /buffer/me`.

---

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

## LANE B — Scalable availability (time-tiles + push) — temporal twin of the live P2 viewport protocol

**Model:** fixed, cacheable time-tiles + push-on-edit. A tile's availability is identical for
every viewer → edge-cacheable (O(unique tiles)); edits are rare → push is O(edits).

**B1 — Tiled, cacheable discover.** *[do first — app can drop the poll immediately]*
- `GET /clips/discover?tile=<n>` where `n = floor(T_ms / TILE_MS)` → that tile's pins + their
  public `intervals` within `[n*TILE_MS, (n+1)*TILE_MS]` (same pin shape as the windowed feed).
- **Cacheable:** `Cache-Control: public, max-age=<short>` + `ETag` (a tile is identical per
  viewer). `TILE_MS` = RemoteConfig, default **3_600_000 (1h)**, aligned to wall-clock floor.
- Keep `?from&to` + `?at=` alive during the transition (retired later, edge #3).
- *App contract:* Ben fetches the tiles covering the scrub range (cacheable GETs), holds/evicts
  them, resolves pin visibility locally.

**B2 — Push channel.** A WebSocket where a viewer **subscribes to the tiles it holds**; on any
edit, the server emits **"tile `<n>` changed"** to its subscribers → they refetch that tile.
Reuse the live discovery socket if it's clean to extend; else a sibling channel. O(edits), not
O(viewers×polls).

**B3 — Invalidate-on-edit.** The directives/snips PATCH (A1/A2) must **bust the affected
tile(s)' cache + emit the B2 push** for the tiles the edited range touches.
- *App contract:* Ben subscribes to held tiles; on "tile changed" → refetch that tile (drops
  the 60s poll; keep a long poll only as a socket-down backstop).

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
- **B1:** time machine fetches per-tile; responses cache (verify `Cache-Control`/`ETag` hits);
  app poll removable.
- **B2/B3:** another viewer's edit → "tile changed" → holders update with no poll wait.

## App side (Ben, in parallel)
- A: generalize the interval lib → piecewise settings; per-segment settings panel; derived
  segmentation from `session.snips` ∪ directive boundaries; multi-axis mend; persist via the
  snips + directives PATCHes.
- B: tile-manager (fetch/hold/evict cacheable tiles) + push subscription; replace the
  window+poll in `useHistoricalAvailability`.
