// src/components/screens/ClipViewerScreen.tsx
//
// Time Machine clip viewer. Reached from a historical clip pin on the globe
// (rolled back into the past) via /(app)/clip/[id]?seekSec=N. Plays the clip's
// recorded HLS (`manifestUrl`), seeking to the playhead instant the user tapped.
//
// Recorded VOD, not live — no signaling, no WebRTC, no viewer count, no chat.
// Mirrors ExternalStreamScreen's expo-video setup; one initial seek (the
// repeated-precise-seek hang only bites after many seeks, so a single landing
// seek is safe).

import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { useVideoPlayer, VideoView } from 'expo-video'
import { Text } from '@/components/primitives/Text'
import { IconButton } from '@/components/primitives/IconButton'
import { Avatar } from '@/components/primitives/Avatar'
import { Button } from '@/components/primitives/Button'
import { clipsApi } from '@/api/clips'
import { theme } from '@/tokens/theme'

export function ClipViewerScreen() {
  const params = useLocalSearchParams<{
    id?: string
    seekSec?: string
    title?: string
    handle?: string
  }>()
  const id = typeof params.id === 'string' ? params.id : undefined
  const seekSec = params.seekSec ? Math.max(0, Math.floor(Number(params.seekSec)) || 0) : 0
  // Optimistic chrome from the pin tap, until the real clip row loads.
  const paramTitle = typeof params.title === 'string' ? params.title : undefined
  const paramHandle = typeof params.handle === 'string' ? params.handle : undefined

  const {
    data: clip,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['clip', id],
    queryFn: () => clipsApi.get(id!),
    enabled: !!id,
    retry: 1,
  })

  // 403 → subscribers-only clip the viewer can't watch (App Store: no in-app buy).
  const isForbidden = (error as any)?.response?.status === 403

  const [phase, setPhase] = useState<'loading' | 'playing' | 'error'>('loading')
  const player = useVideoPlayer(null, (p) => {
    p.loop = false
  })
  const seekedRef = useRef(false)

  // Load the clip's manifest once the row arrives.
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

  // Pause when the screen loses focus.
  useFocusEffect(
    useCallback(() => {
      return () => player.pause()
    }, [player]),
  )

  function back() {
    router.navigate('/(app)/globe')
  }

  const host = clip?.host
  const handle = host?.handle ?? paramHandle ?? 'unknown'
  const title = clip?.title ?? paramTitle ?? 'Clip'
  const hasMedia = !!clip?.manifestUrl

  // ── Blocked states (no media / forbidden / load error) ──────────────────────
  const blocked =
    isForbidden || (!isLoading && !isError && clip && !hasMedia) || (isError && !isForbidden)

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
      {hasMedia ? (
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          nativeControls={false}
          contentFit="contain"
        />
      ) : null}

      {/* Loading / error over the black field. */}
      {phase !== 'playing' && (
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

      {/* Top chrome — back + host identity + REPLAY tag (recorded, not live). */}
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
      </SafeAreaView>
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
