// src/components/screens/GlobeScreen.tsx
//
// Discovery screen. Composes the Earth scene (canvas tier) with the React
// overlays that frame and respond to it: WRLD wordmark + live count,
// reconnect/ended/resumed banner, empty-state CTA, tap-to-preview card,
// cluster card, and the Mapbox street-level handoff at deep zoom.
//
// The tap-to-preview card here is the canonical seam (DESIGN.md 0.7) —
// realized today inline rather than as a feature component. Extraction to
// `src/components/features/DiscoveryHandoffCard.tsx` lands in sub-phase 12.5
// alongside the rest of the feature inventory, per the reuse rule.

import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from 'react-native'
import { useCallback, useEffect, useRef, useState } from 'react'
import { router, useFocusEffect } from 'expo-router'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import Mapbox from '@rnmapbox/maps'
import { consumeStreamSignal } from '@/lib/streamSignals'
import { streamsApi } from '@/api/streams'
import { theme } from '@/tokens/theme'
import { useLocation } from '@/hooks/useLocation'
import { useStreamsNear } from '@/hooks/useStreamsNear'
import { Avatar } from '@/components/primitives/Avatar'
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
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bannerPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const coordsRef = useRef(coords)

  useEffect(() => { coordsRef.current = coords }, [coords])

  useFocusEffect(
    useCallback(() => {
      const signal = consumeStreamSignal()
      if (!signal) return
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current)
      if (bannerPollRef.current) clearInterval(bannerPollRef.current)
      setBanner(
        signal.kind === 'ended'       ? { kind: 'ended' } :
        signal.kind === 'kicked'      ? { kind: 'kicked' } :
        { kind: 'disconnected', broadcasterHandle: signal.broadcasterHandle }
      )
    }, []),
  )

  useEffect(() => {
    if (!banner || (banner.kind !== 'ended' && banner.kind !== 'kicked')) return
    bannerTimerRef.current = setTimeout(() => setBanner(null), 8000)
    return () => { if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current) }
  }, [banner?.kind])

  useEffect(() => {
    if (!banner || banner.kind !== 'disconnected') return
    const { broadcasterHandle } = banner
    if (!broadcasterHandle) {
      bannerTimerRef.current = setTimeout(() => setBanner(null), 5 * 60 * 1000)
      return () => { if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current) }
    }
    let polls = 0
    bannerPollRef.current = setInterval(async () => {
      polls++
      if (polls > 30) { clearInterval(bannerPollRef.current!); bannerPollRef.current = null; setBanner(null); return }
      const c = coordsRef.current
      if (!c) return
      try {
        const nearby = await streamsApi.near(c.latitude, c.longitude)
        const resumed = nearby.find(s => s.host?.handle === broadcasterHandle && s.isLive && s.mediasoupRoomId)
        if (resumed?.mediasoupRoomId) {
          clearInterval(bannerPollRef.current!); bannerPollRef.current = null
          setBanner({ kind: 'resumed', stream: resumed, broadcasterHandle })
        }
      } catch {}
    }, 10_000)
    return () => { if (bannerPollRef.current) { clearInterval(bannerPollRef.current); bannerPollRef.current = null } }
  }, [banner?.kind])

  function dismissBanner() {
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current)
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
    setTimeout(() => { mapboxSettledRef.current = true }, 1500)
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
    router.push({ pathname: `/(app)/stream/${stream.mediasoupRoomId}`, params: { streamId: stream.id, sources: stream.sources.join(',') } })
  }

  // Keep preview state honest when the underlying streams list refreshes.
  useEffect(() => {
    if (!selectedStream || !streams) return
    const updated = streams.find(s => s.id === selectedStream.id)
    if (!updated) setSelectedStream(null)
    else if (updated !== selectedStream) setSelectedStream(updated)
  }, [streams])

  useEffect(() => {
    if (!selectedClusterStreams || !streams) return
    const updated = selectedClusterStreams.map(s => streams.find(x => x.id === s.id)).filter((s): s is Stream => s != null)
    if (updated.length === 0) setSelectedClusterStreams(null)
    else setSelectedClusterStreams(updated)
  }, [streams])

  function joinSelectedStream() {
    if (!selectedStream?.mediasoupRoomId) return
    setSelectedStream(null)
    router.push({ pathname: `/(app)/stream/${selectedStream.mediasoupRoomId}`, params: { streamId: selectedStream.id, sources: (selectedStream.sources ?? []).join(',') } })
  }

  function joinClusterStream(stream: Stream) {
    if (!stream.mediasoupRoomId) return
    setSelectedClusterStreams(null)
    router.push({ pathname: `/(app)/stream/${stream.mediasoupRoomId}`, params: { streamId: stream.id, sources: (stream.sources ?? []).join(',') } })
  }

  const liveCount = streams?.length ?? 0

  return (
    <View style={styles.container}>
      <EarthScene
        streams={streams ?? []}
        coords={coords}
        onPinTap={s => { setSelectedStream(s); setSelectedClusterStreams(null) }}
        onClusterTap={ss => { setSelectedClusterStreams(ss); setSelectedStream(null) }}
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
              if (mapboxSettledRef.current && state.properties.zoom < MAPBOX_DEACTIVATE_ZOOM) {
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
            {streams?.filter(s => s.lat != null && s.lng != null).map(stream => (
              <Mapbox.MarkerView
                key={stream.id}
                coordinate={[stream.lng!, stream.lat!]}
              >
                <Pressable
                  style={styles.mapboxPinHit}
                  onPress={() => { setSelectedStream(stream); setSelectedClusterStreams(null) }}
                >
                  <View style={styles.mapboxPinDot} />
                </Pressable>
              </Mapbox.MarkerView>
            ))}
          </Mapbox.MapView>
        </Animated.View>
      )}

      {mapboxActive && (
        <View style={[styles.mapboxBackRow, { top: insets.top + 8 }]} pointerEvents="box-none">
          <Pressable style={styles.mapboxBackBtn} onPress={deactivateMapbox}>
            <Text style={styles.mapboxBackText}>← Globe</Text>
          </Pressable>
        </View>
      )}

      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <Text style={styles.wordmark}>WRLD</Text>
            {liveCount > 0 && (
              <View style={styles.liveBadge}>
                <Text style={styles.liveBadgeText}>{liveCount} LIVE</Text>
              </View>
            )}
          </View>
        </SafeAreaView>
      </View>

      {liveCount === 0 && coords && (
        <View style={styles.emptyOverlay} pointerEvents="box-none">
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>🌍</Text>
            <Text style={styles.emptyHeading}>No streams nearby</Text>
            <Text style={styles.emptyBody}>Be the first to go live in your area</Text>
            <Pressable style={styles.emptyBtn} onPress={() => router.push('/(app)/dashboard')}>
              <Text style={styles.emptyBtnText}>Go live</Text>
            </Pressable>
          </View>
        </View>
      )}

      {banner && (
        <View style={[styles.bannerWrapper, { top: insets.top + 56 }]} pointerEvents="box-none">
          <Pressable style={[styles.banner, banner.kind === 'resumed' ? styles.bannerResumed : styles.bannerMuted]} onPress={banner.kind === 'resumed' ? handleBannerTap : undefined}>
            <View style={styles.bannerContent}>
              {banner.kind === 'disconnected' && (<><ActivityIndicator size="small" color={theme.colors.text.muted} style={styles.bannerSpinner} /><Text style={styles.bannerText}>Stream disconnected — waiting to reconnect</Text></>)}
              {banner.kind === 'ended'  && <Text style={styles.bannerText}>The stream has ended</Text>}
              {banner.kind === 'kicked' && <Text style={styles.bannerText}>You have been removed from this stream</Text>}
              {banner.kind === 'resumed' && <Text style={[styles.bannerText, styles.bannerTextResumed]}>Stream resumed — tap to rejoin</Text>}
            </View>
            <Pressable onPress={dismissBanner} hitSlop={12} style={styles.bannerClose}>
              <Text style={styles.bannerCloseText}>✕</Text>
            </Pressable>
          </Pressable>
        </View>
      )}

      {selectedStream && (
        <View style={styles.cardWrapper} pointerEvents="box-none">
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectedStream(null)} />
          <View style={styles.card}>
            <View style={styles.cardLeft}>
              {selectedStream.host && <Avatar avatarUrl={selectedStream.host.avatarUrl} displayName={selectedStream.host.displayName} size={44} />}
              <View style={styles.cardText}>
                <Text style={styles.cardTitle} numberOfLines={1}>{selectedStream.title}</Text>
                {selectedStream.host && <Text style={styles.cardHandle}>@{selectedStream.host.handle}</Text>}
                <Text style={styles.cardMeta}>{selectedStream.viewerCount} {selectedStream.viewerCount === 1 ? 'viewer' : 'viewers'}</Text>
              </View>
            </View>
            <Pressable style={styles.joinBtn} onPress={joinSelectedStream}>
              <Text style={styles.joinBtnText}>Join</Text>
            </Pressable>
          </View>
        </View>
      )}

      {selectedClusterStreams && (
        <View style={styles.cardWrapper} pointerEvents="box-none">
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectedClusterStreams(null)} />
          <View style={styles.card}>
            <Text style={styles.clusterHeader}>{selectedClusterStreams.length} live streams here</Text>
            {selectedClusterStreams.map(stream => (
              <Pressable key={stream.id} style={styles.clusterRow} onPress={() => joinClusterStream(stream)}>
                <View style={styles.cardLeft}>
                  {stream.host && <Avatar avatarUrl={stream.host.avatarUrl} displayName={stream.host.displayName} size={38} />}
                  <View style={styles.cardText}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{stream.title}</Text>
                    {stream.host && <Text style={styles.cardHandle}>@{stream.host.handle}</Text>}
                    <Text style={styles.cardMeta}>{stream.viewerCount} {stream.viewerCount === 1 ? 'viewer' : 'viewers'}</Text>
                  </View>
                </View>
                <View style={styles.joinBtnSmall}>
                  <Text style={styles.joinBtnText}>Join</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg.primary },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.sm },
  wordmark: { ...theme.typography.display, color: theme.colors.text.primary },
  liveBadge: { backgroundColor: theme.colors.accent.default, borderRadius: theme.radius.full, paddingHorizontal: theme.spacing.sm, paddingVertical: 3 },
  liveBadgeText: { ...theme.typography.caption, color: '#fff', fontWeight: '700' },
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
  emptyEmoji: { fontSize: 48, marginBottom: 4 },
  emptyHeading: { ...theme.typography.heading, color: theme.colors.text.primary, textAlign: 'center' },
  emptyBody: { ...theme.typography.body, color: theme.colors.text.muted, textAlign: 'center', lineHeight: 20 },
  emptyBtn: {
    marginTop: theme.spacing.sm,
    backgroundColor: theme.colors.accent.default,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xl,
  },
  emptyBtnText: { ...theme.typography.body, color: '#fff', fontWeight: '700' },
  cardWrapper: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
  card: { backgroundColor: theme.colors.bg.elevated, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border.subtle, padding: theme.spacing.md, gap: theme.spacing.sm },
  cardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  cardText: { flex: 1, gap: 2 },
  cardTitle: { ...theme.typography.body, color: theme.colors.text.primary, fontWeight: '600' },
  cardHandle: { ...theme.typography.caption, color: theme.colors.accent.default },
  cardMeta: { ...theme.typography.caption, color: theme.colors.text.muted },
  joinBtn: { backgroundColor: theme.colors.accent.default, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm, alignSelf: 'center' },
  joinBtnSmall: { backgroundColor: theme.colors.accent.default, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.sm, paddingVertical: 6, alignSelf: 'center' },
  joinBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  clusterHeader: { ...theme.typography.caption, color: theme.colors.text.muted, fontWeight: '600', paddingBottom: theme.spacing.xs, borderBottomWidth: 1, borderBottomColor: theme.colors.border.subtle },
  clusterRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.xs },
  bannerWrapper: { position: 'absolute', left: 0, right: 0, paddingHorizontal: theme.spacing.md },
  banner: { borderRadius: theme.radius.md, borderWidth: 1, paddingVertical: theme.spacing.sm, paddingHorizontal: theme.spacing.md, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  bannerMuted: { backgroundColor: theme.colors.bg.elevated, borderColor: theme.colors.border.subtle },
  bannerResumed: { backgroundColor: '#0D2B1F', borderColor: theme.colors.accent.default },
  bannerContent: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  bannerSpinner: { flexShrink: 0 },
  bannerText: { ...theme.typography.caption, color: theme.colors.text.muted, flex: 1 },
  bannerTextResumed: { color: theme.colors.accent.default },
  bannerClose: { flexShrink: 0 },
  bannerCloseText: { ...theme.typography.caption, color: theme.colors.text.muted },
  mapboxPinHit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  mapboxPinDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.colors.accent.default,
    borderWidth: 2,
    borderColor: '#fff',
  },
  mapboxBackRow: { position: 'absolute', left: 0, right: 0, paddingHorizontal: theme.spacing.lg },
  mapboxBackBtn: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(10, 10, 15, 0.85)',
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  mapboxBackText: { ...theme.typography.caption, color: theme.colors.text.primary },
})
