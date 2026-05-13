import { useQuery } from '@tanstack/react-query'
import { usersApi } from '@/api/users'

export function useUserProfile(identifier: string | null) {
  return useQuery({
    queryKey: ['user', identifier],
    queryFn: () => usersApi.getUser(identifier!),
    enabled: !!identifier,
    staleTime: 1000 * 60,
  })
}
