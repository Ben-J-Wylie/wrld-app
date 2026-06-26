import { useQuery } from '@tanstack/react-query'
import { usersApi } from '@/api/users'

// Fires at 3+ characters — the backend matches substrings + fuzzy, so 1–2 chars
// would match a huge slice of the directory. Debounce the input before passing it.
export const USER_SEARCH_MIN = 3

export function useUserSearch(q: string) {
  const trimmed = q.trim()
  return useQuery({
    queryKey: ['userSearch', trimmed],
    queryFn: () => usersApi.search(trimmed),
    enabled: trimmed.length >= USER_SEARCH_MIN,
    staleTime: 1000 * 30,
  })
}
