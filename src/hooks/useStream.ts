import { useQuery } from '@tanstack/react-query'
import { streamsApi } from '@/api/streams'

export function useStream(streamId: string | null | undefined) {
  return useQuery({
    queryKey: ['stream', streamId],
    queryFn: () => streamsApi.get(streamId!),
    enabled: !!streamId,
    staleTime: 1000 * 30,
  })
}
