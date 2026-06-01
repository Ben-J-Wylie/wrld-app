// src/components/screens/GlobeScreenMapbox.tsx
//
// Full-Mapbox globe replacement for GlobeScreen.
// Uses projection="globe" so the MapView covers the full experience
// from outer-space overview to street-level detail with no seam.
//
// Revert: change the one-line import in app/(app)/globe.tsx back to GlobeScreen.
// This file and GlobeScreen.tsx / EarthScene.tsx are entirely independent.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import Mapbox, { Camera, ShapeSource, CircleLayer, SymbolLayer } from '@rnmapbox/maps'
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
import {
  DiscoveryHandoffCard,
  type DiscoveryStream,
} from '@/components/features/stream/DiscoveryHandoffCard'
import type { Stream } from '@/types'

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '')

const PIN_CLUSTER = '#5B8CFF'
const PIN_SINGLE  = '#FF3B5C'
const PIN_BORDER  = '#FFFFFF'

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
  const bannerPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const coordsRef = useRef(coords)

  const cameraRef = useRef<React.ElementRef<typeof Camera>>(null)
  const sourceRef = useRef<ShapeSource>(null)
  const hasAutoOrientedRef = useRef(false)
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

  function handleCameraChanged(state: { properties: { center: number[] }; gestures: { isGestureActive: boolean } }) {
    if (state.gestures.isGestureActive) {
      // Sync rotation refs so auto-rotation resumes from where user left off
      const [lng, lat] = state.properties.center as [number, number]
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

  useEffect(() => {
    if (!coords || hasAutoOrientedRef.current) return
    hasAutoOrientedRef.current = true
    userInteractingRef.current = true
    rotLngRef.current = ((coords.longitude + 360) % 360)
    rotLatRef.current = coords.latitude
    cameraRef.current?.flyTo([coords.longitude, coords.latitude], 1500)
    setTimeout(() => { userInteractingRef.current = false }, 2500)
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
          streamId:       s.id,
          mediasoupRoomId: s.mediasoupRoomId ?? '',
          title:          s.title,
          viewerCount:    s.viewerCount,
          handle:         s.host?.handle ?? 'unknown',
          sources:        (s.sources ?? []).join(','),
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
        onCameraChanged={handleCameraChanged}
        onPress={() => {
          pauseRotation()
          setSelectedStream(null)
          setSelectedClusterStreams(null)
        }}
      >
        <Camera
          ref={cameraRef}
          centerCoordinate={[0, 20]}
          zoomLevel={1.0}
          minZoomLevel={0.5}
          maxZoomLevel={20}
          animationMode="none"
          animationDuration={0}
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
          {/* Cluster circles */}
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
          {/* Cluster count */}
          <SymbolLayer
            id="cluster-count"
            filter={['has', 'point_count']}
            style={{
              textField: ['get', 'point_count_abbreviated'] as any,
              textSize: 13,
              textColor: PIN_BORDER,
              textAllowOverlap: true,
              textIgnorePlacement: true,
            }}
          />
          {/* Single stream circles */}
          <CircleLayer
            id="single-circles"
            filter={['!', ['has', 'point_count']]}
            style={{
              circleColor: PIN_SINGLE,
              circleRadius: 14,
              circleStrokeWidth: 2,
              circleStrokeColor: PIN_BORDER,
              circleOpacity: 0.95,
            }}
          />
          {/* Single stream viewer count */}
          <SymbolLayer
            id="single-count"
            filter={['!', ['has', 'point_count']]}
            style={{
              textField: ['get', 'viewerCount'] as any,
              textSize: 11,
              textColor: PIN_BORDER,
              textAllowOverlap: true,
              textIgnorePlacement: true,
            }}
          />
        </ShapeSource>
      </Mapbox.MapView>

      {/* Header */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <View style={styles.wordmark}>
              <BrandMark size="hero" />
              <Text variant="display">WRLD</Text>
            </View>
            {liveCount > 0 && (
              <Pill size="sm" variant="accent" label={`${liveCount} LIVE`} />
            )}
          </View>
        </SafeAreaView>
      </View>

      {/* Empty state */}
      {liveCount === 0 && coords && (
        <View style={styles.emptyOverlay} pointerEvents="box-none">
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconFrame}>
              <Icon name="globe" size="lg" color={theme.colors.accent.default} />
            </View>
            <Text variant="heading" color={theme.colors.text.inverse} style={styles.center}>
              No streams nearby
            </Text>
            <Text variant="body" color={theme.colors.text.muted} style={styles.center}>
              Be the first to go live in your area
            </Text>
            <Button label="Go live" onPress={() => router.push('/(app)/dashboard')} />
          </View>
        </View>
      )}

      {/* Banner */}
      {banner && (
        <View style={[styles.bannerWrapper, { top: insets.top + 56 }]} pointerEvents="box-none">
          <StreamStateBanner
            variant={banner.kind}
            onDismiss={dismissBanner}
            onTap={banner.kind === 'resumed' ? handleBannerTap : undefined}
            autoDismissMs={banner.kind === 'disconnected' && banner.broadcasterHandle ? 0 : undefined}
          />
        </View>
      )}

      {/* Single stream card */}
      {selectedStream && (
        <View style={styles.cardWrapper} pointerEvents="box-none">
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectedStream(null)} />
          <DiscoveryHandoffCard
            stream={toDiscovery(selectedStream)}
            onDismiss={() => setSelectedStream(null)}
          />
        </View>
      )}

      {/* Cluster card */}
      {selectedClusterStreams && (
        <View style={styles.cardWrapper} pointerEvents="box-none">
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectedClusterStreams(null)} />
          <DiscoveryHandoffCard
            streams={selectedClusterStreams.map(toDiscovery)}
            onDismiss={() => setSelectedClusterStreams(null)}
          />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090B1F' },
  safeArea:  { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },
  wordmark: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  emptyOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  emptyCard: {
    backgroundColor: 'rgba(10, 10, 15, 0.88)',
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    padding: theme.spacing.xl,
    alignItems: 'center',
    gap: theme.spacing.sm,
    maxWidth: 280,
  },
  emptyIconFrame: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: theme.colors.accent.surface,
    borderWidth: 2, borderColor: theme.colors.accent.border,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: theme.spacing.xs,
  },
  center: { textAlign: 'center' },
  bannerWrapper: {
    position: 'absolute', left: 0, right: 0,
    paddingHorizontal: theme.spacing.md,
  },
  cardWrapper: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
})
