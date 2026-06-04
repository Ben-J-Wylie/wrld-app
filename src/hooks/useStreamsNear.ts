import { useQuery } from '@tanstack/react-query'
import { streamsApi } from '@/api/streams'

export function useStreamsNear(lat: number | null, lng: number | null, radiusKm = 50) {
  return useQuery({
    queryKey: ['streams', 'near', lat, lng, radiusKm],
    queryFn: () => streamsApi.near(lat!, lng!, radiusKm),
    enabled: lat !== null && lng !== null,
    // Discovery WS pushes stream_started/ended/location_updated in real time.
    // 60s is a fallback for missed events during a WS reconnect gap.
    refetchInterval: 60_000,
  })
}
