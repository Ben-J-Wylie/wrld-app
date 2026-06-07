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
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { captureScreen } from 'react-native-view-shot'
import { Filter as ProfanityFilter } from 'bad-words'

const profanityFilter = new ProfanityFilter()
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { RTCView } from 'react-native-webrtc'
import { LinearGradient } from 'expo-linear-gradient'
import { useAuth } from '@clerk/clerk-expo'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { ScreenHeader } from '@/components/sections/ScreenHeader'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { IconButton } from '@/components/primitives/IconButton'
import { HelpText } from '@/components/primitives/HelpText'
import { LivePill } from '@/components/features/stream/LivePill'
import { GoLiveRecordBar } from '@/components/features/broadcast/GoLiveRecordBar'
import { BroadcasterRow } from '@/components/features/user/BroadcasterRow'
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
import { useDeviceOrientation, RECORD_ROTATION_DEG } from '@/hooks/useDeviceOrientation'
import { theme } from '@/tokens/theme'
import { signalStreamDisconnected, signalStreamEnded, signalKicked } from '@/lib/streamSignals'
import { signalingClient } from '@/lib/mediasoupSignaling'
import { activeBroadcast } from '@/lib/activeBroadcast'
import { useBroadcastStore } from '@/stores/broadcastStore'
import { loadCaptureConfig, saveCaptureConfig, DEFAULT_CAPTURE_CONFIG, type CaptureConfig } from '@/lib/captureConfig'
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

// Keep the broadcaster's End Stream button at the same screen-bottom offset
// as the dashboard's Go Live button (same value), so the shared control
// doesn't jump when navigating between the two pages.
const FOOTER_DROP = 30

// The AV subset of the armed capture config that actually streams today
// (camera/audio). `cam` / `audio` are the FeedKind keys the dashboard uses.
function avSourcesFromConfig(cfg: CaptureConfig | null): SourceType[] {
  if (!cfg) return []
  const out: SourceType[] = []
  if (cfg.air?.cam) out.push('camera')
  if (cfg.air?.audio) out.push('audio')
  return out
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
  const { id, streamId: paramStreamId, sources: paramSources, lat: paramLat, lng: paramLng, go: paramGo, rec: paramRec } = useLocalSearchParams<{
    id: string
    streamId?: string
    sources?: string
    lat?: string
    lng?: string
    // go=1 means "go live immediately on arrival" (dashboard Go Live). The
    // center stream tab navigates here WITHOUT go, landing on the preview.
    // rec=1 (with go=1) means "go live AND start recording" (dashboard Record).
    go?: string
    rec?: string
  }>()
  const isNew = id === 'new'

  // When arriving via a deep-link notification without full params, look up by room ID
  const { data: streamByRoom } = useStreamByRoom(!paramStreamId && !isNew ? id : null)

  // Broadcaster arming comes from captureConfig (the shared source of truth),
  // not route params: the title, the AV source set to broadcast/preview, the
  // location precision and subscribers-only flag. Loaded on focus.
  const [cfg, setCfg] = useState<CaptureConfig | null>(null)
  const cfgRef = useRef<CaptureConfig | null>(null)
  cfgRef.current = cfg
  const armedAVSources = useMemo<SourceType[]>(() => avSourcesFromConfig(cfg), [cfg])
  const anyAirArmed = !!cfg && Object.values(cfg.air ?? {}).some(Boolean)

  // The AV sources we're actually broadcasting (set at Go Live) — read from
  // the store so re-entering the tab without route params keeps the live view
  // intact. Falls back to the armed set while previewing.
  const liveSources = useBroadcastStore((s) => s.sources)

  const viewerSources: SourceType[] = paramSources
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
  // Broadcaster: while live, the source set comes from the store (stable
  // across tab re-entry); while previewing, from the armed config. Viewers
  // use the sources passed by the globe / looked up by room.
  const broadcastSources: SourceType[] = !isNew
    ? viewerSources
    : status === 'in-room'
      ? liveSources
      : armedAVSources
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
    startPreview, startBroadcasting, startViewing, switchCamera, cleanup,
  } = useMediasoup()
  const { isSignedIn } = useAuth()
  const insets = useSafeAreaInsets()
  const { coords: liveCoords, loading: locationLoading } = useLocation()
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
  // Measured BOTTOM edge of the header row (back/close-X for viewers · the live
  // pill · identity · viewer count · chat-close cluster for broadcasters), in the
  // SafeAreaView's border-box frame — i.e. layout.y (the safe-area top inset the
  // SafeAreaView adds as padding) + layout.height. The chat panel is absolutely
  // positioned and its `top` is measured from that same border-box top, so we
  // need the header's offset included or the panel lands an inset too high (the
  // top crop would sit at the top of the close-X instead of below it). Pins the
  // chat panel's top crop a footerPad below the close-X, fixed regardless of the
  // keyboard (only the panel's height tracks the keyboard, not its top).
  const [headerBottom, setHeaderBottom] = useState(0)
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
    useBroadcastStore.getState().setRecording(false)
  }
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tipToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Guards against double-navigation when multiple end signals arrive simultaneously
  // (e.g. broadcasterLeft WS message + viewer WS close in the same render cycle).
  const navigatingRef = useRef(false)
  const pendingSnapshotUri = useRef<string | null>(null)
  // Keeps the newest chat message pinned to the bottom (hugging the composer).
  const chatScrollRef = useRef<ScrollView>(null)
  // Latest-value refs so the focus effect (memoized on [id]) can auto-go-live
  // with the current status + params without re-subscribing on every change.
  const statusRef = useRef(status)
  statusRef.current = status
  // Assigned below render — handleGoLive is a hoisted function declaration,
  // so it's already defined at this point in the render body.
  const handleGoLiveRef = useRef<(c?: CaptureConfig) => void>(() => {})
  handleGoLiveRef.current = handleGoLive
  // paramGo/paramRec read via ref so the [id]-memoized focus effect sees the
  // current navigation's values (id is always 'new', so the callback isn't recreated).
  const paramGoRef = useRef(paramGo)
  paramGoRef.current = paramGo
  const paramRecRef = useRef(paramRec)
  paramRecRef.current = paramRec
  // Set when "Record" is pressed before the stream id is ready — the
  // pendingRecord effect starts recording once we're live + have a streamId.
  const pendingRecordRef = useRef(false)
  // Whether this screen is currently focused — so a command from the
  // dashboard (which leaves this screen blurred) doesn't turn the preview
  // camera on in the background after End Stream.
  const isFocusedRef = useRef(false)

  const isCameraArmed = broadcastSources.includes('camera')
  // Shows the broadcaster's own camera both while LIVE and while PREVIEWING
  // (center-tab, not yet live) — localStream is set by startPreview too.
  const showCameraPreview = isNew && !!localStream && isCameraArmed
  const showRemoteVideo = !isNew && status === 'in-room' && !!remoteStream && broadcastSources.includes('camera')
  const showOverlay = showCameraPreview || showRemoteVideo

  // Physical device orientation (sensed via the accelerometer — the app UI is
  // portrait-locked, so this is the only way to know how the phone is held). Only
  // active while previewing/broadcasting our own camera. Drives the live preview
  // rotation and the recording's baked rotation so a landscape hold yields
  // landscape video instead of a sideways portrait frame.
  const { orientation: deviceOrientation, tiltDeg } = useDeviceOrientation(showCameraPreview)
  // GIMBAL preview (iOS): counter-rotate the camera by the continuous tilt angle
  // so it stays upright at any tilt (not just snapping at 90° steps). A `transform`
  // on the RTCView itself is ignored on iOS, so it rides a WRAPPER View. The
  // wrapper is a screen-diagonal square, so at ANY rotation it still covers the
  // screen (no empty corners); the RTCView cover-fills it. Android orients the
  // preview natively → 0. Recording stays discrete (server -c:v copy → one bake
  // per go-live), driven by `deviceOrientation`.
  const previewRotation = Platform.OS === 'ios' ? tiltDeg : 0
  const isLandscapeHold = deviceOrientation === 'landscape-left' || deviceOrientation === 'landscape-right'
  // Gimbal: counter-rotate the screen-sized preview by the tilt to keep the
  // subject upright. No scale — rotating without zoom (the trade-off is the
  // corners aren't filled at large angles; we never zoom in).
  const previewStyle = {
    ...StyleSheet.absoluteFillObject,
    transform: [{ rotate: `${previewRotation}deg` }],
  }
  const previewObjectFit: 'cover' | 'contain' = 'cover'
  const showControls = isNew || !showOverlay || controlsVisible

  // Docked-footer bottom padding (Go Live / End Stream), and the shared offset
  // for things that float just ABOVE that 54-tall button — the preview
  // camera-flip button and the live chat composer both sit here so they clear it.
  const footerPad = Math.max(theme.spacing.sm, insets.bottom + theme.spacing.md - FOOTER_DROP)
  // Components (chat input · send · flip) sit so the gap ABOVE the End Stream
  // button equals the gap BELOW it (footerPad) — symmetric around the 54-tall
  // button. EndStream top = footerPad + 54; we want the components a further
  // footerPad up. They render `sm` above composerBottom, so subtract that sm.
  const floatAboveFooter = footerPad + 54 + footerPad - theme.spacing.sm

  // Shared bottom anchor for the chat composer AND the camera-flip button, so
  // input · send · flip sit on one line and travel together. Keyboard up → hug
  // the top of the keyboard: `bottom:` is measured from the SafeAreaView's
  // (inset) bottom, but `endCoordinates.height` is measured from the real screen
  // bottom, so subtract insets.bottom or the row floats a safe-inset too high.
  // Keyboard down → the broadcaster's float-above-footer slot (viewers bottom).
  const composerBottom =
    keyboardHeight > 0
      ? Math.max(0, keyboardHeight - insets.bottom)
      : isNew
        ? floatAboveFooter
        : 0

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
      isFocusedRef.current = true
      if (isNew) {
        setAdminEnded(false)
        const s = statusRef.current
        // Already live or mid-connect → just show it; don't re-init.
        if (s === 'in-room' || s === 'connecting' || s === 'connected' || s === 'authenticated') {
          return () => { isFocusedRef.current = false } // keep the live broadcast running
        }
        // Load the latest arming, then either go live immediately (dashboard
        // Go Live, go=1) or start the camera preview (center stream tab).
        if (paramGoRef.current === '1') {
          if (s !== 'idle') cleanup() // reset a stale dropped/errored session
          // rec=1 (dashboard Record) → also start recording once live.
          pendingRecordRef.current = paramRecRef.current === '1'
          loadCaptureConfig().then((c) => {
            setCfg(c)
            handleGoLiveRef.current(c)
          })
        } else if (s === 'idle') {
          loadCaptureConfig().then((c) => {
            setCfg(c)
            startPreview(avSourcesFromConfig(c))
          })
        }
        // On blur: stop the preview camera if we never went live; keep a live
        // broadcast running (the tab stays mounted, so in-app nav doesn't end it).
        return () => {
          isFocusedRef.current = false
          if (statusRef.current !== 'in-room') cleanup()
        }
      }
      navigatingRef.current = false
      cleanup()
      handleJoin()
      return () => {
        isFocusedRef.current = false
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

  // Clear the global broadcast flag on terminal states (idle before/after a
  // session, or a drop). `handleGoLive` sets it (with the live sources) once
  // connected — we don't set it here so the connect transitions
  // (connecting/connected/authenticated) don't fight the explicit setLive.
  // The center stream tab reads isLive from this store to animate.
  useEffect(() => {
    if (!isNew) return
    if (status === 'idle' || status === 'dropped') useBroadcastStore.getState().clear()
  }, [isNew, status])

  // Pending-record: "Record" (preview button or dashboard rec=1) goes live
  // first; once we're in-room and the streamId has resolved, start recording.
  useEffect(() => {
    if (!isNew || !pendingRecordRef.current) return
    if (status === 'in-room' && streamId && !isRecording) {
      pendingRecordRef.current = false
      startRecording()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, status, streamId, isRecording])

  // Remote commands from another control surface (the dashboard's buttons act
  // on this mounted screen's running broadcast via the store).
  const command = useBroadcastStore((s) => s.command)
  const commandNonce = useBroadcastStore((s) => s.commandNonce)
  useEffect(() => {
    if (!isNew || !command) return
    if (command === 'endStream') handleEndStream()
    else if (command === 'startRecording') startRecording()
    else if (command === 'stopRecording') stopRecording()
    useBroadcastStore.getState().consumeCommand()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command, commandNonce])

  // Tell the room our orientation: a coarse 'portrait'|'landscape' for the
  // viewer-side layout hint, plus the precise rotation degrees the recorder bakes
  // into the fmp4 so the saved video is upright. The recording bakes once at
  // capture start (it's -c:v copy), so for v1 the recording's orientation is
  // whatever it is when the buffer chain starts (~go-live); the preview keeps
  // following the phone live.
  useEffect(() => {
    if (!isNew || status !== 'in-room' || !localStream) return
    sendBroadcasterOrientation(
      isLandscapeHold ? 'landscape' : 'portrait',
      RECORD_ROTATION_DEG[deviceOrientation],
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, status, localStream, deviceOrientation])

  useEffect(() => {
    if (!isNew || status !== 'in-room') return
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background') {
        stopActiveRecording()
        cleanup()
        disconnect()
        // Returning to foreground won't re-fire the focus effect (the tab
        // never blurred), so the screen would sit on the "Going live…"
        // idle frame forever. Send the broadcaster back to the dashboard
        // to re-arm and Go Live again.
        router.navigate('/(app)/dashboard')
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

  // Watch the recordings query cache for server-side status changes on the
  // active recording. The recording_updated WS push keeps this cache current
  // so no polling is needed — this effect just reacts when the cache updates.
  const { data: liveRecordings } = useQuery({
    queryKey: ['recordings'],
    queryFn: recordingsApi.list,
    enabled: isRecording && !!activeRecordingId,
  })
  useEffect(() => {
    if (!isRecording || !activeRecordingId || !liveRecordings) return
    const rec = liveRecordings.find(r => r.id === activeRecordingId)
    if (!rec || rec.status === 'recording') return
    if (!stoppedByUserRef.current) {
      setIsRecording(false)
      setActiveRecordingId(null)
      Alert.alert(
        'Recording stopped',
        rec.status === 'failed'
          ? 'The recording encountered an error and was stopped. Your stream continues.'
          : 'You\'ve reached your storage limit. Your stream continues.',
      )
    }
    stoppedByUserRef.current = false
  }, [liveRecordings, activeRecordingId, isRecording])

  async function handleGoLive(configOverride?: CaptureConfig) {
    // Arming + title come from captureConfig (the shared source of truth), so
    // going live works identically from the dashboard (go=1, passes the
    // freshly-loaded config) and from the stream-view preview's Go Live
    // button (uses the live cfg state, which reflects the typed title).
    const c = configOverride ?? cfgRef.current ?? (await loadCaptureConfig())
    const title = c.title.trim()
    // Data-only broadcasts (location/telemetry only, no camera/audio) are
    // valid — av may be empty; startBroadcasting skips getUserMedia then.
    // Only a title + coords are required.
    if (!title || !coords) return
    if (profanityFilter.isProfane(title)) {
      Alert.alert('Title not allowed', 'Your stream title contains prohibited content. Please choose a different title.')
      return
    }
    const av = avSourcesFromConfig(c)

    setIsRecording(false)
    setActiveRecordingId(null)

    const precisionMap: Record<string, 'exact' | 'city' | 'country' | 'off'> = {
      exact: 'exact',
      city: 'city',
      country: 'country',
      private: 'off',
    }
    const locationPrecision = precisionMap[c.precision] ?? 'exact'

    try {
      await connect()
      // Set the live source set before the room flips to in-room so the live
      // view + center tab read it immediately (cleared in catch on failure).
      useBroadcastStore.getState().setLive(av)
      await createRoom({
        title,
        lat: coords.latitude,
        lng: coords.longitude,
        sources: av,
        subscribersOnly: c.subscribersOnly,
        locationPrecision,
        ppvEventId: activeBroadcast.get()?.ppvEventId,
      })
      await startBroadcasting(av)
    } catch (err) {
      useBroadcastStore.getState().clear()
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
    useBroadcastStore.getState().clear()
    activeBroadcast.clear()
    cleanup()
    disconnect()
    router.navigate('/(app)/dashboard')
  }

  async function startRecording() {
    if (!streamId || isRecording) return
    try {
      const { recordingId } = await recordingsApi.start(streamId)
      setActiveRecordingId(recordingId)
      setIsRecording(true)
      useBroadcastStore.getState().setRecording(true)
    } catch (err: unknown) {
      const serverMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      Alert.alert('Storage full', serverMsg ?? 'Could not start recording')
    }
  }

  async function stopRecording() {
    if (!isRecording || !activeRecordingId) return
    try {
      await recordingsApi.stop(activeRecordingId)
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not stop recording')
      return
    }
    setIsRecording(false)
    setActiveRecordingId(null)
    useBroadcastStore.getState().setRecording(false)
  }

  // Record from the preview: go live first, then start recording once the
  // stream id resolves (see the pendingRecord effect below).
  function handleGoLiveThenRecord() {
    pendingRecordRef.current = true
    handleGoLive()
  }

  // End Stream — stop recording (if any) AND the stream, but STAY on this
  // page (no navigation): drop back to the armed preview so the broadcaster
  // can go live again without leaving. (The header back arrow leaves to the
  // globe but keeps a live broadcast running; only End Stream stops it.)
  function handleEndStream() {
    pendingRecordRef.current = false
    stopActiveRecording()
    useBroadcastStore.getState().clear()
    activeBroadcast.clear()
    cleanup()
    disconnect()
    // Restore the camera preview only if the user is actually on this screen
    // (End Stream can be commanded from the dashboard, leaving it blurred).
    if (isFocusedRef.current) startPreview(avSourcesFromConfig(cfgRef.current))
  }

  // Viewer-only "Leave" → back to the globe.
  function handleLeave() {
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
    // Viewer: leaving tears down the connection. Broadcaster: leave the page
    // but keep a live broadcast running (in-app nav doesn't end it — the blur
    // cleanup stops a non-live preview; only End Stream stops a live one).
    if (!isNew && (status === 'in-room' || status === 'dropped')) {
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

  const displayError = signalingError ?? mediaError
  const burst = reactions.map((r) => ({ id: r.id, kind: r.kind }))

  // Preview (center-tab) Go Live gating + shared-title editing. Editing the
  // title here persists to captureConfig so the dashboard shows the same value.
  const canGoLivePreview = !!cfg?.title.trim() && !!coords && anyAirArmed
  function updatePreviewTitle(t: string) {
    const next = { ...(cfgRef.current ?? DEFAULT_CAPTURE_CONFIG), title: t }
    setCfg(next)
    saveCaptureConfig(next)
  }

  function chatRoleFor(from: string): ChatRole {
    if (broadcaster && from === broadcaster.handle) return 'host'
    return 'user'
  }

  return (
    <SafeAreaView style={styles.container}>
      {showCameraPreview && (
        // The rotation lives on this WRAPPER View, not the RTCView — a transform
        // on RTCView is ignored on iOS. The RTCView fills the (possibly rotated +
        // dimension-swapped) wrapper, so no per-video transform is needed.
        <View style={previewStyle}>
          <RTCView
            streamURL={(localStream as unknown as { toURL(): string }).toURL()}
            style={StyleSheet.absoluteFill}
            objectFit={previewObjectFit}
            mirror={facingMode === 'user'}
            zOrder={0}
          />
        </View>
      )}

      {/* TEMP orientation debug readout (remove once angles are dialled in).
          Reports what each platform senses + the track's own orientation, so the
          per-platform rotation can be set from real data. */}
      {showCameraPreview && (
        <View style={styles.orientationDebug} pointerEvents="none">
          <Text variant="monoLabel" color={theme.colors.text.inverse}>
            {`${Platform.OS} · hold:${deviceOrientation} · tilt:${Math.round(previewRotation)}° · rec:${RECORD_ROTATION_DEG[deviceOrientation]}° · track:${videoIsLandscape ? 'land' : 'port'}`}
          </Text>
        </View>
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

      {/* Top scrim behind the header — same cream gradient as the globe's top
          stack (paper100 → transparent). Rendered right after the video so it
          sits ABOVE the camera but BELOW the header UI + flip button (which
          render later) — otherwise it paints over the flip button while live. */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(236,230,214,1)', 'rgba(236,230,214,0.85)', 'rgba(236,230,214,0)']}
        locations={[0, 0.6, 1]}
        style={[styles.headerScrim, { height: insets.top + 100 }]}
      />

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

      {/* Camera flip — shares the chat composer's bottom anchor so it sits on the
          exact same line as the chat input + send button (all three 44-tall, both
          travel with the keyboard). `+ sm` matches the composer's paddingBottom.
          Sits in the right margin the chat panel leaves open. */}
      {showCameraPreview && (
        <View style={[styles.flipBtn, { bottom: composerBottom + theme.spacing.sm }]}>
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

      {isNew && status !== 'in-room' && !streamEnded ? (
        // Broadcaster, pre-live: the shared brand header (page = "Go Live"),
        // matching the dashboard / globe so the title field below lines up.
        <ScreenHeader title="Go Live" style={styles.previewHeaderPad} />
      ) : (
        <View
          style={[styles.header, styles.headerRow]}
          onLayout={(e) =>
            setHeaderBottom(e.nativeEvent.layout.y + e.nativeEvent.layout.height)
          }
        >
        {isNew ? (
          // Broadcaster: no back button (leave via the tab bar / End Stream).
          // While live, the live pill + identity + viewer count sit top-left.
          status === 'in-room' && !streamEnded ? (
            <View style={styles.broadcasterTopLeft}>
              <LivePill />
              {broadcaster && (
                <BroadcasterRow
                  variant="chip"
                  avatarUrl={broadcaster.avatarUrl}
                  displayName={broadcaster.displayName}
                  handle={broadcaster.handle}
                />
              )}
              <Pressable onPress={openViewerList} hitSlop={8}>
                <Text variant="caption" color={theme.colors.text.inverse}>
                  {viewerCount} {viewerCount === 1 ? 'viewer' : 'viewers'}
                </Text>
              </Pressable>
              {/* Chat toggle/close — on the left beneath the viewer count (for
                  now). Surface + lg to match the send / camera-flip buttons. */}
              <IconButton
                name={chatOpen ? 'x' : 'message-circle'}
                variant="surface"
                size="lg"
                onPress={() => setChatOpen((o) => !o)}
                accessibilityLabel={chatOpen ? 'Close chat' : 'Open chat'}
              />
            </View>
          ) : (
            <View />
          )
        ) : (
          <IconButton
            name="arrow-left"
            variant={showOverlay ? 'surface' : 'ghost'}
            size="md"
            onPress={handleBack}
            accessibilityLabel="Back"
          />
        )}
        {!isNew && status === 'in-room' && !streamEnded && (
          <View style={styles.headerActions}>
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
      )}

      {/* Pre-live: the "What's happening" field sits directly under the brand
          header, at the same Y as the globe search / dashboard title so it
          doesn't jump when switching tabs. */}
      {isNew && status === 'idle' && !streamEnded && isSignedIn && (
        <View style={styles.previewTop}>
          <Input
            placeholder="What's happening?"
            value={cfg?.title ?? ''}
            onChangeText={updatePreviewTitle}
            autoCorrect={false}
          />
          {!anyAirArmed && (
            <Text variant="caption" color={theme.colors.text.muted} style={styles.center}>
              Arm a source on the dashboard to go live
            </Text>
          )}
          {locationLoading && !coords && (
            <Text variant="caption" color={theme.colors.text.muted} style={styles.center}>
              Detecting location…
            </Text>
          )}
        </View>
      )}

      {showControls && (
        <View style={styles.content}>
          {/* ── Broadcaster idle, signed out: prompt to sign in ── */}
          {/* (Signed-in pre-live title field is the top block above; the
              camera preview shows behind. The dashboard's go=1 autostart
              flashes through this for one frame before connecting.) */}
          {status === 'idle' && isNew && !isSignedIn && (
            <View style={styles.actions}>
              <Text variant="body" color={theme.colors.text.muted}>
                Sign in to go live
              </Text>
              <Button label="Back" onPress={() => router.navigate('/(app)/globe')} variant="secondary" />
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

          {/* ── In room (viewer) ─────────────────────────────────── */}
          {/* Broadcaster live UI is rendered as overlays outside `content`
              (top-left cluster in the header + bottom record/End-Stream
              footer); this box is viewer-only now. */}
          {!isNew && status === 'in-room' && !streamEnded && !!remoteStream && (
            <View style={[styles.roomInfo, showOverlay && styles.roomInfoOverlay]}>
              <View style={styles.liveRow}>
                <LivePill />
                {!showOverlay && roomId && (
                  <Text variant="monoCaption" color={theme.colors.text.muted}>
                    {roomId}
                  </Text>
                )}
              </View>

              {broadcaster && (
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

              {broadcastSources.length > 0 && (
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

      {/* Broadcaster preview — Go Live button docked at the SAME screen-bottom
          offset as the dashboard's Go Live button, so it doesn't jump when
          moving between the two pages while not live. */}
      {isNew && status === 'idle' && isSignedIn && (
        <View
          style={[styles.broadcasterFooter, { paddingBottom: footerPad }]}
          pointerEvents="box-none"
        >
          <GoLiveRecordBar
            style={styles.fullWidth}
            isLive={false}
            liveDisabled={!canGoLivePreview}
            onLivePress={() => handleGoLive()}
          />
        </View>
      )}

      {/* Broadcaster live controls — full-width End Stream button, docked at the
          same screen-bottom offset as the dashboard's Go Live button so it
          doesn't jump when moving between the two pages. (Record button retired —
          recording is implicit under the rolling-buffer model.) */}
      {isNew && status === 'in-room' && !streamEnded && (
        <View
          style={[styles.broadcasterFooter, { paddingBottom: footerPad }]}
          pointerEvents="box-none"
        >
          <GoLiveRecordBar
            style={styles.fullWidth}
            isLive
            onLivePress={handleEndStream}
          />
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
        <View
          style={[
            styles.chatPanel,
            // Stretch from just below the header's close-X down to the composer
            // (top + bottom, NO height) so the panel HEIGHT — not its top — tracks
            // the keyboard. The top crop sits a footerPad below the header's bottom
            // edge (the close-X), matching the footerPad gap below the composer's
            // input — so the top crop stays in the exact same spot whether the
            // keyboard is present or not. Never set top+bottom+height together
            // (Yoga drops `bottom`, the composer would float).
            headerBottom > 0
              ? { top: headerBottom + footerPad, bottom: composerBottom }
              : { height: 320, bottom: composerBottom },
          ]}
        >
          <ScrollView
            ref={chatScrollRef}
            style={styles.chatScroll}
            contentContainerStyle={styles.chatScrollContent}
            onContentSizeChange={() => chatScrollRef.current?.scrollToEnd({ animated: true })}
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
          {/* Bottom crop = footerPad — the same gap as below the End Stream button. */}
          <View style={[styles.composerWrap, { paddingTop: footerPad }]}>
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
  // Pre-live brand header + title field. paddingTop sm above the header and sm
  // above the field mirror the globe / dashboard so the field lands at the
  // same Y on every screen.
  previewHeaderPad: { paddingTop: theme.spacing.sm },
  orientationDebug: {
    position: 'absolute',
    top: 90,
    alignSelf: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.md,
    backgroundColor: 'rgba(0,0,0,0.6)',
    zIndex: 50,
  },
  previewTop: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  // Broadcaster live: live pill + identity + viewer count stacked top-left,
  // directly over the camera (no box).
  broadcasterTopLeft: { alignItems: 'flex-start', gap: theme.spacing.xs },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  actions: { width: '100%', gap: theme.spacing.sm, alignItems: 'center' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  // Center-tab preview: title + hints near the top, camera feed (if armed)
  // behind; the Go Live button is docked separately (broadcasterFooter).
  previewControls: { flex: 1, width: '100%', gap: theme.spacing.sm },
  fullWidth: { width: '100%' },
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
  // Broadcaster live: record circle above the full-width End Stream button,
  // docked at the bottom over the camera (no box).
  broadcasterFooter: {
    position: 'absolute',
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    bottom: 0,
    alignItems: 'center',
    gap: theme.spacing.md,
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
    zIndex: 10,
    // `top`/`bottom`/`height` are set inline per-case (see render) so we never
    // combine top+bottom+height. lg so the chat input + messages share the End
    // Stream button's left edge (same as the live-pill / viewer-count cluster).
    paddingHorizontal: theme.spacing.lg,
  },
  // Right-inset the message list by the send button (44) + its gap (sm) so the
  // messages' right boundary lines up with the chat input field's right edge,
  // not the send button's. The composer row below keeps the full panel width.
  chatScroll: { flex: 1, marginRight: 44 + theme.spacing.sm },
  // Bottom-anchored: a few messages sit just above the composer (newest hugs
  // it); a full thread auto-scrolls to the newest. The crops are the viewport
  // edges — top pinned below the cluster, bottom = footerPad via composerWrap.
  chatScrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    gap: 2,
  },
  composerWrap: { paddingBottom: theme.spacing.sm },

  reactionRailWrap: {
    position: 'absolute',
    right: theme.spacing.sm,
    // Higher up the right edge (was bottom: lg) so it clears the bottom
    // broadcast controls.
    bottom: '38%',
  },

  // Camera flip — docked bottom-right above the bottom button; `bottom` is set
  // inline to the shared float-above-footer offset (same as the chat composer).
  flipBtn: {
    position: 'absolute',
    right: theme.spacing.lg,
  },
  headerScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
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
