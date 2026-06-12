import { useQuery } from '@tanstack/react-query'
import { bufferApi } from '@/api/buffer'

// Draft clips (C4.5) — edited-but-not-yet-saved manifests over the buffer. They show in the
// Clips-grid buffer lane as draft blocks (carved out of their source session, re-openable,
// drag-down to materialise). Key is a child of ['buffer','clips'] so the editor's
// invalidate(['buffer','clips']) refreshes drafts + saved together.
export function useDrafts(enabled = true) {
  return useQuery({
    queryKey: ['buffer', 'clips', 'draft'],
    queryFn: () => bufferApi.listClips('draft'),
    enabled,
    staleTime: 15_000,
    retry: 1,
  })
}
