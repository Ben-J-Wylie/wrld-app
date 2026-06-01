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

export function useStreamByRoom(roomId: string | null | undefined) {
  return useQuery({
    queryKey: ['stream-by-room', roomId],
    queryFn: () => streamsApi.getByRoom(roomId!),
    enabled: !!roomId,
    staleTime: 1000 * 30,
  })
}
