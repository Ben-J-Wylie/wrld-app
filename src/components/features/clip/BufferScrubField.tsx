// src/components/features/clip/BufferScrubField.tsx
//
// Buffer-trim clip editor (clips initiative · C2). The full-bleed portrait field at
// the top of the editor — the dominant element and a primary way to move through the
// buffer: swiping left/right anywhere on it scrubs. The frame shown is the moment at
// the shared playhead (owned by the parent, which also drives the BufferTimeline
// playhead and the TimeScrubber clock — one current-time for all three).
//
// The field itself carries NO clock and NO playhead line (2026-06-06): the editor
// overlays the time-machine `TimeScrubber` at the field's bottom as the buffer clock
// (expand to spin-scrub the buffer), and the timeline carries the playhead marker.
// The field is purely the frame + the swipe gesture + a couple of hints.
//
// Shares ClipPreview's visual vocabulary but owns scrub, not playback (no
// play/progress controls): camera → thumbnail/placeholder, audio-only / map-only →
// FeedThumb fallback. The swipe emits incremental pixel deltas via `onScrub`; the
// parent maps px → ms against the current zoom (the field is time-agnostic).
// Direction (drag right = earlier) is flippable.
//
// See DESIGN.md Section 3 (Buffer-trim clip editor) + the 2026-06-06 decision log.

import { useRef, type ReactNode } from 'react'
import {
  Image,
  StyleSheet,
  View,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { runOnJS } from 'react-native-reanimated'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { FeedThumb } from '@/components/features/broadcast/FeedThumb'
import { theme } from '@/tokens/theme'

type Variant = 'camera' | 'audio-only' | 'map-only'

type Props = {
  variant?: Variant
  thumbnailUrl?: string | null
  // Optional frame layer (e.g. a video player) rendered full-bleed behind the
  // chrome instead of the static thumbnail — for camera variant only. The parent
  // owns it (keeps this design component free of any player dependency).
  frameSlot?: ReactNode
  // Optional how-far-back hint shown top-right, e.g. "Buffer · 72h".
  reachLabel?: string
  // When the playhead is over a gap (no recorded content), the parent passes a card
  // to show instead of video — a static gap duration, a running "since last
  // broadcast" clock, or a "footage clears in" countdown. Overrides the frame.
  card?: { title: string; detail: string }
  showScrubHint?: boolean
  // Incremental horizontal pixel delta since the previous move event. The parent
  // converts to a time delta against the current zoom and advances the playhead.
  onScrub?: (deltaPx: number) => void
  // Drag lifecycle (activation / release) so the parent can pause playback while
  // scrubbing and resume on lift if it was playing.
  onScrubStart?: () => void
  onScrubEnd?: () => void
  style?: StyleProp<ViewStyle>
}

export function BufferScrubField({
  variant = 'camera',
  thumbnailUrl,
  frameSlot,
  reachLabel,
  card,
  showScrubHint = true,
  onScrub,
  onScrubStart,
  onScrubEnd,
  style,
}: Props) {
  const onScrubRef = useRef(onScrub)
  const onScrubStartRef = useRef(onScrubStart)
  const onScrubEndRef = useRef(onScrubEnd)
  onScrubRef.current = onScrub
  onScrubStartRef.current = onScrubStart
  onScrubEndRef.current = onScrubEnd
  function emitScrub(dx: number) {
    onScrubRef.current?.(dx)
  }
  function emitScrubStart() {
    onScrubStartRef.current?.()
  }
  function emitScrubEnd() {
    onScrubEndRef.current?.()
  }
  // Horizontal-only pan (RNGH), matching the timeline so scrub/scroll arbitration is
  // identical: once you drag sideways past `activeOffsetX`, the page scroll is locked;
  // a vertical drag fails (`failOffsetY`) and yields to the ScrollView, leaving scrub
  // locked. `changeX` is the incremental px since the previous event. onStart/onEnd let
  // the parent pause while dragging and resume on lift (like the clock).
  const pan = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .failOffsetY([-12, 12])
    .onStart(() => {
      'worklet'
      runOnJS(emitScrubStart)()
    })
    .onChange((e) => {
      'worklet'
      runOnJS(emitScrub)(e.changeX)
    })
    .onEnd(() => {
      'worklet'
      runOnJS(emitScrubEnd)()
    })

  const dark = variant === 'camera'

  return (
    <GestureDetector gesture={pan}>
      <View style={[styles.field, style]}>
      {card ? (
        <View style={[styles.fill, styles.cardWrap]}>
          <View style={styles.card}>
            <Icon name="clock" size="lg" color={theme.colors.text.muted} />
            <Text variant="monoLabel" color={theme.colors.text.subtle}>
              {card.title}
            </Text>
            <Text variant="monoValue" color={theme.colors.text.primary} style={styles.cardDetail}>
              {card.detail}
            </Text>
          </View>
        </View>
      ) : variant === 'camera' ? (
        frameSlot ? (
          <View style={styles.fill}>{frameSlot}</View>
        ) : thumbnailUrl ? (
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


      {!card && showScrubHint && (
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

      {reachLabel != null && (
        <View style={[styles.reachPill, dark ? styles.pillDark : styles.pillLight]} pointerEvents="none">
          <Text variant="monoLabel" color={dark ? theme.colors.text.inverse : theme.colors.text.muted}>
            {reachLabel}
          </Text>
        </View>
      )}
      </View>
    </GestureDetector>
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
  cardWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.bg.panel,
  },
  card: {
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xl,
    paddingHorizontal: theme.spacing.xxl,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    backgroundColor: theme.colors.bg.elevated,
  },
  cardDetail: {
    fontSize: 24,
    lineHeight: 30,
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
  reachPill: {
    position: 'absolute',
    left: theme.spacing.sm,
    top: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.md,
  },
  pillDark: {
    backgroundColor: 'rgba(20,16,13,0.55)',
  },
  pillLight: {
    backgroundColor: theme.colors.bg.elevated,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
  },
})
