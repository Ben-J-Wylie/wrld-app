import { useQuery } from '@tanstack/react-query'
import { recordingsApi } from '@/api/recordings'
import type { Recording } from '@/types'

export function useRecordings(enabled = true) {
  return useQuery({
    queryKey: ['recordings'],
    queryFn: recordingsApi.list,
    enabled,
    staleTime: 10_000,
    // Poll every 3s while any recording is still in-flight or recently failed
    // (failed can be a transient state while FFmpeg finalises and recordingReady fires).
    refetchInterval: (query) => {
      const data = query.state.data as Recording[] | undefined
      const needsPoll = data?.some((r) => r.status === 'recording' || r.status === 'failed')
      return needsPoll ? 3000 : false
    },
  })
}
