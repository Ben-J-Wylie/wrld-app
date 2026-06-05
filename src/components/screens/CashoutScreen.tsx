// src/components/screens/CashoutScreen.tsx
//
// Standalone /(app)/cashout route — now a thin chrome wrapper around the shared
// `CashOutPanel` section (2026-06-05). The status/amount/submit logic lives in
// the panel so it can also render as the Wallet "Cash Out" page-tab without
// duplication. This route keeps a back-arrow header for any direct/deep-link
// entry; the primary path is the Wallet tab.

import { StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { theme } from '@/tokens/theme'
import { Text } from '@/components/primitives/Text'
import { IconButton } from '@/components/primitives/IconButton'
import { CashOutPanel } from '@/components/sections/CashOutPanel'

export function CashoutScreen() {
  const toWallet = () => router.navigate('/(app)/wallet')
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <IconButton
          name="arrow-left"
          variant="ghost"
          onPress={toWallet}
          accessibilityLabel="Back"
        />
        <Text variant="heading">Cash out</Text>
        <View style={styles.headerSpacer} />
      </View>
      <CashOutPanel onDone={toWallet} />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg.primary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
  },
  headerSpacer: { width: 36, height: 36 },
})
