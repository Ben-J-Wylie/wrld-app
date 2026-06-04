import { useQuery } from '@tanstack/react-query'
import { recordingsApi } from '@/api/recordings'

export function useRecordings(enabled = true) {
  return useQuery({
    queryKey: ['recordings'],
    queryFn: recordingsApi.list,
    enabled,
    staleTime: 10_000,
    retry: 1,
    // Real-time updates come from useUserSocket (recording_updated push).
    // 60s poll is a fallback for any events missed during a WS disconnect gap.
    refetchInterval: 60_000,
  })
}
