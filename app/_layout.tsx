import '@/lib/polyfills'
import { Stack, router, usePathname } from 'expo-router'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { KeyboardProvider } from 'react-native-keyboard-controller'
import { StatusBar } from 'expo-status-bar'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { ClerkProvider, useAuth } from '@clerk/clerk-expo'
import { useFonts } from 'expo-font'
import * as Notifications from 'expo-notifications'
import { tokenCache } from '@/lib/tokenCache'
import { env } from '@/lib/env'
import { setClerkTokenGetter } from '@/lib/clerkToken'
import { useAuthStore } from '@/stores/authStore'
import { useRegisterPushToken } from '@/hooks/useRegisterPushToken'
import { RevenueCatProvider } from '@/hooks/useRevenueCat'
import { useUserSocket } from '@/hooks/useUserSocket'
import { usersApi } from '@/api/users'
import { hydrateCaptureLadder } from '@/lib/tierCaps'
import { AccountReactivationGate } from '@/components/features/account/AccountReactivationGate'

// Show notifications as banners even when the app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 30,
      refetchOnWindowFocus: false,
    },
  },
})

function RootNavigator() {
  const { isLoaded, isSignedIn, getToken } = useAuth()
  const setWrldUser = useAuthStore((s) => s.setWrldUser)
  const clearWrldUser = useAuthStore((s) => s.clearWrldUser)
  const setDeletionPending = useAuthStore((s) => s.setDeletionPending)
  const pathname = usePathname()
  const everLoaded = useRef(false)
  if (isLoaded) everLoaded.current = true

  // Wire the Clerk token getter so the axios interceptor can attach JWTs
  useEffect(() => {
    setClerkTokenGetter(getToken)
  }, [getToken])

  // Hydrate the cached capture ladder once at startup so an offline launch uses
  // the last admin-tuned caps (not just the baked-in defaults) at go-live.
  useEffect(() => {
    hydrateCaptureLadder()
  }, [])

  // Fetch the WRLD user record whenever auth state changes.
  // On sign-out transition, navigate to globe — this is the only reliable
  // place to do it because Clerk's auth state is fully settled here.
  // usersApi.getMe() also caches the /auth/me captureLadder (admin-tunable caps).
  useEffect(() => {
    if (!isLoaded) return
    if (isSignedIn) {
      usersApi
        .getMe()
        .then((u) => {
          setWrldUser(u)
          setDeletionPending(null)
        })
        .catch(async (err) => {
          // /auth/me 403s a soft-deleted account in its grace period. Confirm via
          // account-status and surface the reactivation gate instead of failing silent.
          if (err?.response?.status === 403) {
            try {
              const st = await usersApi.accountStatus()
              if (st.status === 'pending_deletion') {
                setDeletionPending(st.anonymizeAt)
                return
              }
            } catch {
              /* fall through */
            }
          }
          console.warn(err)
        })
    } else {
      clearWrldUser()
      setDeletionPending(null)
    }
  }, [isLoaded, isSignedIn])

  // No polling — useUserSocket pushes user_updated for balances, suspension,
  // and tier changes. The initial fetch above covers sign-in state.

  // Register Expo push token when signed in
  useRegisterPushToken(!!isSignedIn)

  // Persistent user push channel — receives recording_updated events
  useUserSocket(!!isSignedIn)

  // Notification deep-link: queue until Clerk is loaded and Stack is rendered
  const pendingStreamRef = useRef<{ roomId: string; streamId: string; sources: string } | null>(null)
  // Tip/gift notifications deep-link to the sender's profile.
  const pendingProfileRef = useRef<string | null>(null)
  // Suspension notifications deep-link to the appeal screen, carrying the signed token.
  const pendingAppealRef = useRef<string | null>(null)

  useEffect(() => {
    if (!isLoaded) return
    const p = pendingStreamRef.current
    if (p) {
      pendingStreamRef.current = null
      router.push({
        pathname: `/(app)/stream/${p.roomId}`,
        params: { streamId: p.streamId, sources: p.sources },
      })
    }
    const handle = pendingProfileRef.current
    if (handle) {
      pendingProfileRef.current = null
      router.push(`/(app)/profile/${handle}`)
    }
    const appealToken = pendingAppealRef.current
    if (appealToken !== null) {
      pendingAppealRef.current = null
      router.push(appealToken ? { pathname: '/appeal', params: { t: appealToken } } : '/appeal')
    }
  }, [isLoaded])

  useEffect(() => {
    function handleResponse(response: Notifications.NotificationResponse | null) {
      if (!response) return
      const data = response.notification.request.content.data as {
        type?: string
        senderHandle?: string
        streamId?: string
        mediasoupRoomId?: string
        sources?: string
        url?: string
        appealUrl?: string
      }

      // Tip/gift/follow/subscribe notifications deep-link to the sender's profile.
      if (
        (data.type === 'tip' || data.type === 'gift' || data.type === 'follow' || data.type === 'subscribe') &&
        data.senderHandle
      ) {
        if (everLoaded.current) {
          router.push(`/(app)/profile/${data.senderHandle}`)
        } else {
          pendingProfileRef.current = data.senderHandle
        }
        return
      }

      // Suspension notification → the appeal screen. The signed token rides in the
      // appealUrl (WEB_BASE_URL/appeal?t=…); pull it out so the token works natively.
      if (data.type === 'suspension') {
        const token = data.appealUrl?.match(/[?&]t=([^&]+)/)?.[1] ?? ''
        if (everLoaded.current) {
          router.push(token ? { pathname: '/appeal', params: { t: token } } : '/appeal')
        } else {
          pendingAppealRef.current = token
        }
        return
      }

      let roomId: string | undefined
      let streamId = ''
      let sources = ''

      if (data.mediasoupRoomId) {
        // Automated stream notification: full payload
        roomId = data.mediasoupRoomId
        streamId = data.streamId ?? ''
        sources = data.sources ?? ''
      } else if (data.url) {
        // Admin broadcast deep-link: wrld://stream/<roomId>
        const match = data.url.match(/wrld:\/\/stream\/([^/?#]+)/)
        if (match) roomId = match[1]
      }

      if (!roomId) return
      const payload = { roomId, streamId, sources }
      if (everLoaded.current) {
        router.push({
          pathname: `/(app)/stream/${payload.roomId}`,
          params: { streamId: payload.streamId, sources: payload.sources },
        })
      } else {
        pendingStreamRef.current = payload
      }
    }

    // Android cold-start: tap response is not delivered to the listener below
    Notifications.getLastNotificationResponseAsync().then(handleResponse)

    // Background / foreground taps on both platforms
    const sub = Notifications.addNotificationResponseReceivedListener(handleResponse)
    return () => sub.remove()
  }, [])

  // Redirect to viewer onboarding when signed-in user still has a temp handle.
  // Guard against redirect loop when already inside an onboarding screen.
  const wrldUser = useAuthStore((s) => s.wrldUser)
  useEffect(() => {
    if (isLoaded && isSignedIn && wrldUser && wrldUser.handle.startsWith('user_')) {
      if (!pathname.includes('onboarding')) {
        router.replace('/onboarding')
      }
    }
  }, [isLoaded, isSignedIn, wrldUser, pathname])

  if (!everLoaded.current) return null

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
        <Stack.Screen name="appeal" />
      </Stack>
      {/* Full-screen reactivation gate — renders over everything when the signed-in
          account is soft-deleted and in its grace period (no-op otherwise). */}
      <AccountReactivationGate />
    </>
  )
}

export default function RootLayout() {
  // Bundle the design-system fonts (loaded at runtime from local assets — no
  // native rebuild). Keys are the family names the theme references, so
  // `theme.typography.*` resolves to the real faces. A load error falls
  // through to the system fallback rather than bricking startup.
  const [fontsLoaded, fontError] = useFonts({
    InterTight_400Regular: require('../assets/fonts/InterTight_400Regular.ttf'),
    InterTight_500Medium: require('../assets/fonts/InterTight_500Medium.ttf'),
    InterTight_600SemiBold: require('../assets/fonts/InterTight_600SemiBold.ttf'),
    IBMPlexMono_500Medium: require('../assets/fonts/IBMPlexMono_500Medium.ttf'),
    IBMPlexMono_700Bold: require('../assets/fonts/IBMPlexMono_700Bold.ttf'),
  })

  if (!fontsLoaded && !fontError) return null

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ClerkProvider publishableKey={env.clerkPublishableKey} tokenCache={tokenCache}>
        <QueryClientProvider client={queryClient}>
          <SafeAreaProvider>
            <KeyboardProvider>
              <StatusBar style="light" />
              <RevenueCatProvider>
                <RootNavigator />
              </RevenueCatProvider>
            </KeyboardProvider>
          </SafeAreaProvider>
        </QueryClientProvider>
      </ClerkProvider>
    </GestureHandlerRootView>
  )
}
