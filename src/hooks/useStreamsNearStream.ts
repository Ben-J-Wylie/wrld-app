import { useQuery } from '@tanstack/react-query'
import { streamsApi } from '@/api/streams'

export function useStreamsNearStream(streamId: string | null, enabled = true) {
  return useQuery({
    queryKey: ['streams', 'nearStream', streamId],
    queryFn: () => streamsApi.nearby(streamId!),
    enabled: enabled && streamId !== null,
    refetchInterval: enabled ? 10_000 : false,
  })
}
