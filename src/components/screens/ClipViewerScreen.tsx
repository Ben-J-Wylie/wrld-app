// src/components/screens/ClipViewerScreen.tsx
//
// Time Machine clip viewer. Reached from a historical clip pin on the globe
// (rolled back into the past) via /(app)/clip/[id]?seekSec=N. Plays the clip's
// recorded HLS, seeking to the playhead instant the user tapped — and offers the
// SAME switchable source rail as live watching + the clip preview: every source
// captured at broadcast (camera/audio/sensors/location/chat/identity) replays at
// the playhead through the live SourceStage visualizers. A passive broadcast clock
// at the bottom ticks the real wall-clock time the footage was captured.
//
// Recorded VOD, not live — no signaling, no WebRTC, no viewer count. One video
// player on the primary track stays mounted for audio continuity while a non-camera
// source is in view; data sources replay from their `.jsonl` tracks sampled at the
// wall-clock instant (startAtMs + currentTime). Mirrors ClipsScreen's clip replay.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native'
import { useAuth } from '@clerk/clerk-expo'
import { ActionSheet } from '@/components/sections/ActionSheet'
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { useVideoPlayer, VideoView } from 'expo-video'
import { Text } from '@/components/primitives/Text'
import { IconButton } from '@/components/primitives/IconButton'
import { Avatar } from '@/components/primitives/Avatar'
import { Button } from '@/components/primitives/Button'
import { SourceStage, type SourceRender } from '@/components/sections/SourceStage'
import { SourceRail } from '@/components/features/clip/SourceRail'
import { BufferTransport } from '@/components/features/clip/BufferTransport'
import {
  SOURCE_META,
  SOURCE_RAIL_ORDER,
  KIND_TO_FEEDKIND,
  FEEDKIND_TO_KIND,
  pickDefaultView,
} from '@/components/features/stream/sourceMeta'
import type { FeedKind } from '@/components/features/broadcast/FeedThumb'
import { useDataTrack } from '@/hooks/useDataTrack'
import { useMutes } from '@/hooks/useMutes'
import { sampleAt, recentUpTo, torchStateAt, trailUpTo, chatUpTo } from '@/lib/dataTrackRender'
import { TimeScrubber } from '@/components/features/discovery/TimeScrubber'
import { serverNow } from '@/lib/serverClock'
import { clipsApi } from '@/api/clips'
import { REPORT_REASONS } from '@/lib/reportReasons'
import { theme } from '@/tokens/theme'

// FeedKind → the backend data-track kind that feeds its visualizer. cam/screen play
// the video (no data track); profile is the identity flag; audio reads its
// `audiolevel` companion (the waveform envelope), not the audio HLS.
const FEED_TO_DATAKIND: Partial<Record<FeedKind, string>> = {
  loc: 'location',
  compass: 'compass',
  gyro: 'gyro',
  accel: 'accel',
  speed: 'speed',
  torch: 'torch',
  chat: 'chat',
}

export function ClipViewerScreen() {
  const params = useLocalSearchParams<{
    id?: string
    seekSec?: string
    at?: string
    title?: string
    handle?: string
    source?: string
  }>()
  const id = typeof params.id === 'string' ? params.id : undefined
  const seekSec = params.seekSec ? Math.max(0, Math.floor(Number(params.seekSec)) || 0) : 0
  // CU1 #3 — the absolute instant being watched (the time-machine playhead at tap). Drives the
  // server's per-instant axis resolution (title/identity/precision) so a later-segment edit shows.
  const atMs = params.at ? Number(params.at) : undefined
  const atKey = atMs != null && Number.isFinite(atMs) ? Math.round(atMs) : undefined
  const paramTitle = typeof params.title === 'string' ? params.title : undefined
  const paramHandle = typeof params.handle === 'string' ? params.handle : undefined
  // 'buffer' → a public buffer session (PB1, GET /buffer/session/:id); else a saved
  // clip (GET /clips/:id). Both normalise to ClipDetail, so the rest is source-agnostic.
  const source = params.source === 'buffer' ? 'buffer' : 'clip'

  const {
    data: clip,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['clip', source, id, atKey],
    queryFn: () => (source === 'buffer' ? clipsApi.getBufferSession(id!, atKey) : clipsApi.get(id!, atKey)),
    enabled: !!id,
    retry: 1,
  })

  const isForbidden = (error as any)?.response?.status === 403

  const [phase, setPhase] = useState<'loading' | 'playing' | 'error'>('loading')
  const player = useVideoPlayer(null, (p) => {
    p.loop = false
  })
  const seekedRef = useRef(false)

  // Load the clip's primary manifest once the row arrives (camera, else audio).
  useEffect(() => {
    const url = clip?.manifestUrl
    if (!url) return
    seekedRef.current = false
    setPhase('loading')
    player.replaceAsync({ uri: url, contentType: 'hls' }).catch(() => setPhase('error'))
  }, [clip?.manifestUrl, player])

  // On first ready, land on the playhead instant and play.
  useEffect(() => {
    const sub = player.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay') {
        if (!seekedRef.current) {
          seekedRef.current = true
          if (seekSec > 0) player.currentTime = seekSec
          player.play()
        }
        setPhase('playing')
      } else if (status === 'error') {
        setPhase('error')
      }
    })
    return () => sub.remove()
  }, [player, seekSec])

  // Track playback position → the wall-clock playhead (startAtMs + currentTime),
  // plus play/pause + duration for the transport.
  const [currentMs, setCurrentMs] = useState(seekSec * 1000)
  const [playing, setPlaying] = useState(true)
  const [durationMs, setDurationMs] = useState(0)
  useEffect(() => {
    const tid = setInterval(() => {
      const t = player.currentTime
      if (typeof t === 'number' && isFinite(t)) setCurrentMs(Math.max(0, Math.floor(t * 1000)))
      const d = player.duration
      if (typeof d === 'number' && isFinite(d) && d > 0) setDurationMs(Math.floor(d * 1000))
      setPlaying(!!player.playing)
    }, 250)
    return () => clearInterval(tid)
  }, [player])

  // Transport. Tolerant keyframe seeks (seekBy) — frame accuracy isn't needed and
  // the precise-seek hang only bites on a -c:v copy VOD after many seeks.
  const FRAME_MS = 5000
  const seekBySec = useCallback(
    (deltaSec: number) => {
      try {
        player.seekBy(deltaSec)
      } catch {}
    },
    [player],
  )
  function togglePlay() {
    if (player.playing) {
      player.pause()
      setPlaying(false)
    } else {
      player.play()
      setPlaying(true)
    }
  }
  const toStart = () => seekBySec(-(currentMs / 1000) - 1) // before 0 → clamps to head
  const toEnd = () => durationMs > 0 && seekBySec((durationMs - currentMs) / 1000)
  const frameBack = () => seekBySec(-FRAME_MS / 1000)
  const frameForward = () => seekBySec(FRAME_MS / 1000)

  // Pause when the screen loses focus.
  useFocusEffect(
    useCallback(() => {
      return () => player.pause()
    }, [player]),
  )

  function back() {
    router.navigate('/(app)/globe')
  }

  // Report → the backend Report Centre copies the clip to the platform moderation hold (CONTENT.md
  // §3). Auth required; the moderator review UI is v0.3. No snapshot (unlike a live stream — the
  // hold copies the clip itself).
  const { isSignedIn } = useAuth()
  const [reportVisible, setReportVisible] = useState(false)
  const handleReportPress = () => {
    if (!isSignedIn) {
      Alert.alert('Sign in to report', 'Create an account or sign in to report a clip.')
      return
    }
    setReportVisible(true)
  }
  const submitReport = async (reason: string) => {
    if (!id) return
    setReportVisible(false)
    try {
      await clipsApi.report(id, reason)
      Alert.alert('Reported', "Thanks for letting us know. We'll review this clip.")
    } catch {
      Alert.alert('Error', 'Could not submit report. Please try again.')
    }
  }

  const host = clip?.host
  const handle = host?.handle ?? paramHandle ?? 'unknown'
  const title = clip?.title ?? paramTitle ?? 'Clip'
  const hasMedia = !!clip?.manifestUrl
  const startAtMs = clip?.startAtMs ?? null
  const playheadMs = startAtMs != null ? startAtMs + currentMs : 0

  // ── Source rail: the clip's captured sources, replaying at the playhead ──────
  // PB4 A4 — the per-segment source window covering the playhead (buffer sessions only).
  // `find` returns the live array element, so the reference is stable within a window
  // (it only changes when the playhead crosses a boundary) — no per-tick rail churn.
  const activeWindow = useMemo(
    () => clip?.sourceWindows?.find((w) => playheadMs >= w.startAtMs && playheadMs < w.endAtMs) ?? null,
    [clip?.sourceWindows, playheadMs],
  )
  // The rail shows only CAPTURED sources (the clip's enabled tracks), mapped to
  // FeedKind + ordered like the dashboard; identity is always present.
  const availableViews = useMemo<FeedKind[]>(() => {
    const set = new Set<FeedKind>()
    for (const t of clip?.tracks ?? []) {
      const fk = KIND_TO_FEEDKIND[t.kind]
      if (fk) set.add(fk)
    }
    // The audiolevel companion track means the audio waveform can replay even on a
    // clip with no separate 'audio' media kind.
    if ((clip?.tracks ?? []).some((t) => t.kind === 'audiolevel')) set.add('audio')
    // The primary manifest is always a camera (or audio) track, so the camera view
    // is always switchable — even before the per-source tracks list is available
    // (the GET /clips/:id tracks include needs deploying for the rest of the rail).
    if (hasMedia) set.add('cam')
    set.add('profile') // identity always
    let views = SOURCE_RAIL_ORDER.filter((k) => set.has(k))
    // PB4 A4 — over a window where the creator toggled a source OFF, hide it from the rail
    // (first-cut: app-side rail filtering; full manifest exclusion is the deferred A4 cut).
    // Identity is its own axis, never a per-source toggle, so it's always kept.
    if (activeWindow) {
      views = views.filter((k) => {
        if (k === 'profile') return true
        const bk = FEEDKIND_TO_KIND[k]
        return !bk || activeWindow.sources[bk] !== false
      })
    }
    return views
  }, [clip?.tracks, hasMedia, activeWindow])

  const [view, setView] = useState<FeedKind>('cam')
  useEffect(() => {
    if (availableViews.length && !availableViews.includes(view)) {
      setView(pickDefaultView(availableViews))
    }
  }, [availableViews]) // eslint-disable-line react-hooks/exhaustive-deps

  const dataUrlByKind = useMemo(() => {
    const m: Record<string, string> = {}
    for (const t of clip?.tracks ?? []) if (t.dataUrl) m[t.kind] = t.dataUrl
    return m
  }, [clip?.tracks])

  const isVideoView = view === 'cam' || view === 'screen'
  const currentDataUrl = isVideoView
    ? null
    : view === 'audio'
      ? dataUrlByKind['audiolevel']
      : FEED_TO_DATAKIND[view]
        ? dataUrlByKind[FEED_TO_DATAKIND[view]!]
        : null
  const dataSamples = useDataTrack(currentDataUrl)
  // The watcher's own mutes — applied to the replayed chat on top of the host
  // filter the track already carries (personal + silent, same as live).
  const { mutedHandles } = useMutes()

  // The recorded source picture, sampled at the playhead — same SourceRender shape
  // as live, rendered by the SourceStage visualizers (camera is the video below).
  const recordedSource = useMemo<SourceRender | null>(() => {
    if (isVideoView) return null
    const s = sampleAt(dataSamples, playheadMs)
    const nf = (k: string) => (s && typeof s[k] === 'number' ? (s[k] as number) : 0)
    switch (view) {
      case 'audio': {
        const history = recentUpTo(dataSamples, playheadMs, 48).map((d) =>
          typeof d.level === 'number' ? d.level : 0,
        )
        return { kind: 'audio', level: history[history.length - 1] ?? 0, variant: 'waveform', history }
      }
      case 'compass':
        return { kind: 'compass', heading: nf('heading') }
      case 'gyro':
        return { kind: 'gyro', pitch: nf('pitch'), roll: nf('roll') }
      case 'accel': {
        const history = recentUpTo(dataSamples, playheadMs, 56).map((d) => ({
          x: typeof d.x === 'number' ? d.x : 0,
          y: typeof d.y === 'number' ? d.y : 0,
          z: typeof d.z === 'number' ? d.z : 0,
        }))
        return { kind: 'accel', x: nf('x'), y: nf('y'), z: nf('z'), history }
      }
      case 'speed':
        return { kind: 'speed', mps: s ? nf('mps') : -1 }
      case 'torch':
        return { kind: 'torch', on: torchStateAt(dataSamples, playheadMs) }
      case 'loc': {
        const path = trailUpTo(dataSamples, playheadMs)
        return { kind: 'loc', path, position: path[path.length - 1] }
      }
      case 'chat':
        // The track is already filtered to "what the creator saw" (host mutes,
        // server-side). Layer the watcher's own mutes on top, same as live.
        return {
          kind: 'chat',
          messages: chatUpTo(dataSamples, playheadMs).filter(
            (m) => !mutedHandles.has((m.handle ?? '').toLowerCase()),
          ),
        }
      case 'profile':
        return {
          kind: 'profile',
          displayName: host?.displayName ?? handle,
          handle,
          avatarUrl: host?.avatarUrl ?? null,
          attributed: true,
        }
      default:
        return null
    }
  }, [isVideoView, view, dataSamples, playheadMs, host, handle, mutedHandles])
  const recordedActive = view === 'profile' || dataSamples.length > 0

  // Broadcast clock offset: serverNow() − the wall-clock instant under the playhead,
  // so the passive TimeScrubber reads the real time the footage was captured, ticking
  // forward as the clip plays.
  const clockOffset = startAtMs != null ? Math.max(0, serverNow() - playheadMs) : 0

  // A clip is playable when it has video OR any data track to replay.
  const hasPlayable = hasMedia || Object.keys(dataUrlByKind).length > 0

  // ── Blocked states (forbidden / nothing to play / load error) ───────────────
  const blocked =
    isForbidden ||
    (isError && !isForbidden) ||
    (!isLoading && !isError && clip && !hasPlayable)

  if (blocked) {
    return (
      <View style={styles.root}>
        <SafeAreaView style={styles.blockedWrap} edges={['top', 'bottom']}>
          <Text variant="bodyEmphasized" color={theme.colors.text.inverse} style={styles.blockedTitle}>
            {isForbidden
              ? 'This clip is for subscribers'
              : isError
                ? "Couldn't load this clip"
                : 'No playable media'}
          </Text>
          {isForbidden && (
            <Text variant="monoCaption" color={theme.colors.text.inverse} style={styles.blockedCaption}>
              Subscribe to @{handle} at wrld.cam to watch.
            </Text>
          )}
          <Button variant="secondary" label="Back to globe" onPress={back} />
        </SafeAreaView>
      </View>
    )
  }

  return (
    <View style={styles.root}>
      {/* Primary video — always mounted (audio continuity while a non-camera
          source is in view). Shows through when the camera source is selected. */}
      {hasMedia ? (
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          nativeControls={false}
          contentFit="contain"
        />
      ) : null}

      {/* Non-camera source → its visualizer, replaying at the playhead, over the
          (still-playing) video. SourceStage with a single source renders no rail. */}
      {!isVideoView && recordedSource && (
        <SourceStage
          sources={[view]}
          selected={view}
          onSelect={() => {}}
          source={recordedSource}
          active={recordedActive}
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* Loading / error over the field. */}
      {hasMedia && phase !== 'playing' && isVideoView && (
        <View style={styles.center} pointerEvents="none">
          {phase === 'error' ? (
            <Text variant="monoCaption" color={theme.colors.text.inverse}>
              Playback error
            </Text>
          ) : (
            <ActivityIndicator color={theme.colors.text.inverse} />
          )}
        </View>
      )}

      {/* Top chrome — back + host identity + replay tag. */}
      <SafeAreaView style={styles.topBar} edges={['top']} pointerEvents="box-none">
        <IconButton name="arrow-left" onPress={back} accessibilityLabel="Back to globe" variant="surface" />
        <View style={styles.identity}>
          <Avatar avatarUrl={host?.avatarUrl} displayName={host?.displayName ?? handle} size="sm" />
          <View style={styles.identityCol}>
            <Text variant="bodyEmphasized" color={theme.colors.text.inverse} numberOfLines={1}>
              {title}
            </Text>
            <Text variant="monoCaption" color={theme.colors.text.inverse} numberOfLines={1}>
              @{handle} · replay
            </Text>
          </View>
        </View>
        <IconButton name="flag" onPress={handleReportPress} accessibilityLabel="Report clip" variant="surface" />
      </SafeAreaView>

      {/* Bottom chrome, bottom-up above the footer: clock · transport · source rail
          (the same stack as the Clips preview). The Tabs navigator already insets
          the scene above the footer, so this just sits at the scene bottom. */}
      <View style={styles.bottomStack} pointerEvents="box-none">
        {/* Source rail — captured sources, switchable (same as live + preview). */}
        {availableViews.length > 1 && (
          <View style={styles.railBar}>
            <SourceRail
              orientation="horizontal"
              sources={availableViews.map((k) => ({
                key: k,
                iconName: SOURCE_META[k].icon,
                label: SOURCE_META[k].label,
              }))}
              value={view}
              onChange={(k) => setView(k as FeedKind)}
            />
          </View>
        )}

        {/* Transport — drives the video (single clip → no prev/next clip). */}
        {hasMedia && (
          <BufferTransport
            playing={playing}
            onToStart={toStart}
            onPrevClip={() => {}}
            onFrameBack={frameBack}
            onFrameBackHold={() => {}}
            onTogglePlay={togglePlay}
            onFrameForward={frameForward}
            onFrameForwardHold={() => {}}
            onNextClip={() => {}}
            onToEnd={toEnd}
            canPrev={false}
            canNext={false}
            canFrameBack={currentMs > 0}
            canFrameForward={durationMs > 0 && currentMs < durationMs}
            style={styles.transport}
          />
        )}

        {/* Broadcast clock — passive ticking readout of the captured wall-clock time. */}
        {startAtMs != null && (
          <TimeScrubber
            offsetMs={clockOffset}
            onOffsetChange={() => {}}
            playback={false}
            interactive={false}
          />
        )}
      </View>

      {/* Report reason picker — same ActionSheet + reasons as the live-stream flag. */}
      <ActionSheet
        visible={reportVisible}
        onClose={() => setReportVisible(false)}
        header="Report clip"
        actions={REPORT_REASONS.map((reason) => ({
          id: reason,
          iconName: 'flag' as const,
          label: reason,
          tone: 'warn' as const,
          onPress: () => submitReport(reason),
        }))}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
  },
  identity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  identityCol: { flex: 1 },
  bottomStack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: theme.spacing.sm,
  },
  railBar: {
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  transport: {
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  blockedWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  blockedTitle: { textAlign: 'center' },
  blockedCaption: { textAlign: 'center' },
})
