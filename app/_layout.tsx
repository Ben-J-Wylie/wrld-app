import '@/lib/polyfills'
import { Stack } from 'expo-router'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect } from 'react'
import { ClerkProvider, useAuth } from '@clerk/clerk-expo'
import { tokenCache } from '@/lib/tokenCache'
import { env } from '@/lib/env'
import { setClerkTokenGetter } from '@/lib/clerkToken'
import { useAuthStore } from '@/stores/authStore'
import { apiClient } from '@/api/client'
import type { User } from '@/types'

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

  // Wire the Clerk token getter so the axios interceptor can attach JWTs
  useEffect(() => {
    setClerkTokenGetter(getToken)
  }, [getToken])

  // Fetch the WRLD user record whenever auth state changes
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

  if (!isLoaded) return null

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
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
