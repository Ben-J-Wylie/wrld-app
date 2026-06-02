// src/components/features/feedback/ToastBanner.tsx
//
// Ephemeral floating notice — confirmation of an action, a warning, an
// error, or a success. Tinted card with icon + body + dismiss X, slides
// down on mount, auto-dismisses after `autoDismissMs` (default 3500),
// and dismisses on tap of the X. Position (top of screen, in-flow
// inside a sheet, etc.) is the consumer's job — this feature owns the
// card, the animation, and the timer.
//
// Variants:
//   accent  (default) — accent.surface tint, info glyph. The "did
//                       a thing, here's confirmation" tone.
//   warn              — amber tint, alert-triangle glyph
//   err               — accent.surface tint, alert-circle glyph
//                       (single-accent rule: error distinguishes by
//                       icon, not color)
//   success           — accent.surface tint, check-circle glyph
//                       (single-accent rule: same as accent + check
//                       glyph; a dedicated `success` palette can swap
//                       in here later without API change)
//
// Exit animation is not yet implemented — the toast disappears
// instantly when the consumer unmounts after `onDismiss`. Adding a
// fade-out is a one-line follow-up if it reads as too abrupt.

import { useEffect, useRef } from 'react'
import {
  Animated,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import type { ComponentProps } from 'react'
import { Pressable } from '@/components/primitives/Pressable'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { theme } from '@/tokens/theme'

type Variant = 'accent' | 'warn' | 'err' | 'success'
type IconName = ComponentProps<typeof Icon>['name']

type Props = {
  variant?: Variant
  body: string
  iconName?: IconName
  onDismiss: () => void
  autoDismissMs?: number
  style?: StyleProp<ViewStyle>
}

const VARIANT_ICON: Record<Variant, IconName> = {
  accent: 'info',
  warn: 'alert-triangle',
  err: 'alert-circle',
  success: 'check-circle',
}

const WARN_SURFACE = 'rgba(200,134,30,0.10)'
const WARN_BORDER = 'rgba(200,134,30,0.32)'

function resolveTint(variant: Variant) {
  if (variant === 'warn') {
    return {
      background: WARN_SURFACE,
      border: WARN_BORDER,
      icon: theme.colors.warn,
    }
  }
  return {
    background: theme.colors.accent.surface,
    border: theme.colors.accent.border,
    icon: theme.colors.accent.default,
  }
}

export function ToastBanner({
  variant = 'accent',
  body,
  iconName,
  onDismiss,
  autoDismissMs = 3500,
  style,
}: Props) {
  const opacity = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(-8)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        ...theme.motion.patterns.overlay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        ...theme.motion.patterns.overlay,
        useNativeDriver: true,
      }),
    ]).start()
  }, [])

  useEffect(() => {
    if (!autoDismissMs) return
    const t = setTimeout(onDismiss, autoDismissMs)
    return () => clearTimeout(t)
  }, [autoDismissMs, onDismiss])

  const tint = resolveTint(variant)
  const glyph = iconName ?? VARIANT_ICON[variant]

  return (
    <Animated.View
      style={[
        styles.banner,
        { backgroundColor: tint.background, borderColor: tint.border },
        { opacity, transform: [{ translateY }] },
        style,
      ]}
    >
      <Icon name={glyph} size="md" color={tint.icon} />
      <Text variant="body" color={theme.colors.text.primary} style={styles.body}>
        {body}
      </Text>
      <Pressable
        variant="default"
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        hitSlop={12}
        style={styles.close}
      >
        <Icon name="x" size="md" color={theme.colors.text.muted} />
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  body: {
    flex: 1,
  },
  close: {
    padding: theme.spacing.xxs,
  },
})
