import { useQuery } from '@tanstack/react-query'
import { usersApi } from '@/api/users'

export function useUserSearch(q: string) {
  const trimmed = q.trim()
  return useQuery({
    queryKey: ['userSearch', trimmed],
    queryFn: () => usersApi.search(trimmed),
    enabled: trimmed.length >= 1,
    staleTime: 1000 * 30,
  })
}
