// src/components/primitives/IconButton.tsx
//
// Icon-only button primitive. Composes Pressable + Icon. Universal for
// nav (back, close, kebab), settings entries, action-bar items
// (save / share / heart), and sheet headers. Circular by construction.
//
// Variants:
//   ghost   — transparent, no border (e.g. nav-bar back/close)
//   surface — panel background with a thin border (sheet headers,
//             action bars)
//   accent  — accent-filled (primary action in an icon-only slot)
//
// The `on` state is opt-in: when true, the button reads as "active"
// using the accent surface + accent border + accent icon (regardless
// of the underlying variant). Used by reactions, save/heart, etc.
//
// Sizes (hit target): sm 32, md 36 (default), lg 44, xl 48. The icon
// inside scales proportionally — roughly 40–50% of the hit target.

import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import type { ComponentProps } from 'react'
import { Pressable } from './Pressable'
import { Icon } from './Icon'
import { theme } from '@/tokens/theme'

type Variant = 'ghost' | 'surface' | 'accent'
type Size = 'sm' | 'md' | 'lg' | 'xl'
type IconName = ComponentProps<typeof Icon>['name']

const HIT: Record<Size, number> = { sm: 32, md: 36, lg: 44, xl: 48 }
const ICON_PX: Record<Size, number> = { sm: 14, md: 16, lg: 20, xl: 22 }

type Props = {
  name: IconName
  onPress: () => void
  accessibilityLabel: string
  variant?: Variant
  size?: Size
  on?: boolean
  disabled?: boolean
  color?: string
  style?: StyleProp<ViewStyle>
}

export function IconButton({
  name,
  onPress,
  accessibilityLabel,
  variant = 'ghost',
  size = 'md',
  on,
  disabled,
  color,
  style,
}: Props) {
  const dim = HIT[size]
  const iconPx = ICON_PX[size]
  const iconColor = color ?? resolveIconColor(variant, on)
  const surface = resolveSurfaceStyle(variant, on)

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      variant="default"
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.base,
        { width: dim, height: dim, borderRadius: dim / 2 },
        surface,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Icon name={name} size={iconPx} color={iconColor} />
    </Pressable>
  )
}

function resolveSurfaceStyle(variant: Variant, on?: boolean): ViewStyle {
  if (on) {
    return {
      backgroundColor: theme.colors.accent.surface,
      borderWidth: 1,
      borderColor: theme.colors.accent.border,
    }
  }
  switch (variant) {
    case 'ghost':
      return { backgroundColor: 'transparent' }
    case 'surface':
      return {
        backgroundColor: theme.colors.bg.panel,
        borderWidth: 1,
        borderColor: theme.colors.border.subtle,
      }
    case 'accent':
      return { backgroundColor: theme.colors.accent.default }
  }
}

function resolveIconColor(variant: Variant, on?: boolean): string {
  if (on) return theme.colors.accent.default
  if (variant === 'accent') return theme.colors.text.inverse
  return theme.colors.text.primary
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.32,
  },
})
