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
// by many thin bands: each is "sun below `alt`°" drawn at a low opacity, stacked so
// the alpha accumulates toward the dark core and feathers at the terminator. The
// altitudes are kept just on the NIGHT side (all < 0) on purpose: each band is then
// a sub-hemisphere cap around the anti-solar point, which renders cleanly. A
// lit-side band (alt > 0) would be a >hemisphere cap whose triangulation produces
// stray wedges on the globe. Tune range/count/opacity.
const NIGHT_BAND_COUNT = 10
const NIGHT_TOP_ALT = -0.4 // just inside the terminator (night side)
const NIGHT_BOTTOM_ALT = -4.4 // deepest band of the soft edge
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

// A small-circle ring of angular radius `radiusDeg` around a centre point, sampled
// by azimuth. Longitudes are kept continuous (no ±180 jump) so the polygon never
// has an antimeridian seam. Used as a clean spherical-cap boundary.
function capRing(centerLat: number, centerLng: number, radiusDeg: number): LngLat[] {
  const latC = centerLat * RAD
  const R = radiusDeg * RAD
  const sinLatC = Math.sin(latC)
  const cosLatC = Math.cos(latC)
  const sinR = Math.sin(R)
  const cosR = Math.cos(R)
  const ring: LngLat[] = []
  let prevLng: number | null = null
  for (let az = 0; az <= 360; az += 3) {
    const th = az * RAD
    const lat2 = Math.asin(sinLatC * cosR + cosLatC * sinR * Math.cos(th))
    let lng =
      centerLng +
      Math.atan2(Math.sin(th) * sinR * cosLatC, cosR - sinLatC * Math.sin(lat2)) / RAD
    if (prevLng != null) {
      while (lng - prevLng > 180) lng -= 360
      while (lng - prevLng < -180) lng += 360
    }
    prevLng = lng
    ring.push([lng, lat2 / RAD])
  }
  return ring
}

// Polygon of the region where the sun is below `altitudeDeg`. The night region is a
// spherical cap centred on the ANTI-SOLAR point with angular radius (90 + alt)°. We
// keep alt < 0 (caller's bands are night-side), so the radius is < 90° → a clean
// sub-hemisphere cap with an unambiguous fill, no pole pinch and no antimeridian
// seam (the failure modes of the old per-longitude great-circle polygon).
function nightPolygonFrom(sun: { lat: number; lng: number }, altitudeDeg: number) {
  let dec = sun.lat
  if (Math.abs(dec) < 0.5) dec = dec >= 0 ? 0.5 : -0.5
  const antiLat = -dec // anti-solar point — centre of the night hemisphere
  const antiLng = ((sun.lng + 180 + 540) % 360) - 180
  const radius = Math.min(89.6, 90 + altitudeDeg) // clamp sub-hemisphere for safety
  const ring = capRing(antiLat, antiLng, radius)
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
