// app/(app)/_layout.tsx
//
// Tabs scaffold. Hosts a top-level SuspensionBanner that surfaces
// account suspension info on every signed-in screen (poll source:
// app/_layout.tsx /auth/me poll — Phase 17).
//
// SuspensionBanner is an inline component (single-use surface; doesn't
// earn a feature-tier entry). Token-clean: warn-tinted background via
// the inline amber rgba pattern already used by ToastBanner's warn
// variant; warn-tinted text via theme.colors.warn.

import { Fragment } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { Tabs, usePathname } from 'expo-router'
import { BottomTabBar } from '@react-navigation/bottom-tabs'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { theme } from '@/tokens/theme'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { LivePill } from '@/components/features/stream/LivePill'
import { useAuthStore } from '@/stores/authStore'
import { useBroadcastStore } from '@/stores/broadcastStore'
import { returnToActiveBroadcast } from '@/lib/activeBroadcast'

// Inline warn-tint values reused from ToastBanner's warn variant —
// remove once a `warn.surface` token lands.
const WARN_SURFACE = 'rgba(200,134,30,0.18)'
const WARN_BORDER = 'rgba(200,134,30,0.45)'

function SuspensionBanner() {
  const wrldUser = useAuthStore((s) => s.wrldUser)
  const insets = useSafeAreaInsets()

  if (!wrldUser?.suspendedUntil) return null
  const until = new Date(wrldUser.suspendedUntil)
  if (until <= new Date()) return null

  const permanent = until.getFullYear() >= 2090
  const message = permanent
    ? 'Your account has been permanently suspended.'
    : `Your account is suspended until ${until.toLocaleDateString()}.`

  return (
    <View
      style={[styles.banner, { paddingTop: insets.top + theme.spacing.xs }]}
    >
      <Text variant="caption" color={theme.colors.warn} style={styles.bannerText}>
        {message}
      </Text>
    </View>
  )
}

// Persistent "you're live" link that sits directly above the tab bar
// while the user has an active outgoing broadcast. The broadcast keeps
// running when you navigate to another page in-app (the stream tab never
// unmounts), so this is the way back to it. Hidden while already on the
// stream view.
function LiveReturnBar() {
  const isLive = useBroadcastStore((s) => s.isLive)
  const pathname = usePathname()
  if (!isLive) return null
  if (pathname.startsWith('/stream/')) return null

  return (
    <Pressable
      onPress={returnToActiveBroadcast}
      style={styles.liveBar}
      accessibilityRole="button"
      accessibilityLabel="Return to your live stream"
    >
      <LivePill size="sm" />
      <Text variant="bodyEmphasized" style={styles.liveBarLabel} numberOfLines={1}>
        Return to your stream
      </Text>
      <Icon name="chevron-right" size="md" color={theme.colors.text.muted} />
    </Pressable>
  )
}

export default function AppLayout() {
  return (
    <View style={styles.root}>
      <SuspensionBanner />
      <Tabs
        tabBar={(props) => (
          <Fragment>
            <LiveReturnBar />
            <BottomTabBar {...props} />
          </Fragment>
        )}
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
        <Tabs.Screen name="dashboard" options={{ title: 'Dashboard' }} />
        <Tabs.Screen name="library" options={{ title: 'Library' }} />
        <Tabs.Screen name="wallet" options={{ title: 'Wallet' }} />
        <Tabs.Screen name="me" options={{ title: 'Me' }} />
        <Tabs.Screen name="ppv" options={{ title: 'Events' }} />
        <Tabs.Screen name="creator-onboarding" options={{ href: null }} />
        <Tabs.Screen name="broadcaster-onboarding" options={{ href: null }} />
        <Tabs.Screen name="cashout" options={{ href: null }} />
        <Tabs.Screen name="topup" options={{ href: null }} />
        <Tabs.Screen name="stream/[id]" options={{ href: null }} />
        <Tabs.Screen name="profile/[handle]" options={{ href: null }} />
        <Tabs.Screen name="settings" options={{ href: null }} />
        <Tabs.Screen name="subscription" options={{ href: null }} />
        <Tabs.Screen name="monetize" options={{ href: null }} />
        <Tabs.Screen name="primitive-gallery" options={{ href: null }} />
        <Tabs.Screen name="feature-gallery" options={{ href: null }} />
        <Tabs.Screen name="section-gallery" options={{ href: null }} />
      </Tabs>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  banner: {
    backgroundColor: WARN_SURFACE,
    borderBottomWidth: 1,
    borderBottomColor: WARN_BORDER,
    paddingBottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
  },
  bannerText: {
    textAlign: 'center',
  },
  liveBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.bg.elevated,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.subtle,
  },
  liveBarLabel: {
    flex: 1,
  },
})
