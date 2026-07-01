import { useQuery } from '@tanstack/react-query'
import { erasApi } from '@/api/eras'
import type { MyRecording } from '@/types/era'

// The owner's recordings + their eras + survivingRegions — the clips-grid timeline (clean-cut).
// Replaces useBuffer/useRecordings/useSavedClips/useDrafts. Tokenized URLs are short-lived, so
// keep it fresh-ish; while `liveRefresh` (currently streaming) poll 5s so the open era's live
// footage edge advances smoothly.
//
// The /me/recordings payload nests eras WITHOUT recordingId (it's the parent), but the grid needs
// it per era for snip/mend (POST /recordings/:id/…). Inject it here so every Era is self-describing.
export function useMyRecordings(enabled = true, liveRefresh = false) {
  return useQuery({
    queryKey: ['me', 'recordings'],
    queryFn: async (): Promise<MyRecording[]> => {
      const recs = await erasApi.myRecordings()
      return recs.map((r) => ({ ...r, eras: r.eras.map((e) => ({ ...e, recordingId: r.id })) }))
    },
    enabled,
    staleTime: liveRefresh ? 5_000 : 30_000,
    refetchInterval: liveRefresh ? 5_000 : false,
    retry: 1,
  })
}
