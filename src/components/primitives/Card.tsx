// src/components/primitives/Card.tsx
//
// Container primitive. Rounded rectangle with a thin border and one of
// four surface treatments. Used universally for stats panels, filter
// rows, alert banners, the discovery handoff card, settings rows, etc.
//
// Variants (surface progression — lighter to weightier):
//   solid     bg.elevated   border.subtle   (lightest — cards floating
//                                           over the canvas)
//   panel     bg.panel      border.subtle   (default — general panels)
//   elevated  bg.panelHi    border.strong   (strongest contrast)
//   accent    accent.surface accent.border  (brand-tinted highlight)
//
// Glass `backdrop-filter:blur` is NOT a default treatment — per the
// 12.3 locked rulings, flat surfaces with hairline borders win. An
// over-globe glass variant can land later as an opt-in prop once
// `expo-blur` is wired up; not in v0.2.
//
// Set `pressable` to make the card tappable — it then composes
// `Pressable` (variant: subtle, scale 0.98 — cards are large surfaces).

import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import type { ReactNode } from 'react'
import { Pressable } from './Pressable'
import { theme } from '@/tokens/theme'

type Variant = 'panel' | 'solid' | 'elevated' | 'accent'

const VARIANTS: Record<Variant, ViewStyle> = {
  panel: {
    backgroundColor: theme.colors.bg.panel,
    borderColor: theme.colors.border.subtle,
  },
  solid: {
    backgroundColor: theme.colors.bg.elevated,
    borderColor: theme.colors.border.subtle,
  },
  elevated: {
    backgroundColor: theme.colors.bg.panelHi,
    borderColor: theme.colors.border.strong,
  },
  accent: {
    backgroundColor: theme.colors.accent.surface,
    borderColor: theme.colors.accent.border,
  },
}

type Props = {
  variant?: Variant
  pressable?: boolean
  onPress?: () => void
  style?: StyleProp<ViewStyle>
  children?: ReactNode
  accessibilityLabel?: string
  testID?: string
}

export function Card({
  variant = 'panel',
  pressable,
  onPress,
  style,
  children,
  accessibilityLabel,
  testID,
}: Props) {
  const surface = VARIANTS[variant]
  const cardStyle: StyleProp<ViewStyle> = [styles.base, surface, style]

  if (pressable) {
    return (
      <Pressable
        variant="subtle"
        onPress={onPress}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        testID={testID}
        style={cardStyle}
      >
        {children}
      </Pressable>
    )
  }

  return (
    <View
      style={cardStyle}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  base: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    padding: theme.spacing.lg,
  },
})
