// src/components/features/wallet/BankCard.tsx
//
// Linked-account card for the Cash Out flow. Bank icon-tile + masked
// bank name + last-4 digits + "Change" link button. v0.2 ships the
// component; the actual bank-linking is v0.3.

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Pressable } from '@/components/primitives/Pressable'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { theme } from '@/tokens/theme'

type Props = {
  bankName: string
  last4: string
  onChange?: () => void
  style?: StyleProp<ViewStyle>
}

export function BankCard({ bankName, last4, onChange, style }: Props) {
  return (
    <View style={[styles.card, style]}>
      <View style={styles.iconTile}>
        <Icon name="credit-card" size="md" color={theme.colors.text.primary} />
      </View>
      <View style={styles.col}>
        <Text variant="bodyEmphasized" numberOfLines={1}>
          {bankName}
        </Text>
        <Text variant="monoCaption" color={theme.colors.text.muted}>
          •••• {last4}
        </Text>
      </View>
      {onChange && (
        <Pressable
          variant="default"
          onPress={onChange}
          accessibilityRole="button"
          accessibilityLabel="Change linked bank"
          hitSlop={8}
        >
          <Text variant="bodyEmphasized" color={theme.colors.accent.default}>
            Change
          </Text>
        </Pressable>
      )}
    </View>
  )
}

const ICON_TILE = 38

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    backgroundColor: theme.colors.bg.elevated,
  },
  iconTile: {
    width: ICON_TILE,
    height: ICON_TILE,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bg.panel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  col: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
})
