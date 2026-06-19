// app/(app)/_layout.tsx
//
// Tabs scaffold with a custom 5-item footer:
//   Globe · Dashboard · [Stream] · Clips · Me
// The center "Stream" item is the broadcaster's own stream view — an accent
// dot that's static when idle and pulses concentric rings while live (read
// from useBroadcastStore). Tapping it opens stream/new (the armed preview,
// or the live view if already broadcasting). Library, Wallet + Events moved
// off the footer; they're reached from the Me screen now.
//
// The footer is a fully custom bar (not BottomTabBar) so we control exactly
// five slots regardless of how many href:null routes exist; it navigates via
// the imperative router and highlights from usePathname.
//
// Also hosts a top-level SuspensionBanner (poll source: app/_layout.tsx
// /auth/me poll — Phase 17).

import { useEffect, useRef } from 'react'
import { Animated, Pressable, StyleSheet, View } from 'react-native'
import { Tabs, usePathname, router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { theme } from '@/tokens/theme'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { useAuthStore } from '@/stores/authStore'
import { useBroadcastStore } from '@/stores/broadcastStore'
import { useFullscreenStore } from '@/stores/fullscreenStore'
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

// Center stream icon: accent dot; while live, two concentric rings pulse
// outward (radar ping). Opacity/scale only → native driver, no layout cost.
function StreamTabIcon({ live }: { live: boolean }) {
  const r1 = useRef(new Animated.Value(0)).current
  const r2 = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!live) {
      r1.setValue(0)
      r2.setValue(0)
      return
    }
    const make = (v: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, {
            toValue: 1,
            duration: 1800,
            easing: theme.motion.patterns.pulse.easing,
            useNativeDriver: true,
          }),
        ]),
      )
    const a = make(r1, 0)
    const b = make(r2, 900)
    a.start()
    b.start()
    return () => {
      a.stop()
      b.stop()
    }
  }, [live, r1, r2])

  const ringStyle = (v: Animated.Value) => ({
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.7, 2.4] }) }],
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
  })

  return (
    <View style={styles.streamIconWrap}>
      {live && <Animated.View style={[styles.streamRing, ringStyle(r1)]} />}
      {live && <Animated.View style={[styles.streamRing, ringStyle(r2)]} />}
      <View style={styles.streamDot} />
    </View>
  )
}

function TabButton({
  icon,
  label,
  active,
  onPress,
  iconRotate,
}: {
  icon: React.ComponentProps<typeof Icon>['name']
  label: string
  active: boolean
  onPress: () => void
  iconRotate?: number
}) {
  const color = active ? theme.colors.accent.default : theme.colors.text.muted
  return (
    <Pressable style={styles.tabItem} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <Icon name={icon} size="md" color={color} rotate={iconRotate} />
      <Text variant="monoCaption" color={color}>
        {label}
      </Text>
    </Pressable>
  )
}

function AppTabBar() {
  const pathname = usePathname()
  const isLive = useBroadcastStore((s) => s.isLive)
  const creatorReady = useAuthStore((s) => s.wrldUser?.creatorReady ?? false)
  const isFullscreen = useFullscreenStore((s) => s.isFullscreen)
  const insets = useSafeAreaInsets()
  const streamActive = pathname.startsWith('/stream')

  // Hide the footer entirely while a video is fullscreen so the frame goes
  // edge-to-edge (the fullscreen overlay renders inside the tab scene, above
  // this bar). Returning null collapses the bar's height → the scene fills.
  if (isFullscreen) return null

  // The center Stream tab opens the broadcaster preview / live view. Going live
  // requires creator onboarding, so a non-creator is sent to finish setup
  // instead of the preview (mirrors the Dashboard wall). An already-live
  // broadcaster always returns straight to their stream.
  const onStreamPress = () => {
    if (!isLive && !creatorReady) {
      router.navigate('/(app)/creator-onboarding')
      return
    }
    returnToActiveBroadcast()
  }

  return (
    <View style={[styles.tabBar, { paddingBottom: insets.bottom }]}>
      <TabButton icon="globe" label="Globe" active={pathname.startsWith('/globe')} onPress={() => router.navigate('/(app)/globe')} />
      <TabButton icon="sliders" label="Dashboard" active={pathname.startsWith('/dashboard')} onPress={() => router.navigate('/(app)/dashboard')} />
      <Pressable style={styles.tabItem} onPress={onStreamPress} accessibilityRole="button" accessibilityLabel="Your stream">
        <StreamTabIcon live={isLive} />
        <Text variant="monoCaption" color={isLive || streamActive ? theme.colors.accent.default : theme.colors.text.muted}>
          {isLive ? 'Live' : 'Stream'}
        </Text>
      </Pressable>
      <TabButton icon="film" label="Clips" active={pathname.startsWith('/clip')} onPress={() => router.navigate('/(app)/clips')} iconRotate={90} />
      <TabButton icon="user" label="Me" active={pathname.startsWith('/me')} onPress={() => router.navigate('/(app)/me')} />
    </View>
  )
}

export default function AppLayout() {
  return (
    <View style={styles.root}>
      <SuspensionBanner />
      <Tabs
        tabBar={() => <AppTabBar />}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen name="globe" options={{ title: 'Globe' }} />
        <Tabs.Screen name="dashboard" options={{ title: 'Dashboard' }} />
        <Tabs.Screen name="clips" options={{ title: 'Clips' }} />
        <Tabs.Screen name="me" options={{ title: 'Me' }} />
        {/* Off the footer. clip-editor is reached by double-tapping a clip on the Clips grid. */}
        <Tabs.Screen name="clip-editor" options={{ href: null }} />
        <Tabs.Screen name="ppv" options={{ href: null }} />
        <Tabs.Screen name="wallet" options={{ href: null }} />
        {/* Non-tab routes. */}
        <Tabs.Screen name="creator-onboarding" options={{ href: null }} />
        <Tabs.Screen name="broadcaster-onboarding" options={{ href: null }} />
        <Tabs.Screen name="cashout" options={{ href: null }} />
        <Tabs.Screen name="topup" options={{ href: null }} />
        <Tabs.Screen name="stream/[id]" options={{ href: null }} />
        {/* Time Machine clip viewer (singular `clip/` to avoid colliding with the
            `clips` grid tab). Reached from a historical clip pin on the globe. */}
        <Tabs.Screen name="clip/[id]" options={{ href: null }} />
        <Tabs.Screen name="profile/[handle]" options={{ href: null }} />
        <Tabs.Screen name="settings" options={{ href: null }} />
        <Tabs.Screen name="subscription" options={{ href: null }} />
        <Tabs.Screen name="monetize" options={{ href: null }} />
        <Tabs.Screen name="analytics" options={{ href: null }} />
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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: theme.colors.bg.elevated,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.subtle,
    paddingTop: theme.spacing.xs,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: theme.spacing.xs,
  },
  streamIconWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streamDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: theme.colors.accent.default,
  },
  streamRing: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: theme.colors.accent.default,
  },
})
