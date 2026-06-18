// src/lib/planets/island.ts
//
// "Haven" — the synthetic island planet for private-location streams.
//
// A creator who broadcasts with PRIVATE location (locationPrecision = 'off')
// reveals no real-world position, so they can't live on Earth. Haven is their
// discovery surface: a planet that is 99% water with a single island. Every
// private stream lands at a STABLE random spot on that island (seeded by its
// id, so it never jumps between socket updates), giving private creators a
// home without leaking where they actually are.
//
// Everything here is in-code and version-controlled (no Mapbox Studio / external
// account): the island is one GeoJSON polygon, and the planet's surface is a
// minimal Mapbox GL `styleJSON` — a water `background` layer + the island `fill`.
// Rendered with `projection="globe"`, the background paints the planet sphere.
//
// Extending to more land later = add polygons to ISLAND_GEOJSON (e.g.
// subject-matter "continents") and map a stream → region in placePin.

// Island colours — the SAME monochrome treatment as Earth's Mapbox Light style:
// light cool-grey water, near-white cream land, soft grey shoreline. Keeps Haven
// reading as the same kind of map as Earth (just 99% water + one island), and the
// day/night terminator darkens it the same way.
const WATER = '#d7dbde' // light grey sea (≈ Mapbox Light water)
const LAND = '#eeece5' // near-white cream land (≈ Mapbox Light land)
const COAST = '#b6bbbe' // soft grey shoreline

export const ISLAND_SURFACE_COLOR = WATER
export const ISLAND_LAND_COLOR = LAND

// Where the island sits on the globe + a sensible framing for the camera.
export const ISLAND_CENTER: [number, number] = [0, 0]

// A single irregular island, centred on [0, 0]. Closed ring, [lng, lat] pairs.
// Hand-authored blob (~13° across) — organic enough to read as a real island
// at globe scale.
const ISLAND_RING: [number, number][] = [
  [6.5, 0.0],
  [5.2, 3.0],
  [3.0, 5.5],
  [0.5, 6.8],
  [-2.8, 5.0],
  [-5.5, 2.6],
  [-6.8, 0.2],
  [-4.8, -2.8],
  [-2.6, -5.2],
  [0.3, -6.5],
  [3.2, -4.8],
  [5.6, -2.6],
  [6.5, 0.0],
]

const ISLAND_GEOJSON = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates: [ISLAND_RING] },
    },
  ],
}

// Minimal Mapbox GL style — water sphere + island. `glyphs` points at Mapbox's
// font endpoint so the app's own SymbolLayers (cluster counts, pole markers) can
// render text on this synthetic style too. Stringified for the `styleJSON` prop.
export const ISLAND_STYLE_JSON = JSON.stringify({
  version: 8,
  name: 'Haven',
  glyphs: 'mapbox://fonts/mapbox/{fontstack}/{range}.pbf',
  sources: {
    island: { type: 'geojson', data: ISLAND_GEOJSON },
  },
  layers: [
    { id: 'water', type: 'background', paint: { 'background-color': WATER } },
    { id: 'island-fill', type: 'fill', source: 'island', paint: { 'fill-color': LAND } },
    {
      id: 'island-coast',
      type: 'line',
      source: 'island',
      paint: { 'line-color': COAST, 'line-width': 1.5 },
    },
  ],
})

// ── Deterministic random placement inside the island ──────────────────────────

const BBOX = ISLAND_RING.reduce(
  (b, [lng, lat]) => ({
    minLng: Math.min(b.minLng, lng),
    maxLng: Math.max(b.maxLng, lng),
    minLat: Math.min(b.minLat, lat),
    maxLat: Math.max(b.maxLat, lat),
  }),
  { minLng: Infinity, maxLng: -Infinity, minLat: Infinity, maxLat: -Infinity },
)

// FNV-1a → 32-bit unsigned. Stable across platforms (no Math.random).
function hashSeed(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

// mulberry32 — small deterministic PRNG. Same seed → same sequence.
function mulberry32(a: number): () => number {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Ray-casting point-in-polygon against the island ring.
function pointInRing(lng: number, lat: number, ring: [number, number][]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]
    const b = ring[j]
    if (!a || !b) continue
    const [xi, yi] = a
    const [xj, yj] = b
    const intersects =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi || 1e-12) + xi
    if (intersects) inside = !inside
  }
  return inside
}

// A stable [lng, lat] inside the island for a given seed (a stream id). Rejection
// samples the bbox with a seeded PRNG so the same stream always lands on the same
// spot; falls back to the island centre if sampling is unlucky.
export function randomPointOnIsland(seed: string): [number, number] {
  const rng = mulberry32(hashSeed(seed))
  for (let i = 0; i < 60; i++) {
    const lng = BBOX.minLng + rng() * (BBOX.maxLng - BBOX.minLng)
    const lat = BBOX.minLat + rng() * (BBOX.maxLat - BBOX.minLat)
    if (pointInRing(lng, lat, ISLAND_RING)) return [lng, lat]
  }
  return ISLAND_CENTER
}
