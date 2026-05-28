import { View, Text, StyleSheet, ActivityIndicator, Pressable, AppState, Keyboard, Platform, Animated } from 'react-native'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { RTCView } from 'react-native-webrtc'
import { Button } from '@/components/ui/Button'
import { NearbyStreamsDrawer } from '@/components/feature/stream/NearbyStreamsDrawer'
import { ChatOverlay } from '@/components/feature/stream/ChatOverlay'
import { ReactionLayer } from '@/components/feature/stream/ReactionLayer'
import { AuthModal } from '@/components/feature/stream/AuthModal'
import { TipSheet } from '@/components/feature/stream/TipSheet'
import { useInvalidateCurrentUser } from '@/hooks/useCurrentUser'
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
import type { TipEvent } from '@/hooks/useSignaling'

function FloatingTip({ tip, onDone }: { tip: TipEvent; onDone: (id: number) => void }) {
  const translateY = useRef(new Animated.Value(0)).current
  const opacity = useRef(new Animated.Value(1)).current
  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: -140, duration: 2400, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(1600),
        Animated.timing(opacity, { toValue: 0, duration: 800, useNativeDriver: true }),
      ]),
    ]).start(() => onDone(tip.id))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <Animated.View style={[tipStyles.floating, { transform: [{ translateY }], opacity }]}>
      <Text style={tipStyles.floatingText}>@{tip.handle} · {tip.amount} 🚀</Text>
    </Animated.View>
  )
}

const tipStyles = StyleSheet.create({
  floating: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center' },
  floatingText: {
    ...theme.typography.caption,
    color: '#fff',
    backgroundColor: 'rgba(91,140,255,0.85)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
    fontWeight: '700',
  },
})

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
    chatMessages, reactions, broadcasterPaused,
    tipEvents, confirmedBalance,
    connect, createRoom, joinRoom, disconnect,
    sendChatMessage, sendReaction, dismissReaction,
    sendTip, dismissTip,
    sendBroadcasterPaused, sendBroadcasterResumed,
  } = useSignaling()
  const invalidateCurrentUser = useInvalidateCurrentUser()
  const { localStream, remoteStream, error: mediaError, facingMode, startBroadcasting, startViewing, switchCamera, cleanup } = useMediasoup()
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
  const [tipSheetVisible, setTipSheetVisible] = useState(false)
  const [broadcasterTipToast, setBroadcasterTipToast] = useState<string | null>(null)
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tipToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
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
      if (tipToastTimerRef.current) clearTimeout(tipToastTimerRef.current)
    }
  }, [])

  // Invalidate currentUser cache when a tip is confirmed so Me screen balance updates
  useEffect(() => {
    if (confirmedBalance === null) return
    invalidateCurrentUser()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmedBalance])

  // Show broadcaster toast when a tip arrives (broadcaster-side only)
  useEffect(() => {
    if (!isNew || tipEvents.length === 0) return
    const latest = tipEvents[tipEvents.length - 1]!
    setBroadcasterTipToast(`@${latest.handle} sent ${latest.amount} 🚀`)
    if (tipToastTimerRef.current) clearTimeout(tipToastTimerRef.current)
    tipToastTimerRef.current = setTimeout(() => setBroadcasterTipToast(null), 3000)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipEvents])

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'
    const showSub = Keyboard.addListener(showEvent, (e) => setKeyboardHeight(e.endCoordinates.height))
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0))
    return () => { showSub.remove(); hideSub.remove() }
  }, [])

  // Auto-join on every screen focus (first visit, return after leaving, hop to
  // different stream). useFocusEffect fires when the tab gains focus AND when
  // its useCallback deps change while already focused — so id-changes (hops)
  // are also caught without a separate useEffect.
  useFocusEffect(
    useCallback(() => {
      if (isNew) return
      navigatingRef.current = false
      cleanup()
      handleJoin()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]),
  )

  // Broadcaster: close the WS when the app goes to background so the server
  // immediately fires broadcasterLeft to all viewers. Without this, iOS/Android
  // keeps the socket alive in background and viewers are stuck on a frozen frame.
  useEffect(() => {
    if (!isNew || status !== 'in-room') return
    const sub = AppState.addEventListener('change', (nextState) => {
      console.log('AppState change:', nextState)
      if (nextState === 'background') {
        cleanup()
        disconnect()
      } else if (nextState === 'inactive') {
        sendBroadcasterPaused()
      } else if (nextState === 'active') {
        sendBroadcasterResumed()
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

  const tipBalance = confirmedBalance ?? (wrldUser?.spaceBucks ?? 0)

  function handleTip(amount: number) {
    sendTip(amount)
  }

  function handleTipPress() {
    if (!isSignedIn) { setAuthModalVisible(true); return }
    setTipSheetVisible(true)
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
          mirror={facingMode === 'user'}
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

      {/* Flip camera button (broadcaster only) */}
      {showCameraPreview && (
        <Pressable style={styles.flipBtn} onPress={switchCamera} hitSlop={12}>
          <Text style={styles.flipBtnText}>⇄</Text>
        </Pressable>
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
                  {!isNew && (
                    <Pressable style={styles.tipBtn} onPress={handleTipPress} hitSlop={8}>
                      <Text style={styles.tipBtnText}>🚀 Tip</Text>
                    </Pressable>
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

      <TipSheet
        visible={tipSheetVisible}
        balance={tipBalance}
        onClose={() => setTipSheetVisible(false)}
        onTip={handleTip}
      />

      {/* Tip burst animations — visible to all peers */}
      {status === 'in-room' && !streamEnded && (
        <View style={styles.tipBurstArea} pointerEvents="none">
          {tipEvents.map((t) => (
            <FloatingTip key={t.id} tip={t} onDone={dismissTip} />
          ))}
        </View>
      )}

      {/* Broadcaster-only private toast */}
      {isNew && broadcasterTipToast !== null && (
        <View style={styles.broadcasterTipToast} pointerEvents="none">
          <Text style={styles.broadcasterTipToastText}>{broadcasterTipToast}</Text>
        </View>
      )}

      {!isNew && broadcasterPaused && !streamEnded && (
        <View style={styles.pausedBanner} pointerEvents="none">
          <Text style={styles.pausedText}>Stream paused · resuming shortly</Text>
        </View>
      )}
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
  flipBtn: {
    position: 'absolute',
    top: 60,
    right: theme.spacing.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  flipBtnText: { fontSize: 22, color: '#fff' },
  pausedBanner: {
    position: 'absolute',
    top: 80,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 20,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    zIndex: 20,
  },
  pausedText: {
    ...theme.typography.caption,
    color: theme.colors.text,
    fontWeight: '600',
  },
  tipBtn: {
    borderRadius: theme.radius.full,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    backgroundColor: `${theme.colors.accent}22`,
    borderWidth: 1,
    borderColor: theme.colors.accent,
  },
  tipBtnText: { ...theme.typography.caption, color: theme.colors.accent, fontWeight: '700' },
  tipBurstArea: {
    position: 'absolute',
    bottom: 100,
    left: theme.spacing.lg,
    width: 200,
  },
  broadcasterTipToast: {
    position: 'absolute',
    top: 120,
    alignSelf: 'center',
    backgroundColor: `${theme.colors.accent}CC`,
    borderRadius: 20,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    zIndex: 20,
  },
  broadcasterTipToastText: {
    ...theme.typography.caption,
    color: '#fff',
    fontWeight: '700',
  },
})
