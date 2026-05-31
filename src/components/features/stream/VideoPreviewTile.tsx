// src/components/features/stream/VideoPreviewTile.tsx
//
// Aspect-ratio image tile with overlay metadata. Used wherever a still
// preview of a video appears: Viewer Sheet preview (live variant —
// composed by `StreamCard.preview`), Clip Edit hero (play variant),
// future replay thumbnails (play variant).
//
// **Not for real-live broadcast** — the live camera feed is `RTCView`
// from `react-native-webrtc` (Phase 7). VideoPreviewTile is for the
// paused / preview / thumbnail states.
//
// Variants:
//   live  — LivePill top-left, no play button. Whole tile tappable
//           "to join live". Used by StreamCard.preview.
//   play  — Centered play button (semi-transparent circle), no
//           LivePill. Used by Clip Edit hero, replays.
//
// Common overlays (both variants): optional viewer-count chip top-
// right, optional channel label bottom-left. Aspect ratio defaults to
// 16:10 — overridable via the `aspectRatio` prop.

import { Image, StyleSheet, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native'
import { Pressable } from '@/components/primitives/Pressable'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { LivePill } from './LivePill'
import { theme } from '@/tokens/theme'

type Variant = 'live' | 'play'

type Props = {
  variant?: Variant
  thumbnailUrl?: string | null
  viewerCount?: number
  channel?: string
  aspectRatio?: number
  onPress?: () => void
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
}

export function VideoPreviewTile({
  variant = 'live',
  thumbnailUrl,
  viewerCount,
  channel,
  aspectRatio = 16 / 10,
  onPress,
  accessibilityLabel,
  style,
}: Props) {
  const body = (
    <>
      <Thumbnail uri={thumbnailUrl ?? null} />
      {variant === 'live' && (
        <View style={styles.liveOverlay}>
          <LivePill />
        </View>
      )}
      {viewerCount !== undefined && (
        <View style={styles.viewerOverlay}>
          <Icon name="eye" size="sm" color={theme.colors.text.inverse} />
          <Text variant="monoCaption" color={theme.colors.text.inverse}>
            {formatCount(viewerCount)}
          </Text>
        </View>
      )}
      {channel && (
        <View style={styles.channelOverlay}>
          <Text variant="monoLabel" color={theme.colors.text.inverse}>
            {channel}
          </Text>
        </View>
      )}
      {variant === 'play' && (
        <View style={styles.playOverlay}>
          <View style={styles.playBtn}>
            <Icon name="play" size="lg" color={theme.colors.text.inverse} />
          </View>
        </View>
      )}
    </>
  )

  const tileStyle = [styles.tile, { aspectRatio }, style]

  if (onPress) {
    return (
      <Pressable
        variant="subtle"
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? 'Open preview'}
        style={tileStyle}
      >
        {body}
      </Pressable>
    )
  }
  return <View style={tileStyle}>{body}</View>
}

function Thumbnail({ uri }: { uri: string | null }) {
  if (uri) {
    return <Image source={{ uri }} style={styles.thumb as ImageStyle} resizeMode="cover" />
  }
  return (
    <View style={[styles.thumb, styles.thumbPlaceholder]}>
      <Icon name="video" size="lg" color={theme.colors.text.subtle} />
    </View>
  )
}

function formatCount(n: number): string {
  if (n >= 10_000) return `${Math.floor(n / 1000)}k`
  if (n >= 1_000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    backgroundColor: theme.colors.bg.elevated,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    alignSelf: 'stretch',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  thumbPlaceholder: {
    backgroundColor: theme.colors.bg.panel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveOverlay: {
    position: 'absolute',
    top: theme.spacing.md,
    left: theme.spacing.md,
  },
  viewerOverlay: {
    position: 'absolute',
    top: theme.spacing.md,
    right: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radius.md,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  channelOverlay: {
    position: 'absolute',
    bottom: theme.spacing.md,
    left: theme.spacing.md,
  },
  playOverlay: {
    position: 'absolute',
    inset: 0 as any,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
