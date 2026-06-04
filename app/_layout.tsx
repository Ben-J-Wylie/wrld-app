import '@/lib/polyfills'
import { Stack, router, usePathname } from 'expo-router'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { KeyboardProvider } from 'react-native-keyboard-controller'
import { StatusBar } from 'expo-status-bar'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { ClerkProvider, useAuth } from '@clerk/clerk-expo'
import * as Notifications from 'expo-notifications'
import { tokenCache } from '@/lib/tokenCache'
import { env } from '@/lib/env'
import { setClerkTokenGetter } from '@/lib/clerkToken'
import { useAuthStore } from '@/stores/authStore'
import { useRegisterPushToken } from '@/hooks/useRegisterPushToken'
import { useUserSocket } from '@/hooks/useUserSocket'
import { apiClient } from '@/api/client'
import type { User } from '@/types'

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
  const pathname = usePathname()
  const everLoaded = useRef(false)
  if (isLoaded) everLoaded.current = true

  // Wire the Clerk token getter so the axios interceptor can attach JWTs
  useEffect(() => {
    setClerkTokenGetter(getToken)
  }, [getToken])

  // Fetch the WRLD user record whenever auth state changes.
  // On sign-out transition, navigate to globe — this is the only reliable
  // place to do it because Clerk's auth state is fully settled here.
  useEffect(() => {
    if (!isLoaded) return
    if (isSignedIn) {
      apiClient
        .get<{ user: User }>('/auth/me')
        .then((res) => setWrldUser(res.data.user))
        .catch(console.warn)
    } else {
      clearWrldUser()
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

  useEffect(() => {
    if (!isLoaded) return
    const p = pendingStreamRef.current
    if (!p) return
    pendingStreamRef.current = null
    router.push({
      pathname: `/(app)/stream/${p.roomId}`,
      params: { streamId: p.streamId, sources: p.sources },
    })
  }, [isLoaded])

  useEffect(() => {
    function handleResponse(response: Notifications.NotificationResponse | null) {
      if (!response) return
      const data = response.notification.request.content.data as {
        streamId?: string
        mediasoupRoomId?: string
        sources?: string
        url?: string
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
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
      <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
    </Stack>
  )
}

export default function RootLayout() {
  return (
    <ClerkProvider publishableKey={env.clerkPublishableKey} tokenCache={tokenCache}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <KeyboardProvider>
            <StatusBar style="light" />
            <RootNavigator />
          </KeyboardProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    </ClerkProvider>
  )
}
