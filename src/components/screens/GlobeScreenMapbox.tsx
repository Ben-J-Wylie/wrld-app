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
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import Mapbox, { Camera, ShapeSource, CircleLayer, SymbolLayer, Atmosphere } from '@rnmapbox/maps'
import { consumeStreamSignal } from '@/lib/streamSignals'
import { streamsApi } from '@/api/streams'
import { theme } from '@/tokens/theme'
import { useLocation } from '@/hooks/useLocation'
import { useStreamsNear } from '@/hooks/useStreamsNear'
import { Text } from '@/components/primitives/Text'
import { Pill } from '@/components/primitives/Pill'
import { BrandMark } from '@/components/primitives/BrandMark'
import { Button } from '@/components/primitives/Button'
import { Icon } from '@/components/primitives/Icon'
import { StreamStateBanner } from '@/components/features/stream/StreamStateBanner'
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

const PIN_CLUSTER = '#5B8CFF'
const PIN_SINGLE  = '#FF3B5C'
const PIN_BORDER  = '#FFFFFF'

const SCREEN_H = Dimensions.get('window').height
const DRAWER_PEEK_H = 200
const DRAWER_EXPANDED_BOTTOM_OFFSET = 240 // top stack + chrome above expanded sheet

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
  | { kind: 'resumed'; stream: Stream; broadcasterHandle: string | null }

export function GlobeScreenMapbox() {
  const { coords } = useLocation()
  const { data: streams } = useStreamsNear(
    coords?.latitude ?? null,
    coords?.longitude ?? null,
  )
  const insets = useSafeAreaInsets()

  const [selectedStream, setSelectedStream] = useState<Stream | null>(null)
  const [selectedClusterStreams, setSelectedClusterStreams] = useState<Stream[] | null>(null)
  const [banner, setBanner] = useState<BannerData | null>(null)
  const [query, setQuery] = useState('')
  const [chipId, setChipId] = useState<string | null>(null)
  const [drawerExpanded, setDrawerExpanded] = useState(false)
  const [mapCenterLat, setMapCenterLat] = useState(20)
  const [mapZoom, setMapZoom] = useState(1.5)

  const bannerPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const coordsRef = useRef(coords)

  const cameraRef = useRef<React.ElementRef<typeof Camera>>(null)
  const sourceRef = useRef<ShapeSource>(null)
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

  function handleCameraChanged(state: {
    properties: { center: number[]; zoom: number }
    gestures: { isGestureActive: boolean }
  }) {
    const [lng, lat] = state.properties.center as [number, number]
    setMapCenterLat(lat)
    setMapZoom(state.properties.zoom)
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
    if (!selectedStream || !streams) return
    const updated = streams.find(s => s.id === selectedStream.id)
    if (!updated) setSelectedStream(null)
    else if (updated !== selectedStream) setSelectedStream(updated)
  }, [streams])

  useEffect(() => {
    if (!selectedClusterStreams || !streams) return
    const updated = selectedClusterStreams
      .map(s => streams.find(x => x.id === s.id))
      .filter((s): s is Stream => s != null)
    if (updated.length === 0) setSelectedClusterStreams(null)
    else setSelectedClusterStreams(updated)
  }, [streams])

  // ── Filtered streams (query + chip) ────────────────────────────────────────

  const visibleStreams = useMemo(() => {
    const all = streams ?? []
    let out = all
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
  }, [streams, chipId, query])

  // ── Navigation ────────────────────────────────────────────────────────────

  function joinStream(stream: Stream) {
    if (!stream.mediasoupRoomId) return
    setSelectedStream(null)
    setSelectedClusterStreams(null)
    router.push({
      pathname: `/(app)/stream/${stream.mediasoupRoomId}`,
      params: { streamId: stream.id, sources: (stream.sources ?? []).join(',') },
    })
  }

  function handleBannerTap() {
    if (!banner || banner.kind !== 'resumed' || !banner.stream.mediasoupRoomId) return
    const { stream } = banner
    dismissBanner()
    router.push({
      pathname: `/(app)/stream/${stream.mediasoupRoomId}`,
      params: { streamId: stream.id, sources: stream.sources.join(',') },
    })
  }

  function toDiscovery(stream: Stream): DiscoveryStream {
    return {
      id: stream.id,
      title: stream.title,
      handle: stream.host?.handle ?? 'unknown',
      displayName: stream.host?.displayName,
      avatarUrl: stream.host?.avatarUrl,
      viewerCount: stream.viewerCount,
      isLive: stream.isLive,
      onJoin: () => joinStream(stream),
    }
  }

  // ── GeoJSON feature collection from streams ───────────────────────────────

  const geoJSON = {
    type: 'FeatureCollection' as const,
    features: (streams ?? [])
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
        },
      })),
  }

  // ── Pin tap handling ──────────────────────────────────────────────────────

  async function handleSourcePress(e: { features: any[] }) {
    pauseRotation()
    const feature = e.features[0]
    if (!feature) return

    if (feature.properties?.cluster) {
      try {
        const leaves = await sourceRef.current?.getClusterLeaves(feature, 100, 0) as any
        const clusterStreams = ((leaves?.features ?? []) as any[])
          .map((f: any) => streams?.find(s => s.id === f.properties?.streamId))
          .filter((s): s is Stream => s != null)
        if (clusterStreams.length > 0) {
          setSelectedClusterStreams(clusterStreams)
          setSelectedStream(null)
        }
      } catch {}
    } else {
      const stream = streams?.find(s => s.id === feature.properties?.streamId)
      if (stream) {
        setSelectedStream(stream)
        setSelectedClusterStreams(null)
      }
    }
  }

  const liveCount = streams?.length ?? 0

  // ── Drawer animation ──────────────────────────────────────────────────────

  const drawerTop = useRef(new Animated.Value(SCREEN_H - DRAWER_PEEK_H)).current
  const expandedTop = insets.top + DRAWER_EXPANDED_BOTTOM_OFFSET

  useEffect(() => {
    Animated.timing(drawerTop, {
      toValue: drawerExpanded ? expandedTop : SCREEN_H - DRAWER_PEEK_H,
      ...theme.motion.patterns.overlay,
      useNativeDriver: false,
    }).start()
  }, [drawerExpanded, expandedTop, drawerTop])

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <Mapbox.MapView
        style={StyleSheet.absoluteFill}
        styleURL={Mapbox.StyleURL.SatelliteStreet}
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
        <Atmosphere style={{ spaceColor: '#D2B48C' }} />

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
          onPress={handleSourcePress}
        >
          <CircleLayer
            id="cluster-circles"
            filter={['has', 'point_count']}
            style={{
              circleColor: PIN_CLUSTER,
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
              textField: ['case', ['>', ['get', 'point_count'], 1], ['get', 'point_count_abbreviated'], ''] as any,
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
              circleColor: PIN_SINGLE,
              circleRadius: 14,
              circleStrokeWidth: 2,
              circleStrokeColor: PIN_BORDER,
              circleOpacity: 0.95,
            }}
          />
          <SymbolLayer
            id="single-count"
            filter={['all', ['!', ['has', 'point_count']], ['==', ['get', 'precision'], 'exact']] as any}
            style={{
              textField: ['case', ['>', ['get', 'viewerCount'], 0], ['to-string', ['get', 'viewerCount']], ''] as any,
              textSize: 11,
              textColor: PIN_BORDER,
              textAllowOverlap: true,
              textIgnorePlacement: true,
            }}
          />
          <CircleLayer
            id="single-city"
            filter={['all', ['!', ['has', 'point_count']], ['==', ['get', 'precision'], 'city']] as any}
            style={{
              circleColor: PIN_SINGLE,
              circleRadius: 44,
              circleOpacity: 0.35,
              circleBlur: 0.85,
              circleStrokeWidth: 1,
              circleStrokeColor: PIN_SINGLE,
              circleStrokeOpacity: 0.6,
            }}
          />
          <CircleLayer
            id="single-country"
            filter={['all', ['!', ['has', 'point_count']], ['==', ['get', 'precision'], 'country']] as any}
            style={{
              circleColor: PIN_SINGLE,
              circleRadius: 72,
              circleOpacity: 0.25,
              circleBlur: 1,
              circleStrokeWidth: 0,
            }}
          />
        </ShapeSource>
      </Mapbox.MapView>

      {/* Top stack — header, search, chips, scale */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <SafeAreaView edges={['top']} pointerEvents="box-none">
          <View style={styles.header} pointerEvents="box-none">
            <View style={styles.wordmark}>
              <BrandMark size="hero" />
              <Text variant="display">WRLD</Text>
            </View>
            {liveCount > 0 && (
              <Pill size="sm" variant="accent" label={`${liveCount} LIVE`} />
            )}
          </View>

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
        <View style={[styles.bannerWrapper, { top: insets.top + 184 }]} pointerEvents="box-none">
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
        <View style={styles.cardWrapper} pointerEvents="box-none">
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectedStream(null)} />
          <DiscoveryHandoffCard
            stream={toDiscovery(selectedStream)}
            onDismiss={() => setSelectedStream(null)}
          />
        </View>
      )}
      {selectedClusterStreams && (
        <View style={styles.cardWrapper} pointerEvents="box-none">
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectedClusterStreams(null)} />
          <DiscoveryHandoffCard
            streams={selectedClusterStreams.map(toDiscovery)}
            onDismiss={() => setSelectedClusterStreams(null)}
          />
        </View>
      )}

      {/* Bottom drawer — always visible */}
      <Animated.View
        style={[
          styles.drawer,
          {
            top: drawerTop,
            paddingBottom: insets.bottom + theme.spacing.sm,
          },
        ]}
      >
        <View style={styles.drawerGrip} />
        <View style={styles.drawerHeader}>
          <Text variant="monoLabel" color={theme.colors.text.muted}>
            {drawerHeaderLabel(query, chipId, visibleStreams.length)}
          </Text>
          <Pressable
            onPress={() => setDrawerExpanded(v => !v)}
            hitSlop={8}
          >
            <Text variant="bodyEmphasized" color={theme.colors.accent.default}>
              {drawerExpanded ? 'Collapse' : 'See all'}
            </Text>
          </Pressable>
        </View>

        {visibleStreams.length === 0 ? (
          <DrawerEmptyState
            chipId={chipId}
            query={query}
            onGoLive={() => router.push('/(app)/dashboard')}
          />
        ) : drawerExpanded ? (
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
  onGoLive,
}: {
  chipId: string | null
  query: string
  onGoLive: () => void
}) {
  const isFilterStub = chipId === 'city' || chipId === 'country'
  const body =
    query.trim().length > 0
      ? 'Try a different search.'
      : isFilterStub
        ? 'This filter is coming soon.'
        : 'Be the first to go live in your area.'

  return (
    <View style={styles.drawerEmpty}>
      <Icon name="globe" size="lg" color={theme.colors.text.subtle} />
      <Text variant="body" color={theme.colors.text.muted} style={styles.drawerEmptyText}>
        {body}
      </Text>
      {query.trim().length === 0 && !isFilterStub && (
        <Button label="Go live" onPress={onGoLive} variant="secondary" />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#D2B48C' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },
  wordmark: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  searchRow: {
    paddingHorizontal: theme.spacing.md,
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
  drawer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.bg.glass,
    borderTopLeftRadius: theme.radius.md,
    borderTopRightRadius: theme.radius.md,
    borderTopWidth: 1,
    borderColor: theme.colors.border.subtle,
    paddingHorizontal: theme.spacing.md,
    ...theme.elevation.sheet,
  },
  drawerGrip: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border.strong,
    alignSelf: 'center',
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
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
