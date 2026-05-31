// src/components/features/user/SocialChip.tsx
//
// Chip composing a brand glyph + a handle. One variant per supported
// platform. Tapping opens the platform's app or web fallback (consumer
// supplies onPress; we don't ship the URL-resolution logic here so the
// feature stays domain-blind).
//
// Brand icons are picked from Feather as the closest neutral glyphs —
// Feather doesn't ship true brand marks for IG/TT/SC/X, so this is a
// pragmatic v1. When bespoke brand glyphs land in
// `src/components/primitives/icons/`, the iconName map below swaps to
// the real glyphs without an API change.

import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import type { ComponentProps } from 'react'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { theme } from '@/tokens/theme'

type Kind = 'ig' | 'tt' | 'sc' | 'x'
type IconName = ComponentProps<typeof Icon>['name']

type Props = {
  kind: Kind
  handle: string
  onPress?: () => void
  style?: StyleProp<ViewStyle>
}

const ICON_FOR_KIND: Record<Kind, IconName> = {
  ig: 'instagram',
  tt: 'music',
  sc: 'volume-2',
  x: 'twitter',
}

const LABEL_PREFIX: Record<Kind, string> = {
  ig: '@',
  tt: '@',
  sc: '',
  x: '@',
}

export function SocialChip({ kind, handle, onPress, style }: Props) {
  const body = (
    <>
      <Icon name={ICON_FOR_KIND[kind]} size="sm" color={theme.colors.text.muted} />
      <Text variant="caption" color={theme.colors.text.primary} numberOfLines={1}>
        {LABEL_PREFIX[kind]}{handle}
      </Text>
    </>
  )

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${kind} ${handle}`}
        style={({ pressed }) => [styles.chip, pressed && styles.pressed, style]}
      >
        {body}
      </Pressable>
    )
  }
  return <View style={[styles.chip, style]}>{body}</View>
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    height: 30,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    backgroundColor: theme.colors.bg.elevated,
    alignSelf: 'flex-start',
  },
  pressed: {
    opacity: 0.7,
  },
})
