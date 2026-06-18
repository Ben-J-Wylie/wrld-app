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
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import Mapbox, { Camera, ShapeSource, CircleLayer, SymbolLayer, Atmosphere } from '@rnmapbox/maps'
import { consumeStreamSignal } from '@/lib/streamSignals'
import { returnToActiveBroadcast } from '@/lib/activeBroadcast'
import { streamsApi } from '@/api/streams'
import { theme } from '@/tokens/theme'
import { useAuthStore } from '@/stores/authStore'
import { useLocation } from '@/hooks/useLocation'
import { useViewportDiscovery, type TileCount } from '@/hooks/useViewportDiscovery'
import { useHistoricalClips } from '@/hooks/useHistoricalClips'
import type { ClipPin } from '@/api/clips'
import { useStreamsNear } from '@/hooks/useStreamsNear'
import { usePublicConfig, configNumber } from '@/hooks/usePublicConfig'
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
import { CategoryChipRow, type Category } from '@/components/sections/CategoryChipRow'
import type { Stream } from '@/types'

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '')

const PIN_RED    = '#FF3B5C'
const PIN_PURPLE = '#A855F7'
const PIN_BLACK  = '#111111' // the viewer's own stream pin (tap → return to it)
const PIN_BORDER = '#FFFFFF'

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
const DRAWER_CLOSED_H            = 44   // grip + breathing room above the tab bar
const DRAWER_PEEK_H              = 220  // header + StreamCard.trending (144) + rail padding
const DRAWER_EXPANDED_TOP_OFFSET = 190  // top stack + chrome reserved above the expanded sheet
const TAP_DRAG_TOLERANCE         = 10   // |dy| under this is a tap, not a drag
const COMMIT_DRAG_DISTANCE       = 60   // px past TAP_DRAG_TOLERANCE before a drag commits

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
const GLOBE_FRAC_OPEN   = 0.48
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
const TOP_SCRIM_TOP    = 'rgba(236,230,214,1)'
const TOP_SCRIM_MID    = 'rgba(236,230,214,0.85)'
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
  const { pins: streams, counts, setView } = useViewportDiscovery({ pinZoomThreshold, countMinZoom })
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
  const isSelfStream = useCallback(
    (s: Stream) => !!myUserId && s.hostId === myUserId,
    [myUserId],
  )

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
    if (!historicalMode) return
    const tid = setInterval(() => setNowTick((n) => n + 1), 1000)
    return () => clearInterval(tid)
  }, [historicalMode])
  const playheadMs = historicalMode ? Date.now() - timeOffsetMs : 0
  const { data: clipPinsData } = useHistoricalClips(playheadMs)
  const clipPins = clipPinsData ?? []
  const clipPinById = useMemo(
    () => new Map(clipPins.map((c) => [c.id, c] as const)),
    [clipPins],
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
    () => (historicalMode ? clipPins.map(clipToStream) : streams),
    [historicalMode, clipPins, streams],
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

  const hasActiveSearch =
    query.trim().length > 0 || (chipId !== null && chipId !== 'all')

  const bannerPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const coordsRef = useRef(coords)

  const cameraRef = useRef<React.ElementRef<typeof Camera>>(null)
  const sourceRef = useRef<ShapeSource>(null)
  const mapViewRef = useRef<React.ElementRef<typeof Mapbox.MapView>>(null)
  const mapZoomRef = useRef(1.5)
  const lastViewPushRef = useRef(0)
  const hasAutoOrientedRef  = useRef(false)
  const mapReadyRef         = useRef(false)
  const pendingOrientRef    = useRef<[number, number] | null>(null)
  const autoRotateRef      = useRef<ReturnType<typeof setInterval> | null>(null)
  const interactTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rotLngRef          = useRef(0)
  const rotLatRef          = useRef(20)
  const userInteractingRef = useRef(false)
  const gestureActiveRef   = useRef(false)

  useEffect(() => { coordsRef.current = coords }, [coords])

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
          s => s.host?.handle === broadcasterHandle && s.isLive && s.mediasoupRoomId,
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
    interactTimerRef.current = setTimeout(() => {
      userInteractingRef.current = false
    }, 4000)
  }

  // Push the current viewport (the tiles the map shows) to the discovery
  // subscription. Throttled — onCameraChanged fires continuously (incl. the 80ms
  // auto-rotate tick); the hook additionally debounces + skips unchanged tile sets.
  const pushViewport = useCallback(() => {
    const map = mapViewRef.current
    if (!map) return
    map.getVisibleBounds()
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
    if (state.gestures.isGestureActive) {
      rotLngRef.current = ((lng + 360) % 360)
      rotLatRef.current = lat
      gestureActiveRef.current = true
      pauseRotation()
    } else {
      gestureActiveRef.current = false
    }
  }

  useEffect(() => {
    autoRotateRef.current = setInterval(() => {
      if (gestureActiveRef.current || userInteractingRef.current) return
      rotLngRef.current = ((rotLngRef.current + 0.15) + 360) % 360
      const lng = rotLngRef.current > 180 ? rotLngRef.current - 360 : rotLngRef.current
      cameraRef.current?.setCamera({ centerCoordinate: [lng, rotLatRef.current], animationDuration: 0 })
    }, 80)
    return () => {
      if (autoRotateRef.current) clearInterval(autoRotateRef.current)
      if (interactTimerRef.current) clearTimeout(interactTimerRef.current)
    }
  }, [])

  // ── GPS auto-orient on first fix ──────────────────────────────────────────

  function flyToUserLocation(lng: number, lat: number) {
    cameraRef.current?.setCamera({
      centerCoordinate: [lng, lat],
      animationDuration: 1500,
      animationMode: 'easeTo',
    })
    setTimeout(() => { userInteractingRef.current = false }, 2500)
  }

  function handleMapLoad() {
    mapReadyRef.current = true
    if (pendingOrientRef.current) {
      const [lng, lat] = pendingOrientRef.current
      pendingOrientRef.current = null
      flyToUserLocation(lng, lat)
    } else {
      cameraRef.current?.setCamera({
        centerCoordinate: [0, 20],
        zoomLevel: 1.5,
        animationMode: 'none',
        animationDuration: 0,
      })
    }
    // Initial viewport subscription once the camera has settled.
    setTimeout(pushViewport, 400)
  }

  useEffect(() => {
    if (!coords || hasAutoOrientedRef.current) return
    hasAutoOrientedRef.current = true
    userInteractingRef.current = true
    rotLngRef.current = ((coords.longitude + 360) % 360)
    rotLatRef.current = coords.latitude
    if (mapReadyRef.current) {
      flyToUserLocation(coords.longitude, coords.latitude)
    } else {
      pendingOrientRef.current = [coords.longitude, coords.latitude]
    }
  }, [coords])

  // ── Keep preview cards in sync with streams refresh ────────────────────────

  useEffect(() => {
    if (!selectedStream || !pins) return
    const updated = pins.find(s => s.id === selectedStream.id)
    if (!updated) setSelectedStream(null)
    else if (updated !== selectedStream) setSelectedStream(updated)
  }, [pins])

  useEffect(() => {
    if (!selectedClusterStreams || !pins) return
    const updated = selectedClusterStreams
      .map(s => pins.find(x => x.id === s.id))
      .filter((s): s is Stream => s != null)
    if (updated.length === 0) setSelectedClusterStreams(null)
    else setSelectedClusterStreams(updated)
  }, [pins])

  // ── Filtered streams (query + chip) ────────────────────────────────────────

  const visibleStreams = useMemo(() => {
    const all = nearbyStreams
    // A streamer never sees their own stream in the drawer. All other
    // curation rules below are unchanged.
    let out = all.filter(s => !isSelfStream(s))
    if (chipId === 'camera') {
      out = out.filter(s => (s.sources ?? []).includes('camera'))
    } else if (chipId === 'audio') {
      out = out.filter(s => (s.sources ?? []).includes('audio'))
    } else if (chipId === 'city' || chipId === 'country') {
      // TODO Phase 14a follow-up: wire reverse-geocode lookup for the
      // user's city + country so these chips can filter against the
      // backend. Today the lookup is missing, so the filter shrinks
      // to empty rather than guess.
      out = []
    }
    const q = query.trim().toLowerCase()
    if (q.length > 0) {
      out = out.filter(s =>
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
  }, [nearbyStreams, chipId, query, isSelfStream])

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

  // Open a historical clip in the replay viewer, seeking to the playhead instant.
  function watchClip(clipId: string) {
    const pin = clipPinById.get(clipId)
    if (!pin) return
    setSelectedStream(null)
    setSelectedClusterStreams(null)
    router.push({
      pathname: '/(app)/clip/[id]',
      params: {
        id: clipId,
        seekSec: String(pin.seekOffsetSec),
        title: pin.title ?? '',
        handle: pin.host.handle,
      },
    })
  }

  function toDiscovery(stream: Stream): DiscoveryStream {
    const clip = clipPinById.get(stream.id)
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
      // Clip pins (Time Machine) → "Watch" → replay viewer; live streams → "Join".
      kind: clip ? 'clip' : 'stream',
      ctaLabel: clip ? 'Watch' : 'Join',
      onJoin: clip ? () => watchClip(stream.id) : () => joinStream(stream),
    }
  }

  // ── GeoJSON feature collection from streams ───────────────────────────────

  const geoJSON = {
    type: 'FeatureCollection' as const,
    features: pins
      .filter(s => s.lat != null && s.lng != null)
      .map(s => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [s.lng!, s.lat!] },
        properties: {
          streamId:         s.id,
          mediasoupRoomId:  s.mediasoupRoomId ?? '',
          title:            s.title,
          viewerCount:      s.viewerCount,
          handle:           s.host?.handle ?? 'unknown',
          sources:          (s.sources ?? []).join(','),
          precision:        s.locationPrecision ?? 'exact',
          subscribersOnly:  s.subscribersOnly === true,
          isSelf:           treatAsSelf(s),
        },
      })),
  }

  // Count bubbles (low zoom): one per populated tile, drawn at the cluster
  // centroid the server snapped to a real pin. Empty in pins mode.
  const countsGeoJSON = {
    type: 'FeatureCollection' as const,
    // In the past, pins come from the clip feed (no server tile-counts) — render
    // clip pins directly and suppress the live count bubbles.
    features: (historicalMode ? [] : counts).map((c: TileCount) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [c.lng, c.lat] },
      properties: {
        tile: c.tile,
        count: c.count,
        label: c.count >= 1000 ? `${(c.count / 1000).toFixed(c.count >= 10000 ? 0 : 1)}k` : `${c.count}`,
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
        const leaves = await sourceRef.current?.getClusterLeaves(feature, 100, 0) as any
        const clusterStreams = ((leaves?.features ?? []) as any[])
          .map((f: any) => pins.find(s => s.id === f.properties?.streamId))
          .filter((s): s is Stream => s != null)
          // A streamer never sees their own stream in the cluster card either.
          .filter(s => !treatAsSelf(s))
        if (clusterStreams.length > 0) {
          setSelectedClusterStreams(clusterStreams)
          setSelectedStream(null)
        }
      } catch {}
    } else {
      const stream = pins.find(s => s.id === feature.properties?.streamId)
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

  const liveCount = nearbyStreams.length

  // ── Drawer animation + state coupling ──────────────────────────────────────

  // Tabs.Screen content area — measured via onLayout because
  // Dimensions.get('window') includes the tab bar / status bar and
  // would push the drawer off-screen if used as the baseline.
  const [containerH, setContainerH] = useState(0)

  function onContainerLayout(e: LayoutChangeEvent) {
    const h = e.nativeEvent.layout.height
    if (h && h !== containerH) setContainerH(h)
  }

  const expandedH = Math.max(
    DRAWER_PEEK_H,
    containerH - (insets.top + DRAWER_EXPANDED_TOP_OFFSET),
  )

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
      outputRange: [
        containerH * (GLOBE_FRAC_CLOSED - 0.5),
        containerH * (GLOBE_FRAC_OPEN - 0.5),
      ],
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

  useEffect(() => { drawerStateRef.current = drawerState }, [drawerState])
  useEffect(() => { expandedHRef.current = expandedH }, [expandedH])

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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container} onLayout={onContainerLayout}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { transform: [{ translateY: globeTranslateY }] },
        ]}
        pointerEvents="box-none"
      >
      <Mapbox.MapView
        ref={mapViewRef}
        style={StyleSheet.absoluteFill}
        styleURL={Mapbox.StyleURL.Light}
        projection="globe"
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={false}
        scaleBarEnabled={false}
        gestureSettings={{ panDecelerationFactor: Platform.OS === 'ios' ? 0.99 : undefined }}
        onCameraChanged={handleCameraChanged}
        onDidFinishLoadingMap={handleMapLoad}
        onPress={() => {
          pauseRotation()
          setSelectedStream(null)
          setSelectedClusterStreams(null)
        }}
      >
        <Atmosphere style={{ spaceColor: theme.colors.bg.primary, color: 'transparent', highColor: 'transparent', starIntensity: 0 }} />

        <Camera
          ref={cameraRef}
          defaultSettings={{ centerCoordinate: [0, 20], zoomLevel: 1.5 }}
          maxZoomLevel={20}
        />

        <ShapeSource
          id="streams"
          ref={sourceRef}
          shape={geoJSON}
          cluster
          clusterRadius={50}
          clusterMaxZoomLevel={14}
          clusterProperties={{
            // sum of 1s for each subscribersOnly stream in the cluster
            subscriberCount: ['+', ['case', ['get', 'subscribersOnly'], 1, 0]],
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
              circleColor: ['case',
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
              textField: ['case',
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
            filter={['all', ['!', ['has', 'point_count']], ['==', ['get', 'precision'], 'exact']] as any}
            style={{
              circleColor: ['case',
                ['get', 'isSelf'], PIN_BLACK,
                ['get', 'subscribersOnly'], PIN_PURPLE,
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
            filter={['all', ['!', ['has', 'point_count']], ['==', ['get', 'precision'], 'city']] as any}
            style={{
              circleColor: ['case',
                ['get', 'isSelf'], PIN_BLACK,
                ['get', 'subscribersOnly'], PIN_PURPLE,
                PIN_RED,
              ] as any,
              circleRadius: 44,
              circleOpacity: 0.35,
              circleBlur: 0.85,
              circleStrokeWidth: 1,
              circleStrokeColor: ['case',
                ['get', 'isSelf'], PIN_BLACK,
                ['get', 'subscribersOnly'], PIN_PURPLE,
                PIN_RED,
              ] as any,
              circleStrokeOpacity: 0.6,
            }}
          />
          <CircleLayer
            id="single-country"
            filter={['all', ['!', ['has', 'point_count']], ['==', ['get', 'precision'], 'country']] as any}
            style={{
              circleColor: ['case',
                ['get', 'isSelf'], PIN_BLACK,
                ['get', 'subscribersOnly'], PIN_PURPLE,
                PIN_RED,
              ] as any,
              circleRadius: 72,
              circleOpacity: 0.25,
              circleBlur: 1,
              circleStrokeWidth: 0,
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

      {/* Top scrim — paper100 fade muting the globe behind the top stack */}
      <LinearGradient
        pointerEvents="none"
        colors={[TOP_SCRIM_TOP, TOP_SCRIM_MID, TOP_SCRIM_BOTTOM]}
        locations={[0, 0.6, 1]}
        style={[
          styles.topScrim,
          { height: insets.top + TOP_SCRIM_HEIGHT },
        ]}
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
            autoDismissMs={banner.kind === 'disconnected' && banner.broadcasterHandle ? 0 : undefined}
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
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectedClusterStreams(null)} />
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
      <Animated.View
        style={[
          styles.drawer,
          { height: drawerHeight, bottom: clockHeight },
        ]}
      >
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
                {visibleStreams.map(s => (
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
                {visibleStreams.map(s => (
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
  if (chipId === 'audio')  return 'Audio streams'
  if (chipId === 'city')   return 'In your city'
  if (chipId === 'country') return 'In your country'
  return 'Nearby now'
}

function DrawerEmptyState({
  chipId,
  query,
}: {
  chipId: string | null
  query: string
}) {
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
    position: 'absolute', left: 0, right: 0,
    paddingHorizontal: theme.spacing.md,
  },
  cardWrapper: {
    position: 'absolute', bottom: DRAWER_PEEK_H, left: 0, right: 0,
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
