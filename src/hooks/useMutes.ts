import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-expo'
import { usersApi } from '@/api/users'

// The current user's mute set + mute/unmute actions. Mute is a personal,
// silent, one-directional filter (see wrld-backend/docs/design/user-mute.md):
// the muter stops seeing the muted user's chat + reactions; the mutee is
// unaffected and unaware. Enforcement is entirely client-side — mediasoup fans
// chat/reactions to everyone keyed on handle, so we drop muted senders at
// render time. The ['mutes'] query is the durable, cross-device source shared
// with the Settings management list, so a mute/unmute anywhere keeps every
// surface in sync.
export function useMutes() {
  const { isSignedIn } = useAuth()
  const qc = useQueryClient()

  const { data: mutes = [] } = useQuery({
    queryKey: ['mutes'],
    queryFn: usersApi.getMutes,
    staleTime: 30_000,
    enabled: !!isSignedIn,
  })

  // Handles are lowercase server-side; lowercase defensively so chat `from`
  // matching never misses on case.
  const mutedHandles = useMemo(
    () => new Set(mutes.map((m) => m.handle.toLowerCase())),
    [mutes],
  )

  const mute = useMutation({
    mutationFn: (handle: string) => usersApi.mute(handle),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mutes'] }),
  })

  const unmute = useMutation({
    mutationFn: (handle: string) => usersApi.unmute(handle),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mutes'] }),
  })

  const isMuted = (handle: string) => mutedHandles.has(handle.toLowerCase())

  return { mutes, mutedHandles, isMuted, mute, unmute }
}
