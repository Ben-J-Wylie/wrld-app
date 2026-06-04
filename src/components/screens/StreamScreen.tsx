// src/components/screens/StreamScreen.tsx
//
// 12.6 migration target. The state machine + lifecycle effects are
// preserved verbatim; only the rendering layer swaps to design-system
// equivalents. Key migrations:
//
//   • ChatOverlay (retiring) splits into a local panel that scrolls
//     ChatMessage rows + a ChatComposer at the bottom.
//   • ReactionLayer (retiring) → ReactionRail (consumer-driven
//     reaction list + burst queue).
//   • LivePill for the LIVE indicator.
//   • BroadcasterRow for the identity strip (chip variant when the
//     viewer is the broadcaster of their own stream, default variant
//     when viewing someone else's stream).
//   • CoordHUD for the broadcaster's idle-state location read.
//   • IconButton for back, flip camera, chat toggle, dismiss-warning,
//     report, and tip header affordances.
//   • Pill (accent, sm) for the BROADCASTING source badges.
//   • ToastBanner for the broadcaster-side post-tip toast.
//   • ActionSheet (section) for the report-stream reason picker.
//   • Text primitive variants + token colors throughout.
//
// Phase 17 / 5/22 integration (merged in from `main` on the same
// pass): suspensionError Alert, handleGoLive suspension navigate,
// report flag button + ActionSheet, screenshot capture via
// react-native-view-shot.
//
// Kept intact: NearbyStreamsDrawer, AuthModal, TipSheet, FollowButton
// (per the 12.6 retirement plan).

import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  Keyboard,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { captureScreen } from 'react-native-view-shot'
import { Filter as ProfanityFilter } from 'bad-words'

const profanityFilter = new ProfanityFilter()
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { RTCView } from 'react-native-webrtc'
import { useAuth } from '@clerk/clerk-expo'
import { Button } from '@/components/primitives/Button'
import { Text } from '@/components/primitives/Text'
import { Pill } from '@/components/primitives/Pill'
import { Icon } from '@/components/primitives/Icon'
import { IconButton } from '@/components/primitives/IconButton'
import { HelpText } from '@/components/primitives/HelpText'
import { LivePill } from '@/components/features/stream/LivePill'
import { BroadcastStatusIndicator } from '@/components/features/broadcast/BroadcastStatusIndicator'
import { BroadcasterRow } from '@/components/features/user/BroadcasterRow'
import { CoordHUD } from '@/components/features/stream/CoordHUD'
import {
  ChatMessage as ChatMessageRow,
  type ChatRole,
} from '@/components/features/chat/ChatMessage'
import { ChatComposer } from '@/components/features/chat/ChatComposer'
import {
  ReactionRail,
  type ReactionConfig,
} from '@/components/features/stream/ReactionRail'
import { ToastBanner } from '@/components/features/feedback/ToastBanner'
import { ActionSheet } from '@/components/sections/ActionSheet'
import { NearbyStreamsDrawer } from '@/components/features/stream/NearbyStreamsDrawer'
import { AuthModal } from '@/components/features/stream/AuthModal'
import { TipSheet } from '@/components/features/stream/TipSheet'
import { FollowButton } from '@/components/features/user/FollowButton'
import { useInvalidateCurrentUser } from '@/hooks/useCurrentUser'
import { useInvalidateWallet } from '@/hooks/useWallet'
import { theme } from '@/tokens/theme'
import { signalStreamDisconnected, signalStreamEnded, signalKicked } from '@/lib/streamSignals'
import { signalingClient } from '@/lib/mediasoupSignaling'
import { activeBroadcast } from '@/lib/activeBroadcast'
import { streamsApi } from '@/api/streams'
import { recordingsApi } from '@/api/recordings'
import { usersApi } from '@/api/users'
import { useSignaling } from '@/hooks/useSignaling'
import { useMediasoup } from '@/hooks/useMediasoup'
import * as Location from 'expo-location'
import { useLocation } from '@/hooks/useLocation'
import { useStream, useStreamByRoom } from '@/hooks/useStream'
import { useAuthStore } from '@/stores/authStore'
import type { Stream, SourceType } from '@/types'
import type { TipEvent } from '@/hooks/useSignaling'

const SOURCE_LABELS: Record<SourceType, string> = {
  camera: 'Camera',
  audio: 'Audio',
}

const REACTION_CONFIGS: ReactionConfig[] = [
  { kind: 'heart', emoji: '❤️' },
  { kind: 'fire', emoji: '🔥' },
  { kind: 'clap', emoji: '👏' },
  { kind: 'wow', emoji: '😮' },
]

function isNetworkError(msg: string | null | undefined): boolean {
  if (!msg) return false
  const lower = msg.toLowerCase()
  return lower.includes('websocket') || lower.includes('network') || lower.includes('connection')
}

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
      <View style={tipStyles.bubble}>
        <Text variant="caption" color={theme.colors.text.inverse}>
          @{tip.handle} · {tip.amount} 🚀
        </Text>
      </View>
    </Animated.View>
  )
}

const tipStyles = StyleSheet.create({
  floating: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center' },
  bubble: {
    backgroundColor: theme.colors.accent.default,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
    overflow: 'hidden',
  },
})

export function StreamScreen() {
  const { id, streamId: paramStreamId, title: paramTitle, sources: paramSources, lat: paramLat, lng: paramLng, subscribersOnly: paramSubscribersOnly, precision: paramPrecision } = useLocalSearchParams<{
    id: string
    streamId?: string
    title?: string
    sources?: string
    lat?: string
    lng?: string
    subscribersOnly?: string
    precision?: string
  }>()
  const isNew = id === 'new'

  // When arriving via a deep-link notification without full params, look up by room ID
  const { data: streamByRoom } = useStreamByRoom(!paramStreamId && !isNew ? id : null)
  const broadcastSources: SourceType[] = paramSources
    ? (paramSources.split(',').filter(Boolean) as SourceType[])
    : ((streamByRoom?.sources ?? []) as SourceType[])

  const {
    status, setStatus, roomId, viewerCount, streamEnded, adminEnded, setAdminEnded,
    adminWarning, setAdminWarning,
    error: signalingError, setError,
    suspensionError, clearSuspensionError,
    chatMessages, reactions, broadcasterPaused,
    tipEvents, confirmedBalance,
    connect, createRoom, joinRoom, disconnect,
    sendChatMessage, sendReaction, dismissReaction,
    sendTip, dismissTip,
    sendLocationUpdate,
    sendBroadcasterPaused, sendBroadcasterResumed, sendBroadcasterOrientation,
  } = useSignaling()
  // Broadcaster: look up the DB stream once in-room so we have streamId for recording.
  // roomId is only available after useSignaling, so this query lives here.
  // gcTime: 0 prevents a stale cache entry from a previous session's room with the same
  // 4-digit ID being served — that would make streamId point at an ended stream and cause
  // POST /recordings to return 400 "Stream is not live".
  const { data: broadcasterStream } = useQuery({
    queryKey: ['broadcaster-stream', roomId],
    queryFn: () => streamsApi.getByRoom(roomId!),
    enabled: isNew && !!roomId,
    staleTime: 0,
    gcTime: 0,
  })
  const streamId = paramStreamId || streamByRoom?.id || broadcasterStream?.id || ''
  const invalidateCurrentUser = useInvalidateCurrentUser()
  const invalidateWallet = useInvalidateWallet()
  const {
    localStream, remoteStream, error: mediaError, facingMode, videoIsLandscape,
    startBroadcasting, startViewing, switchCamera, cleanup,
  } = useMediasoup()
  const { isSignedIn } = useAuth()
  const { coords: liveCoords, loading: locationLoading, error: locationError } = useLocation()
  // Prefer coords captured on the Dashboard (passed as params) over re-acquiring
  const coords = (isNew && paramLat && paramLng)
    ? { latitude: parseFloat(paramLat), longitude: parseFloat(paramLng) }
    : liveCoords
  const wrldUser = useAuthStore((s: ReturnType<typeof useAuthStore.getState>) => s.wrldUser)
  const { data: streamData } = useStream(!isNew ? streamId : null)

  const broadcaster = isNew
    ? (wrldUser ? { handle: wrldUser.handle, displayName: wrldUser.displayName, avatarUrl: wrldUser.avatarUrl } : null)
    : (streamData?.host ?? null)
  const [activeSource, setActiveSource] = useState<SourceType | null>(null)
  const [controlsVisible, setControlsVisible] = useState(false)
  const [hopError, setHopError] = useState<string | null>(null)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [authModalVisible, setAuthModalVisible] = useState(false)
  const [tipSheetVisible, setTipSheetVisible] = useState(false)
  const [reportVisible, setReportVisible] = useState(false)
  const [viewerListVisible, setViewerListVisible] = useState(false)
  const [viewers, setViewers] = useState<{ peerId: string; handle: string | null }[]>([])
  const [broadcasterTipToast, setBroadcasterTipToast] = useState<string | null>(null)
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const [isRecording, setIsRecording] = useState(false)
  const [activeRecordingId, setActiveRecordingId] = useState<string | null>(null)
  const stoppedByUserRef = useRef(false)

  function stopActiveRecording() {
    stoppedByUserRef.current = true
    if (activeRecordingId) {
      recordingsApi.stop(activeRecordingId).catch(() => {})
    }
    setIsRecording(false)
    setActiveRecordingId(null)
  }
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tipToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Guards against double-navigation when multiple end signals arrive simultaneously
  // (e.g. broadcasterLeft WS message + viewer WS close in the same render cycle).
  const navigatingRef = useRef(false)
  const pendingSnapshotUri = useRef<string | null>(null)

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
  function exitToGlobe(kind: 'ended' | 'disconnected' | 'kicked') {
    if (navigatingRef.current) return
    navigatingRef.current = true
    cleanup()
    disconnect()
    if (kind === 'ended') {
      signalStreamEnded()
    } else if (kind === 'kicked') {
      signalKicked()
    } else {
      signalStreamDisconnected(broadcaster?.handle ?? null)
    }
    router.navigate('/(app)/globe')
  }

  useEffect(() => {
    if (!adminEnded || !isNew) return
    stopActiveRecording()
    activeBroadcast.clear()
    cleanup()
    disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminEnded])

  useEffect(() => {
    if (!streamEnded || isNew) return
    exitToGlobe('ended')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamEnded])

  useEffect(() => {
    if (status !== 'dropped' || isNew) return
    exitToGlobe('disconnected')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  // Fast path 3: kicked by admin (code 4003) — handled directly in onClose so
  // navigation fires in the same event turn as the WS close, before React
  // scheduling can interpose another exit path that sets navigatingRef.current.
  useEffect(() => {
    if (isNew) return
    return signalingClient.onClose((code) => {
      if (code === 4003) exitToGlobe('kicked')
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew])

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

  useEffect(() => {
    if (confirmedBalance === null) return
    invalidateCurrentUser()
    invalidateWallet()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmedBalance])

  useEffect(() => {
    if (!isNew || tipEvents.length === 0) return
    const latest = tipEvents[tipEvents.length - 1]!
    setBroadcasterTipToast(`@${latest.handle} sent ${latest.amount} 🚀`)
    invalidateCurrentUser()
    invalidateWallet()
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

  useFocusEffect(
    useCallback(() => {
      if (isNew) {
        setAdminEnded(false)
        return
      }
      navigatingRef.current = false
      cleanup()
      handleJoin()
      return () => {
        cleanup()
        disconnect()
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]),
  )

  useEffect(() => {
    if (!suspensionError) return
    Alert.alert('Account suspended', suspensionError, [{ text: 'OK', onPress: clearSuspensionError }])
  }, [suspensionError])

  useEffect(() => {
    if (!isNew || status !== 'in-room' || !localStream) return
    sendBroadcasterOrientation(videoIsLandscape ? 'portrait' : 'landscape')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, status, localStream, videoIsLandscape])

  useEffect(() => {
    if (!isNew || status !== 'in-room') return
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background') {
        stopActiveRecording()
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

  // Live location tracking for broadcasters — updates the stream pin as they move
  useEffect(() => {
    if (!isNew || status !== 'in-room') return
    let sub: { remove(): void } | null = null
    Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        distanceInterval: 10,
      },
      (loc) => {
        sendLocationUpdate(loc.coords.latitude, loc.coords.longitude)
      },
    ).then((s) => { sub = s }).catch(() => {})
    return () => { sub?.remove() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, status])

  // Poll recording status while recording is active. When the server stops
  // the recording due to quota, finalize cleanly and alert the broadcaster.
  useEffect(() => {
    if (!isRecording || !activeRecordingId) return
    const id = activeRecordingId
    const interval = setInterval(async () => {
      try {
        const list = await recordingsApi.list()
        const rec = list.find(r => r.id === id)
        if (rec && rec.status !== 'recording') {
          if (!stoppedByUserRef.current) {
            setIsRecording(false)
            setActiveRecordingId(null)
            const message = rec.status === 'failed'
              ? 'The recording encountered an error and was stopped. Your stream continues.'
              : 'You\'ve reached your storage limit. Your stream continues.'
            Alert.alert('Recording stopped', message)
          }
          stoppedByUserRef.current = false
        }
      } catch {}
    }, 5_000)
    return () => clearInterval(interval)
  }, [isRecording, activeRecordingId])

  async function handleGoLive() {
    setIsRecording(false)
    setActiveRecordingId(null)
    const title = (paramTitle ?? '').trim()
    if (!title || !coords || broadcastSources.length === 0) return

    // Translate app vocab → backend vocab; fall back to activeBroadcast then param
    const rawPrecision = activeBroadcast.get()?.precision ?? paramPrecision
    const precisionMap: Record<string, 'exact' | 'city' | 'country' | 'off'> = {
      bluedot: 'exact',
      city: 'city',
      country: 'country',
      private: 'off',
    }
    const locationPrecision = precisionMap[rawPrecision ?? ''] ?? 'exact'

    try {
      await connect()
      await createRoom({
        title,
        lat: coords.latitude,
        lng: coords.longitude,
        sources: broadcastSources,
        subscribersOnly: (activeBroadcast.get()?.subscribersOnly ?? paramSubscribersOnly) === 'true',
        locationPrecision,
      })
      await startBroadcasting(broadcastSources)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to go live'
      if (msg.toLowerCase().includes('suspended')) {
        // suspensionError useEffect will show the Alert; navigate back cleanly
        router.navigate('/(app)/dashboard')
      } else {
        setStatus('error')
        setError(msg)
      }
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

  async function handleResume() {
    cleanup()
    await handleGoLive()
  }

  function handleStartNew() {
    activeBroadcast.clear()
    cleanup()
    disconnect()
    router.navigate('/(app)/dashboard')
  }

  async function handleToggleRecording() {
    if (isRecording) {
      if (!activeRecordingId) return
      try {
        await recordingsApi.stop(activeRecordingId)
        setIsRecording(false)
        setActiveRecordingId(null)
      } catch (err) {
        Alert.alert('Error', err instanceof Error ? err.message : 'Could not stop recording')
      }
    } else {
      if (!streamId) return
      try {
        const { recordingId } = await recordingsApi.start(streamId)
        setActiveRecordingId(recordingId)
        setIsRecording(true)
      } catch (err: unknown) {
        const serverMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        const msg = serverMsg ?? 'Could not start recording'
        Alert.alert('Storage full', msg)
      }
    }
  }

  function handleLeave() {
    stopActiveRecording()
    activeBroadcast.clear()
    cleanup()
    disconnect()
    router.navigate('/(app)/globe')
  }

  async function openViewerList() {
    if (!roomId) return
    setViewerListVisible(true)
    try {
      const list = await streamsApi.getViewers(roomId)
      setViewers(list)
    } catch {
      setViewers([])
    }
  }

  async function handleKickViewer(peerId: string) {
    if (!roomId) return
    setViewers(prev => prev.filter(v => v.peerId !== peerId))
    try {
      await streamsApi.kickViewer(roomId, peerId)
    } catch {
      // re-fetch on failure so list stays accurate
      const list = await streamsApi.getViewers(roomId).catch(() => [])
      setViewers(list)
    }
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

  async function handleReportPress() {
    if (!isSignedIn) { setAuthModalVisible(true); return }
    try {
      // captureScreen + handleGLSurfaceViewOnAndroid captures the GPU
      // SurfaceView that RTCView renders into (PixelCopy path on Android,
      // UIKit composite on iOS). result:'base64' avoids Axios FormData/
      // multipart issues with file URIs.
      pendingSnapshotUri.current = await captureScreen({
        format: 'jpg',
        quality: 0.9,
        result: 'base64',
        handleGLSurfaceViewOnAndroid: true,
      })
    } catch {
      pendingSnapshotUri.current = null
    }
    setReportVisible(true)
  }

  async function submitReport(reason: string) {
    if (!streamId) return
    try {
      const reportId = await streamsApi.report(streamId, reason)
      setReportVisible(false)
      if (pendingSnapshotUri.current) {
        const b64 = pendingSnapshotUri.current
        pendingSnapshotUri.current = null
        streamsApi.uploadSnapshot(reportId, b64).catch(() => {})
      }
      Alert.alert('Reported', 'Thanks for letting us know. We\'ll review this stream.')
    } catch {
      Alert.alert('Error', 'Could not submit report. Please try again.')
    }
  }

  function handleSendChat() {
    const trimmed = chatInput.trim()
    if (!trimmed) return
    if (profanityFilter.isProfane(trimmed)) {
      Alert.alert('Message not sent', 'Your message contains prohibited content.')
      return
    }
    sendChatMessage(trimmed, wrldUser?.handle ?? 'user')
    setChatInput('')
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

  const canGoLive = !!paramTitle?.trim() && !!coords && !(locationLoading && !paramLat) && broadcastSources.length > 0
  const displayError = signalingError ?? mediaError
  const burst = reactions.map((r) => ({ id: r.id, kind: r.kind }))

  const coordItems = [
    {
      label: 'LAT',
      value: coords ? coords.latitude.toFixed(4) : locationError ? '—' : '...',
      pending: !coords && !locationError,
    },
    {
      label: 'LON',
      value: coords ? coords.longitude.toFixed(4) : locationError ? '—' : '...',
      pending: !coords && !locationError,
    },
  ]

  function chatRoleFor(from: string): ChatRole {
    if (broadcaster && from === broadcaster.handle) return 'host'
    return 'user'
  }

  return (
    <SafeAreaView style={styles.container}>
      {showCameraPreview && (
        <RTCView
          streamURL={(localStream as unknown as { toURL(): string }).toURL()}
          style={StyleSheet.absoluteFill}
          objectFit="cover"
          mirror={facingMode === 'user'}
          zOrder={0}
        />
      )}

      {showRemoteVideo && (
        <RTCView
          streamURL={(remoteStream as unknown as { toURL(): string }).toURL()}
          style={StyleSheet.absoluteFill}
          objectFit="cover"
          mirror={false}
          zOrder={0}
        />
      )}

      {isNew && !!adminWarning && (
        <View style={styles.adminWarningWrap}>
          <ToastBanner
            variant="warn"
            body={adminWarning}
            autoDismissMs={0}
            onDismiss={() => setAdminWarning(null)}
          />
        </View>
      )}

      {adminEnded && isNew && (
        <View style={[StyleSheet.absoluteFill, styles.adminEndedContainer]}>
          <View style={styles.adminEndedContent}>
            <Text variant="heading" style={styles.center}>
              Stream Closed
            </Text>
            <Text variant="body" color={theme.colors.text.muted} style={styles.center}>
              An administrator has ended your stream.
            </Text>
            <Button
              label="Back to globe"
              onPress={() => router.navigate('/(app)/globe')}
            />
          </View>
        </View>
      )}

      {showCameraPreview && (
        <View style={styles.flipBtn}>
          <IconButton
            name="repeat"
            variant="surface"
            size="lg"
            onPress={switchCamera}
            accessibilityLabel="Flip camera"
          />
        </View>
      )}

      {showRemoteVideo && (
        <Pressable style={StyleSheet.absoluteFill} onPress={handleTap} />
      )}

      <View style={[styles.header, styles.headerRow]}>
        <IconButton
          name="arrow-left"
          variant={showOverlay ? 'surface' : 'ghost'}
          size="md"
          onPress={handleBack}
          accessibilityLabel="Back"
        />
        {status === 'in-room' && !streamEnded && (
          <View style={styles.headerActions}>
            {!isNew && (
              <>
                <Pressable onPress={handleTipPress} style={styles.tipHeaderBtn} hitSlop={8}>
                  <Text variant="monoLabel" color={theme.colors.accent.default}>
                    🚀 TIP
                  </Text>
                </Pressable>
                <IconButton
                  name="flag"
                  variant={showOverlay ? 'surface' : 'ghost'}
                  size="md"
                  onPress={handleReportPress}
                  accessibilityLabel="Report stream"
                />
              </>
            )}
            <IconButton
              name={chatOpen ? 'x' : 'message-circle'}
              variant={showOverlay ? 'surface' : 'ghost'}
              size="md"
              onPress={() => setChatOpen((o) => !o)}
              accessibilityLabel={chatOpen ? 'Close chat' : 'Open chat'}
            />
          </View>
        )}
      </View>

      {showControls && (
        <View style={styles.content}>
          {!showOverlay && isNew && <Text variant="display">Go Live</Text>}

          {/* ── Idle (broadcaster only) ───────────────────────────── */}
          {status === 'idle' && isNew && (
            <View style={styles.actions}>
              {isNew && isSignedIn && (
                <>
                  {paramTitle && (
                    <Text variant="heading" style={styles.center}>
                      {paramTitle}
                    </Text>
                  )}
                  {broadcastSources.length > 0 && (
                    <View style={styles.sourceRow}>
                      {broadcastSources.map((s) => (
                        <Pill key={s} size="sm" label={SOURCE_LABELS[s].toUpperCase()} />
                      ))}
                    </View>
                  )}
                  {locationLoading && !paramLat && (
                    <View style={styles.statusRow}>
                      <ActivityIndicator color={theme.colors.accent.default} size="small" />
                      <Text variant="body" color={theme.colors.text.muted}>
                        Detecting location…
                      </Text>
                    </View>
                  )}
                  {locationError && (
                    <Text variant="body" color={theme.colors.text.muted}>
                      {locationError}
                    </Text>
                  )}
                  {coords && !(locationLoading && !paramLat) && <CoordHUD items={coordItems} />}
                  <Button
                    label="Start stream"
                    onPress={handleGoLive}
                    disabled={!canGoLive}
                  />
                </>
              )}
              {isNew && !isSignedIn && (
                <Text variant="body" color={theme.colors.text.muted}>
                  Sign in to go live
                </Text>
              )}
              <Button
                label="Back"
                onPress={() => router.navigate('/(app)/globe')}
                variant="secondary"
              />
            </View>
          )}

          {/* ── Connecting ───────────────────────────────────────── */}
          {(status === 'connecting' || status === 'connected' || status === 'authenticated') && (
            <View style={styles.statusRow}>
              <ActivityIndicator color={theme.colors.accent.default} />
              <Text variant="body" color={theme.colors.text.muted}>
                {status === 'connecting' && 'Connecting…'}
                {status === 'connected' && 'Authenticating…'}
                {status === 'authenticated' && 'Entering room…'}
              </Text>
            </View>
          )}

          {/* ── Broadcaster: connection dropped ───────────────────── */}
          {status === 'dropped' && isNew && (
            <View style={styles.actions}>
              <Text variant="body" color={theme.colors.text.muted}>
                Your stream ended.
              </Text>
              <Button label="Resume" onPress={handleResume} />
              <Button
                label="Start new stream"
                onPress={handleStartNew}
                variant="secondary"
              />
            </View>
          )}

          {/* ── Viewer: waiting for stream to load ───────────────── */}
          {!isNew && status === 'in-room' && !remoteStream && !streamEnded && (
            <View style={styles.statusRow}>
              <ActivityIndicator color={theme.colors.accent.default} />
              <Text variant="body" color={theme.colors.text.muted}>
                Loading stream…
              </Text>
            </View>
          )}

          {/* ── In room ──────────────────────────────────────────── */}
          {status === 'in-room' && !streamEnded && (!!remoteStream || isNew) && (
            <View style={[styles.roomInfo, showOverlay && styles.roomInfoOverlay]}>
              <View style={styles.liveRow}>
                <LivePill />
                {!showOverlay && roomId && (
                  <Text variant="monoCaption" color={theme.colors.text.muted}>
                    {roomId}
                  </Text>
                )}
              </View>

              {broadcaster && !isNew && (
                <View style={styles.broadcasterWrap}>
                  <BroadcasterRow
                    avatarUrl={broadcaster.avatarUrl}
                    displayName={broadcaster.displayName}
                    handle={broadcaster.handle}
                    showFollowButton={false}
                  />
                  {broadcaster.handle && (
                    <FollowButton
                      handle={broadcaster.handle}
                      onAuthRequest={!isSignedIn ? () => setAuthModalVisible(true) : undefined}
                    />
                  )}
                </View>
              )}
              {broadcaster && isNew && (
                <BroadcasterRow
                  variant="chip"
                  avatarUrl={broadcaster.avatarUrl}
                  displayName={broadcaster.displayName}
                  handle={broadcaster.handle}
                />
              )}

              {/* On-air-vs-recording indicator (clips initiative). The
                  shipped backend records the aired set as a whole, so the
                  faithful state today is "everything on air is also saved";
                  per-source record asymmetry lands when backend supports
                  it (Aaron's lane). Shown only while actually recording. */}
              {isNew && isRecording && broadcastSources.length > 0 && (
                <BroadcastStatusIndicator
                  style={styles.recIndicator}
                  sources={broadcastSources.map((s) => ({
                    label: SOURCE_LABELS[s],
                    iconName: s === 'camera' ? 'video' : 'mic',
                    air: true,
                    rec: true,
                  }))}
                />
              )}

              {isNew && (
                <View style={styles.section}>
                  {!showOverlay && <HelpText>BROADCASTING</HelpText>}
                  <View style={styles.sourceRow}>
                    {broadcastSources.map((s) => (
                      <Pill
                        key={s}
                        size="sm"
                        variant="accent"
                        label={SOURCE_LABELS[s].toUpperCase()}
                      />
                    ))}
                    {(activeBroadcast.get()?.subscribersOnly ?? paramSubscribersOnly) === 'true' && (
                      <View style={styles.lockBadge}>
                        <Icon name="lock" size="sm" color={theme.colors.accent.default} />
                        <Text variant="monoCaption" color={theme.colors.accent.default}>LOCKED</Text>
                      </View>
                    )}
                  </View>
                  <Pressable onPress={openViewerList} hitSlop={8}>
                    <Text
                      variant="body"
                      color={showOverlay ? theme.colors.text.inverse : theme.colors.text.muted}
                    >
                      {viewerCount} {viewerCount === 1 ? 'viewer' : 'viewers'}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={handleToggleRecording}
                    disabled={!streamId}
                    style={[styles.recordBtn, isRecording && styles.recordBtnActive]}
                    hitSlop={8}
                  >
                    <View style={[styles.recordDot, isRecording && styles.recordDotActive]} />
                    <Text
                      variant="monoLabel"
                      color={isRecording ? theme.colors.text.inverse : theme.colors.text.primary}
                    >
                      {isRecording ? 'STOP REC' : 'REC'}
                    </Text>
                  </Pressable>
                </View>
              )}

              {!isNew && broadcastSources.length > 0 && (
                <View style={styles.section}>
                  {!showOverlay && <HelpText>SOURCES</HelpText>}
                  <View style={styles.sourceRow}>
                    {broadcastSources.map((kind) => {
                      const isActive = activeSource === kind
                      return (
                        <Pressable
                          key={kind}
                          onPress={() => setActiveSource(kind)}
                          style={[
                            styles.sourceSwitchBtn,
                            isActive && styles.sourceSwitchBtnActive,
                          ]}
                        >
                          <Text
                            variant="bodyEmphasized"
                            color={
                              isActive
                                ? theme.colors.accent.default
                                : theme.colors.text.muted
                            }
                          >
                            {SOURCE_LABELS[kind]}
                          </Text>
                        </Pressable>
                      )
                    })}
                  </View>
                </View>
              )}

              <Button label="Leave" onPress={handleLeave} variant="primary" />
            </View>
          )}

          {/* ── Error ────────────────────────────────────────────── */}
          {status === 'error' && displayError === 'Subscription required' && !isNew ? (
            <View style={styles.actions}>
              <Icon name="lock" size="lg" color={theme.colors.text.muted} />
              <Text variant="body" color={theme.colors.text.primary} style={styles.center}>
                Subscribers only
              </Text>
              {broadcaster && (
                <Text variant="caption" color={theme.colors.text.muted} style={styles.center}>
                  @{broadcaster.handle}
                  {streamData?.host?.subscriptionPriceUsd
                    ? ` · $${(streamData.host as unknown as { subscriptionPriceUsd: number }).subscriptionPriceUsd / 100}/mo`
                    : ''}
                </Text>
              )}
              <Text variant="caption" color={theme.colors.text.muted} style={styles.center}>
                Subscribe at wrld.cam to watch
              </Text>
              <Button
                label="Back"
                onPress={() => router.navigate('/(app)/globe')}
                variant="secondary"
              />
            </View>
          ) : status === 'error' && displayError === 'PPV access required' && !isNew ? (
            <View style={styles.actions}>
              <Icon name="lock" size="lg" color={theme.colors.text.muted} />
              <Text variant="body" color={theme.colors.text.primary} style={styles.center}>
                Pay-per-view event
              </Text>
              {broadcaster && (
                <Text variant="caption" color={theme.colors.text.muted} style={styles.center}>
                  @{broadcaster.handle}
                </Text>
              )}
              <Text variant="caption" color={theme.colors.text.muted} style={styles.center}>
                Purchase access at wrld.cam to watch
              </Text>
              <Button
                label="Back"
                onPress={() => router.navigate('/(app)/globe')}
                variant="secondary"
              />
            </View>
          ) : status === 'error' ? (
            <View style={styles.actions}>
              {isNetworkError(displayError) ? (
                <>
                  <Text variant="body" color={theme.colors.text.primary} style={styles.center}>
                    No connection
                  </Text>
                  <Text variant="caption" color={theme.colors.text.muted} style={styles.center}>
                    Check your internet connection and try again.
                  </Text>
                </>
              ) : (
                <Text variant="body" color={theme.colors.accent.default} style={styles.center}>
                  {displayError}
                </Text>
              )}
              <Button label="Try again" onPress={isNew ? handleGoLive : handleJoin} />
              <Button
                label="Back"
                onPress={() => router.navigate('/(app)/globe')}
                variant="secondary"
              />
            </View>
          ) : null}

          {/* ── Hop error ────────────────────────────────────────── */}
          {hopError && (
            <View style={styles.actions}>
              <Text variant="body" color={theme.colors.accent.default} style={styles.center}>
                {hopError}
              </Text>
              <Button label="Dismiss" onPress={() => setHopError(null)} variant="secondary" />
              <Button
                label="Back to globe"
                onPress={() => router.navigate('/(app)/globe')}
                variant="secondary"
              />
            </View>
          )}
        </View>
      )}

      {!isNew && streamId && (
        <NearbyStreamsDrawer
          currentStreamId={streamId}
          visible={controlsVisible}
          onHop={handleHop}
        />
      )}

      {/* Chat panel — ChatMessage rows in a scroll + ChatComposer at the bottom */}
      {chatOpen && status === 'in-room' && !streamEnded && (
        <View style={[styles.chatPanel, { bottom: keyboardHeight }]}>
          <ScrollView
            style={styles.chatScroll}
            contentContainerStyle={styles.chatScrollContent}
          >
            {chatMessages.map((m, i) => (
              <ChatMessageRow
                key={`${m.ts}:${i}`}
                role={chatRoleFor(m.from)}
                handle={`@${m.from}`}
                body={m.text}
              />
            ))}
          </ScrollView>
          <View style={styles.composerWrap}>
            <ChatComposer
              value={chatInput}
              onChangeText={setChatInput}
              onSubmit={handleSendChat}
              authenticated={!!isSignedIn}
              onAuthRequest={() => setAuthModalVisible(true)}
            />
          </View>
        </View>
      )}

      {/* Reaction column + floating burst */}
      {status === 'in-room' && !streamEnded && (
        <View style={styles.reactionRailWrap}>
          <ReactionRail
            reactions={REACTION_CONFIGS}
            burst={burst}
            authenticated={!!isSignedIn}
            onReact={handleReact}
            onAuthRequest={() => setAuthModalVisible(true)}
            onBurstDismiss={dismissReaction}
          />
        </View>
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

      {/* Report reason picker — uses ActionSheet section (replaces the
          bespoke bottom sheet Aaron added on main). */}
      <ActionSheet
        visible={reportVisible}
        onClose={() => setReportVisible(false)}
        header="Report stream"
        actions={[
          { id: 'inappropriate', iconName: 'alert-octagon', label: 'Inappropriate content', tone: 'warn', onPress: () => submitReport('Inappropriate content') },
          { id: 'harassment', iconName: 'user-x', label: 'Harassment or bullying', tone: 'warn', onPress: () => submitReport('Harassment or bullying') },
          { id: 'spam', iconName: 'slash', label: 'Spam', onPress: () => submitReport('Spam') },
          { id: 'other', iconName: 'more-horizontal', label: 'Other', onPress: () => submitReport('Other') },
        ]}
      />

      {/* Viewer list sheet — broadcaster only */}
      {viewerListVisible && (
        <View style={styles.sheetBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setViewerListVisible(false)} />
          <View style={styles.viewerSheet}>
            <Text variant="bodyEmphasized" color={theme.colors.text.primary} style={styles.sheetTitle}>
              Viewers ({viewerCount})
            </Text>
            <ScrollView style={styles.viewerList} showsVerticalScrollIndicator={false}>
              {viewers.length === 0 && (
                <Text variant="body" color={theme.colors.text.muted} style={styles.viewerEmpty}>
                  No signed-in viewers
                </Text>
              )}
              {viewers.map(v => (
                <View key={v.peerId} style={styles.viewerRow}>
                  <Text variant="body" color={theme.colors.text.primary} style={styles.viewerHandle}>
                    {v.handle ? `@${v.handle}` : 'Anonymous'}
                  </Text>
                  <Pressable
                    onPress={() => handleKickViewer(v.peerId)}
                    style={styles.removeBtn}
                    hitSlop={8}
                  >
                    <Text variant="caption" color={theme.colors.accent.default}>Remove</Text>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
            <Pressable onPress={() => setViewerListVisible(false)} style={styles.sheetCancel}>
              <Text variant="body" color={theme.colors.text.muted}>Close</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Tip burst animations — visible to all peers */}
      {status === 'in-room' && !streamEnded && (
        <View style={styles.tipBurstArea} pointerEvents="none">
          {tipEvents.map((t) => (
            <FloatingTip key={t.id} tip={t} onDone={dismissTip} />
          ))}
        </View>
      )}

      {isNew && broadcasterTipToast !== null && (
        <View style={styles.tipToastWrap} pointerEvents="box-none">
          <ToastBanner
            variant="success"
            body={broadcasterTipToast}
            autoDismissMs={0}
            onDismiss={() => setBroadcasterTipToast(null)}
          />
        </View>
      )}

      {!isNew && broadcasterPaused && !streamEnded && (
        <View style={styles.pausedBanner} pointerEvents="none">
          <Text variant="caption" color={theme.colors.text.inverse}>
            Stream paused · resuming shortly
          </Text>
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg.primary },
  content: {
    flex: 1,
    padding: theme.spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  center: { textAlign: 'center' },
  header: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.sm },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  recIndicator: { width: '100%' },
  actions: { width: '100%', gap: theme.spacing.sm, alignItems: 'center' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  roomInfo: { width: '100%', alignItems: 'center', gap: theme.spacing.lg },
  roomInfoOverlay: {
    position: 'absolute',
    bottom: theme.spacing.xl,
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
  },
  section: { width: '100%', gap: theme.spacing.sm, alignItems: 'center' },
  sourceRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sourceSwitchBtn: {
    borderRadius: theme.radius.full,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.bg.elevated,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
  },
  sourceSwitchBtnActive: {
    borderColor: theme.colors.accent.default,
    backgroundColor: theme.colors.accent.surface,
  },
  broadcasterWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },

  tipHeaderBtn: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accent.surface,
    borderWidth: 1,
    borderColor: theme.colors.accent.border,
  },

  chatPanel: {
    position: 'absolute',
    left: 0,
    right: 90,
    bottom: 0,
    height: 320,
    zIndex: 10,
    paddingHorizontal: theme.spacing.md,
  },
  chatScroll: { flex: 1 },
  chatScrollContent: { paddingVertical: theme.spacing.sm, gap: 2 },
  composerWrap: { paddingTop: theme.spacing.sm, paddingBottom: theme.spacing.sm },

  reactionRailWrap: {
    position: 'absolute',
    right: theme.spacing.sm,
    bottom: theme.spacing.lg,
  },

  flipBtn: {
    position: 'absolute',
    top: 60,
    right: theme.spacing.lg,
  },

  pausedBanner: {
    position: 'absolute',
    top: 80,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: theme.radius.full,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    zIndex: 20,
  },

  tipBurstArea: {
    position: 'absolute',
    bottom: 100,
    left: theme.spacing.lg,
    width: 200,
  },

  adminWarningWrap: {
    position: 'absolute',
    top: 60,
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    zIndex: 40,
  },
  tipToastWrap: {
    position: 'absolute',
    top: 100,
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    zIndex: 20,
  },

  recordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    backgroundColor: theme.colors.bg.elevated,
  },
  recordBtnActive: {
    backgroundColor: '#D0233A',
    borderColor: '#D0233A',
  },
  recordDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D0233A',
  },
  recordDotActive: {
    backgroundColor: theme.colors.text.inverse,
  },
  adminEndedContainer: {
    backgroundColor: theme.colors.bg.primary,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
  },
  adminEndedContent: {
    padding: theme.spacing.xl,
    alignItems: 'center',
    gap: theme.spacing.md,
    maxWidth: 320,
  },
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', zIndex: 30 },
  viewerSheet: {
    backgroundColor: theme.colors.bg.panel,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    maxHeight: '60%' as unknown as number,
  },
  sheetTitle: { paddingHorizontal: theme.spacing.lg, marginBottom: theme.spacing.sm },
  viewerList: { paddingHorizontal: theme.spacing.lg },
  viewerEmpty: { paddingVertical: theme.spacing.md },
  viewerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border.subtle,
  },
  viewerHandle: { flex: 1 },
  removeBtn: { paddingLeft: theme.spacing.md },
  sheetCancel: { alignItems: 'center', paddingTop: theme.spacing.lg, paddingHorizontal: theme.spacing.lg },
})
