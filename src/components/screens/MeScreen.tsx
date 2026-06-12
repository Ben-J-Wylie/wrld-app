// src/components/screens/MeScreen.tsx
//
// The Me page is a tabbed home for everything personal:
//
//   • Public Profile — a read-only passport + saved-clips feed; mirrors
//     what other users see when they open this profile (MeProfileTab).
//   • Wallet — balances + transactions (WalletScreen, embedded).
//   • Settings — the catch-all: profile editing, plan, notifications,
//     monetize, analytics, sign out (SettingsScreen, embedded).
//
// The host owns the single safe-area frame + fixed header + PageTabs; the
// embedded screens render headerless so the chrome isn't doubled. Library
// and Events stay off the footer and are reached from Settings.

import { useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { useAuth } from '@clerk/clerk-expo'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { theme } from '@/tokens/theme'
import { Button } from '@/components/primitives/Button'
import { Text } from '@/components/primitives/Text'
import { ScreenScroll } from '@/components/sections/ScreenScroll'
import { ScreenHeader } from '@/components/sections/ScreenHeader'
import { PageTabs } from '@/components/features/navigation/PageTabs'
import { MeProfileTab } from '@/components/screens/MeProfileTab'
import { WalletScreen } from '@/components/screens/WalletScreen'
import { SettingsScreen } from '@/components/screens/SettingsScreen'
import { useCurrentUser } from '@/hooks/useCurrentUser'

type MeTab = 'profile' | 'wallet' | 'settings'

const TABS: { key: MeTab; label: string }[] = [
  { key: 'profile', label: 'Profile' },
  { key: 'wallet', label: 'Wallet' },
  { key: 'settings', label: 'Settings' },
]

export function MeScreen() {
  const { isSignedIn } = useAuth()
  const { data: user, isLoading } = useCurrentUser()
  const insets = useSafeAreaInsets()
  const [tab, setTab] = useState<MeTab>('profile')

  if (!isSignedIn) {
    return (
      <ScreenScroll header={<ScreenHeader title="Me" />} contentContainerStyle={styles.center}>
        <Text variant="body" color={theme.colors.text.muted}>
          Sign in to access your profile
        </Text>
        <Button label="Sign in" onPress={() => router.push('/(auth)/login')} style={styles.btn} />
      </ScreenScroll>
    )
  }

  if (isLoading || !user) {
    return (
      <ScreenScroll header={<ScreenHeader title="Me" />} contentContainerStyle={styles.center}>
        <ActivityIndicator color={theme.colors.accent.default} />
      </ScreenScroll>
    )
  }

  return (
    <View style={styles.container}>
      <View style={{ paddingTop: insets.top }}>
        <ScreenHeader title="Me" style={styles.headerPad} />
        <PageTabs tabs={TABS} value={tab} onChange={setTab} style={styles.tabs} />
      </View>

      {tab === 'profile' && (
        <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
          <MeProfileTab />
        </ScrollView>
      )}
      {tab === 'wallet' && <WalletScreen embedded />}
      {tab === 'settings' && <SettingsScreen embedded />}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg.primary,
  },
  headerPad: {
    paddingTop: theme.spacing.sm,
  },
  tabs: {
    marginTop: theme.spacing.sm,
  },
  body: {
    flex: 1,
  },
  center: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
  },
  btn: { width: 160 },
})
