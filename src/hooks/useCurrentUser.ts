import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-expo'
import { usersApi } from '@/api/users'
import type { User } from '@/types'

export const CURRENT_USER_KEY = ['currentUser'] as const

export function useCurrentUser() {
  const { isSignedIn } = useAuth()
  return useQuery({
    queryKey: CURRENT_USER_KEY,
    queryFn: usersApi.getMe,
    enabled: !!isSignedIn,
    staleTime: 1000 * 60,
    // user_updated WS patches cover all server-side changes (balances, tier,
    // suspension). No polling needed; 60s fallback for WS reconnect gaps.
    refetchInterval: 60_000,
  })
}

export function useInvalidateCurrentUser() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: CURRENT_USER_KEY })
}

export function useSetCurrentUser() {
  const qc = useQueryClient()
  return (user: User) => qc.setQueryData(CURRENT_USER_KEY, user)
}
