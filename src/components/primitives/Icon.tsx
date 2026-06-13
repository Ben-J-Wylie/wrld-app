// src/components/primitives/Icon.tsx
//
// Icon primitive — wraps Feather (via @expo/vector-icons) behind the
// design-system size + color contract. Default color is the parent
// surface's text token (`text.primary`); override via the `color` prop.
//
// Sizes are semantic (`sm`/`md`/`lg`) per DESIGN.md Section 3, but a raw
// number is accepted when an icon needs to sit in a specific composed
// shape (e.g. a 14px chip glyph). Numeric overrides should be rare —
// reach for sm/md/lg first.
//
// Bespoke icons that don't exist in Feather will live in
// `src/components/primitives/icons/` and slot into this same wrapper
// when the first feature needs one (Section 0.5 reuse rule). Until then,
// `name` is strictly a Feather glyph.

import { Feather } from '@expo/vector-icons'
import { theme } from '@/tokens/theme'

type IconSize = 'sm' | 'md' | 'lg'

const SIZE_MAP: Record<IconSize, number> = {
  sm: 12,
  md: 16,
  lg: 24,
}

type Props = {
  name: keyof typeof Feather.glyphMap
  size?: IconSize | number
  color?: string
  rotate?: number // degrees clockwise — e.g. 90 to stand a glyph on its end
  accessibilityLabel?: string
}

export function Icon({ name, size = 'md', color, rotate, accessibilityLabel }: Props) {
  const numericSize = typeof size === 'number' ? size : SIZE_MAP[size]
  return (
    <Feather
      name={name}
      size={numericSize}
      color={color ?? theme.colors.text.primary}
      style={rotate ? { transform: [{ rotate: `${rotate}deg` }] } : undefined}
      accessibilityLabel={accessibilityLabel}
    />
  )
}
