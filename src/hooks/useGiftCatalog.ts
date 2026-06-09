import { useQuery } from '@tanstack/react-query'
import { giftsApi } from '@/api/gifts'

// The gift catalog rarely changes (admin-tunable values), so keep it cached long.
export function useGiftCatalog() {
  return useQuery({
    queryKey: ['gift-catalog'],
    queryFn: () => giftsApi.catalog(),
    staleTime: 1000 * 60 * 10,
  })
}
