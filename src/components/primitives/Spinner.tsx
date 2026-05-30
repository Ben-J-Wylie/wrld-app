// src/components/primitives/Spinner.tsx
//
// Loading indicator. Replaces RN's `ActivityIndicator` so the visual
// treatment matches the design system: hairline ring (line color) with
// one arc tinted accent, rotating at 0.7s linear.
//
// Implementation is the classic "border ring with one colored side
// rotating" trick — no SVG, no native module, works under New Architecture.
// The Animated rotation runs on the native driver.
//
// Sizes: xs 12 | sm 14 | md 16 (default) | lg 20.
// Color: defaults to `accent.default`. Pass `color` to override (e.g.
// Button uses `text.inverse` on primary so the spinner reads on the
// crimson fill).

import { useEffect, useRef } from 'react'
import { Animated, Easing, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { theme } from '@/tokens/theme'

type Size = 'xs' | 'sm' | 'md' | 'lg'

const SIZE_PX: Record<Size, number> = { xs: 12, sm: 14, md: 16, lg: 20 }

type Props = {
  size?: Size | number
  color?: string
  style?: StyleProp<ViewStyle>
}

export function Spinner({ size = 'md', color, style }: Props) {
  const rotate = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(rotate, {
        toValue: 1,
        duration: 700,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    )
    loop.start()
    return () => loop.stop()
  }, [rotate])

  const px = typeof size === 'number' ? size : SIZE_PX[size]
  const arcColor = color ?? theme.colors.accent.default
  const spin = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })

  return (
    <Animated.View
      style={[
        styles.spinner,
        {
          width: px,
          height: px,
          borderRadius: px / 2,
          borderColor: theme.colors.border.strong,
          borderTopColor: arcColor,
          transform: [{ rotate: spin }],
        },
        style,
      ]}
    />
  )
}

const styles = StyleSheet.create({
  spinner: {
    borderWidth: 2,
  },
})
