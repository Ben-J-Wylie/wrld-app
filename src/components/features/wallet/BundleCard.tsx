// src/components/features/wallet/BundleCard.tsx
//
// Radio card used in the Top Up bundle picker. Pick bullet on the
// left (filled when selected), body in the middle (token glyph + qty
// + per-token meta), price on the right (USD + per-unit savings %).
// Optional corner badge ("BEST VALUE" / "MOST POPULAR" / "VIP").

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Pressable } from '@/components/primitives/Pressable'
import { Text } from '@/components/primitives/Text'
import { theme } from '@/tokens/theme'

export type BundleBadge = 'best-value' | 'most-popular' | 'vip'

type Props = {
  qty: number
  priceUsd: number
  perUnitSavingsPct?: number
  badge?: BundleBadge
  selected?: boolean
  disabled?: boolean
  onPress?: () => void
  style?: StyleProp<ViewStyle>
}

const BADGE_LABEL: Record<BundleBadge, string> = {
  'best-value': 'BEST VALUE',
  'most-popular': 'MOST POPULAR',
  vip: 'VIP',
}

function badgeColor(b: BundleBadge): { bg: string; ink: string } {
  if (b === 'vip') {
    return {
      bg: theme.colors.text.primary,
      ink: theme.colors.text.inverse,
    }
  }
  return {
    bg: theme.colors.accent.default,
    ink: theme.colors.text.inverse,
  }
}

export function BundleCard({
  qty,
  priceUsd,
  perUnitSavingsPct,
  badge,
  selected,
  disabled,
  onPress,
  style,
}: Props) {
  return (
    <Pressable
      variant="subtle"
      onPress={onPress ?? (() => {})}
      disabled={disabled || !onPress}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      style={[
        styles.card,
        selected && styles.selected,
        disabled && styles.disabled,
        style,
      ]}
    >
      <View
        style={[
          styles.bullet,
          selected && styles.bulletSelected,
        ]}
      >
        {selected && <View style={styles.bulletFill} />}
      </View>
      <View style={styles.body}>
        <Text variant="bodyEmphasized">
          {qty.toLocaleString()} 🚀
        </Text>
        {perUnitSavingsPct !== undefined && perUnitSavingsPct > 0 && (
          <Text variant="monoCaption" color={theme.colors.text.muted}>
            {perUnitSavingsPct}% off vs. base
          </Text>
        )}
      </View>
      <Text variant="bodyEmphasized" color={theme.colors.text.primary}>
        ${priceUsd.toFixed(2)}
      </Text>
      {badge && (
        <View
          style={[
            styles.badge,
            { backgroundColor: badgeColor(badge).bg },
          ]}
        >
          <Text variant="monoLabel" color={badgeColor(badge).ink}>
            {BADGE_LABEL[badge]}
          </Text>
        </View>
      )}
    </Pressable>
  )
}

const BULLET = 22

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    backgroundColor: theme.colors.bg.elevated,
  },
  selected: {
    borderColor: theme.colors.accent.default,
    backgroundColor: theme.colors.accent.surface,
  },
  disabled: {
    opacity: 0.45,
  },
  bullet: {
    width: BULLET,
    height: BULLET,
    borderRadius: BULLET / 2,
    borderWidth: 2,
    borderColor: theme.colors.border.strong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulletSelected: {
    borderColor: theme.colors.accent.default,
  },
  bulletFill: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.accent.default,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  badge: {
    position: 'absolute',
    top: -8,
    right: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
  },
})
