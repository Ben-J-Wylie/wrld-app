// src/components/screens/ExternalStreamScreen.tsx
//
// Viewer for an EXTERNAL cam (ext-<slug>). External cams aren't WebRTC
// broadcasters — they have no mediasoup room — so the normal StreamScreen join
// path can't reach them. The ingest worker pulls the licensed feed into the
// rolling buffer and the backend serves its live edge as HLS at `liveUrl`
// (GET /streams/:id/live.m3u8, a rolling no-ENDLIST playlist). This screen just
// plays that HLS — no signaling, no WebRTC, no mediasoup.
//
// The route shim (app/(app)/stream/[id].tsx) branches here when the globe passes
// `isExternal=true`; everything else still renders the WebRTC StreamScreen.

import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useVideoPlayer, VideoView } from 'expo-video'
import { Text } from '@/components/primitives/Text'
import { IconButton } from '@/components/primitives/IconButton'
import { ScreenHeader } from '@/components/sections/ScreenHeader'
import { LivePill } from '@/components/features/stream/LivePill'
import { useStreamByRoom } from '@/hooks/useStream'
import { useBroadcasterClock } from '@/hooks/useBroadcasterClock'
import { useFullscreenVideo } from '@/hooks/useFullscreenVideo'
import { theme } from '@/tokens/theme'

// AVPlayer/ExoPlayer can briefly error on a live playlist at the segment edge or
// on a transient fetch. Reload the same liveUrl (a fresh manifest fetch returns
// the current segment window) with a capped backoff before giving up.
const MAX_RECOVERIES = 5

export function ExternalStreamScreen() {
  const params = useLocalSearchParams<{ id?: string; liveUrl?: string }>()
  // `id` is the mediasoupRoomId (ext-<slug>) — the globe routes by room id.
  const roomId = typeof params.id === 'string' ? params.id : undefined
  const liveUrl = typeof params.liveUrl === 'string' && params.liveUrl ? params.liveUrl : null

  // Host identity / title for the chrome. Cheap fetch by room id; the feed itself
  // comes from `liveUrl`, not this.
  const { data: stream } = useStreamByRoom(roomId)

  const [phase, setPhase] = useState<'loading' | 'playing' | 'error'>('loading')
  // Fullscreen + audio controls. `videoIsLandscape` is detected from the loaded
  // track (below) so fullscreen rotates only for landscape cams; default true
  // (bar cams are usually landscape) until the first frame's dimensions arrive.
  const { isFullscreen, enter: enterFullscreen, exit: exitFullscreen } = useFullscreenVideo()
  const [videoIsLandscape, setVideoIsLandscape] = useState(true)
  const [muted, setMuted] = useState(false)
  // Measured bottom edge of the branded header so the video box can sit just
  // below it (matching the creator StreamScreen's camera box).
  const [headerBottom, setHeaderBottom] = useState(0)
  const recoveries = useRef(0)
  const recoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const player = useVideoPlayer(liveUrl ? { uri: liveUrl, contentType: 'hls' } : null, (p) => {
    p.loop = false
    p.muted = false
    p.play()
  })

  useEffect(() => {
    const sub = player.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay') {
        recoveries.current = 0
        setPhase('playing')
        player.play()
      } else if (status === 'error') {
        if (recoveries.current >= MAX_RECOVERIES) {
          setPhase('error')
          return
        }
        const attempt = ++recoveries.current
        if (recoverTimer.current) clearTimeout(recoverTimer.current)
        recoverTimer.current = setTimeout(
          () => {
            if (!liveUrl) return
            // Re-fetch the live playlist (current segment window) and resume.
            player.replaceAsync({ uri: liveUrl, contentType: 'hls' }).then(() => player.play()).catch(() => {})
          },
          Math.min(500 * 2 ** (attempt - 1), 8000),
        )
      }
    })
    return () => {
      sub.remove()
      if (recoverTimer.current) clearTimeout(recoverTimer.current)
    }
  }, [player, liveUrl])

  // Detect the cam's aspect from the loaded video track so fullscreen rotates
  // to landscape only when the video actually is landscape. `sourceLoad` fires
  // when the HLS source finishes loading; `videoTrackChange` covers a mid-stream
  // variant switch (a landscape/portrait flip is unlikely but cheap to track).
  useEffect(() => {
    function fromSize(size?: { width: number; height: number } | null) {
      if (size && size.width > 0 && size.height > 0) setVideoIsLandscape(size.width >= size.height)
    }
    const load = player.addListener('sourceLoad', ({ availableVideoTracks }) =>
      fromSize(availableVideoTracks?.[0]?.size),
    )
    const change = player.addListener('videoTrackChange', ({ videoTrack }) => fromSize(videoTrack?.size))
    return () => {
      load.remove()
      change.remove()
    }
  }, [player])

  // Drive playback mute from the viewer's fullscreen control.
  useEffect(() => {
    player.muted = muted
  }, [player, muted])

  // Pause when the screen loses focus (tab switch / navigate away); resume on
  // return. Also drop out of fullscreen so we never leave a landscape lock behind.
  useFocusEffect(
    useCallback(() => {
      player.play()
      return () => {
        player.pause()
        exitFullscreen()
      }
    }, [player, exitFullscreen]),
  )

  function back() {
    router.navigate('/(app)/globe')
  }

  const host = stream?.host
  const broadcasterLocalTime = useBroadcasterClock(stream?.timezone)

  return (
    <View style={styles.root}>
      {/* Video box — sits below the branded header normally, expands to fill the
          whole screen in fullscreen (one VideoView; expo-video can't bind a
          player to two surfaces). Declared before the header so the header
          paints on top. */}
      <View style={[styles.videoBox, isFullscreen ? styles.videoBoxFull : { top: headerBottom }]}>
        {liveUrl ? (
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            nativeControls={false}
            // contain so a landscape cam shows whole (letterboxed) rather than cropped.
            contentFit="contain"
          />
        ) : null}

        {/* Connecting / error states over the black field. */}
        {phase !== 'playing' ? (
          <View style={styles.center} pointerEvents="none">
            {phase === 'loading' ? (
              <>
                <ActivityIndicator color={theme.colors.text.inverse} />
                <Text variant="monoCaption" color={theme.colors.text.inverse} style={styles.centerText}>
                  Connecting…
                </Text>
              </>
            ) : (
              <Text variant="monoCaption" color={theme.colors.text.inverse} style={styles.centerText}>
                {liveUrl ? 'This cam is offline right now.' : 'This cam is unavailable.'}
              </Text>
            )}
          </View>
        ) : null}

        {/* LIVE + fullscreen affordances live on the video frame (like the
            creator screen's frame controls), not in the header. */}
        {!isFullscreen ? (
          <>
            <View style={styles.liveOverlay}>
              <LivePill size="sm" />
            </View>
            {liveUrl && phase === 'playing' ? (
              <View style={styles.maxOverlay}>
                <IconButton
                  name="maximize"
                  variant="surface"
                  size="md"
                  onPress={() => enterFullscreen(videoIsLandscape)}
                  accessibilityLabel="Fullscreen"
                />
              </View>
            ) : null}
          </>
        ) : null}
      </View>

      {/* Branded header — same as the creator stream screen: logo + WRLD on the
          left with a back chevron, broadcaster identity (display name + tiny
          @handle · local time) right-justified. Hidden in fullscreen. */}
      {!isFullscreen ? (
        <SafeAreaView edges={['top']} style={styles.header} pointerEvents="box-none">
          <View
            style={styles.headerBorder}
            onLayout={(e) => setHeaderBottom(e.nativeEvent.layout.y + e.nativeEvent.layout.height)}
          >
            <ScreenHeader
              onBack={back}
              right={
                host ? (
                  <View style={styles.viewerTitle}>
                    <Text variant="heading" numberOfLines={1}>
                      {host.displayName}
                    </Text>
                    <Text variant="monoCaption" color={theme.colors.text.muted}>
                      @{host.handle}
                      {broadcasterLocalTime ? ` · ${broadcasterLocalTime}` : ''}
                    </Text>
                  </View>
                ) : undefined
              }
              style={styles.previewHeaderPad}
            />
          </View>
        </SafeAreaView>
      ) : null}

      {/* Fullscreen controls — a transparent overlay above the single VideoView
          (which already fills the screen and rotates with the orientation lock).
          We do NOT mount a second VideoView: expo-video can't bind one player to
          two surfaces at once (SurfaceVideoView throws on Android). Rotates to
          landscape only for landscape cams (detected from the track). */}
      {isFullscreen && liveUrl ? (
        <View style={styles.fsControls} pointerEvents="box-none">
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
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg.primary },
  // Black video frame below the header; `top` set inline to the header bottom.
  videoBox: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#000' },
  // Fullscreen: the frame covers the whole screen (header is hidden).
  videoBoxFull: { top: 0 },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  centerText: { marginTop: theme.spacing.xs },
  // Opaque branded header pinned to the top, painting over the video frame edge.
  header: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: theme.colors.bg.primary, zIndex: 10 },
  headerBorder: {
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.subtle,
  },
  previewHeaderPad: { paddingTop: theme.spacing.sm },
  // Broadcaster identity in the header's right slot, stacked + right-justified.
  viewerTitle: { alignItems: 'flex-end' },
  // LIVE pill + fullscreen button overlaid on the video frame.
  liveOverlay: { position: 'absolute', top: theme.spacing.sm, left: theme.spacing.md },
  maxOverlay: { position: 'absolute', top: theme.spacing.sm, right: theme.spacing.md },
  fsControls: { ...StyleSheet.absoluteFillObject, zIndex: 100 },
  fsClose: { position: 'absolute', top: theme.spacing.lg, right: theme.spacing.lg },
  fsControlsBar: {
    position: 'absolute',
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    bottom: theme.spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
})
