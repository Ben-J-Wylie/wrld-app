// src/components/primitives/Toggle.tsx
//
// Binary on/off switch. Replaces RN's `Switch` so the visual treatment
// matches the design system: warm-line track when off, accent track
// when on; thumb is warm-ink when off, cream when on; spring-animated
// thumb translation; no chrome iOS green.
//
// Three appearances (added `armed` 2026-06-03 for the clips capture
// model — see DESIGN.md decision-log entry):
//   off   (value false)         — warm-line track, warm-ink thumb
//   armed (value true + armed)   — "cued" on-position: same gray track as
//                                  off + a 1px accent outline ring; thumb
//                                  is accent-filled with a 1px ink stroke
//                                  (set, but not yet live)
//   on    (value true)           — accent-filled track, cream thumb (live)
// The thumb sits in the on-position for both armed and on; armed signals
// "configured, not yet committed" — the trough stays gray (not filled).
//
// The armed outline is an absolutely-positioned overlay ring (not a
// `borderWidth` on the track) so it adds zero box geometry — thumb travel
// and vertical fit stay a clean 2px all around in every state.
//
// Single canonical size (44 × 26 track, 22 × 22 thumb). Variants and
// sizes intentionally absent — toggles should feel the same everywhere
// they appear (consent rows, settings, layer filters, Clip Edit).

import { useEffect, useRef } from 'react'
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Pressable } from './Pressable'
import { theme } from '@/tokens/theme'

const TRACK_W = 44
const TRACK_H = 26
const THUMB = 22
const PAD = 2
const OUTLINE = 1
const TRANSLATE = TRACK_W - 2 * PAD - THUMB

type Props = {
  value: boolean
  onValueChange: (next: boolean) => void
  armed?: boolean
  disabled?: boolean
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
}

export function Toggle({ value, onValueChange, armed, disabled, accessibilityLabel, style }: Props) {
  const thumbX = useRef(new Animated.Value(value ? TRANSLATE : 0)).current

  useEffect(() => {
    Animated.spring(thumbX, {
      toValue: value ? TRANSLATE : 0,
      useNativeDriver: true,
      stiffness: 220,
      damping: 22,
      mass: 0.9,
    }).start()
  }, [value, thumbX])

  const isArmed = value && !!armed
  // Armed keeps the off-state gray trough (the accent ring carries the
  // "cued" signal); only the live `on` state fills the track accent.
  const trackBg =
    value && !isArmed ? theme.colors.accent.default : theme.colors.border.strong
  const thumbBg = !value
    ? theme.colors.text.primary
    : isArmed
      ? theme.colors.accent.default
      : theme.colors.text.inverse

  return (
    <Pressable
      variant="none"
      onPress={() => onValueChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      style={[styles.track, { backgroundColor: trackBg }, disabled && styles.disabled, style]}
    >
      {isArmed && <View pointerEvents="none" style={styles.outline} />}
      <Animated.View
        style={[
          styles.thumb,
          {
            backgroundColor: thumbBg,
            borderWidth: isArmed ? OUTLINE : 0,
            borderColor: isArmed ? theme.colors.text.primary : 'transparent',
            transform: [{ translateX: thumbX }],
          },
        ]}
      />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    padding: PAD,
    justifyContent: 'center',
  },
  outline: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: TRACK_H / 2,
    borderWidth: OUTLINE,
    borderColor: theme.colors.accent.default,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
  },
  disabled: {
    opacity: 0.4,
  },
})
