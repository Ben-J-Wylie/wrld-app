// src/components/features/clip/BufferScrubField.tsx
//
// Buffer-trim clip editor (clips initiative · C2). The full-bleed portrait field at
// the top of the editor — the dominant element and the page's primary interaction.
// Swiping left/right anywhere on it scrubs the buffer; the frame under the centered
// playline is the moment at the shared playhead (driven by the parent, which also
// owns the BufferTimeline playhead — one current-time for both).
//
// Shares ClipPreview's visual vocabulary but owns scrub, not playback, so it has no
// play/progress controls: camera → thumbnail/placeholder, audio-only / map-only →
// FeedThumb fallback (matching ClipPreview's variants). The swipe emits incremental
// pixel deltas via `onScrub`; the parent maps px → ms against the current zoom (the
// field itself is time-agnostic). Direction (drag right = earlier) is flippable.
//
// See DESIGN.md Section 3 (Buffer-trim clip editor) + the 2026-06-06 decision log.

import { useRef } from 'react'
import {
  Image,
  PanResponder,
  StyleSheet,
  View,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { FeedThumb } from '@/components/features/broadcast/FeedThumb'
import { theme } from '@/tokens/theme'

type Variant = 'camera' | 'audio-only' | 'map-only'

type Props = {
  variant?: Variant
  thumbnailUrl?: string | null
  // Capture-time at the playhead, preformatted by the consumer (mono tabular),
  // e.g. "14:22:06 · APR 21".
  timestampLabel: string
  // Optional how-far-back hint shown top-right, e.g. "Buffer · 72h".
  reachLabel?: string
  showScrubHint?: boolean
  // Incremental horizontal pixel delta since the previous move event. The parent
  // converts to a time delta against the current zoom and advances the playhead.
  onScrub?: (deltaPx: number) => void
  style?: StyleProp<ViewStyle>
}

export function BufferScrubField({
  variant = 'camera',
  thumbnailUrl,
  timestampLabel,
  reachLabel,
  showScrubHint = true,
  onScrub,
  style,
}: Props) {
  const lastDx = useRef(0)
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 2,
      onPanResponderGrant: () => {
        lastDx.current = 0
      },
      onPanResponderMove: (_e, g) => {
        const delta = g.dx - lastDx.current
        lastDx.current = g.dx
        onScrubRef.current?.(delta)
      },
    }),
  ).current
  const onScrubRef = useRef(onScrub)
  onScrubRef.current = onScrub

  const dark = variant === 'camera'

  return (
    <View style={[styles.field, style]} {...pan.panHandlers}>
      {variant === 'camera' ? (
        thumbnailUrl ? (
          <Image source={{ uri: thumbnailUrl }} style={styles.fill as ImageStyle} resizeMode="cover" />
        ) : (
          <View style={[styles.fill, styles.camPlaceholder]}>
            <Icon name="video" size="lg" color={theme.colors.text.subtle} />
          </View>
        )
      ) : (
        <View style={[styles.fill, styles.fallback]}>
          <FeedThumb kind={variant === 'audio-only' ? 'audio' : 'loc'} size="lg" />
        </View>
      )}

      <View style={styles.playline} pointerEvents="none">
        <View style={styles.playlineKnob} />
      </View>

      {showScrubHint && (
        <View style={styles.scrubHint} pointerEvents="none">
          <Icon
            name="chevrons-left"
            size="sm"
            color={dark ? theme.colors.text.inverse : theme.colors.text.muted}
          />
          <Text
            variant="monoLabel"
            color={dark ? theme.colors.text.inverse : theme.colors.text.muted}
          >
            Swipe to scrub
          </Text>
          <Icon
            name="chevrons-right"
            size="sm"
            color={dark ? theme.colors.text.inverse : theme.colors.text.muted}
          />
        </View>
      )}

      <View style={[styles.tsPill, dark ? styles.tsPillDark : styles.tsPillLight]} pointerEvents="none">
        <Text variant="monoValue" color={dark ? theme.colors.text.inverse : theme.colors.text.primary}>
          {timestampLabel}
        </Text>
      </View>

      {reachLabel != null && (
        <View style={[styles.reachPill, dark ? styles.tsPillDark : styles.tsPillLight]} pointerEvents="none">
          <Text variant="monoLabel" color={dark ? theme.colors.text.inverse : theme.colors.text.muted}>
            {reachLabel}
          </Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  field: {
    aspectRatio: 9 / 11,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border.strong,
    backgroundColor: theme.colors.bg.panel,
    alignSelf: 'stretch',
  },
  fill: {
    ...StyleSheet.absoluteFillObject,
  },
  camPlaceholder: {
    backgroundColor: theme.colors.bg.panelHi,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  playline: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: 2,
    marginLeft: -1,
    backgroundColor: theme.colors.accent.bright,
  },
  playlineKnob: {
    position: 'absolute',
    top: 0,
    left: -3.5,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: theme.colors.accent.bright,
  },
  scrubHint: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    marginTop: -8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  tsPill: {
    position: 'absolute',
    left: theme.spacing.sm,
    bottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.md,
  },
  reachPill: {
    position: 'absolute',
    right: theme.spacing.sm,
    top: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.md,
  },
  tsPillDark: {
    backgroundColor: 'rgba(20,16,13,0.55)',
  },
  tsPillLight: {
    backgroundColor: theme.colors.bg.elevated,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
  },
})
