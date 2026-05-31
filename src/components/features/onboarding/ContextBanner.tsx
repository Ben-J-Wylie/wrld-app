// src/components/features/onboarding/ContextBanner.tsx
//
// Top-of-wizard banner acknowledging the user's entry context.
// E.g. "SIGN UP TO CHAT IN @KAI.DC'S STREAM" or
//      "BECOME A CREATOR · 10 STEPS · ~3 MIN".
// Sits above the wizard's Head/Body/CTA scaffolding.
//
// Variants:
//   accent — accent-tinted glass (the common case)
//   warn   — warn-tinted (amber) for higher-stakes flows

import type { ComponentProps } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { theme } from '@/tokens/theme'

type Variant = 'accent' | 'warn'
type IconName = ComponentProps<typeof Icon>['name']

type Props = {
  variant?: Variant
  iconName?: IconName
  label: string
  style?: StyleProp<ViewStyle>
}

const WARN_SURFACE = 'rgba(200,134,30,0.10)'
const WARN_BORDER = 'rgba(200,134,30,0.32)'

export function ContextBanner({ variant = 'accent', iconName, label, style }: Props) {
  const tint =
    variant === 'warn'
      ? {
          bg: WARN_SURFACE,
          border: WARN_BORDER,
          ink: theme.colors.warn,
        }
      : {
          bg: theme.colors.accent.surface,
          border: theme.colors.accent.border,
          ink: theme.colors.accent.default,
        }

  return (
    <View
      style={[
        styles.banner,
        { backgroundColor: tint.bg, borderColor: tint.border },
        style,
      ]}
    >
      {iconName && <Icon name={iconName} size="sm" color={tint.ink} />}
      <Text variant="monoLabel" color={tint.ink} numberOfLines={2}>
        {label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
  },
})
