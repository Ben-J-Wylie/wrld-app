/**
 * Slippy-map tile math (z/x/y), shared model for globe-discovery scaling (P2).
 *
 * Slippy tiles are chosen over geohash/H3 because they map 1:1 to Mapbox's own
 * tile pyramid and zoom — the web/app client computes the same tiles from its
 * viewport that the server indexes pins into, so subscription tiles and indexed
 * tiles line up exactly. This file is MIRRORED in wrld-web (src/lib/tiles.ts);
 * the two MUST stay identical or a client would subscribe to tiles the server
 * keys differently. Pure, no I/O — unit-tested in src/__tests__/tiles.test.ts.
 */

// Deepest zoom the server indexes pins at. The client clamps its subscription
// zoom to this; above it, tiles are tiny (a handful of pins) so a slightly
// larger tile is fine. Bounds per-event write amplification (one tile set per
// zoom 0..MAX) — 15 levels.
export const MAX_TILE_ZOOM = 14

// Default zoom split between regimes: at map zoom < this the client asks for
// per-tile COUNTS (bubbles snapped to a real pin); at or above it, individual
// PINS. z4 ≈ regional zoom, so pins appear once you're looking at a region and
// bubbles remain only for the continental/global overview. Tunable; the server
// serves whichever mode the client requests per tile, so this is a client-only
// default. Raise it as live-stream density grows (counts are the scale-saver
// only when a tile would otherwise hold many pins).
export const PIN_ZOOM_THRESHOLD = 4

// Floor on the tile zoom used in COUNT mode. Below this the client still counts,
// but always at z >= COUNT_MIN_ZOOM tiles — never the giant z0–z3 tiles whose
// centroid lands in open ocean when a cluster straddles it (e.g. US-east +
// Europe averaging into the North Atlantic). At z5 (~11°) clusters on opposite
// shores fall into separate tiles, so each bubble sits over land. Client-side
// knob — ~z5 is the practical max as a global floor (z6 = 4096 tiles globally).
export const COUNT_MIN_ZOOM = 5

export type Tile = { z: number; x: number; y: number }
export type LngLatBounds = { west: number; south: number; east: number; north: number }

const clampZoom = (z: number) => Math.max(0, Math.min(MAX_TILE_ZOOM, Math.floor(z)))

/** Web Mercator (EPSG:3857) tile containing (lng, lat) at integer zoom z. */
export function lngLatToTile(lng: number, lat: number, z: number): Tile {
  const zz = clampZoom(z)
  const n = 2 ** zz
  const clampLat = Math.max(-85.05112878, Math.min(85.05112878, lat))
  const latRad = (clampLat * Math.PI) / 180
  let x = Math.floor(((lng + 180) / 360) * n)
  let y = Math.floor(((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n)
  const clampXY = (v: number) => Math.max(0, Math.min(n - 1, v))
  x = clampXY(x)
  y = clampXY(y)
  return { z: zz, x, y }
}

export function tileKey(z: number, x: number, y: number): string {
  return `${z}/${x}/${y}`
}

export function parseTileKey(key: string): Tile {
  const parts = key.split('/')
  return { z: Number(parts[0]), x: Number(parts[1]), y: Number(parts[2]) }
}

/**
 * The tile key containing (lng, lat) at every zoom 0..maxZ. This is the pin's
 * "tile path" — the server maintains the pin in each of these tile sets, and
 * routes an event to a subscriber by looking up the path entry at the
 * subscriber's zoom. Pure math, no Redis.
 */
export function tilePath(lng: number, lat: number, maxZ = MAX_TILE_ZOOM): Record<number, string> {
  const out: Record<number, string> = {}
  const top = clampZoom(maxZ)
  for (let z = 0; z <= top; z++) {
    const t = lngLatToTile(lng, lat, z)
    out[z] = tileKey(z, t.x, t.y)
  }
  return out
}

/** Geographic center of a tile — where the client draws a count bubble. */
export function tileCenter(z: number, x: number, y: number): { lng: number; lat: number } {
  const n = 2 ** z
  const lng = ((x + 0.5) / n) * 360 - 180
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 0.5)) / n)))
  return { lng, lat: (latRad * 180) / Math.PI }
}

/**
 * Geographic bounds of a tile. The client fits these on a count-bubble click so
 * every pin in the tile frames on screen (rather than easing to a fixed zoom on
 * the centroid, which overshoots a wide tile and pushes pins off the edge).
 */
export function tileBounds(z: number, x: number, y: number): LngLatBounds {
  const n = 2 ** z
  const lngAt = (xx: number) => (xx / n) * 360 - 180
  const latAt = (yy: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * yy) / n))) * 180) / Math.PI
  return { west: lngAt(x), east: lngAt(x + 1), north: latAt(y), south: latAt(y + 1) }
}

/**
 * All tile keys covering a lng/lat bounding box at zoom z (client-side: which
 * tiles the current viewport needs). Handles the simple (non-antimeridian)
 * case; a viewport crossing the antimeridian (east < west) is split into two
 * spans. Capped to avoid a pathological request at very low zoom.
 */
export function tilesForBounds(b: LngLatBounds, z: number, cap = 1200): string[] {
  const zz = clampZoom(z)
  const n = 2 ** zz
  const spans: Array<[number, number]> =
    b.east < b.west
      ? [
          [b.west, 180],
          [-180, b.east],
        ]
      : [[b.west, b.east]]
  const keys: string[] = []
  const yTop = lngLatToTile(0, b.north, zz).y
  const yBot = lngLatToTile(0, b.south, zz).y
  const yMin = Math.min(yTop, yBot)
  const yMax = Math.max(yTop, yBot)
  for (const [w, e] of spans) {
    const xMin = lngLatToTile(w, 0, zz).x
    const xMax = lngLatToTile(e, 0, zz).x
    for (let x = xMin; x <= xMax && x < n; x++) {
      for (let y = yMin; y <= yMax && y < n; y++) {
        keys.push(tileKey(zz, x, y))
        if (keys.length >= cap) return keys
      }
    }
  }
  return keys
}
