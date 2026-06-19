# HANDOFF — Haven on viewport-tile discovery (scale to 100k private pins)

**Decided 2026-06-19 (Aaron + user):** Haven can grow to 100k private pins if being
private is popular — so it gets the **same viewport-tile + WS discovery as Earth**, not a
poll and not the always-on global socket. This is the scale-proof path. Cross-repo +
protocol-level → this doc is the contract.

## The idea
Private ('off') streams have NO real coordinate, so the **server computes each pin's stable
island position from its stream id** (a byte-identical mirror of the app's
`randomPointOnIsland`) and indexes it into a **Haven tile namespace**. Earth and Haven then
share ONE model: the client subscribes to the slippy tiles its viewport shows; the server
fans pins to matching tiles. Privacy intact — the island position is id-derived (what the
client already renders publicly); the real coordinate is never read server-side.

## Protocol extension (the contract) — a `planet` dimension
Tiles stay `z/x/y`; **planet is a separate axis** (cleanest — no tile-string format change):
- **`subscribe`** message gains **`planet: 'earth' | 'haven'`** (default `'earth'` →
  back-compat: existing Earth clients unchanged). One planet per subscription.
- Each pin carries a **`planet`** (server-derived: `locationPrecision === 'off'` → `'haven'`,
  else `'earth'`). A pin is routed to a subscriber iff **same planet AND tile matches**.
- **Earth pins** tile by real coords (today). **Haven pins** tile by the SERVER-computed
  island coords (`randomPointOnIsland(id)`), in a planet-keyed tile namespace
  (`disco:tile:haven:z/x/y`). `tile_pins`/`pin_added`/`pin_removed`/`count_changed` are
  unchanged in shape (planet is implied by the subscription).

## Backend steps (Aaron)
1. ✅ **Server island placement mirror** — `src/lib/island.ts` (byte-identical
   `randomPointOnIsland`) + golden vectors. Landed `c97bd61` (inert).
2. ⏳ **Planet-keyed tile index + planet-aware subscribe/route** — index private pins by
   their island coords into `disco:tile:haven:…`; add `planet` to `ViewportSub` + the
   `subscribe` handler + `routeToSub`/`tilePathDiff`; derive `planet` on each
   `DiscoveryStream`. Additive + flag-gated (`HAVEN_VIEWPORT`, default off → today's
   coordless-legacy behaviour). Earth path byte-identical when off.
3. Backfill not needed (live index, rebuilt from Postgres on boot/reconnect — `off` rows
   get island coords at rebuild).

## App steps (Ben) — `design`
- **Haven globe subscribes viewport tiles with `planet: 'haven'`.** Compute the visible
  tiles over the ISLAND coordinate space with the shared `tiles.ts` (the island spans
  ≈ ±6.8°, so it's just a small lng/lat region — `tilesForBounds` over the Haven camera's
  bounds). Same `tile_pins`/incremental handling Earth uses.
- **Drop the always-on discovery socket** for Haven (the scale regression). Earth already
  uses viewport tiles; Haven now does too.
- Keep `randomPointOnIsland(id)` for rendering — it already matches the server (golden
  vectors below). **Add a golden-vector test** asserting the SAME (id → [lng,lat]) pairs so
  the two repos can't drift:
  ```
  clstream0001               -> [-1.3942906060721718, 3.2522372819483287]
  cmqk3kd580029lbnfu7pvublk  -> [-2.150092931138351,  0.24951269547455013]
  ext-bol-harbour            -> [1.7688946702051913,  3.35101336548105]
  a                          -> [1.4684195626061411, -2.4006277948385106]
  zzz999                     -> [2.0166004291502757,  3.3929690009914335]
  ```
  (mulberry32 is integer PRNG ops → exact across platforms; `toEqual` holds.)

## Sign-off ask
Confirm the `planet` protocol axis (subscribe gains `planet`; pins carry `planet`; tiles
planet-namespaced) before I build step 2. Then: I land step 2 flag-gated → you wire the
Haven viewport subscription + drop the socket → flip `HAVEN_VIEWPORT` on → on-device gate
(many private streams cluster + viewport-subscribe on Haven like Earth, no always-on socket).

## Privacy (unchanged guarantee)
Real `off` coordinates are never read server-side (the island mirror takes only the id).
The Haven tile index holds only id-derived island coords. `findStreamsNear` still excludes
`off`. Same guarantee as the shipped Haven private-pins work, now tile-scalable.
