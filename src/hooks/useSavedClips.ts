import { useQuery } from '@tanstack/react-query'
import { bufferApi } from '@/api/buffer'

// The owner's durable saved-clip pool (C5) — backs the Clips-grid saved lane and
// the editor's saved-clip focus lookup. Invalidate ['buffer', 'clips'] after a
// save / un-save so the lane reflects server truth. A just-saved clip only lands
// here once the backend finishes processing it (GET returns status:'ready' only),
// so `moveClip` schedules a short refetch window after a save.
export function useSavedClips(enabled = true) {
  return useQuery({
    queryKey: ['buffer', 'clips'],
    queryFn: bufferApi.listSavedClips,
    enabled,
    staleTime: 15_000,
    retry: 1,
  })
}
