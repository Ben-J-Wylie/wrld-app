// src/components/primitives/BrandMark.tsx
//
// The WRLD globe-mark. Hollow outer circle + two crossing inner
// ellipses (one squished horizontally, one vertically) — reads as
// meridian + parallel through a globe. Drawn entirely with Views:
// three nested elements with borderRadius:50% and scaleX/scaleY
// transforms. No SVG dependency.
//
// Sizes: sm 18 | md 22 | lg 26 | hero 32. A raw number is accepted for
// rare one-offs.
//
// Color inherits via the `color` prop; defaults to `text.primary` so
// the mark tints with the surface's text color when consumers don't
// override.

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { theme } from '@/tokens/theme'

type Size = 'sm' | 'md' | 'lg' | 'hero'

const SIZE_PX: Record<Size, number> = { sm: 18, md: 22, lg: 26, hero: 32 }

type Props = {
  size?: Size | number
  color?: string
  style?: StyleProp<ViewStyle>
}

export function BrandMark({ size = 'md', color, style }: Props) {
  const px = typeof size === 'number' ? size : SIZE_PX[size]
  const borderWidth = px >= 26 ? 2 : 1.5
  const c = color ?? theme.colors.text.primary

  const outer: ViewStyle = {
    width: px,
    height: px,
    borderRadius: px / 2,
    borderWidth,
    borderColor: c,
  }
  const ellipse: ViewStyle = {
    borderRadius: px / 2,
    borderWidth,
    borderColor: c,
  }

  return (
    <View style={[outer, style]}>
      <View style={[StyleSheet.absoluteFillObject, ellipse, { transform: [{ scaleX: 0.35 }] }]} />
      <View style={[StyleSheet.absoluteFillObject, ellipse, { transform: [{ scaleY: 0.35 }] }]} />
    </View>
  )
}
