// src/components/screens/GlobeScreenMapbox.tsx
//
// Full-Mapbox globe replacement for GlobeScreen.
// Uses projection="globe" so the MapView covers the full experience
// from outer-space overview to street-level detail with no seam.
//
// Phase 14a layout (mock: docs/design/mocks/Globe Mobile.html):
//   • Header — BrandMark + WRLD + LIVE count Pill (unchanged)
//   • SearchBar — pill input, matches stream titles for v0.2.
//     Place + people search wired in a follow-up.
//   • CategoryChipRow — 5 chips: all / city / country / camera-only /
//     audio-only. Camera + audio filter on `Stream.sources`. City +
//     country are STUBBED today (no reverse-geocode wired); selecting
//     them shows an empty result. Wire in a follow-up.
//   • ScaleBar — distance scale on top-left, reads live from camera.
//   • MapView — Mapbox satellite-streets globe (unchanged engine).
//   • DiscoveryHandoffCard — appears on pin tap (single + cluster),
//     independent of the drawer.
//   • Bottom drawer — always visible. Peek = horizontal scroll of
//     StreamCard.trending; "See all" expands to a vertical list of
//     StreamCard.compact. Independent of pin taps. The drawer chrome
//     lives inline here per the DESIGN.md Section 0.5 reuse rule
//     (extract on second proven case).
//
// Revert: change the one-line import in app/(app)/globe.tsx back to
// GlobeScreen. This file and GlobeScreen.tsx / EarthScene.tsx are
// entirely independent.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  AppState,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import Mapbox, {
  Camera,
  ShapeSource,
  CircleLayer,
  SymbolLayer,
  LineLayer,
  FillLayer,
  Atmosphere,
} from '@rnmapbox/maps'
import { consumeStreamSignal } from '@/lib/streamSignals'
import { returnToActiveBroadcast } from '@/lib/activeBroadcast'
import { streamsApi } from '@/api/streams'
import { theme } from '@/tokens/theme'
import { useAuthStore } from '@/stores/authStore'
import { useLocation } from '@/hooks/useLocation'
import { useViewportDiscovery, type TileCount } from '@/hooks/useViewportDiscovery'
import { useHistoricalClips } from '@/hooks/useHistoricalClips'
import { useHistoricalAvailability } from '@/hooks/useHistoricalAvailability'
import type { Interval } from '@/api/clips'
import type { ClipPin, BufferPin } from '@/api/clips'
import { useStreamsNear } from '@/hooks/useStreamsNear'
import { useDiscoverySocket } from '@/hooks/useDiscoverySocket'
import { usePublicConfig, configNumber, configBool } from '@/hooks/usePublicConfig'
import { PIN_ZOOM_THRESHOLD, COUNT_MIN_ZOOM } from '@/lib/tiles'
import { Text } from '@/components/primitives/Text'
import { Pill } from '@/components/primitives/Pill'
import { ScreenHeader } from '@/components/sections/ScreenHeader'
import { StreamStateBanner } from '@/components/features/stream/StreamStateBanner'
import {
  TimeScrubber,
  CLOCK_COLLAPSED_H,
  CLOCK_EXPANDED_H,
} from '@/components/features/discovery/TimeScrubber'
import { StreamCard } from '@/components/features/stream/StreamCard'
import {
  DiscoveryHandoffCard,
  type DiscoveryStream,
} from '@/components/features/stream/DiscoveryHandoffCard'
import { SearchBar } from '@/components/features/discovery/SearchBar'
import { ScaleBar } from '@/components/features/discovery/ScaleBar'
import { PlanetSwitcher } from '@/components/features/discovery/PlanetSwitcher'
import { CategoryChipRow, type Category } from '@/components/sections/CategoryChipRow'
import { PLANETS, planetById, planetIndex, type PlanetId } from '@/lib/planets'
import type { Stream } from '@/types'

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '')

const PIN_RED = '#FF3B5C'
const PIN_PURPLE = '#A855F7'
const PIN_BLACK = '#111111' // the viewer's own stream pin (tap → return to it)
const PIN_BORDER = '#FFFFFF'

// Globe zoom FLOOR — the furthest you can pinch out. CRITICAL: this must keep the
// globe at least filling its MapView viewport (globeBox = 1.4× screen). Below the
// "globe fills the viewport" zoom, Mapbox's globe projection treats a drag as
// panning past the world bounds and elastically SNAPS IT BACK — that's the
// "spin hits a wall and bounces back" you only see when there's space between the
// globe edge and the screen edge (i.e. zoomed out; it's gone once zoomed in). So
// the floor is the fill-zoom, NOT a low framing zoom — framing is GLOBE_FIT_SCALE's
// job (an RN shrink that never reintroduces the bounce). Both are admin-tunable
// (RemoteConfig); these consts are the offline fallbacks. NOTE: at this 1.5 floor the
// globe doesn't fully fill its viewport on Android, so a fast swipe can still hit the
// Mapbox rubber-band — raise GLOBE_MIN_ZOOM (here or live in /admin/config) until the
// space/bounce is gone, then use GLOBE_FIT_SCALE for on-screen size.
const GLOBE_MIN_ZOOM = 1.5

// Idle globe auto-rotation: spin as a signature intro, then ease to a stop so
// Mapbox stops re-rendering (continuous setCamera at 12.5fps was the dominant
// battery cost when browsing). Re-armed on interaction / focus / foreground.
const SPIN_WINDOW_MS = 12_000 // how long each spin window lasts before resting
const SPIN_EASE_MS = 2_500 // taper the angular speed to zero over the tail
const SPIN_STEP_DEG = 0.15 // per-tick longitude advance at full speed

// Shortest angular distance between two longitudes (degrees, 0..180), wrapping the
// ±180 seam. Used to tell the auto-rotate tick's own camera writes from user moves.
function angularDistDeg(a: number, b: number) {
  const d = Math.abs(((a - b + 540) % 360) - 180)
  return d
}

// Globe fit-scale — a visual shrink of the rendered globe, independent of the zoom,
// so the planet can sit smaller / more framed than the zoom floor alone allows. Full
// shrink (GLOBE_FIT_SCALE) at the floor, relaxing to 1.0 by GLOBE_FIT_FULL_ZOOM so
// pinched-in (street) detail still fills the screen. 1.0 = no shrink. (Scales the
// native MapView — verify on Android.)
const GLOBE_FIT_SCALE = 0.65
const GLOBE_FIT_FULL_ZOOM = 3.0

// Graticule — thin reference lines on the globe: the equator, the two tropics, and
// the Arctic / Antarctic circles. Static, on every planet, drawn under the pins.
// Densely sampled so the rings stay smooth on the globe projection.
const GRATICULE_COLOR = '#1a1612'
const TROPIC_LAT = 23.4366 // obliquity of the ecliptic — Tropics of Cancer / Capricorn
const POLAR_LAT = 90 - TROPIC_LAT // 66.5634° — Arctic / Antarctic circles

const latRing = (lat: number): [number, number][] => {
  const pts: [number, number][] = []
  for (let lng = -180; lng <= 180; lng += 4) pts.push([lng, lat])
  return pts
}
const GRATICULE_GEOJSON = {
  type: 'FeatureCollection' as const,
  features: [
    {
      type: 'Feature' as const,
      properties: { kind: 'equator' },
      geometry: { type: 'LineString' as const, coordinates: latRing(0) },
    },
    {
      type: 'Feature' as const,
      properties: { kind: 'tropic' },
      geometry: { type: 'LineString' as const, coordinates: latRing(TROPIC_LAT) },
    },
    {
      type: 'Feature' as const,
      properties: { kind: 'tropic' },
      geometry: { type: 'LineString' as const, coordinates: latRing(-TROPIC_LAT) },
    },
    {
      type: 'Feature' as const,
      properties: { kind: 'polar' },
      geometry: { type: 'LineString' as const, coordinates: latRing(POLAR_LAT) },
    },
    {
      type: 'Feature' as const,
      properties: { kind: 'polar' },
      geometry: { type: 'LineString' as const, coordinates: latRing(-POLAR_LAT) },
    },
  ],
}

// Day/night terminator (Option A) — a SOFT dusk LINE on the great circle 90° from the
// subsolar point. Built as a parametric ring around the circle's pole (the subsolar
// point), NOT latitude-as-a-function-of-longitude, so it's well-defined for every sun
// position — no equinox degeneracy, no pole bald-spot, no wrong-hemisphere fill. Split
// at the antimeridian so no seam line spans the globe. Driven by the WRLD clock.
const TERMINATOR_COLOR = '#3a3a5c'

const subsolarPoint = (date: Date): { lat: number; lng: number } => {
  // Day of year (UTC)
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 0)
  const dayOfYear =
    (Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - yearStart) / 86400000
  // Solar declination (deg) — obliquity approximation, good enough for a visual line.
  const decl = -23.44 * Math.cos(((2 * Math.PI) / 365) * (dayOfYear + 10))
  // Subsolar longitude from UTC time (equation-of-time ignored, <4° error): the sun is
  // over lng 0 at UTC noon and sweeps −15°/hour.
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600
  const lng = -15 * (utcHours - 12)
  return { lat: decl, lng: ((lng + 540) % 360) - 180 }
}

const terminatorGeoJSON = (date: Date) => {
  const { lat, lng } = subsolarPoint(date)
  const phi = (lat * Math.PI) / 180
  const lam = (lng * Math.PI) / 180
  // Subsolar unit vector (nx,ny,nz) = the terminator great-circle's pole.
  const nx = Math.cos(phi) * Math.cos(lam)
  const ny = Math.cos(phi) * Math.sin(lam)
  const nz = Math.sin(phi)
  // Orthonormal basis perpendicular to n. Reference = north pole (0,0,1); the subsolar
  // point stays within the tropics so it's never near a pole — always safe.
  const dn = nz // ref·n with ref = (0,0,1)
  let ex = -dn * nx
  let ey = -dn * ny
  let ez = 1 - dn * nz
  const eLen = Math.hypot(ex, ey, ez)
  ex /= eLen
  ey /= eLen
  ez /= eLen
  // f = n × e (completes the right-handed basis on the great circle's plane)
  const fx = ny * ez - nz * ey
  const fy = nz * ex - nx * ez
  const fz = nx * ey - ny * ex
  // Sweep the ring 90° from the sun. FINE step (0.5°) so chords stay short — a coarse
  // step lets the near-cusp chords span a wide longitude and bulge over the pole cap
  // (the semicircle artifact). 720 points, recomputed only on the 30s tick — cheap.
  const pts: [number, number][] = []
  for (let deg = 0; deg <= 360; deg += 0.5) {
    const t = (deg * Math.PI) / 180
    const c = Math.cos(t)
    const s = Math.sin(t)
    const x = c * ex + s * fx
    const y = c * ey + s * fy
    const z = c * ez + s * fz
    pts.push([(Math.atan2(y, x) * 180) / Math.PI, (Math.asin(z) * 180) / Math.PI])
  }
  // Build arcs. DROP everything within POLE_CLIP of the pole. The bad zone is STRUCTURAL
  // to Mapbox's globe: Web Mercator tiles stop at ±85.0511° (the projection diverges at
  // the poles), and above that Mapbox fills a degenerate "pole cap" fan that mangles any
  // geometry drawn in it. So we clip just inside the tile-backed zone — 85° is the
  // smallest CLEAN cap possible (can't go tighter without entering the degenerate cap).
  // It only bites near equinox anyway (terminator max lat = 90 − |declination|). At the
  // antimeridian, stitch both arcs to exactly ±180 at the crossing latitude (no seam).
  const POLE_CLIP = 85
  const segments: [number, number][][] = []
  let seg: [number, number][] = []
  let prev: [number, number] | null = null
  const flush = () => {
    if (seg.length > 1) segments.push(seg)
    seg = []
  }
  for (const p of pts) {
    if (Math.abs(p[1]) >= POLE_CLIP) {
      flush()
      prev = null
      continue
    }
    if (prev) {
      const dl = p[0] - prev[0]
      if (Math.abs(dl) > 180) {
        const curUnwrapped = p[0] + (dl > 0 ? -360 : 360)
        const edge = prev[0] < 0 ? -180 : 180
        const frac = (edge - prev[0]) / (curUnwrapped - prev[0])
        const latEdge = prev[1] + frac * (p[1] - prev[1])
        seg.push([edge, latEdge])
        flush()
        seg.push([-edge, latEdge])
      }
    }
    seg.push(p)
    prev = p
  }
  flush()
  return {
    type: 'FeatureCollection' as const,
    features: segments
      .filter((coords) => coords.length > 1)
      .map((coords) => ({
        type: 'Feature' as const,
        properties: {},
        geometry: { type: 'LineString' as const, coordinates: coords },
      })),
  }
}

// Night-side shading — the hemisphere facing away from the sun, as a translucent fill.
// The terminator is single-valued in longitude (termLat = atan(−cos Δlng / tan δ)), so
// the night region is a simple longitude sweep closed to the WINTER pole (the pole the
// night cap always contains). The fill covers that pole's degenerate >85° cap, but as a
// UNIFORM wash it HIDES the geometry the line couldn't cross. The terminator edge is
// clamped to ±85 so the visible day/night boundary stays in the clean tile-backed zone;
// the pole closure runs to ±90 so the winter cap fills dark.
const NIGHT_COLOR = '#10162e'
const NIGHT_CLAMP = 85

const nightGeoJSON = (date: Date) => {
  const { lat: decl, lng: lngSun } = subsolarPoint(date)
  let tanDecl = Math.tan((decl * Math.PI) / 180)
  if (Math.abs(tanDecl) < 1e-6) tanDecl = tanDecl < 0 ? -1e-6 : 1e-6
  // Winter pole = opposite the sun's hemisphere; always inside the night cap.
  const winterPole = decl >= 0 ? -90 : 90
  const ring: [number, number][] = []
  let firstLat = 0
  for (let lng = -180; lng <= 180; lng += 1) {
    const dl = ((lng - lngSun) * Math.PI) / 180
    let termLat = (Math.atan(-Math.cos(dl) / tanDecl) * 180) / Math.PI
    if (termLat > NIGHT_CLAMP) termLat = NIGHT_CLAMP
    else if (termLat < -NIGHT_CLAMP) termLat = -NIGHT_CLAMP
    if (lng === -180) firstLat = termLat
    ring.push([lng, termLat])
  }
  // Close around the winter pole (fills its cap — hidden under the uniform wash).
  ring.push([180, winterPole])
  ring.push([-180, winterPole])
  ring.push([-180, firstLat])
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

// Planet-swap motion (ms). Driven entirely by NATIVE transforms on the globe
// layer (translateX slide + scale zoom) — NOT the Mapbox camera, which stutters
// when animated under load. The globe slides off one side shrinking, the new
// planet slides in from the other growing back. Direction = registry order.
const TX_EXIT_MS = 460
const TX_ENTER_MS = 560
const TX_EXIT_SCALE = 0.45 // how far the globe shrinks as it flies off
const TX_STYLE_FALLBACK_MS = 1400 // enter even if the style-load event is missed

// Drawer has three states:
//   closed   — only the grip visible above the tab bar (default at app
//              launch and whenever no search/filter is active). Tap the
//              grip to open, swipe up to peek.
//   peek     — grip + header + horizontal scroll of StreamCard.trending.
//              Auto-opened when a search query or non-"All" chip activates.
//              Height sized so the full trending card renders without
//              cropping above the tab bar.
//   expanded — grip + header + vertical list of StreamCard.compact, from
//              just below the top stack down to the tab bar.
//
// Heights are absolute (not relative to window) — we measure the
// Tabs.Screen content area via onLayout because Dimensions.get('window')
// includes the tab bar and gives wrong numbers for `bottom: 0`-anchored
// math. The drawer is positioned `bottom: 0` (i.e. just above the tab
// bar) and we animate its height.
const DRAWER_CLOSED_H = 44 // grip + breathing room above the tab bar
const DRAWER_PEEK_H = 220 // header + StreamCard.trending (144) + rail padding
const DRAWER_EXPANDED_TOP_OFFSET = 190 // top stack + chrome reserved above the expanded sheet
const TAP_DRAG_TOLERANCE = 10 // |dy| under this is a tap, not a drag
const COMMIT_DRAG_DISTANCE = 60 // px past TAP_DRAG_TOLERANCE before a drag commits

// Vertical placement of the rendered globe sphere on screen.
//
// We do NOT use Mapbox Camera padding for this — `padding` shifts the
// geographic centerCoordinate's projected point within the viewport,
// which moves a flat-map view but leaves the globe SPHERE at viewport
// centre in `projection="globe"` mode.
//
// Instead the whole MapView is translated down with translateY. The
// sphere keeps its rendered size; only its on-screen position moves.
// translateY = containerH * (FRAC - 0.5) lands the sphere centre at
// FRAC of the container's height from the top.
//
// The sphere shifts down a few percent when the drawer opens, so the
// drawer doesn't crowd it. peek and expanded share the same fraction
// — the globe stays put while the drawer slides between them.
const GLOBE_FRAC_CLOSED = 0.59
const GLOBE_FRAC_OPEN = 0.48
// The clock also pushes the planet up when it expands (it grows from the bottom
// like the drawer). Its frac shift is proportional to its growth vs the
// drawer's — the same shift-per-pixel of bottom-UI growth — so the four
// (clock × drawer) collapsed/expanded states each land the planet at a distinct
// height. Added on top of the drawer's shift; both clamp.
const GLOBE_FRAC_CLOCK_SHIFT =
  (GLOBE_FRAC_CLOSED - GLOBE_FRAC_OPEN) *
  ((CLOCK_EXPANDED_H - CLOCK_COLLAPSED_H) / (DRAWER_PEEK_H - DRAWER_CLOSED_H))

type DrawerState = 'closed' | 'peek' | 'expanded'

function nextStateUp(s: DrawerState): DrawerState {
  return s === 'closed' ? 'peek' : 'expanded'
}
function nextStateDown(s: DrawerState): DrawerState {
  return s === 'expanded' ? 'peek' : 'closed'
}

// Top-stack scrim: paper100 fading to transparent over the header +
// search + chips + scale band, so the globe pattern doesn't fight the
// foreground UI when it's behind the controls. Matches the visual
// muting `bg.glass` gives the bottom drawer. paper100 values are
// expressed inline as rgba because LinearGradient needs colour strings
// with explicit alpha stops — same precedent as `bg.glass`.
const TOP_SCRIM_HEIGHT = 220
const TOP_SCRIM_TOP = 'rgba(236,230,214,1)'
const TOP_SCRIM_MID = 'rgba(236,230,214,0.85)'
const TOP_SCRIM_BOTTOM = 'rgba(236,230,214,0)'

const CATEGORIES: Category[] = [
  { id: 'all', label: 'All' },
  { id: 'city', label: 'My city' },
  { id: 'country', label: 'My country' },
  { id: 'camera', label: 'Camera only' },
  { id: 'audio', label: 'Audio only' },
]

type BannerData =
  | { kind: 'disconnected'; broadcasterHandle: string | null }
  | { kind: 'ended' }
  | { kind: 'kicked' }
  | { kind: 'cancelled' }
  | { kind: 'resumed'; stream: Stream; broadcasterHandle: string | null }

// Stable empty pin arrays — so an absent historical feed doesn't hand a fresh `[]`
// each render into the memo chain (which would defeat the referential-stability the
// card-sync effects rely on).
const EMPTY_CLIPS: ClipPin[] = []
const EMPTY_BUFFER: BufferPin[] = []

// Time Machine — map a surviving-clip pin into the Stream shape the globe's pin
// renderer + card already consume, so historical pins reuse the whole live path.
// Module-level + pure so the memoised `pins` stays referentially stable. Clips are
// recorded (isLive false, no room, no viewers); their clip-ness is recovered by
// `clipPinById.has(id)`, which drives the "Watch" CTA + replay caption.
function clipToStream(c: ClipPin): Stream {
  return {
    id: c.id,
    hostId: c.host.id,
    host: {
      id: c.host.id,
      handle: c.host.handle,
      displayName: c.host.displayName,
      avatarUrl: c.host.avatarUrl,
    },
    title: c.title ?? 'Clip',
    lat: c.lat,
    lng: c.lng,
    startedAt: new Date(c.clipStartMs).toISOString(),
    viewerCount: 0,
    isLive: false,
    sources: [],
    mediasoupRoomId: null,
    subscribersOnly: c.subscribersOnly,
    locationPrecision: c.locationPrecision,
  }
}

// PB1 — map a public/gated buffer session into the same Stream shape (so buffer pins
// reuse the pin renderer + card). A subscriber/ppv tier reads as `subscribersOnly` so
// the card shows the locked treatment; owner-private sessions never reach here.
function bufferPinToStream(b: BufferPin): Stream {
  return {
    id: b.sessionId,
    hostId: b.host.id,
    host: {
      id: b.host.id,
      handle: b.host.handle,
      displayName: b.host.displayName,
      avatarUrl: b.host.avatarUrl,
      subscriptionPriceUsd: b.subscriptionPriceUsd ?? null,
    },
    title: b.title ?? 'Buffer',
    lat: b.lat,
    lng: b.lng,
    startedAt: new Date(b.sessionStartMs).toISOString(),
    viewerCount: 0,
    isLive: false,
    sources: [],
    mediasoupRoomId: null,
    subscribersOnly: b.accessTier !== 'public',
    locationPrecision: b.locationPrecision,
  }
}

export function GlobeScreenMapbox() {
  const { coords } = useLocation()
  // ── Map pins: viewport tile-subscription feed (P2) ─────────────────────────
  // `streams` here = the pins in the current viewport (individual pins at high
  // zoom; empty at low zoom, where `counts` carries per-tile bubbles instead).
  // The admin-tunable zoom knobs come from RemoteConfig (fallback = tiles.ts).
  // If the backend's Redis flag is off, the hook falls back to the legacy global
  // snapshot (mode 'legacy' → all live streams as pins), so the map still works.
  //
  // TIME MACHINE SEAM (Aaron / backend): when `timeOffsetMs > 0` the user has
  // scrubbed into the past — swap this live viewport feed for a historical
  // "surviving clips at playhead" query. Until that lands, the globe shows the
  // live viewport feed regardless.
  const { config } = usePublicConfig()
  const pinZoomThreshold = configNumber(config, 'PIN_ZOOM_THRESHOLD', PIN_ZOOM_THRESHOLD)
  const countMinZoom = configNumber(config, 'COUNT_MIN_ZOOM', COUNT_MIN_ZOOM)
  // Globe sizing knobs (admin-tunable, "Globe rotation" group). globeMinZoom is the
  // resting/floor zoom — keep it at the "globe fills the viewport" value or Mapbox
  // rubber-bands the spin when zoomed out. globeFitScale is the on-screen size dial
  // (RN shrink of the already-full MapView; safe to lower with no bounce). Applied on
  // app relaunch (config is cached ~30s server-side + locally).
  const globeMinZoom = configNumber(config, 'GLOBE_MIN_ZOOM', GLOBE_MIN_ZOOM)
  const globeFitScale = configNumber(config, 'GLOBE_FIT_SCALE', GLOBE_FIT_SCALE)
  const {
    pins: streams,
    counts,
    setView,
  } = useViewportDiscovery({ pinZoomThreshold, countMinZoom })
  const setViewRef = useRef(setView)
  setViewRef.current = setView

  // ── Drawer / search / LIVE count: nearest streams via bounded REST ─────────
  // The viewport feed only knows what's on screen (and nothing individual at low
  // zoom), so the drawer's "Nearby now" list, the search box, and the LIVE pill
  // read from streamsApi.near instead. A generous radius keeps it populated at
  // today's sparse global scale (server caps at 100 nearest); it tightens to
  // genuinely-nearby as density grows. Falls back to (20,0) before a GPS fix so
  // the drawer isn't empty for location-denied users.
  const nearbyQuery = useStreamsNear(coords?.latitude ?? 20, coords?.longitude ?? 0, 20000)
  const nearbyStreams = nearbyQuery.data ?? []
  const insets = useSafeAreaInsets()
  // The viewer's own user id — used to identify their own live stream on the
  // globe: it's excluded from the drawer + cards, its pin renders black, and
  // tapping it returns to their stream view instead of opening a join card.
  const myUserId = useAuthStore((s) => s.wrldUser?.id) ?? null
  const isSelfStream = useCallback((s: Stream) => !!myUserId && s.hostId === myUserId, [myUserId])

  // 0 = live present; >0 = playback offset behind now (Time Machine).
  const [timeOffsetMs, setTimeOffsetMs] = useState(0)
  const historicalMode = timeOffsetMs > 0

  // ── TIME MACHINE: surviving-clip pins at the playhead ──────────────────────
  // Scrubbed into the past → the globe shows the public clips alive at the
  // playhead instead of the live viewport feed. The playhead = now − offset
  // ticks forward at 1× (a 1s ticker, only while scrubbed), so the pin set
  // replays the past as time advances; useHistoricalClips buckets the query to
  // 5s so it refreshes without thrashing. `playheadMs` uses Date.now() to match
  // the TimeScrubber's own clock (offset is derived against the device clock).
  const [, setNowTick] = useState(0)
  useEffect(() => {
    // Historical: tick 1s so the pin set replays the past. Live: tick 30s — enough to
    // creep the day/night terminator (it moves ~0.25°/min) without re-uploading the
    // source every second.
    const tid = setInterval(() => setNowTick((n) => n + 1), historicalMode ? 1000 : 30000)
    return () => clearInterval(tid)
  }, [historicalMode])
  const playheadMs = historicalMode ? Date.now() - timeOffsetMs : 0

  // Day/night terminator (Option A): the dusk frontier line, tracking the WRLD clock +
  // time-machine scrub. Recomputed on the ~30s tick (or immediately on scrub — the
  // bucket dep jumps when timeOffsetMs changes).
  const sunInstantMs = Date.now() - timeOffsetMs
  const terminatorShape = useMemo(
    () => terminatorGeoJSON(new Date(sunInstantMs)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [Math.round(sunInstantMs / 30000)],
  )
  const nightShape = useMemo(
    () => nightGeoJSON(new Date(sunInstantMs)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [Math.round(sunInstantMs / 30000)],
  )
  // PB3.5 — the time-machine pin feed. Two paths, chosen by the AVAILABILITY_FEED flag:
  //  • OFF (legacy): per-instant `discover?at=T` (re-queried each tick) — returns only the
  //    pins alive at T (server-sampled). Kept live until the windowed feed deploys.
  //  • ON (windowed): `discover?from&to` returns every pin in the window + its public
  //    `intervals`; we resolve visibility LOCALLY here (`playhead ∈ interval`) — no
  //    per-tick query, no bucket, no stale-pin (kills the blink / half-missing anomalies).
  // Both hooks are called every render (hooks rules); only the active one is enabled.
  const availabilityEnabled = configBool(config, 'AVAILABILITY_FEED', false)
  const legacyHist = useHistoricalClips(historicalMode && !availabilityEnabled ? playheadMs : 0)
  const windowedHist = useHistoricalAvailability(playheadMs, historicalMode && availabilityEnabled)
  const publicBufferEnabled = configBool(config, 'PUBLIC_BUFFER_ENABLED', false)

  // Source pin sets (stable query refs). Windowed feed carries `intervals`; legacy is
  // already alive-at-T.
  const srcClips = (availabilityEnabled ? windowedHist.data?.clips : legacyHist.data?.clips) ?? EMPTY_CLIPS
  const srcBuffer = !publicBufferEnabled
    ? EMPTY_BUFFER
    : (availabilityEnabled ? windowedHist.data?.bufferPins : legacyHist.data?.bufferPins) ?? EMPTY_BUFFER
  const inInterval = (intervals?: Interval[]) =>
    !!intervals && intervals.some((iv) => playheadMs >= iv.startMs && playheadMs < iv.endMs)
  // Windowed: resolve the visible set LOCALLY (playhead ∈ interval). The set genuinely
  // changes as the playhead crosses an interval edge, but we keep `clipPins`/`bufferPins`
  // REFERENTIALLY STABLE between renders unless the visible id-set actually changes (memo
  // keyed on a signature, not on playheadMs) — so the card-sync effects don't loop on the
  // 1s ticker. Legacy: the server already returned only alive-at-T pins (stable query ref).
  const clipSig = availabilityEnabled
    ? srcClips.filter((c) => inInterval(c.intervals)).map((c) => c.id).join(',')
    : `legacy:${srcClips.length}`
  const bufferSig = availabilityEnabled
    ? srcBuffer.filter((b) => inInterval(b.intervals)).map((b) => b.sessionId).join(',')
    : `legacy:${srcBuffer.length}`
  const clipPins = useMemo(
    () => (availabilityEnabled ? srcClips.filter((c) => inInterval(c.intervals)) : srcClips),
    [availabilityEnabled, srcClips, clipSig], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const bufferPins = useMemo(
    () => (availabilityEnabled ? srcBuffer.filter((b) => inInterval(b.intervals)) : srcBuffer),
    [availabilityEnabled, srcBuffer, bufferSig], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const clipPinById = useMemo(() => new Map(clipPins.map((c) => [c.id, c] as const)), [clipPins])
  const bufferPinById = useMemo(
    () => new Map(bufferPins.map((b) => [b.sessionId, b] as const)),
    [bufferPins],
  )
  // Bumped whenever any overlay UI (not the globe, not the clock) is touched,
  // so the TimeScrubber blurs + collapses. Spinning/zooming the globe doesn't.
  const [clockCollapseSignal, setClockCollapseSignal] = useState(0)
  const collapseClock = () => setClockCollapseSignal((n) => n + 1)

  const [selectedStream, setSelectedStream] = useState<Stream | null>(null)
  const [selectedClusterStreams, setSelectedClusterStreams] = useState<Stream[] | null>(null)
  const [banner, setBanner] = useState<BannerData | null>(null)

  // The pins the globe renders: live viewport streams, or — when scrubbed into
  // the past — the surviving clips mapped into the Stream shape. Memoised so the
  // reference stays stable between renders (the 1s playhead ticker re-renders the
  // screen, but `pins` only changes when the live feed or the clip set changes),
  // which keeps the card-sync effects from looping.
  const pins: Stream[] = useMemo(
    () =>
      historicalMode
        ? [...clipPins.map(clipToStream), ...bufferPins.map(bufferPinToStream)]
        : streams,
    [historicalMode, clipPins, bufferPins, streams],
  )
  // A clip pin is never treated as the viewer's own live stream (no black self-pin,
  // no return-to-broadcast on tap) even when it's their own clip.
  const treatAsSelf = useCallback(
    (s: Stream) => !historicalMode && isSelfStream(s),
    [historicalMode, isSelfStream],
  )
  // Crossing the live↔past boundary clears any open card (the pin may not exist on
  // the other side). Within the past, the card-sync effects drop a stale selection.
  useEffect(() => {
    setSelectedStream(null)
    setSelectedClusterStreams(null)
  }, [historicalMode])
  const [query, setQuery] = useState('')
  const [chipId, setChipId] = useState<string | null>(null)
  const [drawerState, setDrawerState] = useState<DrawerState>('closed')
  const [mapCenterLat, setMapCenterLat] = useState(20)
  const [mapZoom, setMapZoom] = useState(1.5)

  // ── Active planet + swap transition ────────────────────────────────────────
  const { width: windowW } = useWindowDimensions()
  const [activePlanetId, setActivePlanetId] = useState<PlanetId>('earth')
  const planet = planetById(activePlanetId)

  // ── HAVEN DATA SEAM ────────────────────────────────────────────────────────
  // Earth's pins ride the geographic viewport feed (useViewportDiscovery) + the
  // nearby-REST drawer. PRIVATE ('off') streams are coordless, so they can't ride
  // either — Haven reads the discovery socket filtered to 'off' instead, and the
  // registry's placePin scatters them on the island by stream id. The socket
  // snapshot/events now carry 'off' streams (backend findAllLiveStreams + the
  // streamStarted push). Earth ignores this feed entirely.
  const socketStreams = useDiscoverySocket()
  const privateStreams = useMemo(
    () => socketStreams.filter((s) => s.locationPrecision === 'off'),
    [socketStreams],
  )
  // Active-planet pin + drawer sources. Both stable references (one of two
  // memoised arrays), so the card-sync effects don't loop.
  const planetPins = planet.id === 'haven' ? privateStreams : pins
  const drawerSource = planet.id === 'haven' ? privateStreams : nearbyStreams
  const [transitioning, setTransitioning] = useState(false)
  const transitioningRef = useRef(false)
  const pendingToRef = useRef<PlanetId | null>(null)
  const swapDirRef = useRef(1) // +1 = exit left / enter right; -1 = reverse
  const styleSwappedRef = useRef(false)
  const enterStartedRef = useRef(false)
  const txTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  // Native-driven slide + scale of the globe layer during a planet swap. These
  // live on the OUTER wrapper (separate from globeTranslateY, which is non-native),
  // so the swap runs on the UI thread — smooth, and no Mapbox camera animation.
  const glideX = useRef(new Animated.Value(0)).current
  const glideScale = useRef(new Animated.Value(1)).current
  // Fit-scale: shrink the globe at the floor (GLOBE_FIT_SCALE), relaxing to 1.0 as
  // you pinch in past the floor (so street detail still fills the screen).
  const fitScale = useMemo(() => {
    const t = (mapZoom - globeMinZoom) / (GLOBE_FIT_FULL_ZOOM - globeMinZoom)
    return globeFitScale + Math.max(0, Math.min(1, t)) * (1 - globeFitScale)
  }, [mapZoom, globeMinZoom, globeFitScale])

  const hasActiveSearch = query.trim().length > 0 || (chipId !== null && chipId !== 'all')

  const bannerPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const coordsRef = useRef(coords)

  const cameraRef = useRef<React.ElementRef<typeof Camera>>(null)
  const sourceRef = useRef<ShapeSource>(null)
  const mapViewRef = useRef<React.ElementRef<typeof Mapbox.MapView>>(null)
  const mapZoomRef = useRef(1.5)
  const lastViewPushRef = useRef(0)
  const hasAutoOrientedRef = useRef(false)
  const mapReadyRef = useRef(false)
  const pendingOrientRef = useRef<[number, number] | null>(null)
  const autoRotateRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const interactTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rotLngRef = useRef(0)
  const rotLatRef = useRef(20)
  const userInteractingRef = useRef(false)
  const gestureActiveRef = useRef(false)
  // Longitudes the auto-rotate tick has written but not yet seen echoed back by
  // onCameraChanged. Lets handleCameraChanged tell OUR camera writes apart from
  // user-driven ones (a drag, or the native fling momentum after the finger lifts)
  // without trusting Mapbox's flaky-on-Android `isGestureActive` flag: any change
  // that isn't one of our pending self-writes is a user move and must pause the
  // spin. This is what stops a fast fling from being clawed back by the rotate tick.
  const selfWriteLngsRef = useRef<number[]>([])
  // Auto-rotation only makes sense on Earth — a synthetic planet (Haven) would
  // spin its single island off-screen, so we keep it framed instead.
  const rotateEnabledRef = useRef(true)
  // Only drive the map (setCamera) while the globe is actually on screen. The
  // stream tab never unmounts, so without these guards the 80ms rotate tick
  // keeps re-rendering the GPU map when the app is backgrounded or the user is
  // on another tab — a continuous, invisible battery drain. Refs (not state) so
  // the long-lived interval closure reads the current value without resubscribing.
  const appActiveRef = useRef(true)
  const screenFocusedRef = useRef(true)
  // The globe spins as a signature intro, then comes to rest so Mapbox stops
  // re-rendering (a resting map draws ~no GPU). `spinUntilRef` holds the instant
  // the current spin window ends; null = at rest. Each interaction / focus /
  // foregrounding re-arms a fresh window. `armSpin()` (re)starts one.
  const spinUntilRef = useRef(0)
  // Spin timing is admin-tunable (RemoteConfig "Globe rotation" group); the module
  // consts above are the offline/pre-fetch fallbacks. Held in a ref so the
  // long-lived rotate interval + armSpin read current values without resubscribing.
  const spinCfgRef = useRef({
    windowMs: SPIN_WINDOW_MS,
    easeMs: SPIN_EASE_MS,
    stepDeg: SPIN_STEP_DEG,
  })
  const spinWindowMs = configNumber(config, 'SPIN_WINDOW_MS', SPIN_WINDOW_MS)
  const spinEaseMs = configNumber(config, 'SPIN_EASE_MS', SPIN_EASE_MS)
  const spinStepDeg = configNumber(config, 'SPIN_STEP_DEG', SPIN_STEP_DEG)
  useEffect(() => {
    spinCfgRef.current = { windowMs: spinWindowMs, easeMs: spinEaseMs, stepDeg: spinStepDeg }
  }, [spinWindowMs, spinEaseMs, spinStepDeg])
  const armSpin = useCallback(() => {
    spinUntilRef.current = Date.now() + spinCfgRef.current.windowMs
  }, [])

  useEffect(() => {
    coordsRef.current = coords
  }, [coords])
  useEffect(() => {
    rotateEnabledRef.current = activePlanetId === 'earth'
  }, [activePlanetId])

  // Pause the globe when the app leaves the foreground; re-arm a spin on return.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      appActiveRef.current = next === 'active'
      if (next === 'active') armSpin()
    })
    return () => sub.remove()
  }, [armSpin])

  // Pause the globe when the user switches to another tab (the screen blurs);
  // re-arm a spin window each time the globe regains focus.
  useFocusEffect(
    useCallback(() => {
      screenFocusedRef.current = true
      armSpin()
      return () => {
        screenFocusedRef.current = false
      }
    }, [armSpin]),
  )

  // ── Banner state machine (identical to GlobeScreen) ───────────────────────

  useFocusEffect(
    useCallback(() => {
      const signal = consumeStreamSignal()
      if (!signal) return
      if (bannerPollRef.current) clearInterval(bannerPollRef.current)
      setBanner(
        signal.kind === 'ended'
          ? { kind: 'ended' }
          : signal.kind === 'kicked'
            ? { kind: 'kicked' }
            : signal.kind === 'cancelled'
              ? { kind: 'cancelled' }
              : { kind: 'disconnected', broadcasterHandle: signal.broadcasterHandle },
      )
    }, []),
  )

  useEffect(() => {
    if (!banner || banner.kind !== 'disconnected') return
    const { broadcasterHandle } = banner
    if (!broadcasterHandle) return
    let polls = 0
    bannerPollRef.current = setInterval(async () => {
      polls++
      if (polls > 30) {
        clearInterval(bannerPollRef.current!)
        bannerPollRef.current = null
        setBanner(null)
        return
      }
      const c = coordsRef.current
      if (!c) return
      try {
        const nearby = await streamsApi.near(c.latitude, c.longitude)
        const resumed = nearby.find(
          (s) => s.host?.handle === broadcasterHandle && s.isLive && s.mediasoupRoomId,
        )
        if (resumed?.mediasoupRoomId) {
          clearInterval(bannerPollRef.current!)
          bannerPollRef.current = null
          setBanner({ kind: 'resumed', stream: resumed, broadcasterHandle })
        }
      } catch {}
    }, 10_000)
    return () => {
      if (bannerPollRef.current) {
        clearInterval(bannerPollRef.current)
        bannerPollRef.current = null
      }
    }
  }, [banner?.kind])

  function dismissBanner() {
    if (bannerPollRef.current) clearInterval(bannerPollRef.current)
    setBanner(null)
  }

  // ── Auto-rotation ──────────────────────────────────────────────────────────

  function pauseRotation() {
    userInteractingRef.current = true
    if (interactTimerRef.current) clearTimeout(interactTimerRef.current)
    // SAFETY FALLBACK ONLY — the primary resume is handleMapIdle (onMapIdle). This
    // timer must OUTLAST the longest possible fling: panDecelerationFactor 0.99
    // makes a hard swipe coast ~7s. On iOS onCameraChanged fires throughout the
    // fling and re-arms this each frame, so a short timer was fine. On Android those
    // events don't fire during the momentum glide, so a 4s timer expired MID-FLING
    // and the rotate tick's setCamera fought the still-gliding fling → the sporadic
    // snap-back. 12s comfortably outlasts any fling; onMapIdle resumes sooner.
    interactTimerRef.current = setTimeout(() => {
      userInteractingRef.current = false
      armSpin()
    }, 12_000)
  }

  // The map has fully come to rest — including at the END of a fling's momentum,
  // which is the signal a blind timer can't get right on Android. Only resume when
  // we're actually paused for a user interaction; if the map went idle because the
  // spin window ended naturally (userInteractingRef false), stay at rest so the GPU
  // idles (the battery optimisation). Never resume mid-gesture.
  function handleMapIdle() {
    if (!userInteractingRef.current || gestureActiveRef.current) return
    if (interactTimerRef.current) clearTimeout(interactTimerRef.current)
    interactTimerRef.current = setTimeout(() => {
      userInteractingRef.current = false
      armSpin() // resume a fresh spin window once the map (and any fling) settles
    }, 1_200)
  }

  // Push the current viewport (the tiles the map shows) to the discovery
  // subscription. Throttled — onCameraChanged fires continuously (incl. the 80ms
  // auto-rotate tick); the hook additionally debounces + skips unchanged tile sets.
  const pushViewport = useCallback(() => {
    const map = mapViewRef.current
    if (!map) return
    map
      .getVisibleBounds()
      .then((b) => {
        if (!b) return
        const [[east, north], [west, south]] = b as [[number, number], [number, number]]
        setViewRef.current({ west, south, east, north }, mapZoomRef.current)
      })
      .catch(() => {})
  }, [])
  const throttledPushViewport = useCallback(() => {
    const t = Date.now()
    if (t - lastViewPushRef.current < 400) return
    lastViewPushRef.current = t
    pushViewport()
  }, [pushViewport])

  // Re-subscribe when the admin-tunable knobs arrive/change (config loads after
  // the map, or an admin edits them + the app refreshes).
  useEffect(() => {
    pushViewport()
  }, [pinZoomThreshold, countMinZoom, pushViewport])

  function handleCameraChanged(state: {
    properties: { center: number[]; zoom: number }
    gestures: { isGestureActive: boolean }
  }) {
    const [lng, lat] = state.properties.center as [number, number]
    setMapCenterLat(lat)
    setMapZoom(state.properties.zoom)
    mapZoomRef.current = state.properties.zoom
    throttledPushViewport()
    // Always resume rotation from wherever the map actually is — not only when
    // Mapbox flags the change as a gesture. On Android `isGestureActive` is
    // unreliable, and guarding the sync behind it left `rotLngRef` stale at the
    // pre-drag longitude: the 80ms auto-rotate tick then slammed the camera back
    // there every frame ("hits a wall and bounces back to where it started").
    // Syncing unconditionally is idempotent for our own rotate writes (same value)
    // and keeps a user drag from snapping back even if the gesture flag misses.
    rotLngRef.current = (lng + 360) % 360
    rotLatRef.current = lat
    // Was this change our own rotate tick echoing back, or a user move? Consume a
    // matching pending self-write if present; anything else (drag or post-lift
    // fling momentum) is user-driven and must keep the spin paused. A small angular
    // epsilon (< the per-tick step) absorbs float/echo jitter and callback reorder.
    const pending = selfWriteLngsRef.current
    let isSelf = false
    for (let i = 0; i < pending.length; i++) {
      const w = pending[i]
      if (w !== undefined && angularDistDeg(w, lng) < 0.08) {
        pending.splice(i, 1)
        isSelf = true
        break
      }
    }
    gestureActiveRef.current = state.gestures.isGestureActive
    if (state.gestures.isGestureActive || !isSelf) pauseRotation()
  }

  useEffect(() => {
    armSpin() // spin on first open
    autoRotateRef.current = setInterval(() => {
      if (!rotateEnabledRef.current || gestureActiveRef.current || userInteractingRef.current)
        return
      // Don't render the map when the globe isn't on screen — let the GPU idle.
      if (!appActiveRef.current || !screenFocusedRef.current) return
      // The spin window is over — globe at rest, no setCamera, Mapbox idles.
      const remaining = spinUntilRef.current - Date.now()
      if (remaining <= 0) return
      // Ease the angular speed to zero over the tail so it glides to a stop.
      const { easeMs, stepDeg } = spinCfgRef.current
      const step = remaining < easeMs ? stepDeg * (remaining / easeMs) : stepDeg
      rotLngRef.current = (rotLngRef.current + step + 360) % 360
      const lng = rotLngRef.current > 180 ? rotLngRef.current - 360 : rotLngRef.current
      // Record this write so the onCameraChanged it triggers is recognised as ours
      // and doesn't pause the spin. Keep only the last few (the echo arrives within
      // a tick or two); a longer tail would let a stale value mask a real user move.
      const pending = selfWriteLngsRef.current
      pending.push(lng)
      if (pending.length > 4) pending.shift()
      cameraRef.current?.setCamera({
        centerCoordinate: [lng, rotLatRef.current],
        animationDuration: 0,
      })
    }, 80)
    return () => {
      if (autoRotateRef.current) clearInterval(autoRotateRef.current)
      if (interactTimerRef.current) clearTimeout(interactTimerRef.current)
    }
  }, [armSpin])

  // ── GPS auto-orient on first fix ──────────────────────────────────────────

  function flyToUserLocation(lng: number, lat: number) {
    cameraRef.current?.setCamera({
      centerCoordinate: [lng, lat],
      animationDuration: 1500,
      animationMode: 'easeTo',
    })
    setTimeout(() => {
      userInteractingRef.current = false
    }, 2500)
  }

  function handleMapLoad() {
    mapReadyRef.current = true
    if (pendingOrientRef.current) {
      const [lng, lat] = pendingOrientRef.current
      pendingOrientRef.current = null
      flyToUserLocation(lng, lat)
    } else {
      cameraRef.current?.setCamera({
        centerCoordinate: planetById('earth').initialCamera.centerCoordinate,
        zoomLevel: globeMinZoom,
        animationMode: 'none',
        animationDuration: 0,
      })
    }
    // Initial viewport subscription once the camera has settled.
    setTimeout(pushViewport, 400)
  }

  useEffect(() => {
    if (!coords || hasAutoOrientedRef.current) return
    // Only orient the real-world globe to the user; a synthetic planet stays
    // framed on its own content.
    if (!rotateEnabledRef.current) return
    hasAutoOrientedRef.current = true
    userInteractingRef.current = true
    rotLngRef.current = (coords.longitude + 360) % 360
    rotLatRef.current = coords.latitude
    if (mapReadyRef.current) {
      flyToUserLocation(coords.longitude, coords.latitude)
    } else {
      pendingOrientRef.current = [coords.longitude, coords.latitude]
    }
  }, [coords])

  // ── Planet switch (fly out → swap off-screen → fly in) ─────────────────────
  //
  // One live MapView throughout — no placeholder globe, no cover. The REAL globe
  // zooms out + slides off one edge; while it's off-screen the style swaps; then
  // the new planet slides in from the OTHER edge + zooms in to its default
  // framing, centred on the island (Haven) or the user's location (Earth).
  // Direction follows registry order (later planet → exit left / enter right;
  // reversed coming back). The swap is hidden simply by being off-screen.
  // A fallback timer guarantees the fly-in even if the style-load event is missed.

  function clearTxTimers() {
    txTimersRef.current.forEach(clearTimeout)
    txTimersRef.current = []
  }
  function txSchedule(ms: number, fn: () => void) {
    txTimersRef.current.push(setTimeout(fn, ms))
  }

  function planetTargetCenter(p: ReturnType<typeof planetById>): [number, number] {
    // Earth re-centres on the user (if known); a synthetic planet on its own centre.
    if (p.id === 'earth' && coordsRef.current) {
      return [coordsRef.current.longitude, coordsRef.current.latitude]
    }
    return p.initialCamera.centerCoordinate
  }

  function flyInNewPlanet() {
    if (!transitioningRef.current || enterStartedRef.current) return
    enterStartedRef.current = true
    clearTxTimers()
    const dir = swapDirRef.current
    const p = planetById(pendingToRef.current ?? activePlanetId)
    const center = planetTargetCenter(p)
    // Frame the new planet at its initial zoom (INSTANT — the camera never animates
    // during a swap), parked off the ENTERING edge and shrunk by glideScale.
    cameraRef.current?.setCamera({
      centerCoordinate: center,
      zoomLevel: globeMinZoom,
      animationDuration: 0,
    })
    glideX.setValue(dir * windowW)
    glideScale.setValue(TX_EXIT_SCALE)
    rotLngRef.current = (center[0] + 360) % 360
    rotLatRef.current = center[1]
    // …then slide in + grow back, entirely on the UI thread (native driver).
    Animated.parallel([
      Animated.timing(glideX, {
        toValue: 0,
        duration: TX_ENTER_MS,
        easing: theme.motion.easing.standard,
        useNativeDriver: true,
      }),
      Animated.timing(glideScale, {
        toValue: 1,
        duration: TX_ENTER_MS,
        easing: theme.motion.easing.standard,
        useNativeDriver: true,
      }),
    ]).start(() => {
      transitioningRef.current = false
      pendingToRef.current = null
      setTransitioning(false)
      userInteractingRef.current = false // auto-rotation resumes (Earth only)
    })
  }

  function changePlanet(toId: PlanetId) {
    if (toId === activePlanetId || transitioningRef.current) return
    const dir = planetIndex(toId) > planetIndex(activePlanetId) ? 1 : -1
    transitioningRef.current = true
    pendingToRef.current = toId
    swapDirRef.current = dir
    styleSwappedRef.current = false
    enterStartedRef.current = false
    userInteractingRef.current = true // pause auto-rotation through the swap
    setSelectedStream(null)
    setSelectedClusterStreams(null)
    setTransitioning(true)
    clearTxTimers()
    glideX.setValue(0)
    glideScale.setValue(1)

    // Exit: slide the CURRENT globe off-screen (dir +1 → left) while shrinking it —
    // pure native transforms, no Mapbox camera move. Swap the style when it's gone.
    Animated.parallel([
      Animated.timing(glideX, {
        toValue: -dir * windowW,
        duration: TX_EXIT_MS,
        easing: theme.motion.easing.standard,
        useNativeDriver: true,
      }),
      Animated.timing(glideScale, {
        toValue: TX_EXIT_SCALE,
        duration: TX_EXIT_MS,
        easing: theme.motion.easing.standard,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!finished || !transitioningRef.current) return
      styleSwappedRef.current = true
      setActivePlanetId(toId) // restyle the now-off-screen MapView
      // Fly in on the new style's load, or this fallback if the event is missed.
      txSchedule(TX_STYLE_FALLBACK_MS, flyInNewPlanet)
    })
  }

  function handleStyleLoad() {
    if (!transitioningRef.current || !styleSwappedRef.current) return
    flyInNewPlanet()
  }

  // Clean up any in-flight transition timers on unmount.
  useEffect(() => () => clearTxTimers(), [])

  // ── Keep preview cards in sync with streams refresh ────────────────────────

  useEffect(() => {
    if (!selectedStream || !planetPins) return
    const updated = planetPins.find((s) => s.id === selectedStream.id)
    if (!updated) setSelectedStream(null)
    else if (updated !== selectedStream) setSelectedStream(updated)
  }, [planetPins])

  useEffect(() => {
    if (!selectedClusterStreams || !planetPins) return
    const updated = selectedClusterStreams
      .map((s) => planetPins.find((x) => x.id === s.id))
      .filter((s): s is Stream => s != null)
    if (updated.length === 0) setSelectedClusterStreams(null)
    else setSelectedClusterStreams(updated)
  }, [planetPins])

  // ── Filtered streams (query + chip) ────────────────────────────────────────

  const visibleStreams = useMemo(() => {
    // Only the active planet's streams populate its drawer + cards. `drawerSource`
    // is Earth's nearby-REST feed or Haven's private-stream socket feed (HAVEN
    // DATA SEAM); the planet filter is then a safety no-op on each.
    const all = drawerSource.filter(planet.belongsTo)
    // A streamer never sees their own stream in the drawer. All other
    // curation rules below are unchanged.
    let out = all.filter((s) => !isSelfStream(s))
    if (chipId === 'camera') {
      out = out.filter((s) => (s.sources ?? []).includes('camera'))
    } else if (chipId === 'audio') {
      out = out.filter((s) => (s.sources ?? []).includes('audio'))
    } else if (chipId === 'city' || chipId === 'country') {
      // TODO Phase 14a follow-up: wire reverse-geocode lookup for the
      // user's city + country so these chips can filter against the
      // backend. Today the lookup is missing, so the filter shrinks
      // to empty rather than guess.
      out = []
    }
    const q = query.trim().toLowerCase()
    if (q.length > 0) {
      out = out.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          (s.host?.handle ?? '').toLowerCase().includes(q) ||
          (s.host?.displayName ?? '').toLowerCase().includes(q),
      )
      // TODO Phase 14a follow-up: also match Mapbox geocoding place
      // results and people search. Today the search filters streams
      // only — query gets matched against title + handle + displayName.
    }
    // Order by viewer count desc for now (until a real "trending"
    // weighting lands).
    return out.slice().sort((a, b) => b.viewerCount - a.viewerCount)
  }, [drawerSource, chipId, query, isSelfStream, planet])

  // ── Navigation ────────────────────────────────────────────────────────────

  function joinStream(stream: Stream) {
    if (!stream.mediasoupRoomId) return
    setSelectedStream(null)
    setSelectedClusterStreams(null)
    router.push({
      pathname: `/(app)/stream/${stream.mediasoupRoomId}`,
      params: {
        streamId: stream.id,
        sources: (stream.sources ?? []).join(','),
        // External cams branch to the HLS viewer (no mediasoup join) — see stream/[id].tsx.
        isExternal: String(stream.isExternal ?? false),
        liveUrl: stream.liveUrl ?? '',
      },
    })
  }

  function handleBannerTap() {
    if (!banner || banner.kind !== 'resumed' || !banner.stream.mediasoupRoomId) return
    const { stream } = banner
    dismissBanner()
    router.push({
      pathname: `/(app)/stream/${stream.mediasoupRoomId}`,
      params: {
        streamId: stream.id,
        sources: stream.sources.join(','),
        isExternal: String(stream.isExternal ?? false),
        liveUrl: stream.liveUrl ?? '',
      },
    })
  }

  // Open a historical clip OR public buffer session in the replay viewer, seeking to
  // the playhead instant. `source` routes the viewer's fetch (clips/:id vs
  // buffer/session/:id).
  function watchHistorical(id: string) {
    const clip = clipPinById.get(id)
    const buf = bufferPinById.get(id)
    const pin = clip ?? buf
    if (!pin) return
    // Seek to the exact playhead within the content: playhead − the pin's content start.
    // Computed client-side (works for both feeds; the windowed feed carries no per-instant
    // `seekOffsetSec`). Clamped ≥ 0.
    const contentStartMs = clip ? clip.clipStartMs : buf!.sessionStartMs
    const seekSec = Math.max(0, Math.floor((playheadMs - contentStartMs) / 1000))
    setSelectedStream(null)
    setSelectedClusterStreams(null)
    router.push({
      pathname: '/(app)/clip/[id]',
      params: {
        id,
        source: buf ? 'buffer' : 'clip',
        seekSec: String(seekSec),
        title: pin.title ?? '',
        handle: pin.host.handle,
      },
    })
  }

  function toDiscovery(stream: Stream): DiscoveryStream {
    const clip = clipPinById.get(stream.id) ?? bufferPinById.get(stream.id)
    return {
      id: stream.id,
      title: stream.title,
      handle: stream.host?.handle ?? 'unknown',
      displayName: stream.host?.displayName,
      avatarUrl: stream.host?.avatarUrl,
      viewerCount: stream.viewerCount,
      isLive: stream.isLive,
      subscribersOnly: stream.subscribersOnly,
      subscriptionPriceUsd: stream.host?.subscriptionPriceUsd,
      ppvEvent: stream.ppvEvent,
      // Clip / buffer pins (Time Machine) → "Watch" → replay viewer; live → "Join".
      kind: clip ? 'clip' : 'stream',
      ctaLabel: clip ? 'Watch' : 'Join',
      onJoin: clip ? () => watchHistorical(stream.id) : () => joinStream(stream),
    }
  }

  // ── GeoJSON feature collection from streams ───────────────────────────────

  // Pins for the active planet only. Earth uses real coords + location precision
  // halos; Haven places each private stream at its stable island spot (by id) and
  // renders sharp dots (precision halos are meaningless on a synthetic planet).
  const geoJSON = {
    type: 'FeatureCollection' as const,
    features: planetPins
      .filter(planet.belongsTo)
      .map((s) => {
        // Earth: real coords + precision halos. Haven: stable island spot by id,
        // sharp dots (halos are meaningless on a synthetic planet).
        const [lng, lat] = planet.placePin(s)
        if (lng == null || lat == null || Number.isNaN(lng) || Number.isNaN(lat)) {
          return null
        }
        return {
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [lng, lat] },
          properties: {
            streamId: s.id,
            mediasoupRoomId: s.mediasoupRoomId ?? '',
            title: s.title,
            viewerCount: s.viewerCount,
            handle: s.host?.handle ?? 'unknown',
            sources: (s.sources ?? []).join(','),
            precision: planet.id === 'earth' ? (s.locationPrecision ?? 'exact') : 'exact',
            subscribersOnly: s.subscribersOnly === true,
            ppv: s.ppvEvent != null,
            isSelf: treatAsSelf(s),
          },
        }
      })
      .filter((f): f is NonNullable<typeof f> => f != null),
  }

  // Count bubbles (low zoom): one per populated tile, drawn at the cluster
  // centroid the server snapped to a real pin. Empty in pins mode.
  const countsGeoJSON = {
    type: 'FeatureCollection' as const,
    // In the past, pins come from the clip feed (no server tile-counts); on Haven
    // the tile feed is geographic + irrelevant — suppress the count bubbles in
    // both cases (only Earth-live has real viewport tile counts).
    features: (historicalMode || planet.id !== 'earth' ? [] : counts).map((c: TileCount) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [c.lng, c.lat] },
      properties: {
        tile: c.tile,
        count: c.count,
        label:
          c.count >= 1000 ? `${(c.count / 1000).toFixed(c.count >= 10000 ? 0 : 1)}k` : `${c.count}`,
      },
    })),
  }

  // ── Pin tap handling ──────────────────────────────────────────────────────

  // Tapping a count bubble drills in toward it (no card — there's no single
  // stream to show at low zoom). Each step crosses into finer tiles / eventually
  // the pins regime.
  function handleCountPress(e: { features: any[] }) {
    pauseRotation()
    const f = e.features[0]
    const coordinates = f?.geometry?.coordinates as [number, number] | undefined
    if (!coordinates) return
    cameraRef.current?.setCamera({
      centerCoordinate: coordinates,
      zoomLevel: Math.min(mapZoomRef.current + 3, 14),
      animationDuration: 600,
    })
  }

  async function handleSourcePress(e: { features: any[] }) {
    pauseRotation()
    const feature = e.features[0]
    if (!feature) return

    if (feature.properties?.cluster) {
      try {
        const leaves = (await sourceRef.current?.getClusterLeaves(feature, 100, 0)) as any
        const clusterStreams = ((leaves?.features ?? []) as any[])
          .map((f: any) => planetPins.find((s) => s.id === f.properties?.streamId))
          .filter((s): s is Stream => s != null)
          // A streamer never sees their own stream in the cluster card either.
          .filter((s) => !treatAsSelf(s))
        if (clusterStreams.length > 0) {
          setSelectedClusterStreams(clusterStreams)
          setSelectedStream(null)
        }
      } catch {}
    } else {
      const stream = planetPins.find((s) => s.id === feature.properties?.streamId)
      if (stream) {
        // Tapping your own (black) pin returns to your stream view instead of
        // opening a join card — same path as the tab-bar live-return link.
        if (treatAsSelf(stream)) {
          returnToActiveBroadcast()
          return
        }
        setSelectedStream(stream)
        setSelectedClusterStreams(null)
      }
    }
  }

  // LIVE count reflects the active planet (what the user is actually looking at).
  const liveCount = drawerSource.filter(planet.belongsTo).length

  // ── Drawer animation + state coupling ──────────────────────────────────────

  // Tabs.Screen content area — measured via onLayout because
  // Dimensions.get('window') includes the tab bar / status bar and
  // would push the drawer off-screen if used as the baseline.
  const [containerH, setContainerH] = useState(0)

  function onContainerLayout(e: LayoutChangeEvent) {
    const h = e.nativeEvent.layout.height
    if (h && h !== containerH) setContainerH(h)
  }

  const expandedH = Math.max(DRAWER_PEEK_H, containerH - (insets.top + DRAWER_EXPANDED_TOP_OFFSET))

  const drawerHeight = useRef(new Animated.Value(DRAWER_CLOSED_H)).current

  // The time-machine clock now sits at the very bottom (above the tab bar); the
  // drawer rides flush on top of it. `clockHeight` tracks the clock's
  // collapsed/expanded height so the drawer slides up/down to stay above it
  // (the mirror of the drawer→clock coupling this used to have).
  const clockHeight = useRef(new Animated.Value(CLOCK_COLLAPSED_H)).current
  const handleClockExpandedChange = useCallback(
    (expanded: boolean) => {
      Animated.timing(clockHeight, {
        toValue: expanded ? CLOCK_EXPANDED_H : CLOCK_COLLAPSED_H,
        ...theme.motion.patterns.overlay,
        useNativeDriver: false,
      }).start()
    },
    [clockHeight],
  )

  // Globe sphere on-screen y-offset is derived directly from
  // drawerHeight so the sphere glides in sync with the drawer during
  // drag — no separate timing animation needed. Below the closed
  // height the sphere sits at GLOBE_FRAC_CLOSED; above the peek height
  // it sits at GLOBE_FRAC_OPEN. Between PEEK and EXPANDED the value
  // clamps, so the sphere stays put while the drawer keeps growing
  // upward into its vertical scroll state.
  const globeTranslateY = useMemo(() => {
    // Drawer contribution: GLOBE_FRAC_CLOSED → GLOBE_FRAC_OPEN as it opens.
    const drawerT = drawerHeight.interpolate({
      inputRange: [DRAWER_CLOSED_H, DRAWER_PEEK_H],
      outputRange: [containerH * (GLOBE_FRAC_CLOSED - 0.5), containerH * (GLOBE_FRAC_OPEN - 0.5)],
      extrapolate: 'clamp',
    })
    // Clock contribution: 0 collapsed → a further proportional up-shift expanded.
    // Added to the drawer's so the four (clock × drawer) states are distinct.
    const clockT = clockHeight.interpolate({
      inputRange: [CLOCK_COLLAPSED_H, CLOCK_EXPANDED_H],
      outputRange: [0, -containerH * GLOBE_FRAC_CLOCK_SHIFT],
      extrapolate: 'clamp',
    })
    return Animated.add(drawerT, clockT)
  }, [drawerHeight, clockHeight, containerH])

  // Refs used by the PanResponder so its long-lived closure reads
  // current values, not the ones captured at mount.
  const drawerStateRef = useRef<DrawerState>('closed')
  const expandedHRef = useRef(expandedH)
  const dragStartHeightRef = useRef(DRAWER_CLOSED_H)

  useEffect(() => {
    drawerStateRef.current = drawerState
  }, [drawerState])
  useEffect(() => {
    expandedHRef.current = expandedH
  }, [expandedH])

  function heightForState(s: DrawerState): number {
    return s === 'closed'
      ? DRAWER_CLOSED_H
      : s === 'expanded'
        ? expandedHRef.current
        : DRAWER_PEEK_H
  }

  function animateToState(s: DrawerState) {
    Animated.timing(drawerHeight, {
      toValue: heightForState(s),
      ...theme.motion.patterns.overlay,
      useNativeDriver: false,
    }).start()
  }

  useEffect(() => {
    animateToState(drawerState)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerState, expandedH])

  // Auto-open closed → peek as soon as the user activates a search or
  // chip filter. We don't auto-close on clear; that would yank the
  // results out from under the user. They tap the grip (or drag) to
  // dismiss explicitly.
  useEffect(() => {
    if (hasActiveSearch && drawerState === 'closed') {
      setDrawerState('peek')
    }
  }, [hasActiveSearch, drawerState])

  // Grip gesture: while the user drags, the drawer sticks to the finger
  // (height = startHeight - dy, clamped between closed + expanded).
  // On release we decide:
  //   - drag < TAP_DRAG_TOLERANCE px       → tap, toggle closed ↔ peek
  //   - drag ≥ COMMIT_DRAG_DISTANCE px up  → next state up
  //   - drag ≥ COMMIT_DRAG_DISTANCE px dn  → next state down
  //   - otherwise                          → snap back to current state
  // PanResponder is mounted on the grip hit area only so it doesn't
  // fight the horizontal rail's ScrollView underneath.
  const gripPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4,
      onPanResponderGrant: () => {
        drawerHeight.stopAnimation((v: number) => {
          dragStartHeightRef.current = v
        })
      },
      onPanResponderMove: (_, g) => {
        const start = dragStartHeightRef.current
        const max = expandedHRef.current
        const next = Math.max(DRAWER_CLOSED_H, Math.min(max, start - g.dy))
        drawerHeight.setValue(next)
      },
      onPanResponderRelease: (_, g) => {
        const dy = g.dy
        const current = drawerStateRef.current
        let target: DrawerState = current
        if (Math.abs(dy) < TAP_DRAG_TOLERANCE) {
          target = current === 'closed' ? 'peek' : 'closed'
        } else if (dy <= -COMMIT_DRAG_DISTANCE) {
          target = nextStateUp(current)
        } else if (dy >= COMMIT_DRAG_DISTANCE) {
          target = nextStateDown(current)
        }
        if (target === current) {
          // Snap back to the current state's resting height — the state
          // setter wouldn't fire the effect if the value matches.
          animateToState(current)
        } else {
          setDrawerState(target)
        }
      },
      onPanResponderTerminate: () => {
        animateToState(drawerStateRef.current)
      },
    }),
  ).current

  function handleSeeAllPress() {
    setDrawerState((s) => (s === 'expanded' ? 'peek' : 'expanded'))
  }

  // NO-CLIP VIEWPORT (set-and-forget; auto-sized, NOT a tuning knob).
  // The MapView is this square. Mapbox zoom is resolution-based — the globe is a
  // FIXED pixel size, so a bigger viewport just shows more space around it (it does
  // NOT grow the globe). We make the square comfortably LARGER than the globe so it
  // never touches an edge → no crop, on any phone, portrait OR landscape. Derived
  // live from the screen, so it re-figures itself on rotation / different devices.
  // 1.4 × the larger screen dimension covers the globe + the drawer shift + headroom
  // for fit-scale down to ~0.7. (Before containerH measures it's windowW×1.4 — still
  // bigger than the globe.) Centred → globe at screen centre, then nudged by translateY.
  const globeBox = Math.max(windowW, containerH) * 1.4

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container} onLayout={onContainerLayout}>
      {/* OUTER: planet-swap slide + scale (NATIVE driver — UI thread). */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { transform: [{ translateX: glideX }, { scale: glideScale }] },
        ]}
        pointerEvents="box-none"
      >
        {/* INNER: the big (globeBox) MapView, centred. Bigger than the globe → no
          edge clip; globeTranslateY shifts it for the drawer/clock; fitScale is the
          clean on-screen globe-size dial. Separate view from the outer native
          slide+scale so the two transform drivers never mix. */}
        <Animated.View
          style={[
            {
              position: 'absolute',
              left: (windowW - globeBox) / 2,
              top: (containerH - globeBox) / 2,
              width: globeBox,
              height: globeBox,
            },
            { transform: [{ translateY: globeTranslateY }, { scale: fitScale }] },
          ]}
          pointerEvents="box-none"
          // Belt-and-suspenders gate for the auto-rotate loop. Mapbox's
          // `isGestureActive` (read in handleCameraChanged) is unreliable on
          // Android, so pausing only off that flag can leave the 80ms rotate tick
          // fighting a user drag. This raw touch handler fires the instant a finger
          // lands on the globe — independent of the gesture flag — and pauses
          // rotation immediately. Raw onTouchStart bubbles through a box-none
          // wrapper (same pattern the clock collapse signal uses), so it works even
          // though the native MapView consumes the gesture itself.
          onTouchStart={() => pauseRotation()}
        >
          <Mapbox.MapView
            ref={mapViewRef}
            style={StyleSheet.absoluteFill}
            // Exactly one of styleURL / styleJSON is set per planet (Earth = hosted
            // Mapbox style; Haven = synthetic in-code water+island style).
            {...(planet.styleJSON
              ? { styleJSON: planet.styleJSON }
              : { styleURL: planet.styleURL })}
            projection="globe"
            logoEnabled={false}
            attributionEnabled={false}
            compassEnabled={false}
            scaleBarEnabled={false}
            // Disable the two-finger bearing twist (z-axis / yaw roll). Pan + pinch-zoom
            // stay; auto-spin is a pan (center change), so it's unaffected.
            rotateEnabled={false}
            // Disable pitch/tilt. On Android a fast swipe on the globe is sporadically
            // misclassified as a tilt gesture (mapbox-maps-android #2217), which then
            // snaps the camera back to its un-tilted state — the intermittent "bounce
            // back to where it started" seen only on Android, only on the globe (zoomed
            // out), only on a fast swipe. A spin globe never wants tilt, so turn it off.
            pitchEnabled={false}
            // Pan inertia (fling-to-spin). iOS keeps near-full momentum at 0.99;
            // Android was left `undefined`, which the native gestures manager treats
            // as 0 — a released spin stopped dead with no inertia. Give both
            // platforms a real deceleration factor so a flung globe keeps spinning.
            gestureSettings={{ panDecelerationFactor: 0.99 }}
            onCameraChanged={handleCameraChanged}
            onMapIdle={handleMapIdle}
            onDidFinishLoadingMap={handleMapLoad}
            onDidFinishLoadingStyle={handleStyleLoad}
            onPress={() => {
              pauseRotation()
              setSelectedStream(null)
              setSelectedClusterStreams(null)
            }}
          >
            <Atmosphere
              style={{
                spaceColor: theme.colors.bg.primary,
                color: 'transparent',
                highColor: 'transparent',
                starIntensity: 0,
              }}
            />

            <Camera
              ref={cameraRef}
              defaultSettings={{
                centerCoordinate: [0, 20],
                zoomLevel: globeMinZoom,
              }}
              minZoomLevel={globeMinZoom}
              maxZoomLevel={20}
            />

            {/* Night-side shading — translucent veil over the hemisphere facing away
            from the sun. Drawn UNDER the graticule + terminator line + pins so the line
            reads as its crisp edge. Robust at the poles: the winter pole fills dark
            (hiding the degenerate cap), and the visible edge is clamped to the clean
            tile-backed zone. */}
            <ShapeSource id="night" shape={nightShape}>
              <FillLayer id="night-fill" style={{ fillColor: NIGHT_COLOR, fillOpacity: 0.15 }} />
            </ShapeSource>

            {/* Graticule — equator, tropics, and polar circles. The polar circles
            foreshorten near the poles so they read faint at a flat opacity; boost
            them and ease the rest so all the lines land at a consistent weight. */}
            <ShapeSource id="graticule" shape={GRATICULE_GEOJSON}>
              <LineLayer
                id="graticule-lines"
                style={{
                  lineColor: GRATICULE_COLOR,
                  lineWidth: 0.6,
                  lineOpacity: ['match', ['get', 'kind'], 'polar', 0.3, 0.17] as any,
                }}
              />
            </ShapeSource>

            {/* Day/night terminator (Option A) — soft dusk frontier line on the great
            circle 90° from the sun. A LINE (not a fill), so it's artifact-free across
            solstice↔equinox and both poles. Tracks the WRLD clock + time-machine. */}
            <ShapeSource id="terminator" shape={terminatorShape}>
              <LineLayer
                id="terminator-line"
                style={{
                  lineColor: TERMINATOR_COLOR,
                  lineWidth: 1.4,
                  lineBlur: 2,
                  lineOpacity: 0.5,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />
            </ShapeSource>

            <ShapeSource
              id="streams"
              ref={sourceRef}
              shape={geoJSON}
              cluster
              clusterRadius={50}
              clusterMaxZoomLevel={14}
              clusterProperties={{
                // sum of 1s for each subscription (NOT PPV) stream in the cluster —
                // PPV streams are red, so they don't pull a cluster purple.
                subscriberCount: [
                  '+',
                  ['case', ['all', ['get', 'subscribersOnly'], ['!', ['get', 'ppv']]], 1, 0],
                ],
                // sum of 1s for the viewer's own stream(s) — subtracted from the
                // displayed count so a streamer is never counted in their cluster.
                selfCount: ['+', ['case', ['get', 'isSelf'], 1, 0]],
              }}
              onPress={handleSourcePress}
            >
              <CircleLayer
                id="cluster-circles"
                filter={['has', 'point_count']}
                style={{
                  // purple if every stream in cluster is subscriber-only, red otherwise
                  circleColor: [
                    'case',
                    ['==', ['get', 'subscriberCount'], ['get', 'point_count']],
                    PIN_PURPLE,
                    PIN_RED,
                  ] as any,
                  circleRadius: ['step', ['get', 'point_count'], 18, 5, 22, 15, 26] as any,
                  circleStrokeWidth: 2,
                  circleStrokeColor: PIN_BORDER,
                  circleOpacity: 0.95,
                }}
              />
              <SymbolLayer
                id="cluster-count"
                filter={['has', 'point_count']}
                style={{
                  // Count excludes the viewer's own stream(s) in the cluster.
                  textField: [
                    'case',
                    ['>', ['-', ['get', 'point_count'], ['get', 'selfCount']], 1],
                    ['to-string', ['-', ['get', 'point_count'], ['get', 'selfCount']]],
                    '',
                  ] as any,
                  textSize: 13,
                  textColor: PIN_BORDER,
                  textAllowOverlap: true,
                  textIgnorePlacement: true,
                }}
              />
              <CircleLayer
                id="single-circles"
                filter={
                  [
                    'all',
                    ['!', ['has', 'point_count']],
                    ['==', ['get', 'precision'], 'exact'],
                  ] as any
                }
                style={{
                  circleColor: [
                    'case',
                    ['get', 'isSelf'],
                    PIN_BLACK,
                    ['get', 'ppv'],
                    PIN_RED,
                    ['get', 'subscribersOnly'],
                    PIN_PURPLE,
                    PIN_RED,
                  ] as any,
                  circleRadius: 14,
                  circleStrokeWidth: 2,
                  circleStrokeColor: PIN_BORDER,
                  circleOpacity: 0.95,
                }}
              />
              <CircleLayer
                id="single-city"
                filter={
                  [
                    'all',
                    ['!', ['has', 'point_count']],
                    ['==', ['get', 'precision'], 'city'],
                  ] as any
                }
                style={{
                  circleColor: [
                    'case',
                    ['get', 'isSelf'],
                    PIN_BLACK,
                    ['get', 'ppv'],
                    PIN_RED,
                    ['get', 'subscribersOnly'],
                    PIN_PURPLE,
                    PIN_RED,
                  ] as any,
                  circleRadius: 44,
                  circleOpacity: 0.35,
                  circleBlur: 0.85,
                  circleStrokeWidth: 1,
                  circleStrokeColor: [
                    'case',
                    ['get', 'isSelf'],
                    PIN_BLACK,
                    ['get', 'ppv'],
                    PIN_RED,
                    ['get', 'subscribersOnly'],
                    PIN_PURPLE,
                    PIN_RED,
                  ] as any,
                  circleStrokeOpacity: 0.6,
                }}
              />
              <CircleLayer
                id="single-country"
                filter={
                  [
                    'all',
                    ['!', ['has', 'point_count']],
                    ['==', ['get', 'precision'], 'country'],
                  ] as any
                }
                style={{
                  circleColor: [
                    'case',
                    ['get', 'isSelf'],
                    PIN_BLACK,
                    ['get', 'ppv'],
                    PIN_RED,
                    ['get', 'subscribersOnly'],
                    PIN_PURPLE,
                    PIN_RED,
                  ] as any,
                  circleRadius: 72,
                  circleOpacity: 0.25,
                  circleBlur: 1,
                  circleStrokeWidth: 0,
                }}
              />
              {/* "PPV" label on unclustered pay-per-view pins. */}
              <SymbolLayer
                id="single-ppv-label"
                filter={['all', ['!', ['has', 'point_count']], ['==', ['get', 'ppv'], true]] as any}
                style={{
                  textField: 'PPV',
                  textSize: 9,
                  textColor: PIN_BORDER,
                  textAllowOverlap: true,
                  textIgnorePlacement: true,
                }}
              />
              {/* White star on unclustered subscription-paywall pins that are NOT PPV
              (a PPV stream shows "PPV" instead, even if it's also subscriber-only). */}
              <SymbolLayer
                id="single-sub-star"
                filter={
                  [
                    'all',
                    ['!', ['has', 'point_count']],
                    ['==', ['get', 'subscribersOnly'], true],
                    ['!=', ['get', 'ppv'], true],
                  ] as any
                }
                style={{
                  textField: '★',
                  textSize: 13,
                  textColor: PIN_BORDER,
                  textAllowOverlap: true,
                  textIgnorePlacement: true,
                }}
              />
            </ShapeSource>

            {/* Count bubbles — server-side per-tile aggregates at low zoom. Populated
            only in count mode (empty in pins mode), so they never overlap the
            individual pins above. Tap drills in. */}
            <ShapeSource id="tile-counts" shape={countsGeoJSON} onPress={handleCountPress}>
              <CircleLayer
                id="count-circles"
                style={{
                  circleColor: PIN_RED,
                  circleRadius: ['step', ['get', 'count'], 18, 10, 22, 100, 26, 1000, 30] as any,
                  circleStrokeWidth: 2,
                  circleStrokeColor: PIN_BORDER,
                  circleOpacity: 0.95,
                }}
              />
              <SymbolLayer
                id="count-labels"
                style={{
                  textField: ['get', 'label'] as any,
                  textSize: 13,
                  textColor: PIN_BORDER,
                  textAllowOverlap: true,
                  textIgnorePlacement: true,
                }}
              />
            </ShapeSource>
          </Mapbox.MapView>
        </Animated.View>
      </Animated.View>

      {/* Top scrim — paper100 fade muting the globe behind the top stack */}
      <LinearGradient
        pointerEvents="none"
        colors={[TOP_SCRIM_TOP, TOP_SCRIM_MID, TOP_SCRIM_BOTTOM]}
        locations={[0, 0.6, 1]}
        style={[styles.topScrim, { height: insets.top + TOP_SCRIM_HEIGHT }]}
      />

      {/* Top stack — header, search, chips, scale */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none" onTouchStart={collapseClock}>
        <SafeAreaView edges={['top']} pointerEvents="box-none">
          <ScreenHeader
            style={styles.headerPad}
            pointerEvents="box-none"
            right={
              liveCount > 0 ? (
                <Pill size="sm" variant="accent" label={`${liveCount} LIVE`} />
              ) : undefined
            }
          />

          {PLANETS.length > 1 && (
            <View style={styles.planetRow} pointerEvents="box-none">
              <PlanetSwitcher
                planets={PLANETS.map((p) => ({ id: p.id, name: p.name, glyph: p.glyph }))}
                activeId={activePlanetId}
                onChange={(id) => changePlanet(id as PlanetId)}
                disabled={transitioning}
              />
            </View>
          )}

          <View style={styles.searchRow}>
            <SearchBar
              value={query}
              onChangeText={setQuery}
              onClear={() => setQuery('')}
              placeholder="Search streams, places, or people"
            />
          </View>

          <CategoryChipRow
            categories={CATEGORIES}
            value={chipId}
            onChange={setChipId}
            style={styles.chipRow}
          />

          <View style={styles.scaleRow} pointerEvents="none">
            <ScaleBar centerLat={mapCenterLat} zoom={mapZoom} maxWidthPx={120} />
          </View>
        </SafeAreaView>
      </View>

      {/* Banner */}
      {banner && (
        <View
          style={[styles.bannerWrapper, { top: insets.top + 184 }]}
          pointerEvents="box-none"
          onTouchStart={collapseClock}
        >
          <StreamStateBanner
            variant={banner.kind}
            onDismiss={dismissBanner}
            onTap={banner.kind === 'resumed' ? handleBannerTap : undefined}
            autoDismissMs={
              banner.kind === 'disconnected' && banner.broadcasterHandle ? 0 : undefined
            }
          />
        </View>
      )}

      {/* Pin-tap cards */}
      {selectedStream && (
        <View style={styles.cardWrapper} pointerEvents="box-none" onTouchStart={collapseClock}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectedStream(null)} />
          <DiscoveryHandoffCard
            stream={toDiscovery(selectedStream)}
            onDismiss={() => setSelectedStream(null)}
          />
        </View>
      )}
      {selectedClusterStreams && (
        <View style={styles.cardWrapper} pointerEvents="box-none" onTouchStart={collapseClock}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setSelectedClusterStreams(null)}
          />
          <DiscoveryHandoffCard
            streams={selectedClusterStreams.map(toDiscovery)}
            onDismiss={() => setSelectedClusterStreams(null)}
          />
        </View>
      )}

      {/* Time machine — pinned at the very bottom (above the tab bar). The
          drawer rides on top of it (its bottom tracks the clock height). */}
      <Animated.View style={styles.timeScrubber}>
        <TimeScrubber
          offsetMs={timeOffsetMs}
          onOffsetChange={setTimeOffsetMs}
          collapseSignal={clockCollapseSignal}
          onExpandedChange={handleClockExpandedChange}
        />
      </Animated.View>

      {/* Bottom drawer — sits flush above the clock; closed by default, opens
          to peek when the user searches or filters, expands on "See all".
          Interacting with the drawer does NOT collapse the clock (like the
          globe) — the two operate independently; only other UI collapses it. */}
      <Animated.View style={[styles.drawer, { height: drawerHeight, bottom: clockHeight }]}>
        <View
          {...gripPanResponder.panHandlers}
          style={styles.gripHitArea}
          accessibilityRole="button"
          accessibilityLabel={drawerState === 'closed' ? 'Open results' : 'Close results'}
        >
          <View style={styles.drawerGrip} />
        </View>

        {drawerState !== 'closed' && (
          <>
            <View style={styles.drawerHeader}>
              <Text variant="monoLabel" color={theme.colors.text.muted}>
                {drawerHeaderLabel(query, chipId, visibleStreams.length)}
              </Text>
              <Pressable onPress={handleSeeAllPress} hitSlop={8}>
                <Text variant="bodyEmphasized" color={theme.colors.accent.default}>
                  {drawerState === 'expanded' ? 'Less' : 'More'}
                </Text>
              </Pressable>
            </View>

            {visibleStreams.length === 0 ? (
              <DrawerEmptyState chipId={chipId} query={query} />
            ) : drawerState === 'expanded' ? (
              <ScrollView
                contentContainerStyle={styles.drawerVerticalList}
                showsVerticalScrollIndicator={false}
              >
                {visibleStreams.map((s) => (
                  <StreamCard
                    key={s.id}
                    variant="compact"
                    title={s.title}
                    viewerCount={s.viewerCount}
                    channel={`@${s.host?.handle ?? 'unknown'}`}
                    city={s.host?.displayName ?? undefined}
                    isLive={s.isLive}
                    onPress={() => joinStream(s)}
                  />
                ))}
              </ScrollView>
            ) : (
              <ScrollView
                horizontal
                contentContainerStyle={styles.drawerRail}
                showsHorizontalScrollIndicator={false}
              >
                {visibleStreams.map((s) => (
                  <StreamCard
                    key={s.id}
                    variant="trending"
                    title={s.title}
                    viewerCount={s.viewerCount}
                    channel={`@${s.host?.handle ?? 'unknown'}`}
                    city={s.host?.displayName ?? undefined}
                    isLive={s.isLive}
                    onPress={() => joinStream(s)}
                  />
                ))}
              </ScrollView>
            )}
          </>
        )}
      </Animated.View>
    </View>
  )
}

function drawerHeaderLabel(query: string, chipId: string | null, count: number): string {
  if (query.trim().length > 0) {
    return count === 0 ? 'No matches' : `${count} match${count === 1 ? '' : 'es'}`
  }
  if (chipId === 'camera') return 'Camera streams'
  if (chipId === 'audio') return 'Audio streams'
  if (chipId === 'city') return 'In your city'
  if (chipId === 'country') return 'In your country'
  return 'Nearby now'
}

function DrawerEmptyState({ chipId, query }: { chipId: string | null; query: string }) {
  const isFilterStub = chipId === 'city' || chipId === 'country'
  const body =
    query.trim().length > 0
      ? 'No matches. Try a different search.'
      : isFilterStub
        ? 'This filter is coming soon.'
        : 'No live streams nearby right now.'

  return (
    <View style={styles.drawerEmpty}>
      <Text variant="body" color={theme.colors.text.muted} style={styles.drawerEmptyText}>
        {body}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg.primary },
  topScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  // The shared header sits at safe-area-top + sm; the search field below at
  // +sm. Dashboard / stream preview mirror this exactly so the field doesn't
  // jump between tabs.
  headerPad: {
    paddingTop: theme.spacing.sm,
  },
  planetRow: {
    alignItems: 'center',
    paddingTop: theme.spacing.sm,
  },
  searchRow: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },
  chipRow: {
    paddingTop: theme.spacing.sm,
  },
  scaleRow: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },
  bannerWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: theme.spacing.md,
  },
  cardWrapper: {
    position: 'absolute',
    bottom: DRAWER_PEEK_H,
    left: 0,
    right: 0,
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  timeScrubber: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  drawer: {
    position: 'absolute',
    left: 0,
    right: 0,
    // `bottom` is set inline to the animated clock height so the drawer rides
    // flush above the clock.
    overflow: 'hidden',
    backgroundColor: theme.colors.bg.glass,
    borderTopLeftRadius: theme.radius.md,
    borderTopRightRadius: theme.radius.md,
    borderTopWidth: 1,
    borderColor: theme.colors.border.subtle,
    paddingHorizontal: theme.spacing.md,
    ...theme.elevation.sheet,
  },
  // Grip hit area — generous touch target. The View itself is 48px tall
  // and pads the grip down 10px from the top so the visible bar sits
  // exactly where it did at 24px height. `marginBottom: -24` pulls the
  // next sibling (drawerHeader) back to its original y position, so
  // layout is unchanged — only the touch area grows. The PanResponder
  // attached to this View captures taps + swipes; the overlapped header
  // area still routes its own Pressable taps correctly (RN dispatches
  // to the topmost view with a responder).
  gripHitArea: {
    height: 48,
    paddingTop: 10,
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: -24,
  },
  drawerGrip: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border.strong,
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xs,
    paddingBottom: theme.spacing.sm,
  },
  drawerRail: {
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
    paddingBottom: theme.spacing.sm,
  },
  drawerVerticalList: {
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
    paddingBottom: theme.spacing.lg,
  },
  drawerEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.lg,
  },
  drawerEmptyText: {
    textAlign: 'center',
  },
})
