import { useQuery } from '@tanstack/react-query'
import { recordingsApi } from '@/api/recordings'
import type { Recording } from '@/types'

export function useRecordings(enabled = true) {
  return useQuery({
    queryKey: ['recordings'],
    queryFn: recordingsApi.list,
    enabled,
    staleTime: 10_000,
    // Poll every 3s while any recording is still processing, then stop.
    refetchInterval: (query) => {
      const data = query.state.data as Recording[] | undefined
      return data?.some((r) => r.status === 'recording') ? 3000 : false
    },
  })
}
