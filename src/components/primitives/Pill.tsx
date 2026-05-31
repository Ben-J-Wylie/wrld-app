// src/components/primitives/Pill.tsx
//
// Display-only marker (never pressable). Compact rounded shape used for
// LIVE indicators, channel chips, AcctID badges, follower counts,
// viewer counts, jurisdiction badges, recommended / anon / draft tags.
// If you need a pressable filter, use `Chip` instead — Pill is strictly
// non-interactive.
//
// Variants:
//   default     — transparent + line border (status / channel chips)
//   live        — accent fill, cream label (single-accent rule:
//                 visually identical to `accent`; `LivePill` feature
//                 composes Pill.live + an animated pulsing dot)
//   accent      — accent fill, cream label
//   jurisdiction — accent.surface bg + accent.border + accent.default
//                 label (EU · GDPR, US · CCPA badges)
//   countBadge  — small accent-filled numeric badge (notification dots,
//                 unread counts); ignores the `size` prop — always 18px
//
// Sizes (height): sm 22 | md 28 | lg 32. `countBadge` is its own size.

import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import type { ComponentProps, ReactNode } from 'react'
import { Text } from './Text'
import { Icon } from './Icon'
import { theme } from '@/tokens/theme'

type Variant = 'default' | 'live' | 'accent' | 'jurisdiction' | 'countBadge'
type Size = 'sm' | 'md' | 'lg'
type IconName = ComponentProps<typeof Icon>['name']

const HEIGHT: Record<Size, number> = { sm: 22, md: 28, lg: 32 }
const COUNT_BADGE_SIZE = 18

type Surface = { bg: string; border: string; text: string }

const SURFACE: Record<Variant, Surface> = {
  default: {
    bg: 'transparent',
    border: theme.colors.border.strong,
    text: theme.colors.text.primary,
  },
  live: {
    bg: theme.colors.accent.default,
    border: theme.colors.accent.default,
    text: theme.colors.text.inverse,
  },
  accent: {
    bg: theme.colors.accent.default,
    border: theme.colors.accent.default,
    text: theme.colors.text.inverse,
  },
  jurisdiction: {
    bg: theme.colors.accent.surface,
    border: theme.colors.accent.border,
    text: theme.colors.accent.default,
  },
  countBadge: {
    bg: theme.colors.accent.default,
    border: theme.colors.accent.default,
    text: theme.colors.text.inverse,
  },
}

type Props = {
  label: string
  variant?: Variant
  size?: Size
  leadingIcon?: IconName
  leading?: ReactNode
  style?: StyleProp<ViewStyle>
}

export function Pill({ label, variant = 'default', size = 'md', leadingIcon, leading, style }: Props) {
  const surface = SURFACE[variant]
  const height = variant === 'countBadge' ? COUNT_BADGE_SIZE : HEIGHT[size]
  const sizeStyle: ViewStyle =
    variant === 'countBadge'
      ? { height, minWidth: height, paddingHorizontal: theme.spacing.xs }
      : { height, paddingHorizontal: theme.spacing.md }

  return (
    <View
      style={[
        styles.base,
        sizeStyle,
        { backgroundColor: surface.bg, borderColor: surface.border },
        style,
      ]}
    >
      {leading ?? (leadingIcon && <Icon name={leadingIcon} size="sm" color={surface.text} />)}
      <Text variant="monoLabel" color={surface.text}>
        {label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
})
