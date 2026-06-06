import { useQuery } from '@tanstack/react-query'
import { bufferApi } from '@/api/buffer'

// The owner's rolling buffer for the clip editor. Tokenized URLs are short-lived,
// so keep it fresh-ish; the editor also re-renders on its own 1s clock tick.
export function useBuffer(enabled = true) {
  return useQuery({
    queryKey: ['buffer', 'me'],
    queryFn: bufferApi.getMine,
    enabled,
    staleTime: 30_000,
    retry: 1,
  })
}
