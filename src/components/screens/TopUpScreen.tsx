// src/components/screens/TopUpScreen.tsx
//
// Standalone /(app)/topup route — now a thin chrome wrapper around the shared
// `TopUpPanel` section (2026-06-05). The bundle picker + buy logic lives in the
// panel so it can also render as the Wallet "Top Up" page-tab without
// duplication. This route keeps a back-arrow header for any direct/deep-link
// entry; the primary path is the Wallet tab.

import { StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { theme } from '@/tokens/theme'
import { Text } from '@/components/primitives/Text'
import { IconButton } from '@/components/primitives/IconButton'
import { TopUpPanel } from '@/components/sections/TopUpPanel'

export function TopUpScreen() {
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
        <Text variant="heading">Top up</Text>
        <View style={styles.headerSpacer} />
      </View>
      <TopUpPanel onDone={toWallet} />
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
