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
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native'
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useVideoPlayer, VideoView } from 'expo-video'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { IconButton } from '@/components/primitives/IconButton'
import { Avatar } from '@/components/primitives/Avatar'
import { LivePill } from '@/components/features/stream/LivePill'
import { useStreamByRoom } from '@/hooks/useStream'
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

  return (
    <View style={styles.root}>
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

      {/* Top chrome: back · LIVE · host identity. Hidden in fullscreen — the
          fullscreen overlay supplies its own close + audio controls. */}
      {!isFullscreen ? (
      <SafeAreaView edges={['top']} style={styles.header} pointerEvents="box-none">
        <View style={styles.headerRow}>
          <Pressable onPress={back} hitSlop={12} style={styles.backBtn}>
            <Icon name="chevron-left" size="lg" color={theme.colors.text.inverse} />
          </Pressable>
          <LivePill size="sm" />
          {host ? (
            <View style={styles.identity}>
              <Avatar displayName={host.displayName} avatarUrl={host.avatarUrl} size={28} />
              <View style={styles.identityText}>
                <Text variant="bodyEmphasized" color={theme.colors.text.inverse} numberOfLines={1}>
                  {host.displayName}
                </Text>
                <Text variant="monoCaption" color={theme.colors.text.inverse} numberOfLines={1}>
                  @{host.handle}
                </Text>
              </View>
            </View>
          ) : null}
          {liveUrl && phase === 'playing' ? (
            <IconButton
              name="maximize"
              variant="surface"
              size="md"
              onPress={() => enterFullscreen(videoIsLandscape)}
              accessibilityLabel="Fullscreen"
            />
          ) : null}
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
  root: { flex: 1, backgroundColor: '#000' },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  centerText: { marginTop: theme.spacing.xs },
  header: { position: 'absolute', top: 0, left: 0, right: 0 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
  },
  backBtn: { padding: theme.spacing.xs },
  identity: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, flex: 1 },
  identityText: { flex: 1 },
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
