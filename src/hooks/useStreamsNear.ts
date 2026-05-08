import { useQuery } from '@tanstack/react-query'
import { streamsApi } from '@/api/streams'

export function useStreamsNear(lat: number | null, lng: number | null, radiusKm = 50) {
  return useQuery({
    queryKey: ['streams', 'near', lat, lng, radiusKm],
    queryFn: () => streamsApi.near(lat!, lng!, radiusKm),
    enabled: lat !== null && lng !== null,
    refetchInterval: 30_000,
  })
}
