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
  NativeModules,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  View,
} from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { useEffect, useMemo, useRef, useState, useCallback, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { captureScreen } from 'react-native-view-shot'
import { Filter as ProfanityFilter } from 'bad-words'

const profanityFilter = new ProfanityFilter()
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { RTCView } from 'react-native-webrtc'
import { CameraPreview } from '@/components/native/CameraPreview'
import { useAuth } from '@clerk/clerk-expo'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { ScreenHeader } from '@/components/sections/ScreenHeader'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { IconButton } from '@/components/primitives/IconButton'
import { LivePill } from '@/components/features/stream/LivePill'
import { SourceRail } from '@/components/features/clip/SourceRail'
import { SOURCE_META, SOURCE_RAIL_ORDER, KIND_TO_FEEDKIND, pickDefaultView } from '@/components/features/stream/sourceMeta'
import { SourceStage, type SourceRender } from '@/components/sections/SourceStage'
import { useBroadcasterClock } from '@/hooks/useBroadcasterClock'
import { useStreamTelemetry } from '@/hooks/useStreamTelemetry'
import { useLocalTelemetry } from '@/hooks/useLocalTelemetry'
import { useLocationTrail } from '@/hooks/useLocationTrail'
import { useTelemetryCapture } from '@/hooks/useTelemetryCapture'
import { useAudioLevelCapture } from '@/hooks/useAudioLevelCapture'
import type { FeedKind } from '@/components/features/broadcast/FeedThumb'
import { Avatar } from '@/components/primitives/Avatar'
import { GoLiveRecordBar } from '@/components/features/broadcast/GoLiveRecordBar'
import { LiveClockBar, LIVE_CLOCK_BAR_H } from '@/components/features/discovery/LiveClockBar'
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
import { GiftRail } from '@/components/features/stream/GiftRail'
import { useGiftCatalog } from '@/hooks/useGiftCatalog'
import { FollowButton } from '@/components/features/user/FollowButton'
import { useInvalidateCurrentUser } from '@/hooks/useCurrentUser'
import { useInvalidateWallet } from '@/hooks/useWallet'
import { useDeviceOrientation, RECORD_ROTATION_DEG } from '@/hooks/useDeviceOrientation'
import { theme } from '@/tokens/theme'
import { signalStreamDisconnected, signalStreamEnded, signalKicked, signalEventCancelled } from '@/lib/streamSignals'
import { signalingClient } from '@/lib/mediasoupSignaling'
import { activeBroadcast } from '@/lib/activeBroadcast'
import { useBroadcastStore } from '@/stores/broadcastStore'
import { loadCaptureConfig, saveCaptureConfig, DEFAULT_CAPTURE_CONFIG, type CaptureConfig } from '@/lib/captureConfig'
import { streamsApi } from '@/api/streams'
import { ppvApi } from '@/api/ppvEvents'
import { onPpvSocketEvent } from '@/lib/ppvSocketEvents'
import { recordingsApi } from '@/api/recordings'
import { usersApi } from '@/api/users'
import { useSignaling } from '@/hooks/useSignaling'
import { useMediasoup } from '@/hooks/useMediasoup'
import { useFullscreenVideo } from '@/hooks/useFullscreenVideo'
import * as Location from 'expo-location'
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'
import { useLocation } from '@/hooks/useLocation'
import { useStream, useStreamByRoom } from '@/hooks/useStream'
import { useAuthStore } from '@/stores/authStore'
import type { Stream, SourceType, GiftCatalogItem } from '@/types'
import type { TipEvent, GiftEvent } from '@/hooks/useSignaling'

// Keep the broadcaster's End Stream button at the same screen-bottom offset
// as the dashboard's Go Live button (same value), so the shared control
// doesn't jump when navigating between the two pages.
const FOOTER_DROP = 30
// Height reserved for the horizontal source rail band that sits between the bottom button and the
// chat-tools line (broadcaster) / above the clock (viewer). The camera box bottom is lifted by this.
const RAIL_BAR_H = 40

// The AV subset of the armed capture config that actually streams today
// (camera/audio). `cam` / `audio` are the FeedKind keys the dashboard uses.
// Drives getUserMedia (startBroadcasting) + the source rail.
function avSourcesFromConfig(cfg: CaptureConfig | null): SourceType[] {
  if (!cfg) return []
  const out: SourceType[] = []
  if (cfg.air?.cam) out.push('camera')
  if (cfg.air?.audio) out.push('audio')
  return out
}

// The full armed RECORDED source set sent to createRoom → room._meta.sources →
// which per-source buffer tracks mediasoup records (so a saved clip's chat /
// telemetry / location track is real). Maps the dashboard's FeedKind air keys +
// the chat flag to the backend's canonical kind names (the VALID_SOURCES set).
// AV still drives getUserMedia + the rail; the data kinds only add recorded
// tracks. Capture ⊆ broadcast — these are the aired sources.
const AIR_KEY_TO_KIND: Record<string, string> = {
  cam: 'camera',
  audio: 'audio',
  screen: 'screen',
  loc: 'location',
  gyro: 'gyro',
  compass: 'compass',
  motion: 'motion',
  accel: 'accel',
  speed: 'speed',
  temp: 'temp',
  torch: 'torch',
}


function recordedSourcesFromConfig(cfg: CaptureConfig | null): string[] {
  if (!cfg) return []
  const out: string[] = []
  for (const [key, on] of Object.entries(cfg.air ?? {})) {
    if (on && AIR_KEY_TO_KIND[key]) out.push(AIR_KEY_TO_KIND[key])
  }
  if (cfg.chat === 'on') out.push('chat')
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

// Floating gift burst — same upward-drift treatment as tips, shown to all peers.
function FloatingGift({ gift, onDone }: { gift: GiftEvent; onDone: (id: number) => void }) {
  const translateY = useRef(new Animated.Value(0)).current
  const opacity = useRef(new Animated.Value(1)).current
  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: -140, duration: 2400, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(1600),
        Animated.timing(opacity, { toValue: 0, duration: 800, useNativeDriver: true }),
      ]),
    ]).start(() => onDone(gift.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <Animated.View style={[tipStyles.floating, { transform: [{ translateY }], opacity }]}>
      <View style={giftStyles.bubble}>
        <RNText style={giftStyles.emoji}>{gift.emoji}</RNText>
        <Text variant="caption" color={theme.colors.text.inverse}>
          @{gift.handle}
        </Text>
      </View>
    </Animated.View>
  )
}

const giftStyles = StyleSheet.create({
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.accent.default,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
    overflow: 'hidden',
  },
  emoji: { fontSize: 18 },
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
    goLiveError, clearGoLiveError,
    chatMessages, reactions, broadcasterPaused,
    tipEvents, giftEvents, confirmedBalance,
    connect, createRoom, joinRoom, disconnect,
    sendChatMessage, sendReaction, dismissReaction,
    sendTip, dismissTip,
    sendGift, dismissGift,
    sendLocationUpdate,
    sendTelemetry,
    sendBroadcasterPaused, sendBroadcasterResumed, sendBroadcasterOrientation, sendCameraFacing,
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
    localStream, remoteStream, audioLevel, error: mediaError, facingMode, videoIsLandscape,
    setRemoteAudioVolume,
    startPreview, startBroadcasting, startViewing, consumeProducer, switchCamera, cleanup,
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
  // Broadcaster's local time, shown to viewers next to their identity.
  const broadcasterLocalTime = useBroadcasterClock(streamData?.timezone)
  const [activeSource, setActiveSource] = useState<FeedKind | null>(null)
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
  // Fullscreen viewer + its mute control. Unmuted by default (unity gain) — no
  // behaviour change until the viewer mutes.
  const { isFullscreen, enter: enterFullscreen, exit: exitFullscreen } = useFullscreenVideo()
  const [muted, setMuted] = useState(false)
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
  // PPV pause: the broadcaster stopped but the event is still live — hold here and
  // wait for the resume push instead of leaving to the globe.
  const [paused, setPaused] = useState(false)
  const pausedRef = useRef(false)
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
  // Viewer is in a live room with media flowing. The viewer media surface
  // (camera video OR a source visualizer) renders for the whole time this is
  // true; the SourceRail switches which source is shown.
  const isViewerInRoom = !isNew && status === 'in-room' && !streamEnded && !!remoteStream
  // The source rail shows ONLY the ARMED sources (Ben 2026-06-17) — not the full suite. Identity is
  // always present (a flag). Broadcaster: the armed set from captureConfig (air keys are FeedKinds,
  // + chat). Viewer: the stream's armed sources (Stream.sources, backend names → FeedKind). Ordered
  // by SOURCE_RAIL_ORDER. (An un-armed source isn't shown — and a data-only/location-only stream is
  // valid: it still has identity + location.)
  const availableKinds = useMemo<FeedKind[]>(() => {
    const set = new Set<FeedKind>(['profile']) // identity always
    if (isNew) {
      for (const [k, on] of Object.entries(cfg?.air ?? {})) if (on) set.add(k as FeedKind)
      if (cfg?.chat === 'on') set.add('chat')
    } else {
      for (const s of broadcastSources) {
        const fk = KIND_TO_FEEDKIND[s as string]
        if (fk) set.add(fk)
      }
    }
    return SOURCE_RAIL_ORDER.filter((k) => set.has(k))
  }, [isNew, cfg, broadcastSources])
  // Which source is shown — the held selection if it's still armed; else the most important armed
  // source by the default-view priority (camera first, … location, identity last).
  const selectedKind: FeedKind =
    activeSource && availableKinds.includes(activeSource) ? activeSource : pickDefaultView(availableKinds)
  const selectSource = (k: FeedKind) => setActiveSource(k)

  // Viewer-side live decode of the broadcaster's sensor telemetry (latest per kind), from the
  // `telemetryUpdate` fan-out. Viewer-only — the broadcaster monitors its OWN sensors locally
  // (the relay never fans back to the sender), so the broadcaster reads `localTel` instead.
  const tel = useStreamTelemetry(isViewerInRoom)
  // Broadcaster self-monitor: the relay fans telemetry out to VIEWERS, never back to the sender,
  // so a broadcaster can't watch its own sensors over the wire. Read the selected sensor locally
  // (preview AND live) and feed the SAME render path. Only the viewed sensor is subscribed.
  // Read the broadcaster's own sensor for the selected source in PREVIEW (status idle, camera on OR
  // off) AND live (in-room) — so a camera-off preview's id/location/sensor view has real data.
  const localTel = useLocalTelemetry(isNew ? selectedKind : null, isNew && (status === 'idle' || (status === 'in-room' && !streamEnded)))
  // The readings the media surface renders: the broadcaster's own (local) vs the viewer's (fan-out).
  const monitorTel = isNew ? localTel : tel
  // SP5 — accumulate live location samples into a [lng,lat] trail for the location source view
  // (broadcaster's own via localTel, viewer's via the fan-out tel.location). Resets off-surface.
  const locTrail = useLocationTrail(
    monitorTel.location,
    (isNew && (status === 'idle' || (status === 'in-room' && !streamEnded))) || isViewerInRoom,
  )
  // SP6a — torch is a CONTROL, not a phone sensor (RN-WebRTC has no torch API; this is a signaled
  // on/off channel — the lamp UI, not the device LED). The broadcaster holds the on/off state and
  // emits it; mediasoup fans it to viewers + records it when torch is armed (Aaron's data path).
  const [torchOn, setTorchOn] = useState(false)
  const toggleTorch = useCallback(() => {
    setTorchOn((on) => {
      const next = !on
      try {
        sendTelemetry({ kind: 'torch', ts: Date.now(), on: next })
      } catch {}
      return next
    })
  }, [sendTelemetry])
  // Build the SourceStage render for the selected source. cam/screen get the
  // injected RTCView slot; everything else renders from `monitorTel` / `audioLevel`.
  const buildSource = useCallback(
    (kind: FeedKind, camSlot: ReactNode): SourceRender => {
      switch (kind) {
        case 'cam':
        case 'screen':
          return { kind, slot: camSlot }
        case 'audio':
          return { kind: 'audio', level: audioLevel, variant: 'waveform' }
        case 'compass':
          return { kind: 'compass', heading: monitorTel.compass?.heading ?? 0 }
        case 'gyro':
          return { kind: 'gyro', pitch: monitorTel.gyro?.pitch ?? 0, roll: monitorTel.gyro?.roll ?? 0 }
        case 'motion':
          return { kind: 'motion', intensity: monitorTel.motionIntensity ?? 0 }
        case 'accel':
          return { kind: 'accel', x: monitorTel.accel?.x ?? 0, y: monitorTel.accel?.y ?? 0, z: monitorTel.accel?.z ?? 0 }
        case 'speed':
          return { kind: 'speed', mps: monitorTel.speed?.mps ?? -1 }
        case 'torch':
          // Broadcaster: own on/off state + the tappable toggle; viewer: read-only from the fan-out.
          return isNew
            ? { kind: 'torch', on: torchOn, onToggle: toggleTorch }
            : { kind: 'torch', on: monitorTel.torch?.on ?? false, level: monitorTel.torch?.level }
        case 'temp':
          return { kind: 'temp', celsius: NaN } // no phone sensor → idle
        case 'loc':
          // SP5 — live trail: broadcaster's own (localTel) / viewer's (fan-out), accumulated above.
          return { kind: 'loc', path: locTrail, position: locTrail[locTrail.length - 1] }
        case 'chat':
          return { kind: 'chat', messages: chatMessages.map((m) => ({ handle: m.from, text: m.text })) }
        case 'profile':
          return {
            kind: 'profile',
            displayName: broadcaster?.displayName ?? '—',
            handle: broadcaster?.handle ?? '',
            avatarUrl: broadcaster?.avatarUrl ?? null,
            attributed: true,
          }
        default:
          return { kind: 'audio', level: audioLevel, variant: 'waveform' }
      }
    },
    [monitorTel, audioLevel, chatMessages, broadcaster, locTrail, torchOn, toggleTorch, isNew],
  )
  // Has the selected source produced data yet? (idle/dim styling until then — honest, never faked).
  // audio is metered for the broadcaster whenever audio is armed — in PREVIEW (a local meter PC)
  // AND live — and for a viewer in-room (consumer getStats). temp has no phone sensor → always idle.
  // chat/profile/cam/screen are always live surfaces.
  const sourceActive =
    selectedKind === 'cam' ||
    selectedKind === 'screen' ||
    selectedKind === 'profile' ||
    selectedKind === 'chat' ||
    (selectedKind === 'audio' && ((isNew && broadcastSources.includes('audio')) || isViewerInRoom)) ||
    (selectedKind === 'compass' && !!monitorTel.compass) ||
    (selectedKind === 'gyro' && !!monitorTel.gyro) ||
    (selectedKind === 'motion' && monitorTel.motionIntensity !== null) ||
    (selectedKind === 'accel' && !!monitorTel.accel) ||
    (selectedKind === 'speed' && !!monitorTel.speed) ||
    (selectedKind === 'loc' && !!monitorTel.location) ||
    // torch: the broadcaster's control is always active; a viewer's lamp once a sample arrives.
    (selectedKind === 'torch' && (isNew || !!monitorTel.torch))
  // The viewer always gets the dark media surface + translucent control overlay
  // (so a visualizer reads like the video it replaces).
  const showOverlay = showCameraPreview || isViewerInRoom
  // Live broadcaster monitoring a non-camera source — show that visualizer in the
  // camera's place; the camera preview only shows when 'cam' is selected.
  const showBroadcasterCamera = showCameraPreview && selectedKind === 'cam'
  // True while THIS broadcaster is live — drives the header page name ("Live")
  // and the live info row (LivePill + avatar + viewer count) that takes the
  // title input's place.
  const isLiveBroadcast = isNew && status === 'in-room' && !streamEnded
  // Broadcaster ARMING/preview state on the stream page (pre-live, signed in) — REGARDLESS of camera.
  // The source view + rail must render here too: with camera off, the selected source (id / location /
  // sensor) fills the surface so the page isn't blank until go-live (Ben 2026-06-17).
  const isBroadcasterPreview = isNew && status === 'idle' && !streamEnded && !!isSignedIn

  // Publish the live local camera feed to the shared store so the Clips page can show the ACTUAL live
  // view (not the seconds-behind buffer VOD) when the playhead rides the now edge. Mirrors the stream
  // page's front-camera mirroring. Cleared whenever we're not live-with-camera (and on unmount).
  useEffect(() => {
    const live = isLiveBroadcast && !!localStream && isCameraArmed
    try {
      useBroadcastStore
        .getState()
        .setLiveStream(live ? (localStream as unknown as { toURL(): string }).toURL() : null, facingMode === 'user')
    } catch {}
    return () => {
      try {
        useBroadcastStore.getState().setLiveStream(null, false)
      } catch {}
    }
  }, [isLiveBroadcast, localStream, isCameraArmed, facingMode])

  // Publish the broadcaster's own live mic level too — the non-camera live tap the Clips page reads
  // at the now edge (SP4). The producer getStats poll keeps `audioLevel` current while live even when
  // this (never-unmounted) tab is in the background, so the Clips tab sees it move. 0 when not live.
  useEffect(() => {
    try {
      useBroadcastStore.getState().setLiveAudioLevel(isLiveBroadcast ? audioLevel : 0)
    } catch {}
    return () => {
      try {
        useBroadcastStore.getState().setLiveAudioLevel(0)
      } catch {}
    }
  }, [isLiveBroadcast, audioLevel])

  // Broadcaster sensor capture — while live, read the armed sensor sources and
  // emit `telemetry` (compass/speed via expo-location, gyro/accel via DeviceMotion).
  // The armed set comes from captureConfig (mapped to backend kind names).
  const armedKinds = useMemo(() => new Set(recordedSourcesFromConfig(cfg)), [cfg])
  useTelemetryCapture(armedKinds, sendTelemetry, isLiveBroadcast)
  // SP6a item 4 — emit the live audio loudness as `audiolevel` telemetry while live
  // with audio armed, so mediasoup records the audio-amplitude track for clip-waveform
  // replay. Companion to the audio media track (not a phone sensor → its own emitter).
  useAudioLevelCapture(audioLevel, sendTelemetry, isLiveBroadcast && armedKinds.has('audio'))

  // Physical device orientation (sensed via DeviceMotion — the app UI is
  // portrait-locked, so this is the only way to know how the phone is held).
  // `deviceOrientation` (discrete) bakes the recording orientation; `tiltDeg`
  // (continuous) drives the iOS gimbal preview.
  const { orientation: deviceOrientation, tiltDeg } = useDeviceOrientation(showCameraPreview)
  const isLandscapeHold = deviceOrientation === 'landscape-left' || deviceOrientation === 'landscape-right'

  // Apply the viewer's mute to the consumed remote audio track. Re-runs when the
  // remote stream (re)connects so a fresh consumer picks up the mute state.
  useEffect(() => {
    setRemoteAudioVolume(muted ? 0 : 1)
  }, [muted, remoteStream, setRemoteAudioVolume])

  // Bail out of fullscreen (re-lock portrait) whenever the viewer leaves the
  // live room — stream end, tab blur (cleanup nulls remoteStream), or a drop.
  useEffect(() => {
    if (!isViewerInRoom && isFullscreen) exitFullscreen()
  }, [isViewerInRoom, isFullscreen, exitFullscreen])

  // iOS preview via AVCaptureVideoPreviewLayer (CameraPreview).
  // ON-DEVICE FINDING (2026-06-07): the raw preview layer stays vertical on its
  // own at every tilt — it's already a continuous gimbal, no rotation needed.
  // (Confirmed by GIMBAL_GAIN 0; gain ±1 each tilted it the opposite way, which
  // is how we found the natural zero.) So GIMBAL_GAIN stays 0 → previewGimbalDeg
  // is always 0, the native side applies no rotation and no cover-zoom.
  //
  // The rotation knob is kept (cheap, hot-reloadable) in case a future device
  // does ride the tilt: set GIMBAL_GAIN to counter it (cover-zoom grows with it).
  // tiltDeg: 0=portrait, +90=landscape-left, -90=landscape-right (useDeviceOrientation).
  const GIMBAL_GAIN = 0
  const GIMBAL_BASE = 0
  const gimbalMirrorSign = facingMode === 'user' ? -1 : 1
  const previewGimbalDeg = GIMBAL_BASE + GIMBAL_GAIN * gimbalMirrorSign * tiltDeg

  // Pinch-to-zoom indicator: show a "2.4×" pill that fades in during the gesture
  // and out ~0.9s after it settles. iOS feeds it from CameraPreview's onZoomChange
  // (native videoZoomFactor); Android feeds it from the JS pinch gesture below.
  const [zoomLabel, setZoomLabel] = useState<string | null>(null)
  const zoomOpacity = useRef(new Animated.Value(0)).current
  const zoomHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flashZoom = useCallback(
    (z: number) => {
      setZoomLabel(`${z.toFixed(1)}×`)
      Animated.timing(zoomOpacity, { toValue: 1, duration: 120, useNativeDriver: true }).start()
      if (zoomHideTimer.current) clearTimeout(zoomHideTimer.current)
      zoomHideTimer.current = setTimeout(() => {
        Animated.timing(zoomOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(
          ({ finished }) => {
            if (finished) setZoomLabel(null)
          },
        )
      }, 900)
    },
    [zoomOpacity],
  )
  const handlePreviewZoom = useCallback(
    (e: { nativeEvent: { zoom: number } }) => flashZoom(e.nativeEvent.zoom),
    [flashZoom],
  )
  useEffect(() => () => {
    if (zoomHideTimer.current) clearTimeout(zoomHideTimer.current)
  }, [])

  // Android pinch-to-zoom. iOS handles zoom natively inside CameraPreview; on
  // Android the local preview is an RTCView, so we detect the pinch in JS and
  // drive the real camera zoom via the WebRTCModule patch (mediaStreamTrackSet-
  // VideoZoom → SCALER_CROP_REGION), so the broadcast + buffer zoom too. Double-
  // tap resets to 1×. Cap 5× to match iOS.
  const androidVideoTrackId =
    Platform.OS === 'android'
      ? ((localStream as unknown as { getVideoTracks?: () => { id: string }[] })?.getVideoTracks?.()?.[0]
          ?.id ?? null)
      : null
  const zoomValueRef = useRef(1)
  const zoomBaseRef = useRef(1)
  const applyAndroidZoom = useCallback(
    (z: number) => {
      const clamped = Math.max(1, Math.min(z, 5))
      zoomValueRef.current = clamped
      if (androidVideoTrackId) {
        NativeModules.WebRTCModule?.mediaStreamTrackSetVideoZoom?.(androidVideoTrackId, clamped)
      }
      flashZoom(clamped)
    },
    [androidVideoTrackId, flashZoom],
  )
  // New session / camera flip recreates the capture session → zoom resets to 1×
  // natively; keep our refs in sync (silent — no pill on flip).
  useEffect(() => {
    zoomValueRef.current = 1
    zoomBaseRef.current = 1
  }, [facingMode, androidVideoTrackId])
  const androidZoomGesture = useMemo(() => {
    const pinch = Gesture.Pinch()
      .onStart(() => {
        zoomBaseRef.current = zoomValueRef.current
      })
      .onUpdate((e) => {
        applyAndroidZoom(zoomBaseRef.current * e.scale)
      })
      .runOnJS(true)
    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .onEnd(() => {
        applyAndroidZoom(1)
      })
      .runOnJS(true)
    return Gesture.Race(doubleTap, pinch)
  }, [applyAndroidZoom])

  const showControls = isNew || !showOverlay || controlsVisible

  // Camera box top = the measured bottom of the header. The bordered header
  // strip is the SAME height pre-live and live (logo + one row, swapped input ↔
  // live-info), so this — and the camera crop below it — never jumps on go-live.
  // Falls back to a sane offset until measured.
  const camTop = headerBottom || insets.top + 96

  // Docked-footer bottom padding (Go Live / End Stream), and the shared offset
  // for things that float just ABOVE that 54-tall button — the preview
  // camera-flip button and the live chat composer both sit here so they clear it.
  const footerPad = Math.max(theme.spacing.sm, insets.bottom + theme.spacing.md - FOOTER_DROP)
  // The horizontal source-rail band sits just above the bottom button (broadcaster) or just above
  // the clock (viewer). Everything above it (camera + the chat-tools line) is lifted to clear it,
  // so the page reads input → camera → chat tools → SOURCE RAIL → button → clock.
  const railBottom = isNew
    ? footerPad + LIVE_CLOCK_BAR_H + 54 + theme.spacing.sm
    : LIVE_CLOCK_BAR_H + theme.spacing.sm
  // Camera box bottom — lifted above the rail band (button height 54 + footerPad + clock already
  // under the rail). `sm` gaps keep the dashboard's input → camera → button → clock rhythm.
  const camBottom = railBottom + RAIL_BAR_H + theme.spacing.sm
  // Shared bottom anchor for the chat toggle · input · send so they sit on one
  // line just INSIDE the bottom edge of the camera frame, overlaid on the video
  // — identical for broadcaster and viewer. Keyboard up → hug the top of the
  // keyboard (`bottom:` is from the SafeAreaView's inset bottom, but the keyboard
  // height is from the real screen bottom, so subtract insets.bottom). Keyboard
  // down → `camBottom` (mode-aware: broadcaster = above the button, viewer = the
  // clock top); elements add `sm`, landing them just inside the frame's edge.
  const composerBottom =
    keyboardHeight > 0
      ? Math.max(0, keyboardHeight - insets.bottom)
      : camBottom

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
  function exitToGlobe(kind: 'ended' | 'disconnected' | 'kicked' | 'cancelled') {
    if (navigatingRef.current) return
    navigatingRef.current = true
    cleanup()
    disconnect()
    if (kind === 'ended') {
      signalStreamEnded()
    } else if (kind === 'kicked') {
      signalKicked()
    } else if (kind === 'cancelled') {
      signalEventCancelled()
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

  // Broadcaster left. For a PPV stream this may be a PAUSE (event still live)
  // rather than a real end. getCreatorEvents only returns scheduled/live events,
  // so finding this event = paused (hold + wait for the resume push); missing it
  // = ended/cancelled (leave). Non-PPV streams leave immediately, as before.
  useEffect(() => {
    if (!streamEnded || isNew || navigatingRef.current || pausedRef.current) return
    const ppvId = streamByRoom?.ppvEvent?.id
    const hostHandle = streamByRoom?.host?.handle ?? broadcaster?.handle
    if (ppvId && hostHandle) {
      cleanup()
      disconnect()
      ppvApi.getCreatorEvents(hostHandle)
        .then((events) => {
          if (events.some((e) => e.id === ppvId)) { pausedRef.current = true; setPaused(true) }
          else exitToGlobe('ended')
        })
        .catch(() => exitToGlobe('ended'))
    } else {
      exitToGlobe('ended')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamEnded])

  // PPV pushes over the user socket — active for any PPV stream (not just while
  // paused) so a creator ending or CANCELLING mid-watch is surfaced (cancel →
  // refund notice). Resume (new room → rejoin) only acts when we're paused.
  useEffect(() => {
    const ppvId = streamByRoom?.ppvEvent?.id
    if (isNew || !ppvId) return
    return onPpvSocketEvent((e) => {
      if (e.eventId !== ppvId) return
      if (e.type === 'ppv_event_live' && e.mediasoupRoomId) {
        if (pausedRef.current) {
          pausedRef.current = false
          router.replace({ pathname: '/(app)/stream/[id]', params: { id: e.mediasoupRoomId, sources: '' } })
        }
      } else if (e.type === 'ppv_event_ended') {
        exitToGlobe(e.reason === 'cancelled' ? 'cancelled' : 'ended')
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamByRoom?.ppvEvent?.id, isNew])

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

  // Viewer: consume tracks the broadcaster produces AFTER we joined (the
  // 'newProducer' push). Covers joining an empty room at go-live / on a PPV
  // resume — otherwise the screen stays black until a rejoin.
  useEffect(() => {
    if (isNew) return
    return signalingClient.onMessage((msg) => {
      if (msg.type === 'newProducer') consumeProducer({ id: msg.id, kind: msg.kind })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew])

  // Fallback: poll stream status every 10s.
  // Catches cases where neither broadcasterLeft nor a clean WS close arrive
  // (Android force-kill delay, iOS graceful-leave race, server-side quirks).
  useEffect(() => {
    if (isNew || !streamId || status !== 'in-room') return
    const pollId = setInterval(async () => {
      if (navigatingRef.current || pausedRef.current) { clearInterval(pollId); return }
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
      pausedRef.current = false
      setPaused(false)
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

  // Broadcaster: the backend rejected the go-live (e.g. a PPV event in progress,
  // a banned title) — mediasoup sends the reason as an error then closes 4001.
  // Without this the broadcaster just sees a blank "Going live…" screen. Surface
  // the real reason and send them back to the dashboard to fix it and re-arm.
  useEffect(() => {
    if (!goLiveError || !isNew) return
    const reason = goLiveError
    clearGoLiveError()
    cleanup()
    disconnect()
    useBroadcastStore.getState().clear()
    Alert.alert("Couldn't go live", reason, [
      { text: 'OK', onPress: () => router.navigate('/(app)/dashboard') },
    ])
  }, [goLiveError, isNew])

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
      deviceOrientation,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, status, localStream, deviceOrientation])

  // Tell the server which camera is live, at go-live and on every flip. Back and
  // front cameras need rotations 180° apart, and the recorder bakes one rotation
  // per session — so a flip makes the server start a fresh session that re-bakes
  // for the new camera. Without this, half a flipped recording is upside-down.
  useEffect(() => {
    if (!isNew || status !== 'in-room') return
    sendCameraFacing(facingMode)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, status, facingMode])

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

  // Keep the screen awake while actively broadcasting so the OS idle timer
  // doesn't auto-lock mid-stream — locking fires AppState 'background', which
  // tears the broadcast down (see the AppState effect above). Same pattern as
  // Google Maps during navigation. Scoped to the live broadcaster session and
  // released on End Stream / leaving the screen so we don't pin the screen on
  // for viewers or the arming flow. (Note: this only helps an attended,
  // screen-on stream — true screen-off background broadcasting is a separate,
  // platform-constrained feature; iOS suspends the camera in the background.)
  useEffect(() => {
    if (!isNew || status !== 'in-room') return
    activateKeepAwakeAsync('wrld-broadcast').catch(() => {})
    return () => { deactivateKeepAwake('wrld-broadcast').catch(() => {}) }
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
    // Going live requires creator onboarding (age gate + ToS + camera
    // permission). The dashboard already walls this off; the center-tab preview
    // path didn't, so gate here too — both go-live entry points funnel through
    // handleGoLive. (mediasoup enforces the same as a hard server-side block.)
    if (wrldUser && !wrldUser.creatorReady) {
      router.push('/(app)/creator-onboarding')
      return
    }
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
    // The full armed set (AV + data sources like chat/location) — drives which
    // buffer tracks get recorded. AV alone drives getUserMedia + the live rail.
    const recordedSources = recordedSourcesFromConfig(c)

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
        sources: recordedSources,
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
      } else if (msg.toLowerCase().includes('creator setup')) {
        // Server-side go-live gate (non-creator). Send them to finish setup.
        router.push('/(app)/creator-onboarding')
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

  const { data: giftCatalog } = useGiftCatalog()

  function handleSendGift(giftId: string) {
    sendGift(giftId)
  }

  function handleGiftInsufficient(gift: GiftCatalogItem) {
    Alert.alert(
      'Not enough Space Bucks',
      `The ${gift.label} gift costs ${gift.value} 🚀. Top up to send it.`,
    )
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
    // Your own handle → primary accent; everyone else → secondary accent.
    if (wrldUser && from === wrldUser.handle) return 'self'
    return 'user'
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* PPV pause — hold here and rejoin automatically when the creator resumes. */}
      {paused && (
        <View style={styles.pausedOverlay}>
          <Text variant="heading">⏸️</Text>
          <Text variant="bodyEmphasized" color={theme.colors.text.primary}>The creator paused the stream</Text>
          <Text variant="caption" color={theme.colors.text.muted} style={styles.pausedNote}>
            Hang tight — we&apos;ll bring you back automatically when they resume.
          </Text>
          <ActivityIndicator color={theme.colors.text.muted} />
          <Button label="Back to Globe" variant="secondary" onPress={() => { setPaused(false); router.navigate('/(app)/globe') }} />
        </View>
      )}
      {/* Camera — bounded in a box from below the top chrome (header / title
          input) down to the top of the clock.
          iOS broadcaster: WRLDCameraPreview (the gimbal layer) — keeps the scene
          vertical at any tilt and carries native pinch-zoom. It cover-scales (no
          contain), so the iOS preview fills the box rather than letterboxing —
          orientation correctness wins over the full-frame view (reverted the
          earlier RTCView-contain swap, which broke preview orientation on tilt).
          Android broadcaster + viewer: RTCView with objectFit "contain" so the
          FULL frame shows (black letterbox fills the rest). */}
      {/* Broadcaster camera preview (iOS gimbal / Android RTCView) — only when the
          broadcaster is monitoring the camera source. */}
      {showBroadcasterCamera && (
        <View style={[styles.cameraBox, { top: camTop, bottom: camBottom }]}>
          {Platform.OS === 'android' ? (
            <GestureDetector gesture={androidZoomGesture}>
              <View style={StyleSheet.absoluteFill} collapsable={false}>
                <RTCView
                  streamURL={(localStream as unknown as { toURL(): string }).toURL()}
                  style={StyleSheet.absoluteFill}
                  objectFit="contain"
                  mirror={facingMode === 'user'}
                  zOrder={0}
                />
              </View>
            </GestureDetector>
          ) : (
            <CameraPreview
              streamURL={(localStream as unknown as { toURL(): string }).toURL()}
              style={StyleSheet.absoluteFill}
              rotationDeg={previewGimbalDeg}
              mirror={facingMode === 'user'}
              onZoomChange={handlePreviewZoom}
            />
          )}
        </View>
      )}

      {/* Broadcaster source monitor — the selected non-camera source's visualizer fills the surface,
          in ARMING/preview (camera on OR off) AND live. With camera off this is what the broadcaster
          sees pre-live (id / location / sensor) instead of a blank screen. Sensors read locally
          (monitorTel); audio uses the broadcaster's own mic level. The left rail (below) switches it. */}
      {isNew && (showCameraPreview || isBroadcasterPreview || isLiveBroadcast) && selectedKind !== 'cam' && (
        <View style={[styles.cameraBox, { top: camTop, bottom: camBottom }]}>
          <SourceStage
            sources={[selectedKind]}
            selected={selectedKind}
            onSelect={selectSource}
            source={buildSource(selectedKind, null)}
            active={sourceActive}
            style={StyleSheet.absoluteFill}
          />
        </View>
      )}

      {/* Viewer media surface — the SELECTED source fills the media box: camera
          video (RTCView) or a source visualizer. The SourceRail (in the control
          overlay below) switches between the stream's sources. */}
      {isViewerInRoom && (
        <View style={[styles.cameraBox, { top: camTop, bottom: camBottom }]}>
          <SourceStage
            sources={[selectedKind]}
            selected={selectedKind}
            onSelect={selectSource}
            source={buildSource(
              selectedKind,
              <RTCView
                streamURL={(remoteStream as unknown as { toURL(): string }).toURL()}
                style={StyleSheet.absoluteFill}
                objectFit="contain"
                mirror={false}
                zOrder={0}
              />,
            )}
            active={sourceActive}
            style={StyleSheet.absoluteFill}
          />
        </View>
      )}

      {/* Full source rail — ALWAYS present on a media surface (broadcaster preview, live, or
          viewer), as a HORIZONTAL band between the bottom button and the chat-tools line. Tapping
          a source switches the media box above to that source's live readout. (Ben, 2026-06-16.) */}
      {(showCameraPreview || isBroadcasterPreview || isLiveBroadcast || isViewerInRoom) && (
        <View style={[styles.sourceRailBar, { bottom: railBottom, height: RAIL_BAR_H }]} pointerEvents="box-none">
          <SourceRail
            orientation="horizontal"
            sources={availableKinds.map((k) => ({ key: k, iconName: SOURCE_META[k].icon, label: SOURCE_META[k].label }))}
            value={selectedKind}
            onChange={(k) => selectSource(k as FeedKind)}
          />
        </View>
      )}

      {/* Pinch-to-zoom level indicator (broadcaster preview — Android JS pinch +
          iOS native pinch via CameraPreview). */}
      {showBroadcasterCamera && zoomLabel && (
        <Animated.View style={[styles.zoomPill, { opacity: zoomOpacity }]} pointerEvents="none">
          <Text variant="monoLabel" color={theme.colors.text.inverse}>
            {zoomLabel}
          </Text>
        </Animated.View>
      )}

      {/* Chat toggle — far left of the bottom control line (alongside the chat
          input · send), inside the camera frame, whenever in-room. Identical for
          broadcaster and viewer. Shares the composer's bottom anchor so it sits
          on the same line and rises with the keyboard. */}
      {status === 'in-room' && !streamEnded && (
        <View style={[styles.frameChatBtn, { bottom: composerBottom + theme.spacing.sm }]}>
          <IconButton
            name={chatOpen ? 'x' : 'message-circle'}
            variant="surface"
            size="lg"
            onPress={() => setChatOpen((o) => !o)}
            accessibilityLabel={chatOpen ? 'Close chat' : 'Open chat'}
          />
        </View>
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

      {/* Camera flip — top-right of the camera frame. Moved off the bottom line
          so the chat input gets the full width and the send button takes the
          bottom-right corner the flip used to hold. */}
      {showBroadcasterCamera && (
        <View style={[styles.flipBtn, { top: camTop + theme.spacing.sm }]}>
          <IconButton
            name="repeat"
            variant="surface"
            size="lg"
            onPress={switchCamera}
            accessibilityLabel="Flip camera"
          />
        </View>
      )}

      {/* Viewer controls — tip · flag — top-right of the camera frame (mirrors
          the broadcaster's flip slot). Chat lives on the bottom line (shared with
          the broadcaster); these stay off the header so it's the clean branded
          name/handle strip. */}
      {!isNew && status === 'in-room' && !streamEnded && (
        <View style={[styles.viewerActions, { top: camTop + theme.spacing.sm }]}>
          <Pressable onPress={handleTipPress} style={styles.tipHeaderBtn} hitSlop={8}>
            <Text variant="monoLabel" color={theme.colors.accent.default}>
              🚀 TIP
            </Text>
          </Pressable>
          {broadcaster?.handle && (
            <FollowButton
              compact
              handle={broadcaster.handle}
              onAuthRequest={!isSignedIn ? () => setAuthModalVisible(true) : undefined}
            />
          )}
          <IconButton
            name="flag"
            variant="surface"
            size="md"
            onPress={handleReportPress}
            accessibilityLabel="Report stream"
          />
          <IconButton
            name="maximize"
            variant="surface"
            size="md"
            onPress={() => enterFullscreen(videoIsLandscape)}
            accessibilityLabel="Fullscreen"
          />
          <IconButton
            name="log-out"
            variant="surface"
            size="md"
            onPress={handleLeave}
            accessibilityLabel="Leave stream"
          />
        </View>
      )}


      {/* Header — logo + page name ("Go Live" → "Live" once live), matching the
          dashboard's bordered header. For the broadcaster the row below swaps
          the title input (pre-live) for the live info (LivePill + avatar +
          viewer count) when live — both rows the same height, so the header
          height (and the camera crop below it) doesn't move on go-live. The
          viewer keeps its back + tip/flag/chat row. Both carry the dashboard's
          faint bottom border + sm bottom space. */}
      {isNew ? (
        <View
          style={styles.headerBorder}
          onLayout={(e) =>
            setHeaderBottom(e.nativeEvent.layout.y + e.nativeEvent.layout.height)
          }
        >
          <ScreenHeader
            title={isLiveBroadcast ? 'Live' : 'Go Live'}
            style={styles.previewHeaderPad}
          />
          {isSignedIn && (
            <View style={styles.titleRow}>
              {isLiveBroadcast ? (
                <View style={styles.liveInfoRow}>
                  <LivePill />
                  {broadcaster && (
                    <Avatar
                      size="sm"
                      avatarUrl={broadcaster.avatarUrl}
                      displayName={broadcaster.displayName}
                    />
                  )}
                  <Pressable onPress={openViewerList} hitSlop={8}>
                    <Text variant="body" color={theme.colors.text.primary}>
                      {viewerCount} {viewerCount === 1 ? 'viewer' : 'viewers'}
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <Input
                  placeholder="What's happening?"
                  value={cfg?.title ?? ''}
                  onChangeText={updatePreviewTitle}
                  autoCorrect={false}
                />
              )}
            </View>
          )}
        </View>
      ) : (
        // Viewer: the same branded header as the broadcaster — back chevron +
        // logo, with the broadcaster's display name as the page title and a tiny
        // @handle underneath. Tip / flag / chat live on the camera frame (below).
        <View
          style={styles.headerBorder}
          onLayout={(e) =>
            setHeaderBottom(e.nativeEvent.layout.y + e.nativeEvent.layout.height)
          }
        >
          <ScreenHeader
            onBack={handleBack}
            right={
              broadcaster ? (
                <View style={styles.viewerTitle}>
                  <Text variant="heading" numberOfLines={1}>
                    {broadcaster.displayName}
                  </Text>
                  <Text variant="monoCaption" color={theme.colors.text.muted}>
                    @{broadcaster.handle}
                    {broadcasterLocalTime ? ` · ${broadcasterLocalTime}` : ''}
                  </Text>
                </View>
              ) : undefined
            }
            style={styles.previewHeaderPad}
          />
        </View>
      )}

      {/* Pre-live hints — float just below the header line, over the camera (or
          the empty cream area when no camera is armed). Rendered as chips with
          a translucent dark fill so they read on either background, and kept
          OUT of the header so they never change its height / move the crop. */}
      {isNew && status === 'idle' && !streamEnded && isSignedIn &&
        (!anyAirArmed || (locationLoading && !coords)) && (
          <View style={[styles.previewHints, { top: camTop + theme.spacing.sm }]} pointerEvents="none">
            {!anyAirArmed && (
              <View style={styles.hintChip}>
                <Text variant="caption" color={theme.colors.text.inverse}>
                  Arm a source on the dashboard to go live
                </Text>
              </View>
            )}
            {locationLoading && !coords && (
              <View style={styles.hintChip}>
                <Text variant="caption" color={theme.colors.text.inverse}>
                  Detecting location…
                </Text>
              </View>
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

          {/* Viewer in-room: no overlay panel here anymore. The LIVE/identity readout is the
              `profile` source view (SourceIdentityCard — same card the broadcaster sees), and the
              actions (tip · follow · report · leave · fullscreen) live in the always-visible top
              cluster (`viewerActions`). The old roomInfo panel (LivePill + BroadcasterRow + Follow
              + Leave) was retired 2026-06-17. */}

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
          style={[styles.broadcasterFooter, { paddingBottom: footerPad + LIVE_CLOCK_BAR_H }]}
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
          style={[styles.broadcasterFooter, { paddingBottom: footerPad + LIVE_CLOCK_BAR_H }]}
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
            // Panel spans lg-to-lg, so the message list aligns at the left margin
            // (the chat toggle's left edge) and the send button lands on the right
            // margin (mirroring the toggle). The composer itself is inset past the
            // toggle below; the message list stays flush left.
            { left: theme.spacing.lg, right: theme.spacing.lg },
            // Stretch from just below the header down to the composer (top +
            // bottom, NO height) so the panel HEIGHT — not its top — tracks the
            // keyboard. The top crop sits a footerPad below the header's bottom
            // edge, matching the footerPad gap below the composer's input — so the
            // top crop stays in the exact same spot whether the keyboard is present
            // or not. Never set top+bottom+height together (Yoga drops `bottom`,
            // the composer would float).
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
          {/* Bottom crop = footerPad — the same gap as below the End Stream button.
              Inset left past the far-left chat toggle so the input starts after it
              (with an sm gap) and the send mirrors it on the right — equal sm gaps
              on either side of the input. Identical for broadcaster and viewer. */}
          <View style={[styles.composerWrap, { paddingTop: footerPad, paddingLeft: 44 + theme.spacing.sm }]}>
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

      {/* Gift rail — viewers only. Tap to reveal the 5 gift emojis above the button. */}
      {!isNew && status === 'in-room' && !streamEnded && (giftCatalog?.length ?? 0) > 0 && (
        <View style={styles.giftRailWrap}>
          <GiftRail
            gifts={giftCatalog ?? []}
            balance={tipBalance}
            authenticated={!!isSignedIn}
            onSend={handleSendGift}
            onAuthRequest={() => setAuthModalVisible(true)}
            onInsufficient={handleGiftInsufficient}
          />
        </View>
      )}

      {/* Fullscreen viewer — edge-to-edge video over everything, with a close
          button and a mute toggle. Landscape video rotated the whole screen on
          enter (see useFullscreenVideo); portrait video just fills upright.
          Renders its own RTCView/visualizer of the same stream. */}
      {isFullscreen && isViewerInRoom && (
        <View style={styles.fsRoot}>
          <SourceStage
            sources={[selectedKind]}
            selected={selectedKind}
            onSelect={selectSource}
            source={buildSource(
              selectedKind,
              <RTCView
                streamURL={(remoteStream as unknown as { toURL(): string }).toURL()}
                style={StyleSheet.absoluteFill}
                objectFit="contain"
                mirror={false}
                zOrder={1}
              />,
            )}
            active={sourceActive}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.fsClose}>
            <IconButton
              name="minimize"
              variant="surface"
              size="lg"
              onPress={exitFullscreen}
              accessibilityLabel="Exit fullscreen"
            />
          </View>

          <View style={styles.fsControlsBar}>
            <IconButton
              name={muted ? 'volume-x' : 'volume-2'}
              variant="surface"
              size="lg"
              onPress={() => setMuted((m) => !m)}
              accessibilityLabel={muted ? 'Unmute' : 'Mute'}
            />
          </View>
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

      {/* Gift burst animations — visible to all peers */}
      {status === 'in-room' && !streamEnded && (
        <View style={styles.giftBurstArea} pointerEvents="none">
          {giftEvents.map((g) => (
            <FloatingGift key={g.id} gift={g} onDone={dismissGift} />
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

      {/* WRLD clock — pinned flush above the app footer in every stream mode
          (broadcaster preview/live + viewer), the predictable cross-screen
          pattern. Live readout only; pointerEvents none so it never steals
          touches from the controls beneath it. The Go Live / End Stream bar is
          offset up by LIVE_CLOCK_BAR_H to sit above it. */}
      <View style={styles.clockDock} pointerEvents="none">
        <LiveClockBar />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg.primary },
  pausedOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    backgroundColor: theme.colors.bg.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.xl,
  },
  pausedNote: { textAlign: 'center' },
  // WRLD clock dock — flush above the app footer, spanning full width.
  clockDock: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  // Camera box — bounded below the top chrome (inline `top`) to just above the
  // Go Live / End Stream button for the broadcaster, or the clock top for the
  // viewer (inline `bottom`). Black so the contain letterbox bars read as such.
  cameraBox: { position: 'absolute', left: 0, right: 0, backgroundColor: '#000' },
  // Fullscreen viewer overlay — covers the whole screen above all chrome.
  fsRoot: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000', zIndex: 100 },
  // Close (minimize) button — top-right, clear of any notch in both orientations.
  fsClose: { position: 'absolute', top: theme.spacing.lg, right: theme.spacing.lg },
  // Mute toggle — pinned near the bottom.
  fsControlsBar: {
    position: 'absolute',
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    bottom: theme.spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  // Chat toggle parked at the far left of the bottom control line while live
  // (`bottom` set inline to the shared composer line). zIndex above the chat
  // panel (10) so the ✕ stays tappable to close when chat is open — the panel
  // now spans from this same left margin and would otherwise swallow the tap.
  frameChatBtn: { position: 'absolute', left: theme.spacing.lg, zIndex: 20 },
  content: {
    flex: 1,
    padding: theme.spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  center: { textAlign: 'center' },
  // Pre-live brand header + title field. paddingTop sm above the header and sm
  // above the field mirror the globe / dashboard so the field lands at the
  // same Y on every screen.
  previewHeaderPad: { paddingTop: theme.spacing.sm },
  // Viewer header right slot — broadcaster display name + tiny @handle, stacked
  // and right-justified under the page-name convention.
  viewerTitle: { alignItems: 'flex-end' },
  // Viewer controls (tip · flag · chat) — top-right of the camera frame (`top`
  // set inline to camTop + sm). zIndex above the chat panel so the chat toggle
  // stays tappable where the two vertically overlap.
  viewerActions: {
    position: 'absolute',
    right: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    zIndex: 20,
  },
  zoomPill: {
    position: 'absolute',
    top: '46%',
    alignSelf: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 50,
  },
  // Bordered header strip — faint bottom line + sm space below the content,
  // matching the dashboard header. Applied to both the broadcaster and viewer
  // headers.
  headerBorder: {
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.subtle,
  },
  // Row beneath the brand header (input pre-live / live-info when live). sm gap
  // below the header + lg side padding, matching the dashboard title row.
  titleRow: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },
  // Live info row — LivePill + avatar + viewer count in the title input's slot.
  // minHeight matches the Input (md = 52) so the header height — and the camera
  // crop below it — is identical pre-live and live.
  liveInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    minHeight: 52,
  },
  // Pre-live hint chips floating just under the header line, over the camera.
  previewHints: {
    position: 'absolute',
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  hintChip: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
  },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  actions: { width: '100%', gap: theme.spacing.sm, alignItems: 'center' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
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
    zIndex: 10,
    // `left`/`right` (both lg, the screen margins) and `top`/`bottom`/`height`
    // are set inline per-case (see render); never combine top+bottom+height.
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
  giftRailWrap: {
    position: 'absolute',
    left: theme.spacing.sm,
    bottom: '38%',
  },

  // Full source rail — horizontal band, centred, between the bottom button and the chat-tools
  // line (`bottom`/`height` set inline). `box-none` wrapper so only the rail buttons capture touches.
  sourceRailBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Camera flip — top-right of the camera frame; `top` is set inline to
  // camTop + sm.
  flipBtn: {
    position: 'absolute',
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
  giftBurstArea: {
    position: 'absolute',
    bottom: 140,
    left: theme.spacing.lg,
    right: theme.spacing.lg,
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
