// src/components/primitives/Button.tsx
//
// CTA primitive. Composes Pressable + Text + Icon (and ActivityIndicator
// as a Spinner placeholder until that primitive ships later in 12.4).
// Replaces the Phase 1 Button.tsx — same import path, narrowed variant
// set (no separate `danger` variant; locked single-accent rule has
// `primary` covering destructive too).
//
// Variants:
//   primary    — accent fill, cream label, optional `glow` (opt-in
//                per consumer; box-shadow on the accent)
//   secondary  — transparent + line border, ink label
//   skip       — text-only with hairline underline (no fill, no border)
//   social     — social-auth button; the `social` prop picks the
//                sub-variant ('apple' | 'google' | 'email')
//
// Sizes: md (h:44 — content actions, sheet CTAs) and lg (h:54 — primary
// hero CTAs at the top level). Radius is locked at `radius.md` (r:4)
// regardless of what the mocks render.

import { ActivityIndicator, View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import type { ComponentProps } from 'react'
import { Pressable } from './Pressable'
import { Text } from './Text'
import { Icon } from './Icon'
import { theme } from '@/tokens/theme'

type Variant = 'primary' | 'secondary' | 'skip' | 'social'
type SocialKind = 'apple' | 'google' | 'email'
type Size = 'md' | 'lg'
type IconName = ComponentProps<typeof Icon>['name']

const HEIGHT: Record<Size, number> = { md: 44, lg: 54 }

type Props = {
  label: string
  onPress: () => void
  variant?: Variant
  social?: SocialKind
  size?: Size
  icon?: IconName
  loading?: boolean
  disabled?: boolean
  glow?: boolean
  style?: StyleProp<ViewStyle>
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  social = 'apple',
  size = 'md',
  icon,
  loading,
  disabled,
  glow,
  style,
}: Props) {
  const isDisabled = disabled || loading
  const labelColor = resolveLabelColor(variant, social)
  const surfaceStyle = resolveSurfaceStyle(variant, social, glow)
  const pressVariant = variant === 'skip' ? 'none' : 'default'

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      variant={pressVariant}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.base,
        { height: HEIGHT[size] },
        surfaceStyle,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={labelColor} />
        ) : (
          <>
            {icon && <Icon name={icon} size="md" color={labelColor} />}
            <Text
              variant={variant === 'skip' ? 'body' : 'bodyEmphasized'}
              color={labelColor}
              style={variant === 'skip' ? styles.skipLabel : undefined}
            >
              {label}
            </Text>
          </>
        )}
      </View>
    </Pressable>
  )
}

function resolveSurfaceStyle(variant: Variant, social: SocialKind, glow?: boolean): ViewStyle {
  switch (variant) {
    case 'primary':
      return {
        backgroundColor: theme.colors.accent.default,
        ...(glow ? theme.elevation.glow.accent : null),
      }
    case 'secondary':
      return {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: theme.colors.border.strong,
      }
    case 'skip':
      return { backgroundColor: 'transparent' }
    case 'social':
      if (social === 'apple') {
        return { backgroundColor: theme.colors.text.primary }
      }
      return {
        backgroundColor: theme.colors.bg.panelHi,
        borderWidth: 1,
        borderColor: theme.colors.border.subtle,
      }
  }
}

function resolveLabelColor(variant: Variant, social: SocialKind): string {
  if (variant === 'primary') return theme.colors.text.inverse
  if (variant === 'social' && social === 'apple') return theme.colors.text.inverse
  if (variant === 'skip') return theme.colors.text.muted
  return theme.colors.text.primary
}

const styles = StyleSheet.create({
  base: {
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  disabled: {
    opacity: 0.32,
  },
  skipLabel: {
    textDecorationLine: 'underline',
  },
})
