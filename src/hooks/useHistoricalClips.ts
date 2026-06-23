import { useQuery } from '@tanstack/react-query'
import { clipsApi, type ClipPin, type BufferPin } from '@/api/clips'

// Time Machine — the globe's historical pin feed. Given a playhead instant (epoch
// ms behind now), queries the surviving public clips alive at that moment.
//
// `playheadMs <= 0` → live present: the query is disabled and returns no clips (the
// globe uses its live viewport feed instead). When scrubbed into the past the
// playhead ticks forward at 1× (the globe recomputes it each second); the query key
// is bucketed so the pin set refreshes as the playhead advances without refetching on
// every sub-second change. `placeholderData` keeps the prior pins on screen while the
// next bucket loads, so the globe doesn't flicker empty between fetches.
//
// 1s bucket (was 5s): PB3 per-segment privacy is evaluated at the queried instant T, so
// a coarse bucket can't resolve which short segment the playhead is in — a clip snipped
// into ~5-10s public/private segments read as one permission. 1s matches the globe's 1s
// playhead ticker and resolves per-segment. (Discover is a small query; 1/s is fine.)
const BUCKET_MS = 1000

export function useHistoricalClips(playheadMs: number) {
  const active = playheadMs > 0
  const bucket = active ? Math.floor(playheadMs / BUCKET_MS) : 0

  return useQuery<{ clips: ClipPin[]; bufferPins: BufferPin[] }>({
    queryKey: ['historical-clips', bucket],
    queryFn: () => clipsApi.discover(new Date(bucket * BUCKET_MS).toISOString()),
    enabled: active,
    staleTime: BUCKET_MS,
    placeholderData: (prev) => prev,
  })
}
