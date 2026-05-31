// src/components/features/user/AccountIDPill.tsx
//
// Small mono-caps pill surfacing the user's permanent account ID
// (e.g. "ACCT 0042-887-1156"). Reinforces the identity-model framing
// that handle is changeable but account ID is permanent. Drops into
// a SettingsRow's `right` slot, sits next to the handle in the
// Change-Handle confirm + success screens.

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Text } from '@/components/primitives/Text'
import { theme } from '@/tokens/theme'

type Props = {
  accountId: string
  style?: StyleProp<ViewStyle>
}

export function AccountIDPill({ accountId, style }: Props) {
  return (
    <View style={[styles.pill, style]}>
      <Text variant="monoLabel" color={theme.colors.text.muted}>
        ACCT {formatId(accountId)}
      </Text>
    </View>
  )
}

function formatId(id: string): string {
  const clean = id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  if (clean.length <= 12) {
    return clean.replace(/(.{4})/g, '$1-').replace(/-$/, '')
  }
  return `${clean.slice(0, 4)}-${clean.slice(4, 7)}-${clean.slice(-4)}`
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    backgroundColor: theme.colors.bg.elevated,
    alignSelf: 'flex-start',
  },
})
