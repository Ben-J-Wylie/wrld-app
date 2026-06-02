// src/components/primitives/Pressable.tsx
//
// Press surface primitive. Wraps RN `Pressable` with a scale animation
// driven by motion tokens. Every higher-tier interactive primitive
// (Button, IconButton, Chip, Card-as-pressable) composes this — they
// never reach for RN's raw `Pressable`.
//
// Variants pick the scale magnitude:
//   default → motion.press.scaleMid   (0.96, generic buttons + chips)
//   subtle  → motion.press.scaleLarge (0.98, big surfaces — cards, rows)
//   none    → 1 (no scale feedback — used by things that have their own
//                visual press response, e.g. an Input field highlight)
//
// The transition follows the `press` motion pattern (fast + ease-out) —
// tactile without feeling sluggish.

import { useRef } from 'react'
import {
  Animated,
  Pressable as RNPressable,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import type { ReactNode } from 'react'
import { theme } from '@/tokens/theme'

type PressVariant = 'default' | 'subtle' | 'none'

const SCALE_MAP: Record<PressVariant, number> = {
  default: theme.motion.press.scaleMid,
  subtle: theme.motion.press.scaleLarge,
  none: 1,
}

type Props = {
  onPress?: (event: GestureResponderEvent) => void
  onLongPress?: (event: GestureResponderEvent) => void
  onPressIn?: (event: GestureResponderEvent) => void
  onPressOut?: (event: GestureResponderEvent) => void
  disabled?: boolean
  hitSlop?: number | { top?: number; bottom?: number; left?: number; right?: number }
  variant?: PressVariant
  style?: StyleProp<ViewStyle>
  children?: ReactNode
  accessibilityLabel?: string
  accessibilityHint?: string
  accessibilityRole?: 'button' | 'link' | 'none' | 'switch' | 'tab'
  accessibilityState?: { selected?: boolean; disabled?: boolean; checked?: boolean }
  testID?: string
}

export function Pressable({
  variant = 'default',
  onPressIn,
  onPressOut,
  disabled,
  style,
  children,
  ...rest
}: Props) {
  const scale = useRef(new Animated.Value(1)).current
  const targetScale = SCALE_MAP[variant]

  function handlePressIn(event: GestureResponderEvent) {
    if (variant !== 'none') {
      Animated.timing(scale, {
        toValue: targetScale,
        ...theme.motion.patterns.press,
        useNativeDriver: true,
      }).start()
    }
    onPressIn?.(event)
  }

  function handlePressOut(event: GestureResponderEvent) {
    if (variant !== 'none') {
      Animated.timing(scale, {
        toValue: 1,
        ...theme.motion.patterns.press,
        useNativeDriver: true,
      }).start()
    }
    onPressOut?.(event)
  }

  return (
    <RNPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      {...rest}
    >
      <Animated.View style={[{ transform: [{ scale }] }, style, disabled && { opacity: 0.5 }]}>
        {children}
      </Animated.View>
    </RNPressable>
  )
}
