// src/components/primitives/Chip.tsx
//
// Pressable filter / toggle. Composes Pressable + Text + optional Icon.
// Distinct from `Pill` because Chip is interactive and has a `selected`
// state with explicit visual feedback (accent fill + accent border).
//
// Variants:
//   default    — neutral filter chip (Globe categories, search filters)
//   suggestion — accent-tinted hint chip (handle suggestions, prompt
//                rows in onboarding)
//
// Single-select vs multi-select behavior is the consumer's
// responsibility — Chip itself doesn't track group state. Parent passes
// `selected` per chip and handles deselection on press as needed.
//
// Sizes (height): sm 28 | md 30 (default) | lg 36.

import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import type { ComponentProps } from 'react'
import { Pressable } from './Pressable'
import { Text } from './Text'
import { Icon } from './Icon'
import { theme } from '@/tokens/theme'

type Variant = 'default' | 'suggestion'
type Size = 'sm' | 'md' | 'lg'
type IconName = ComponentProps<typeof Icon>['name']

const HEIGHT: Record<Size, number> = { sm: 28, md: 30, lg: 36 }

type Props = {
  label: string
  onPress: () => void
  selected?: boolean
  variant?: Variant
  size?: Size
  leadingIcon?: IconName
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}

export function Chip({
  label,
  onPress,
  selected,
  variant = 'default',
  size = 'md',
  leadingIcon,
  disabled,
  style,
}: Props) {
  const surface = resolveSurface(variant, !!selected)
  const labelColor = resolveLabelColor(variant, !!selected)
  const iconColor = labelColor

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      variant="default"
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      style={[
        styles.base,
        { height: HEIGHT[size] },
        surface,
        disabled && styles.disabled,
        style,
      ]}
    >
      {leadingIcon && <Icon name={leadingIcon} size="sm" color={iconColor} />}
      <Text variant="bodyEmphasized" color={labelColor}>
        {label}
      </Text>
    </Pressable>
  )
}

function resolveSurface(variant: Variant, selected: boolean): ViewStyle {
  if (selected) {
    return {
      backgroundColor: theme.colors.accent.surface,
      borderColor: theme.colors.accent.border,
    }
  }
  if (variant === 'suggestion') {
    return {
      backgroundColor: theme.colors.accent.surface,
      borderColor: 'transparent',
    }
  }
  return {
    backgroundColor: 'transparent',
    borderColor: theme.colors.border.strong,
  }
}

function resolveLabelColor(variant: Variant, selected: boolean): string {
  if (selected) return theme.colors.accent.default
  if (variant === 'suggestion') return theme.colors.accent.default
  return theme.colors.text.primary
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    alignSelf: 'flex-start',
  },
  disabled: {
    opacity: 0.5,
  },
})
