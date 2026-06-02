// src/components/features/stream/LivePill.tsx
//
// Iconic LIVE marker. Composes `Pill` (`variant='live'` — accent fill,
// cream label) with an animated pulsing dot in the leading slot.
// Appears wherever a broadcast surface is currently live: top strips,
// video thumbnails, broadcast HUDs, banners.
//
// Sizes: sm (h:22) | md (h:28, default). Dot scales proportionally.
//
// The pulse animation runs on the native driver via `Animated.timing`
// in a `loop` — opacity fades from 1 → 0.3 → 1 across one
// `motion.patterns.pulse` cycle. No CALayer-affecting properties (per
// the 2026-05-30 focus-shadow rule in DESIGN.md decision log), only
// opacity, so it doesn't interact with focus/keyboard behavior.

import { useEffect, useRef } from 'react'
import { Animated, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { Pill } from '@/components/primitives/Pill'
import { theme } from '@/tokens/theme'

type Size = 'sm' | 'md'

const DOT_PX: Record<Size, number> = { sm: 6, md: 8 }

type Props = {
  size?: Size
  style?: StyleProp<ViewStyle>
}

export function LivePill({ size = 'md', style }: Props) {
  const opacity = useRef(new Animated.Value(1)).current

  useEffect(() => {
    const half = theme.motion.patterns.pulse.duration / 2
    const easing = theme.motion.patterns.pulse.easing
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: half,
          easing,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: half,
          easing,
          useNativeDriver: true,
        }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [opacity])

  const dotSize = DOT_PX[size]

  return (
    <Pill
      label="LIVE"
      variant="live"
      size={size}
      style={style}
      leading={
        <Animated.View
          style={[
            styles.dot,
            {
              width: dotSize,
              height: dotSize,
              opacity,
            },
          ]}
        />
      }
    />
  )
}

const styles = StyleSheet.create({
  dot: {
    backgroundColor: theme.colors.text.inverse,
    borderRadius: 1,
  },
})
