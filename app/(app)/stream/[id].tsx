import { View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native'
import { useState } from 'react'
import { useLocalSearchParams, router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { RTCView } from 'react-native-webrtc'
import { Button } from '@/components/ui/Button'
import { theme } from '@/lib/theme'
import { useSignaling } from '@/hooks/useSignaling'
import { useMediasoup } from '@/hooks/useMediasoup'
import { useLocation } from '@/hooks/useLocation'
import { useAuth } from '@clerk/clerk-expo'
import type { SourceType } from '@/types'

const SOURCE_LABELS: Record<SourceType, string> = {
  camera: 'Camera',
  audio: 'Audio',
}

export default function StreamView() {
  const { id, title: paramTitle, sources: paramSources } = useLocalSearchParams<{
    id: string
    title?: string
    sources?: string
  }>()
  const isNew = id === 'new'

  const broadcastSources: SourceType[] = paramSources
    ? (paramSources.split(',').filter(Boolean) as SourceType[])
    : []

  const { status, roomId, viewerCount, streamEnded, error: signalingError, setError, connect, createRoom, joinRoom, disconnect } =
    useSignaling()
  const { localStream, remoteStream, error: mediaError, startBroadcasting, startViewing, cleanup } = useMediasoup()
  const { isSignedIn } = useAuth()
  const { coords, loading: locationLoading, error: locationError } = useLocation()
  const [activeSource, setActiveSource] = useState<SourceType | null>(null)

  const isCameraArmed = broadcastSources.includes('camera')
  const showCameraPreview = isNew && status === 'in-room' && !!localStream && isCameraArmed
  const showRemoteVideo = !isNew && status === 'in-room' && !!remoteStream && broadcastSources.includes('camera')
  const showOverlay = showCameraPreview || showRemoteVideo

  async function handleGoLive() {
    const title = (paramTitle ?? '').trim()
    if (!title || !coords || broadcastSources.length === 0) return
    try {
      await connect()
      await createRoom({
        title,
        lat: coords.latitude,
        lng: coords.longitude,
        sources: broadcastSources,
      })
      await startBroadcasting(broadcastSources)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to go live')
    }
  }

  async function handleJoin() {
    try {
      await connect()
      const producers = await joinRoom(id)
      await startViewing(producers)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join stream')
    }
  }

  function handleLeave() {
    cleanup()
    disconnect()
    router.back()
  }

  function handleBack() {
    if (status === 'in-room') {
      cleanup()
      disconnect()
    }
    router.back()
  }

  const canGoLive = !!paramTitle?.trim() && !!coords && !locationLoading && broadcastSources.length > 0
  const displayError = signalingError ?? mediaError

  return (
    <SafeAreaView style={styles.container}>
      {/* Fullscreen local camera preview (broadcaster) */}
      {showCameraPreview && (
        <RTCView
          streamURL={(localStream as unknown as { toURL(): string }).toURL()}
          style={StyleSheet.absoluteFill}
          objectFit="cover"
          mirror={true}
          zOrder={0}
        />
      )}

      {/* Fullscreen remote stream (viewer) */}
      {showRemoteVideo && (
        <RTCView
          streamURL={(remoteStream as unknown as { toURL(): string }).toURL()}
          style={StyleSheet.absoluteFill}
          objectFit="cover"
          mirror={false}
          zOrder={0}
        />
      )}

      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backBtn} hitSlop={12}>
          <Text style={[styles.backArrow, showOverlay && styles.overlayText]}>←</Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        {!showOverlay && (
          <Text style={styles.title}>{isNew ? 'Go Live' : 'Watch'}</Text>
        )}

        {/* ── Idle ─────────────────────────────────────────────── */}
        {status === 'idle' && (
          <View style={styles.actions}>
            {isNew && isSignedIn && (
              <>
                {paramTitle ? (
                  <Text style={styles.streamTitle}>{paramTitle}</Text>
                ) : null}
                {broadcastSources.length > 0 && (
                  <View style={styles.sourceRow}>
                    {broadcastSources.map((s) => (
                      <View key={s} style={styles.sourceBadge}>
                        <Text style={styles.sourceBadgeText}>{SOURCE_LABELS[s]}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {locationLoading && (
                  <View style={styles.statusRow}>
                    <ActivityIndicator color={theme.colors.accent} size="small" />
                    <Text style={styles.muted}>Detecting location…</Text>
                  </View>
                )}
                {locationError && <Text style={styles.muted}>{locationError}</Text>}
                {coords && !locationLoading && (
                  <Text style={styles.muted}>
                    {coords.latitude.toFixed(4)}, {coords.longitude.toFixed(4)}
                  </Text>
                )}
                <Button
                  label="Start stream"
                  onPress={handleGoLive}
                  disabled={!canGoLive}
                  style={styles.wide}
                />
              </>
            )}
            {isNew && !isSignedIn && <Text style={styles.muted}>Sign in to go live</Text>}
            {!isNew && <Button label="Join stream" onPress={handleJoin} style={styles.wide} />}
            <Button label="Back" onPress={() => router.back()} variant="secondary" style={styles.wide} />
          </View>
        )}

        {/* ── Connecting ───────────────────────────────────────── */}
        {(status === 'connecting' || status === 'connected' || status === 'authenticated') && (
          <View style={styles.statusRow}>
            <ActivityIndicator color={theme.colors.accent} />
            <Text style={styles.muted}>
              {status === 'connecting' && 'Connecting…'}
              {status === 'connected' && 'Authenticating…'}
              {status === 'authenticated' && 'Entering room…'}
            </Text>
          </View>
        )}

        {/* ── Stream ended (viewer) ────────────────────────────── */}
        {streamEnded && (
          <View style={styles.actions}>
            <Text style={styles.muted}>The stream has ended.</Text>
            <Button label="Back" onPress={() => router.back()} variant="secondary" style={styles.wide} />
          </View>
        )}

        {/* ── Viewer: waiting for stream to load ───────────────── */}
        {!isNew && status === 'in-room' && !remoteStream && !streamEnded && (
          <View style={styles.statusRow}>
            <ActivityIndicator color={theme.colors.accent} />
            <Text style={styles.muted}>Loading stream…</Text>
          </View>
        )}

        {/* ── In room ──────────────────────────────────────────── */}
        {status === 'in-room' && !streamEnded && (!!remoteStream || isNew) && (
          <View style={[styles.roomInfo, showOverlay && styles.roomInfoOverlay]}>
            <View style={styles.liveRow}>
              <Text style={styles.live}>● LIVE</Text>
              {!showOverlay && (
                <Text style={styles.roomId}>{roomId}</Text>
              )}
            </View>

            {/* Broadcaster */}
            {isNew && (
              <View style={styles.section}>
                {!showOverlay && <Text style={styles.sectionLabel}>BROADCASTING</Text>}
                <View style={styles.sourceRow}>
                  {broadcastSources.map((s) => (
                    <View key={s} style={styles.sourceActiveBadge}>
                      <Text style={styles.sourceActiveBadgeText}>{SOURCE_LABELS[s]}</Text>
                    </View>
                  ))}
                </View>
                <Text style={[styles.viewerCount, showOverlay && styles.overlayText]}>
                  {viewerCount} {viewerCount === 1 ? 'viewer' : 'viewers'}
                </Text>
              </View>
            )}

            {/* Viewer: source switcher */}
            {!isNew && broadcastSources.length > 0 && (
              <View style={styles.section}>
                {!showOverlay && <Text style={styles.sectionLabel}>SOURCES</Text>}
                <View style={styles.sourceRow}>
                  {broadcastSources.map((kind) => (
                    <Pressable
                      key={kind}
                      style={[styles.sourceSwitchBtn, activeSource === kind && styles.sourceSwitchBtnActive]}
                      onPress={() => setActiveSource(kind)}
                    >
                      <Text style={[styles.sourceSwitchText, activeSource === kind && styles.sourceSwitchTextActive]}>
                        {SOURCE_LABELS[kind]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            <Button label="Leave" onPress={handleLeave} variant="danger" />
          </View>
        )}

        {/* ── Error ────────────────────────────────────────────── */}
        {status === 'error' && (
          <View style={styles.actions}>
            <Text style={styles.errorText}>{displayError}</Text>
            <Button label="Retry" onPress={isNew ? handleGoLive : handleJoin} />
            <Button label="Back" onPress={() => router.back()} variant="secondary" />
          </View>
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: {
    flex: 1,
    padding: theme.spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  title: { ...theme.typography.title, color: theme.colors.text },
  streamTitle: { ...theme.typography.heading, color: theme.colors.text, textAlign: 'center' },
  muted: { ...theme.typography.body, color: theme.colors.textMuted, textAlign: 'center' },
  errorText: { ...theme.typography.body, color: theme.colors.danger, textAlign: 'center' },
  overlayText: { color: '#fff', textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  live: { ...theme.typography.heading, color: theme.colors.live },
  roomId: { ...theme.typography.caption, color: theme.colors.textMuted, fontFamily: 'monospace' },
  viewerCount: { ...theme.typography.body, color: theme.colors.textMuted },
  header: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.sm },
  backBtn: { alignSelf: 'flex-start' },
  backArrow: { ...theme.typography.heading, color: theme.colors.text },
  actions: { width: '100%', gap: theme.spacing.sm, alignItems: 'center' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  roomInfo: { width: '100%', alignItems: 'center', gap: theme.spacing.lg },
  roomInfoOverlay: {
    position: 'absolute',
    bottom: theme.spacing.xl,
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
  },
  wide: { width: '100%' },
  section: { width: '100%', gap: theme.spacing.sm, alignItems: 'center' },
  sectionLabel: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  sourceRow: { flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap', justifyContent: 'center' },
  sourceBadge: {
    borderRadius: theme.radius.full,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  sourceBadgeText: { ...theme.typography.caption, color: theme.colors.textMuted, fontWeight: '600' },
  sourceActiveBadge: {
    borderRadius: theme.radius.full,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    backgroundColor: theme.colors.live,
  },
  sourceActiveBadgeText: { ...theme.typography.caption, color: '#fff', fontWeight: '700' },
  sourceSwitchBtn: {
    borderRadius: theme.radius.full,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
  sourceSwitchBtnActive: {
    borderColor: theme.colors.accent,
    backgroundColor: '#0D1830',
  },
  sourceSwitchText: { ...theme.typography.body, color: theme.colors.textMuted, fontWeight: '600' },
  sourceSwitchTextActive: { color: theme.colors.accent },
})
