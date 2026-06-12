// src/components/features/clip/ClipViewer.tsx
//
// The sticky clip viewer at the top of the Clips landing page — a full-width 2:1 field
// (half-height) that previews the currently-selected clip. The footage is letterboxed /
// pillarboxed inside the field (`contentFit="contain"` over a black field), so portrait and
// landscape clips both show whole — no crop. Shows the poster frame by default; a centre play button starts the HLS
// video (for clips that expose a `manifestUrl` — buffered sessions today; saved clips once
// the backend returns their manifest). Tapping a clip in the grid selects it here.
//
// NOTE: capture currently encodes landscape, so the buffer video can play rotated — that's
// a capture-side fix (wrld-mediasoup), NOT an app rotation. Do not rotate here.
// See DESIGN.md Section 3 (Clips landing grid).

import { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Image } from 'expo-image'
import { useVideoPlayer, VideoView } from 'expo-video'
import { Pressable } from '@/components/primitives/Pressable'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { theme } from '@/tokens/theme'

type Props = {
  posterUrl?: string | null
  manifestUrl?: string | null
  title?: string | null
  style?: StyleProp<ViewStyle>
}

export function ClipViewer({ posterUrl, manifestUrl, title, style }: Props) {
  const player = useVideoPlayer(null, (p) => {
    p.loop = false
  })
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)

  // Load (or clear) the selected clip's video. Reset to the poster on any change.
  useEffect(() => {
    setPlaying(false)
    if (!manifestUrl) {
      player.replace(null)
      return
    }
    setLoading(true)
    player
      .replaceAsync({ uri: manifestUrl, contentType: 'hls' })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [manifestUrl, player])

  // Drop back to the poster when playback reaches the end.
  useEffect(() => {
    const sub = player.addListener('playToEnd', () => setPlaying(false))
    return () => sub.remove()
  }, [player])

  const togglePlay = () => {
    if (player.playing) {
      player.pause()
      setPlaying(false)
    } else {
      player.play()
      setPlaying(true)
    }
  }

  const hasVideo = !!manifestUrl
  const hasClip = hasVideo || !!posterUrl

  return (
    <View style={[styles.frame, style]}>
      {/* Video layer (letterbox/pillarbox via contain). */}
      {hasVideo ? (
        <VideoView player={player} style={StyleSheet.absoluteFill} nativeControls={false} contentFit="contain" />
      ) : null}
      {/* Poster covers the video until play starts (and whenever paused/ended). */}
      {posterUrl && !playing ? (
        <Image source={{ uri: posterUrl }} style={StyleSheet.absoluteFill} contentFit="contain" transition={120} />
      ) : null}

      {!hasClip ? (
        <View style={styles.empty}>
          <Icon name="film" size="lg" color={theme.colors.text.subtle} />
          <Text variant="monoCaption" color={theme.colors.text.muted}>
            Tap a clip to preview
          </Text>
        </View>
      ) : null}

      {/* Title chip. */}
      {hasClip && title ? (
        <View style={styles.titleChip} pointerEvents="none">
          <Text variant="monoCaption" color={theme.colors.text.inverse} numberOfLines={1}>
            {title}
          </Text>
        </View>
      ) : null}

      {/* Play / pause — only when the clip is playable. */}
      {hasVideo ? (
        <Pressable variant="subtle" onPress={togglePlay} style={styles.playBtn} accessibilityLabel={playing ? 'Pause' : 'Play'}>
          {loading && !playing ? (
            <ActivityIndicator color={theme.colors.text.inverse} />
          ) : (
            <Icon name={playing ? 'pause' : 'play'} size="md" color={theme.colors.text.inverse} />
          )}
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    aspectRatio: 2, // full width, half-height (was square — trimmed to save vertical space)
    backgroundColor: '#000', // letterbox / pillarbox bars
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  titleChip: {
    position: 'absolute',
    top: theme.spacing.sm,
    left: theme.spacing.sm,
    maxWidth: '70%',
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(20,16,12,0.55)',
  },
  playBtn: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20,16,12,0.45)',
  },
})
