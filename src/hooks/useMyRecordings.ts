import { useQuery } from '@tanstack/react-query'
import { erasApi } from '@/api/eras'

// The owner's recordings + their eras + survivingRegions — the clips-grid timeline (clean-cut).
// Replaces useBuffer/useRecordings/useSavedClips/useDrafts. Tokenized URLs are short-lived, so
// keep it fresh-ish; while `liveRefresh` (currently streaming) poll 5s so the open era's live
// footage edge advances smoothly.
export function useMyRecordings(enabled = true, liveRefresh = false) {
  return useQuery({
    queryKey: ['me', 'recordings'],
    queryFn: erasApi.myRecordings,
    enabled,
    staleTime: liveRefresh ? 5_000 : 30_000,
    refetchInterval: liveRefresh ? 5_000 : false,
    retry: 1,
  })
}
