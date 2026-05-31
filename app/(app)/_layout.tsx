import { View, Text } from 'react-native'
import { Tabs } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { theme } from '@/tokens/theme'
import { useAuthStore } from '@/stores/authStore'

function SuspensionBanner() {
  const wrldUser = useAuthStore(s => s.wrldUser)
  const insets = useSafeAreaInsets()

  if (!wrldUser?.suspendedUntil) return null
  const until = new Date(wrldUser.suspendedUntil)
  if (until <= new Date()) return null

  const permanent = until.getFullYear() >= 2090
  const message = permanent
    ? 'Your account has been permanently suspended.'
    : `Your account is suspended until ${until.toLocaleDateString()}.`

  return (
    <View style={{
      backgroundColor: '#7c2d12',
      paddingTop: insets.top + 6,
      paddingBottom: 8,
      paddingHorizontal: 16,
    }}>
      <Text style={{ color: '#fed7aa', fontSize: 12, textAlign: 'center' }}>
        {message}
      </Text>
    </View>
  )
}

export default function AppLayout() {
  return (
    <View style={{ flex: 1 }}>
      <SuspensionBanner />
      <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.bg.elevated,
          borderTopColor: theme.colors.border.subtle,
        },
        tabBarActiveTintColor: theme.colors.accent.default,
        tabBarInactiveTintColor: theme.colors.text.muted,
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
      <Tabs.Screen name="gallery" options={{ href: null }} />
    </Tabs>
    </View>
  )
}
