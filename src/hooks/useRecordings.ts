import { useQuery } from '@tanstack/react-query'
import { recordingsApi } from '@/api/recordings'
import type { Recording } from '@/types'

export function useRecordings(enabled = true) {
  return useQuery({
    queryKey: ['recordings'],
    queryFn: recordingsApi.list,
    enabled,
    staleTime: 10_000,
    // Poll every 3s while any recording is in-flight, recently failed,
    // or ready but still awaiting its thumbnail (extracted async after status update).
    refetchInterval: (query) => {
      const data = query.state.data as Recording[] | undefined
      const needsPoll = data?.some(
        (r) => r.status === 'recording' || r.status === 'failed' || (r.status === 'ready' && !r.thumbnailUrl),
      )
      return needsPoll ? 3000 : false
    },
  })
}
