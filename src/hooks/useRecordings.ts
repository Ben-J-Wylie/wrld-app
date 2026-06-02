import { useQuery } from '@tanstack/react-query'
import { recordingsApi } from '@/api/recordings'

export function useRecordings(enabled = true) {
  return useQuery({
    queryKey: ['recordings'],
    queryFn: recordingsApi.list,
    enabled,
    staleTime: 1000 * 30,
  })
}
