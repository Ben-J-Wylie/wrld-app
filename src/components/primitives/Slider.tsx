// src/components/primitives/Slider.tsx
//
// Range input. Thin track + accent-tinted filled portion + 20px thumb
// with tone-colored border, cream fill, and accent glow. Snap-to-step
// is controlled by the `step` prop (defaults to 1).
//
// Tones:
//   accent (default) — accent.default fill
//   live             — visually identical to accent under single-accent
//                      rule (kept as a semantic name for cashout flows)
//   warn             — amber fill (rare — pre-cashout warnings, etc.)
//
// Optional `minLabel` / `maxLabel` render mono-caps tick labels below
// the track at the endpoints.

import { useRef, useState } from 'react'
import {
  PanResponder,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { Text } from './Text'
import { theme } from '@/tokens/theme'

type Tone = 'accent' | 'live' | 'warn'

const THUMB = 20
const TRACK_H = 4

type Props = {
  value: number
  onValueChange: (next: number) => void
  min?: number
  max?: number
  step?: number
  tone?: Tone
  disabled?: boolean
  minLabel?: string
  maxLabel?: string
  style?: StyleProp<ViewStyle>
}

export function Slider({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  tone = 'accent',
  disabled,
  minLabel,
  maxLabel,
  style,
}: Props) {
  const [trackWidth, setTrackWidth] = useState(0)
  const trackWidthRef = useRef(0)
  const startValueRef = useRef(value)

  const toneColor = tone === 'warn' ? theme.colors.warn : theme.colors.accent.default
  const range = max - min
  const ratio = range > 0 ? Math.max(0, Math.min(1, (value - min) / range)) : 0
  const filledPx = ratio * trackWidth

  function snap(raw: number): number {
    const clamped = Math.max(min, Math.min(max, raw))
    if (step <= 0) return clamped
    const stepped = Math.round((clamped - min) / step) * step + min
    return Math.max(min, Math.min(max, stepped))
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder: () => !disabled,
      onPanResponderGrant: () => {
        startValueRef.current = value
      },
      onPanResponderMove: (_, g) => {
        if (trackWidthRef.current <= 0 || range <= 0) return
        const startRatio = (startValueRef.current - min) / range
        const newRatio = startRatio + g.dx / trackWidthRef.current
        const newValue = snap(min + newRatio * range)
        if (newValue !== value) onValueChange(newValue)
      },
    }),
  ).current

  function handleLayout(e: LayoutChangeEvent) {
    const w = e.nativeEvent.layout.width
    trackWidthRef.current = w
    setTrackWidth(w)
  }

  return (
    <View style={[styles.root, disabled && styles.disabled, style]}>
      <View style={styles.trackRow}>
        <View style={styles.track} onLayout={handleLayout}>
          <View style={[styles.filled, { width: filledPx, backgroundColor: toneColor }]} />
          <View
            {...panResponder.panHandlers}
            style={[
              styles.thumb,
              { left: filledPx - THUMB / 2, borderColor: toneColor },
              theme.elevation.glow.accent,
            ]}
          />
        </View>
      </View>
      {(minLabel || maxLabel) && (
        <View style={styles.labelsRow}>
          <Text variant="monoLabel" color={theme.colors.text.subtle}>{minLabel ?? ''}</Text>
          <Text variant="monoLabel" color={theme.colors.text.subtle}>{maxLabel ?? ''}</Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    alignSelf: 'stretch',
    gap: 8,
  },
  trackRow: {
    height: THUMB,
    justifyContent: 'center',
    paddingHorizontal: THUMB / 2,
  },
  track: {
    height: TRACK_H,
    backgroundColor: theme.colors.border.strong,
    borderRadius: TRACK_H / 2,
    position: 'relative',
  },
  filled: {
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
  },
  thumb: {
    position: 'absolute',
    top: -((THUMB - TRACK_H) / 2),
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    borderWidth: 2,
    backgroundColor: theme.colors.text.inverse,
  },
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: THUMB / 2,
  },
  disabled: {
    opacity: 0.4,
  },
})
