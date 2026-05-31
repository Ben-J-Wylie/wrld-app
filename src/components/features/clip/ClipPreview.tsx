// src/components/features/clip/ClipPreview.tsx
//
// 16:11 hero preview used in Clip Edit + future clip-detail surfaces.
// Variant is chosen by the consumer based on which layers were
// captured:
//
//   camera     — default; composes VideoPreviewTile.play with the
//                clip's thumbnail and a play button overlay
//   audio-only — animated waveform fallback (FeedThumb kind='audio',
//                size lg) + "AUDIO ONLY" mono label
//   map-only   — location-fallback (FeedThumb kind='loc', size lg) +
//                "LOCATION ONLY" label
//
// Playback controls (play/pause + progress) overlay every variant.

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { Pressable } from '@/components/primitives/Pressable'
import { VideoPreviewTile } from '@/components/features/stream/VideoPreviewTile'
import { FeedThumb } from '@/components/features/broadcast/FeedThumb'
import { theme } from '@/tokens/theme'

type Variant = 'camera' | 'audio-only' | 'map-only'

type Props = {
  variant?: Variant
  thumbnailUrl?: string | null
  playing?: boolean
  progressPct?: number
  onTogglePlay?: () => void
  style?: StyleProp<ViewStyle>
}

export function ClipPreview({
  variant = 'camera',
  thumbnailUrl,
  playing,
  progressPct,
  onTogglePlay,
  style,
}: Props) {
  return (
    <View style={[styles.hero, style]}>
      {variant === 'camera' && (
        <VideoPreviewTile
          variant="play"
          thumbnailUrl={thumbnailUrl}
          aspectRatio={16 / 11}
          style={styles.fill}
        />
      )}
      {variant !== 'camera' && (
        <View style={styles.fallback}>
          <FeedThumb kind={variant === 'audio-only' ? 'audio' : 'loc'} size="lg" />
          <Text variant="monoLabel" color={theme.colors.text.muted} style={styles.fallbackLabel}>
            {variant === 'audio-only' ? 'AUDIO ONLY' : 'LOCATION ONLY'}
          </Text>
        </View>
      )}
      <View style={styles.controls}>
        <Pressable
          variant="default"
          onPress={onTogglePlay ?? (() => {})}
          accessibilityRole="button"
          accessibilityLabel={playing ? 'Pause' : 'Play'}
          hitSlop={8}
          style={styles.playBtn}
        >
          <Icon
            name={playing ? 'pause' : 'play'}
            size="md"
            color={theme.colors.text.inverse}
          />
        </Pressable>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.max(0, Math.min(100, progressPct ?? 0))}%` },
            ]}
          />
        </View>
      </View>
    </View>
  )
}

const PLAY_BTN = 36

const styles = StyleSheet.create({
  hero: {
    aspectRatio: 16 / 11,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    backgroundColor: theme.colors.bg.elevated,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    alignSelf: 'stretch',
  },
  fill: {
    flex: 1,
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  fallbackLabel: {
    letterSpacing: 1.6,
  },
  controls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  playBtn: {
    width: PLAY_BTN,
    height: PLAY_BTN,
    borderRadius: PLAY_BTN / 2,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    flex: 1,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.accent.bright,
  },
})
