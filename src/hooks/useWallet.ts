import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-expo'
import { usersApi } from '@/api/users'

export const WALLET_KEY = ['wallet'] as const

export function useWallet() {
  const { isSignedIn } = useAuth()
  return useQuery({
    queryKey: WALLET_KEY,
    queryFn: usersApi.getWallet,
    enabled: !!isSignedIn,
    staleTime: 1000 * 15,
    refetchInterval: 1000 * 15,
  })
}

export function useInvalidateWallet() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: WALLET_KEY })
}
