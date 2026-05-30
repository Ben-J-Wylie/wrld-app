// src/components/primitives/Toggle.tsx
//
// Binary on/off switch. Replaces RN's `Switch` so the visual treatment
// matches the design system: warm-line track when off, accent track
// when on; thumb is warm-ink when off, cream when on; spring-animated
// thumb translation; no chrome iOS green.
//
// Single canonical size (44 × 26 track, 22 × 22 thumb). Variants and
// sizes intentionally absent — toggles should feel the same everywhere
// they appear (consent rows, settings, layer filters, Clip Edit).

import { useEffect, useRef } from 'react'
import { Animated, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { Pressable } from './Pressable'
import { theme } from '@/tokens/theme'

const TRACK_W = 44
const TRACK_H = 26
const THUMB = 22
const PAD = 2
const TRANSLATE = TRACK_W - THUMB - 2 * PAD

type Props = {
  value: boolean
  onValueChange: (next: boolean) => void
  disabled?: boolean
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
}

export function Toggle({ value, onValueChange, disabled, accessibilityLabel, style }: Props) {
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

  return (
    <Pressable
      variant="none"
      onPress={() => onValueChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      style={[
        styles.track,
        {
          backgroundColor: value
            ? theme.colors.accent.default
            : theme.colors.border.strong,
        },
        disabled && styles.disabled,
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.thumb,
          {
            backgroundColor: value
              ? theme.colors.text.inverse
              : theme.colors.text.primary,
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
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
  },
  disabled: {
    opacity: 0.4,
  },
})
