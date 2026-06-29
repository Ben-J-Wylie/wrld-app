import { useQuery } from '@tanstack/react-query'
import { legalApi } from '@/api/legal'

// Legal documents change rarely; cache for 30 min. The backend itself caches
// the underlying config ~30s, so edits propagate within roughly a screen-open.
export function useLegalDoc(slug: string) {
  return useQuery({
    queryKey: ['legal-doc', slug],
    queryFn: () => legalApi.get(slug),
    staleTime: 30 * 60_000,
  })
}
