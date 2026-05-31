// src/components/features/identity/SwapCard.tsx
//
// Confirmation card for a value-swap mutation — Change Handle confirm
// step, future FROM/TO confirmation surfaces. Accent-tinted card with
// a FROM block (strikethrough old value), an accent arrow, and a TO
// block (new value).
//
// Layout: row with FROM column, arrow icon, TO column. On narrow
// widths the columns flex naturally — each side's value uses
// `numberOfLines: 1` so long values truncate rather than wrap and
// break the layout.

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { theme } from '@/tokens/theme'

type Props = {
  fromLabel?: string
  fromValue: string
  toLabel?: string
  toValue: string
  style?: StyleProp<ViewStyle>
}

export function SwapCard({
  fromLabel = 'FROM',
  fromValue,
  toLabel = 'TO',
  toValue,
  style,
}: Props) {
  return (
    <View style={[styles.card, style]}>
      <View style={styles.col}>
        <Text variant="monoLabel" color={theme.colors.text.subtle}>
          {fromLabel}
        </Text>
        <Text
          variant="bodyEmphasized"
          color={theme.colors.text.muted}
          numberOfLines={1}
          style={styles.fromValue}
        >
          {fromValue}
        </Text>
      </View>
      <View style={styles.arrow}>
        <Icon name="arrow-right" size="md" color={theme.colors.accent.default} />
      </View>
      <View style={styles.col}>
        <Text variant="monoLabel" color={theme.colors.accent.default}>
          {toLabel}
        </Text>
        <Text
          variant="bodyEmphasized"
          color={theme.colors.text.primary}
          numberOfLines={1}
        >
          {toValue}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.accent.border,
    backgroundColor: theme.colors.accent.surface,
  },
  col: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  fromValue: {
    textDecorationLine: 'line-through',
  },
  arrow: {
    flexShrink: 0,
  },
})
