// src/components/screens/GlobeScreen.tsx
//
// 12.6 migration target. The discovery screen now composes the
// design-system equivalents of its overlays:
//
//   • StreamStateBanner (feature) replaces the inline reconnect /
//     ended / resumed banner. The screen retains the signal-consume +
//     polling state machine (per the feature's domain-blind
//     contract); only the rendering moves to the feature. Per-variant
//     auto-dismiss timers move into the feature too — the screen's
//     own ended-8s + disconnected-5min useEffects retire.
//   • DiscoveryHandoffCard (feature) replaces both the single tap-to-
//     preview card AND the cluster card. Variant is inferred from
//     prop shape (`{ stream }` vs `{ streams }`).
//   • BrandMark + Pill compose the header (wordmark + LIVE count).
//   • IconButton for the Mapbox "← Globe" back affordance at deep
//     zoom.
//   • Empty state uses Card / Text / Button primitives (the rgba
//     glass card carries one inline hex because there's no dark-
//     glass surface token today — the card sits over the globe,
//     not the cream canvas).
//
// EarthScene + Mapbox integration are untouched; this is purely an
// overlay-layer migration.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Animated, Pressable, StyleSheet, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import Mapbox from '@rnmapbox/maps'
import { consumeStreamSignal } from '@/lib/streamSignals'
import { streamsApi } from '@/api/streams'
import { theme } from '@/tokens/theme'
import { useLocation } from '@/hooks/useLocation'
import { useStreamsNear } from '@/hooks/useStreamsNear'
import { Text } from '@/components/primitives/Text'
import { Pill } from '@/components/primitives/Pill'
import { BrandMark } from '@/components/primitives/BrandMark'
import { IconButton } from '@/components/primitives/IconButton'
import { Button } from '@/components/primitives/Button'
import { Icon } from '@/components/primitives/Icon'
import { StreamStateBanner } from '@/components/features/stream/StreamStateBanner'
import {
  DiscoveryHandoffCard,
  type DiscoveryStream,
} from '@/components/features/stream/DiscoveryHandoffCard'
import { EarthScene } from '@/canvas/scenes/earth'
import type { Stream } from '@/types'

const MAPBOX_DEACTIVATE_ZOOM = 3
Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '')

type BannerData =
  | { kind: 'disconnected'; broadcasterHandle: string | null }
  | { kind: 'ended' }
  | { kind: 'kicked' }
  | { kind: 'resumed'; stream: Stream; broadcasterHandle: string | null }

export function GlobeScreen() {
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

  useEffect(() => {
    coordsRef.current = coords
  }, [coords])

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

  // Disconnected → resumed polling. The screen owns the signal → variant
  // transition; the feature owns the per-variant visual + the safety-net
  // auto-dismiss timer (5min on disconnected, 8s on ended, 8s on kicked).
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

  // ── Mapbox handoff (deep-zoom street-level scene) ──────────────────────────
  const mapboxSettledRef = useRef(false)
  const mapboxFade = useRef(new Animated.Value(0)).current
  const [mapboxActive, setMapboxActive] = useState(false)
  const [mapboxEverActivated, setMapboxEverActivated] = useState(false)
  const [mapCenter, setMapCenter] = useState({ lat: 0, lng: 0 })

  function activateMapbox(center: { lat: number; lng: number }) {
    if (mapboxActive) return
    mapboxSettledRef.current = false
    setMapboxEverActivated(true)
    setMapboxActive(true)
    setMapCenter(center)
    Animated.timing(mapboxFade, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start()
    setTimeout(() => {
      mapboxSettledRef.current = true
    }, 1500)
  }

  function deactivateMapbox() {
    if (!mapboxActive) return
    setMapboxActive(false)
    Animated.timing(mapboxFade, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start()
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

  // Keep preview state honest when the underlying streams list refreshes.
  useEffect(() => {
    if (!selectedStream || !streams) return
    const updated = streams.find((s) => s.id === selectedStream.id)
    if (!updated) setSelectedStream(null)
    else if (updated !== selectedStream) setSelectedStream(updated)
  }, [streams])

  useEffect(() => {
    if (!selectedClusterStreams || !streams) return
    const updated = selectedClusterStreams
      .map((s) => streams.find((x) => x.id === s.id))
      .filter((s): s is Stream => s != null)
    if (updated.length === 0) setSelectedClusterStreams(null)
    else setSelectedClusterStreams(updated)
  }, [streams])

  function joinStream(stream: Stream) {
    if (!stream.mediasoupRoomId) return
    setSelectedStream(null)
    setSelectedClusterStreams(null)
    router.push({
      pathname: `/(app)/stream/${stream.mediasoupRoomId}`,
      params: { streamId: stream.id, sources: (stream.sources ?? []).join(',') },
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

  const liveCount = streams?.length ?? 0

  return (
    <View style={styles.container}>
      <EarthScene
        streams={streams ?? []}
        coords={coords}
        onPinTap={(s) => {
          setSelectedStream(s)
          setSelectedClusterStreams(null)
        }}
        onClusterTap={(ss) => {
          setSelectedClusterStreams(ss)
          setSelectedStream(null)
        }}
        onDeepZoom={activateMapbox}
        disabled={mapboxActive}
      />

      {mapboxEverActivated && (
        <Animated.View
          style={[StyleSheet.absoluteFill, { opacity: mapboxFade }]}
          pointerEvents={mapboxActive ? 'auto' : 'none'}
        >
          <Mapbox.MapView
            style={StyleSheet.absoluteFill}
            styleURL={Mapbox.StyleURL.SatelliteStreet}
            onCameraChanged={(state) => {
              if (
                mapboxSettledRef.current &&
                state.properties.zoom < MAPBOX_DEACTIVATE_ZOOM
              ) {
                deactivateMapbox()
              }
            }}
          >
            <Mapbox.Camera
              centerCoordinate={[mapCenter.lng, mapCenter.lat]}
              zoomLevel={4}
              animationMode="flyTo"
              animationDuration={600}
            />
            {streams
              ?.filter((s) => s.lat != null && s.lng != null)
              .map((stream) => (
                <Mapbox.MarkerView
                  key={stream.id}
                  coordinate={[stream.lng!, stream.lat!]}
                >
                  <Pressable
                    style={styles.mapboxPinHit}
                    onPress={() => {
                      setSelectedStream(stream)
                      setSelectedClusterStreams(null)
                    }}
                  >
                    <View style={styles.mapboxPinDot} />
                  </Pressable>
                </Mapbox.MarkerView>
              ))}
          </Mapbox.MapView>
        </Animated.View>
      )}

      {mapboxActive && (
        <View
          style={[styles.mapboxBackRow, { top: insets.top + 8 }]}
          pointerEvents="box-none"
        >
          <IconButton
            name="arrow-left"
            variant="surface"
            size="md"
            onPress={deactivateMapbox}
            accessibilityLabel="Back to globe"
          />
        </View>
      )}

      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <View style={styles.wordmark}>
              <BrandMark size="hero" />
              <Text variant="display">WRLD</Text>
            </View>
            {liveCount > 0 && (
              <Pill
                size="sm"
                variant="accent"
                label={`${liveCount} LIVE`}
              />
            )}
          </View>
        </SafeAreaView>
      </View>

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
            <Button
              label="Go live"
              onPress={() => router.push('/(app)/dashboard')}
            />
          </View>
        </View>
      )}

      {banner && (
        <View
          style={[styles.bannerWrapper, { top: insets.top + 56 }]}
          pointerEvents="box-none"
        >
          <StreamStateBanner
            variant={banner.kind}
            onDismiss={dismissBanner}
            onTap={banner.kind === 'resumed' ? handleBannerTap : undefined}
            autoDismissMs={banner.kind === 'disconnected' && banner.broadcasterHandle ? 0 : undefined}
          />
        </View>
      )}

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
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg.primary },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },
  wordmark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },

  // Empty-state card sits OVER the globe (dark backdrop), so it carries
  // a dark glass background even though the rest of the app is cream.
  // A future bg.darkGlass token would replace the inline rgba here.
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
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.accent.surface,
    borderWidth: 2,
    borderColor: theme.colors.accent.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.xs,
  },
  center: { textAlign: 'center' },

  bannerWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: theme.spacing.md,
  },
  cardWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },

  mapboxPinHit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  mapboxPinDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.colors.accent.default,
    borderWidth: 2,
    borderColor: theme.colors.text.inverse,
  },
  mapboxBackRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: theme.spacing.lg,
    flexDirection: 'row',
  },
})
