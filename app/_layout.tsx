import '@/lib/polyfills'
import { Stack, router } from 'expo-router'
import { SafeAreaProvider } from 'react-native-safe-area-context'
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

  // Register Expo push token when signed in
  useRegisterPushToken(!!isSignedIn)

  // Handle notification taps — navigate to the stream in the payload
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as {
        streamId?: string
        mediasoupRoomId?: string
        sources?: string
      }
      if (data.mediasoupRoomId && data.streamId) {
        router.navigate({
          pathname: '/(app)/stream/[id]',
          params: {
            id: data.mediasoupRoomId,
            streamId: data.streamId,
            sources: data.sources ?? '',
          },
        })
      }
    })
    return () => sub.remove()
  }, [])

  // Redirect to onboarding when signed-in user still has a temp handle
  const wrldUser = useAuthStore((s) => s.wrldUser)
  useEffect(() => {
    if (isLoaded && isSignedIn && wrldUser && wrldUser.handle.startsWith('user_')) {
      router.replace('/onboarding')
    }
  }, [isLoaded, isSignedIn, wrldUser])

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
          <StatusBar style="light" />
          <RootNavigator />
        </SafeAreaProvider>
      </QueryClientProvider>
    </ClerkProvider>
  )
}
