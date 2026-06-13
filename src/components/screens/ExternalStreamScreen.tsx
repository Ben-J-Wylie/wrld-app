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
import { Avatar } from '@/components/primitives/Avatar'
import { LivePill } from '@/components/features/stream/LivePill'
import { useStreamByRoom } from '@/hooks/useStream'
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

  // Pause when the screen loses focus (tab switch / navigate away); resume on return.
  useFocusEffect(
    useCallback(() => {
      player.play()
      return () => player.pause()
    }, [player]),
  )

  function back() {
    router.navigate('/(app)/globe')
  }

  const host = stream?.host
  const title = stream?.title ?? ''

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

      {/* Top chrome: back · LIVE · host identity. */}
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
                <Text variant="monoCaption" color={theme.colors.text.inverse} numberOfLines={1}>
                  @{host.handle}
                </Text>
                {title ? (
                  <Text variant="monoCaption" color={theme.colors.text.inverse} numberOfLines={1} style={styles.title}>
                    {title}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}
        </View>
      </SafeAreaView>
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
  title: { opacity: 0.85 },
})
