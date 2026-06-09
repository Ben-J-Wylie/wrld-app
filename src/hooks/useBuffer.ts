import { useQuery } from '@tanstack/react-query'
import { bufferApi } from '@/api/buffer'

// The owner's rolling buffer for the clip editor. Tokenized URLs are short-lived,
// so keep it fresh-ish; the editor also re-renders on its own 1s clock tick.
// While `liveRefresh` (the user is currently streaming), poll every 5s so the
// live session's flushed media duration — hence the live footage edge — advances
// smoothly instead of stepping on the 30s staleTime.
export function useBuffer(enabled = true, liveRefresh = false) {
  return useQuery({
    queryKey: ['buffer', 'me'],
    queryFn: bufferApi.getMine,
    enabled,
    staleTime: liveRefresh ? 5_000 : 30_000,
    refetchInterval: liveRefresh ? 5_000 : false,
    retry: 1,
  })
}
