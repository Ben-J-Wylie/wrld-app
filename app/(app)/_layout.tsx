import { Tabs } from 'expo-router'
import { theme } from '@/lib/theme'

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.bgElevated,
          borderTopColor: theme.colors.border,
        },
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textMuted,
      }}
    >
      <Tabs.Screen name="globe" options={{ title: 'Globe' }} />
      <Tabs.Screen name="search" options={{ title: 'Search' }} />
      <Tabs.Screen name="dashboard" options={{ title: 'Dashboard' }} />
      <Tabs.Screen name="wallet" options={{ title: 'Wallet' }} />
      <Tabs.Screen name="me" options={{ title: 'Me' }} />
      <Tabs.Screen name="creator-onboarding" options={{ href: null }} />
      <Tabs.Screen name="broadcaster-onboarding" options={{ href: null }} />
      <Tabs.Screen name="cashout" options={{ href: null }} />
      <Tabs.Screen name="topup" options={{ href: null }} />
      <Tabs.Screen name="stream/[id]" options={{ href: null }} />
      <Tabs.Screen name="profile/[handle]" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  )
}
