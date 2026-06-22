// src/lib/planets/index.ts
//
// Planet registry — the extension point for WRLD's multi-planet globe.
//
// A "planet" is data, not a code path. The globe screen reads everything it
// needs from a Planet config: how to render the sphere (a Mapbox styleURL or a
// synthetic styleJSON), which streams live there, where each stream's pin goes,
// and how to frame the camera. Adding a planet = adding one object to PLANETS;
// the switcher, the glide transition, and the pin layers all pick it up with no
// per-planet branching in the screen.
//
//   • Earth — the real world. Every located stream (exact / city / country).
//   • Haven — the private island. Streams broadcasting with PRIVATE location
//             ('off'), placed at a stable random spot on the island so they're
//             discoverable without revealing where they are.
//
// Later planets drop in here: subject-matter "continents" (more polygons in a
// synthetic style + a placePin that maps a stream's category to a region), a
// Venus for adult content, a system-level view, etc.

import Mapbox from '@rnmapbox/maps'
import type { Stream } from '@/types'
import {
  ISLAND_CENTER,
  ISLAND_SURFACE_COLOR,
  ISLAND_STYLE_JSON,
  randomPointOnIsland,
} from './island'

export type PlanetId = 'earth' | 'haven'

export type Planet = {
  id: PlanetId
  /** Display name in the switcher. */
  name: string
  /** Feather glyph name for the switcher chip. */
  glyph: string
  /** Mapbox hosted style (Earth). Exactly one of styleURL / styleJSON is set. */
  styleURL?: string
  /** Synthetic in-code GL style (Haven). */
  styleJSON?: string
  /** Dominant sphere colour — used by the glide placeholder so the incoming
   *  planet reads as itself before the real Mapbox style finishes loading. */
  surfaceColor: string
  /** Camera framing when this planet becomes active. */
  initialCamera: { centerCoordinate: [number, number]; zoomLevel: number }
  /** Which discovery streams render on this planet. */
  belongsTo: (s: Stream) => boolean
  /** Where a stream's pin sits on this planet, as [lng, lat]. */
  placePin: (s: Stream) => [number, number]
}

const isPrivate = (s: Stream) => (s.locationPrecision ?? 'exact') === 'off'

const earth: Planet = {
  id: 'earth',
  name: 'Earth',
  glyph: 'globe',
  styleURL: Mapbox.StyleURL.Light,
  surfaceColor: '#e7e4dc',
  // Rests at the zoom floor, which must be the "globe fills the MapView viewport"
  // zoom — below it Mapbox rubber-bands the spin (see GLOBE_MIN_ZOOM). Keep in sync
  // with GLOBE_MIN_ZOOM; framing/size is GLOBE_FIT_SCALE's job, not this zoom.
  initialCamera: { centerCoordinate: [0, 20], zoomLevel: 2.0 },
  belongsTo: (s) => !isPrivate(s),
  placePin: (s) => [s.lng as number, s.lat as number],
}

const haven: Planet = {
  id: 'haven',
  name: 'Haven',
  glyph: 'shield', // privacy / refuge
  styleJSON: ISLAND_STYLE_JSON,
  surfaceColor: ISLAND_SURFACE_COLOR,
  // Same fill-the-viewport resting zoom as Earth (keep in sync with GLOBE_MIN_ZOOM).
  initialCamera: { centerCoordinate: ISLAND_CENTER, zoomLevel: 2.0 },
  belongsTo: isPrivate,
  placePin: (s) => randomPointOnIsland(s.id),
}

export const PLANETS: Planet[] = [earth, haven]

export function planetById(id: PlanetId): Planet {
  return PLANETS.find((p) => p.id === id) ?? earth
}

export function planetIndex(id: PlanetId): number {
  return Math.max(0, PLANETS.findIndex((p) => p.id === id))
}
