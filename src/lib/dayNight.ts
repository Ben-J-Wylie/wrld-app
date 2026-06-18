// src/lib/dayNight.ts
//
// Day/night terminator for the Earth globe. Given an instant, computes the
// subsolar point (where the sun is directly overhead) and returns GeoJSON
// polygons covering the region where the sun is below a given altitude — i.e.
// night, and the twilight bands just inside it. Stacking a few bands at low
// opacity (terminator → civil → nautical → astronomical) gives a SOFT,
// graded frontier instead of a hard line.
//
// Pure functions of a Date, so they're automatically correct for time-machine
// scrubbing: feed `Date.now() - timeOffsetMs` and the frontier tracks the
// playhead. Astronomy is a standard low-precision solar-position approximation
// (good to a fraction of a degree — far finer than the frontier needs).

const RAD = Math.PI / 180

type LngLat = [number, number]

// Mapbox fill layers can't blur or gradient, so a SOFT terminator is approximated
// by many thin bands: each is "sun below `alt`°" drawn at a low opacity. The bands
// span a window straddling the terminator (+TOP° into the day → BOTTOM° into the
// night); stacked, the alpha accumulates toward the dark side and feathers the day
// edge, so the soft transition is centred on the day/night line. More bands →
// smoother gradient (at a little more render cost). Tune range/count/opacity.
const NIGHT_BAND_COUNT = 10
const NIGHT_TOP_ALT = 2 // degrees into the day side
const NIGHT_BOTTOM_ALT = -2 // degrees into the night side
export const NIGHT_BANDS: { alt: number; opacity: number }[] = Array.from(
  { length: NIGHT_BAND_COUNT },
  (_, i) => ({
    alt: NIGHT_TOP_ALT + (NIGHT_BOTTOM_ALT - NIGHT_TOP_ALT) * (i / (NIGHT_BAND_COUNT - 1)),
    opacity: 0.022, // reduced two-thirds from the original 0.05
  }),
)

// Subsolar point: { lat = solar declination, lng = where it's solar noon }.
function subsolarPoint(date: Date): { lat: number; lng: number } {
  const julian = date.getTime() / 86_400_000 + 2440587.5
  const n = julian - 2451545.0
  const L = (280.46 + 0.9856474 * n) % 360 // mean longitude (deg)
  const g = ((357.528 + 0.9856003 * n) % 360) * RAD // mean anomaly
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD // ecliptic longitude
  const epsilon = 23.439 * RAD // obliquity of the ecliptic
  const declination = Math.asin(Math.sin(epsilon) * Math.sin(lambda)) / RAD
  const gmst = (280.46061837 + 360.98564736629 * n) % 360 // Greenwich mean sidereal time (deg)
  const alpha = Math.atan2(Math.cos(epsilon) * Math.sin(lambda), Math.cos(lambda)) / RAD // right ascension
  const lng = (((alpha - gmst) % 360) + 540) % 360 - 180 // wrap to [-180, 180]
  return { lat: declination, lng }
}

// Boundary latitude (deg) where the sun's altitude equals `altDeg`, at a given
// hour angle (Δlng from the subsolar meridian). Solves
//   sin(alt) = sinφ·sinδ + cosφ·cosδ·cos(H)   for φ.
function boundaryLat(hRad: number, decRad: number, altRad: number): number {
  const A = Math.sin(decRad)
  const B = Math.cos(decRad) * Math.cos(hRad)
  const R = Math.hypot(A, B)
  const s = Math.max(-1, Math.min(1, Math.sin(altRad) / R))
  const phi0 = Math.atan2(B, A)
  return (Math.asin(s) - phi0) / RAD
}

// Polygon of the region where the sun is below `altitudeDeg`, given a subsolar
// point. The band's boundary great circle, sampled per-longitude, closed around
// whichever pole is currently dark.
function nightPolygonFrom(sun: { lat: number; lng: number }, altitudeDeg: number) {
  // Near an equinox sin(declination) → 0; clamp so the boundary stays finite.
  let dec = sun.lat
  if (Math.abs(dec) < 0.5) dec = dec >= 0 ? 0.5 : -0.5
  const decRad = dec * RAD
  const altRad = altitudeDeg * RAD

  const ring: LngLat[] = []
  for (let lng = -180; lng <= 180; lng += 2) {
    const h = (lng - sun.lng) * RAD
    ring.push([lng, boundaryLat(h, decRad, altRad)])
  }
  // Sun in the north → the south pole is dark, and vice versa. Close the ring
  // around the dark pole so the fill covers the night cap.
  const nightPole = dec >= 0 ? -90 : 90
  ring.push([180, nightPole])
  ring.push([-180, nightPole])
  const start = ring[0]
  if (start) ring.push(start)

  return {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        properties: {},
        geometry: { type: 'Polygon' as const, coordinates: [ring] },
      },
    ],
  }
}

// Real geographic terminator (Earth) — true subsolar point for the instant.
export function nightPolygon(date: Date, altitudeDeg = 0) {
  return nightPolygonFrom(subsolarPoint(date), altitudeDeg)
}

// Viewer-LOCAL terminator (synthetic planets, e.g. Haven). Keeps the real seasonal
// tilt (declination — date-only, same for everyone) but places the sun's longitude
// so the planet's anchor meridian reads the VIEWER's local clock time. The result
// differs per viewer's timezone, so it shows local day/night without revealing
// anything about the broadcaster's real location.
//   local solar time at λ = 12 + (λ − λs)/15  ⇒  λs = anchorLng + 15·(12 − T)
export function nightPolygonLocal(date: Date, anchorLng: number, altitudeDeg = 0) {
  const { lat } = subsolarPoint(date)
  const localHours = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600
  let lng = anchorLng + 15 * (12 - localHours)
  lng = ((lng + 540) % 360) - 180 // wrap to [-180, 180]
  return nightPolygonFrom({ lat, lng }, altitudeDeg)
}
