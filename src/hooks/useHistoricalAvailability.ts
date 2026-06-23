import { useQuery } from '@tanstack/react-query'
import { clipsApi, type ClipPin, type BufferPin } from '@/api/clips'

// PB3.5 — the WINDOWED availability feed (the robust time-machine discovery primitive).
//
// Instead of asking the server "what's public at instant T?" every tick (the per-instant
// `useHistoricalClips` path — which samples a continuous truth and produces the blink /
// half-missing anomalies), this fetches all public/gated pins with content in a WINDOW
// around the playhead, each carrying its public `intervals`. The globe holds this and
// resolves pin visibility LOCALLY (`playhead ∈ interval`) as the playhead scrubs — no
// per-tick query, no bucket, no stale-pin. Mirrors live discovery's "what's available"
// snapshot, with the playhead as a client cursor; tagging a segment invalidates this
// query (the "tagging edits the availability map" step).
//
// The window follows the playhead on a coarse (1h) bucket so scrubbing far back
// re-centers; everything between fetches is local. Gated by the AVAILABILITY_FEED flag
// (the caller passes `active`); behind it until the backend's windowed feed deploys.
const HALF_MS = 12 * 3_600_000 // ±12h window around the playhead
const CENTER_BUCKET_MS = 3_600_000 // re-fetch only when the playhead crosses an hour (≥11h margin)

export function useHistoricalAvailability(playheadMs: number, active: boolean) {
  const center = active ? Math.floor(playheadMs / CENTER_BUCKET_MS) * CENTER_BUCKET_MS : 0
  const from = center - HALF_MS
  const to = center + HALF_MS

  return useQuery<{ clips: ClipPin[]; bufferPins: BufferPin[] }>({
    queryKey: ['historical-availability', center],
    queryFn: () =>
      clipsApi.discoverWindow(new Date(from).toISOString(), new Date(to).toISOString()),
    enabled: active,
    staleTime: 60_000,
    // Backstop poll: a parked/playing viewer picks up OTHERS' edits to the past within
    // ~60s (your own edits are instant via invalidate-on-tag; a scrub picks up the latest
    // on settle — the globe calls refetch() on scrub-end). Only runs while enabled.
    refetchInterval: 60_000,
    placeholderData: (prev) => prev,
  })
}
