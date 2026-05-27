import { View, Text, StyleSheet, ActivityIndicator, Pressable, AppState, Keyboard, Platform } from 'react-native'
import { useEffect, useRef, useState } from 'react'
import { useLocalSearchParams, router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { RTCView } from 'react-native-webrtc'
import { Button } from '@/components/ui/Button'
import { NearbyStreamsDrawer } from '@/components/feature/stream/NearbyStreamsDrawer'
import { ChatOverlay } from '@/components/feature/stream/ChatOverlay'
import { ReactionLayer } from '@/components/feature/stream/ReactionLayer'
import { AuthModal } from '@/components/feature/stream/AuthModal'
import { Avatar } from '@/components/feature/user/Avatar'
import { FollowButton } from '@/components/feature/user/FollowButton'
import { theme } from '@/lib/theme'
import { signalStreamDisconnected, signalStreamEnded } from '@/lib/streamSignals'
import { streamsApi } from '@/api/streams'
import { useSignaling } from '@/hooks/useSignaling'
import { useMediasoup } from '@/hooks/useMediasoup'
import { useLocation } from '@/hooks/useLocation'
import { useStream } from '@/hooks/useStream'
import { useAuth } from '@clerk/clerk-expo'
import { useAuthStore } from '@/stores/authStore'
import type { Stream, SourceType } from '@/types'

const SOURCE_LABELS: Record<SourceType, string> = {
  camera: 'Camera',
  audio: 'Audio',
}

export default function StreamView() {
  const { id, streamId, title: paramTitle, sources: paramSources } = useLocalSearchParams<{
    id: string
    streamId?: string
    title?: string
    sources?: string
  }>()
  const isNew = id === 'new'

  const broadcastSources: SourceType[] = paramSources
    ? (paramSources.split(',').filter(Boolean) as SourceType[])
    : []

  const {
    status, setStatus, roomId, viewerCount, streamEnded,
    error: signalingError, setError,
    chatMessages, reactions,
    connect, createRoom, joinRoom, disconnect,
    sendChatMessage, sendReaction, dismissReaction,
  } = useSignaling()
  const { localStream, remoteStream, error: mediaError, startBroadcasting, startViewing, cleanup } = useMediasoup()
  const { isSignedIn } = useAuth()
  const { coords, loading: locationLoading, error: locationError } = useLocation()
  const wrldUser = useAuthStore((s: ReturnType<typeof useAuthStore.getState>) => s.wrldUser)
  const { data: streamData } = useStream(!isNew ? streamId : null)

  const broadcaster = isNew
    ? (wrldUser ? { handle: wrldUser.handle, displayName: wrldUser.displayName, avatarUrl: wrldUser.avatarUrl } : null)
    : (streamData?.host ?? null)
  const [activeSource, setActiveSource] = useState<SourceType | null>(null)
  const [controlsVisible, setControlsVisible] = useState(false)
  const [hopError, setHopError] = useState<string | null>(null)
  const [chatOpen, setChatOpen] = useState(false)
  const [authModalVisible, setAuthModalVisible] = useState(false)
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Guards against double-navigation when multiple end signals arrive simultaneously
  // (e.g. broadcasterLeft WS message + viewer WS close in the same render cycle).
  const navigatingRef = useRef(false)

  const isCameraArmed = broadcastSources.includes('camera')
  const showCameraPreview = isNew && status === 'in-room' && !!localStream && isCameraArmed
  const showRemoteVideo = !isNew && status === 'in-room' && !!remoteStream && broadcastSources.includes('camera')
  const showOverlay = showCameraPreview || showRemoteVideo
  const showControls = isNew || !showOverlay || controlsVisible

  function scheduleHide() {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    hideTimerRef.current = setTimeout(() => setControlsVisible(false), 3000)
  }

  function handleTap() {
    if (controlsVisible) {
      setControlsVisible(false)
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    } else {
      setControlsVisible(true)
      scheduleHide()
    }
  }

  // Single exit point for all viewer stream-end scenarios.
  // navigatingRef ensures only the first trigger wins when multiple signals
  // arrive in the same render cycle (e.g. broadcasterLeft + WS close together).
  function exitToGlobe(kind: 'ended' | 'disconnected') {
    if (navigatingRef.current) return
    navigatingRef.current = true
    cleanup()
    disconnect()
    if (kind === 'ended') {
      signalStreamEnded()
    } else {
      signalStreamDisconnected(broadcaster?.handle ?? null)
    }
    router.navigate('/(app)/globe')
  }

  // Fast path 1: server sent broadcasterLeft
  useEffect(() => {
    if (!streamEnded || isNew) return
    exitToGlobe('ended')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamEnded])

  // Fast path 2: viewer's own WS dropped unexpectedly
  useEffect(() => {
    if (status !== 'dropped' || isNew) return
    exitToGlobe('disconnected')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  // Fallback: poll stream status every 10s.
  // Catches cases where neither broadcasterLeft nor a clean WS close arrive
  // (Android force-kill delay, iOS graceful-leave race, server-side quirks).
  useEffect(() => {
    if (isNew || !streamId || status !== 'in-room') return
    const pollId = setInterval(async () => {
      if (navigatingRef.current) { clearInterval(pollId); return }
      try {
        const s = await streamsApi.get(streamId)
        if (!s.isLive) {
          clearInterval(pollId)
          exitToGlobe('ended')
        }
      } catch {}
    }, 10_000)
    return () => clearInterval(pollId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, streamId, status])

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
  }, [])

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'
    const showSub = Keyboard.addListener(showEvent, (e) => setKeyboardHeight(e.endCoordinates.height))
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0))
    return () => { showSub.remove(); hideSub.remove() }
  }, [])

  // Auto-join (or re-join after a hop) whenever the room id changes.
  // Reset navigatingRef so exitToGlobe works fresh for the new session.
  useEffect(() => {
    if (isNew) return
    navigatingRef.current = false
    cleanup()
    handleJoin()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Broadcaster: close the WS when the app goes to background so the server
  // immediately fires broadcasterLeft to all viewers. Without this, iOS/Android
  // keeps the socket alive in background and viewers are stuck on a frozen frame.
  useEffect(() => {
    if (!isNew || status !== 'in-room') return
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background') {
        cleanup()
        disconnect()
      }
    })
    return () => sub.remove()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, status])

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
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Failed to go live')
    }
  }

  async function handleJoin() {
    try {
      await connect()
      const producers = await joinRoom(id)
      await startViewing(producers)
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Failed to join stream')
    }
  }

  // Broadcaster: resume with same settings, starting a fresh room.
  async function handleResume() {
    cleanup()
    await handleGoLive()
  }

  function handleStartNew() {
    cleanup()
    disconnect()
    router.replace('/(app)/dashboard')
  }

  function handleLeave() {
    cleanup()
    disconnect()
    router.navigate('/(app)/globe')
  }

  function handleBack() {
    if (status === 'in-room' || status === 'dropped') {
      cleanup()
      disconnect()
    }
    router.navigate('/(app)/globe')
  }

  function handleSendChat(text: string) {
    sendChatMessage(text, wrldUser?.handle ?? 'user')
  }

  function handleReact(kind: string) {
    sendReaction(kind, wrldUser?.handle ?? 'user')
  }

  function handleHop(target: Stream) {
    if (!target.mediasoupRoomId || target.mediasoupRoomId === id) return
    try {
      cleanup()
      disconnect()
      router.replace({
        pathname: '/(app)/stream/[id]',
        params: {
          id: target.mediasoupRoomId,
          streamId: target.id,
          sources: (target.sources ?? []).join(','),
        },
      })
    } catch {
      setHopError('Failed to switch stream. Try again.')
    }
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

      {/* Tap-to-reveal layer for viewer fullscreen mode */}
      {showRemoteVideo && (
        <Pressable style={StyleSheet.absoluteFill} onPress={handleTap} />
      )}

      <View style={[styles.header, styles.headerRow]}>
        <Pressable onPress={handleBack} style={styles.backBtn} hitSlop={12}>
          <Text style={[styles.backArrow, showOverlay && styles.overlayText]}>←</Text>
        </Pressable>
        {status === 'in-room' && !streamEnded && (
          <Pressable
            onPress={() => setChatOpen((o) => !o)}
            style={styles.chatToggleBtn}
            hitSlop={12}
          >
            <Text style={[styles.chatToggleText, showOverlay && styles.overlayText]}>
              {chatOpen ? '✕' : '💬'}
            </Text>
          </Pressable>
        )}
      </View>

      {showControls && (
        <View style={styles.content}>
          {!showOverlay && isNew && (
            <Text style={styles.title}>Go Live</Text>
          )}

          {/* ── Idle (broadcaster only) ───────────────────────────── */}
          {status === 'idle' && isNew && (
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
              <Button label="Back" onPress={() => router.navigate('/(app)/globe')} variant="secondary" style={styles.wide} />
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

          {/* ── Broadcaster: connection dropped ───────────────────── */}
          {status === 'dropped' && isNew && (
            <View style={styles.actions}>
              <Text style={styles.muted}>Your stream ended.</Text>
              <Button label="Resume" onPress={handleResume} style={styles.wide} />
              <Button
                label="Start new stream"
                onPress={handleStartNew}
                variant="secondary"
                style={styles.wide}
              />
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

              {broadcaster && (
                <View style={styles.broadcasterRow}>
                  <Avatar
                    avatarUrl={broadcaster.avatarUrl}
                    displayName={broadcaster.displayName}
                    size={32}
                  />
                  <Text style={[styles.broadcasterHandle, showOverlay && styles.overlayText]}>
                    @{broadcaster.handle}
                  </Text>
                  {!isNew && broadcaster.handle && (
                    <FollowButton
                      handle={broadcaster.handle}
                      onAuthRequest={!isSignedIn ? () => setAuthModalVisible(true) : undefined}
                    />
                  )}
                </View>
              )}

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
              <Button label="Back" onPress={() => router.navigate('/(app)/globe')} variant="secondary" />
            </View>
          )}

          {/* ── Hop error ────────────────────────────────────────── */}
          {hopError && (
            <View style={styles.actions}>
              <Text style={styles.errorText}>{hopError}</Text>
              <Button label="Dismiss" onPress={() => setHopError(null)} variant="secondary" />
              <Button label="Back to globe" onPress={() => router.navigate('/(app)/globe')} variant="secondary" />
            </View>
          )}
        </View>
      )}

      {/* Nearby streams drawer (viewer only) */}
      {!isNew && streamId && (
        <NearbyStreamsDrawer
          currentStreamId={streamId}
          visible={controlsVisible}
          onHop={handleHop}
        />
      )}

      {/* Chat panel — bottom shifts up by keyboard height so input stays visible */}
      {chatOpen && status === 'in-room' && !streamEnded && (
        <View style={[styles.chatPanel, { bottom: keyboardHeight }]}>
          <ChatOverlay
            messages={chatMessages}
            isSignedIn={!!isSignedIn}
            onSend={handleSendChat}
            onAuthRequest={() => setAuthModalVisible(true)}
          />
        </View>
      )}

      {/* Reaction buttons + floating bursts */}
      {status === 'in-room' && !streamEnded && (
        <ReactionLayer
          reactions={reactions}
          isSignedIn={!!isSignedIn}
          onReact={handleReact}
          onAuthRequest={() => setAuthModalVisible(true)}
          onDismiss={dismissReaction}
        />
      )}

      <AuthModal
        visible={authModalVisible}
        onClose={() => setAuthModalVisible(false)}
        onSuccess={() => setAuthModalVisible(false)}
      />
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
  broadcasterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  broadcasterHandle: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    fontWeight: '600',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chatToggleBtn: { padding: theme.spacing.xs },
  chatToggleText: { fontSize: 22, color: theme.colors.text },
  chatPanel: {
    position: 'absolute',
    left: 0,
    right: 90,
    bottom: 0,
    height: 320,
    zIndex: 10,
  },
})
