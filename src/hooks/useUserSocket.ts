import { useEffect, useRef } from 'react'
import { useAuth } from '@clerk/clerk-expo'
import { useQueryClient } from '@tanstack/react-query'
import { env } from '@/lib/env'
import { useAuthStore } from '@/stores/authStore'
import { CURRENT_USER_KEY } from '@/hooks/useCurrentUser'
import type { Recording, User, WalletData } from '@/types'

// Convert https://api.wrld.cam → wss://api.wrld.cam/ws
const WS_URL = env.apiBaseUrl.replace(/^https?/, (s) => (s === 'https' ? 'wss' : 'ws')) + '/ws'

const MAX_RETRY_MS = 30_000

export function useUserSocket(enabled: boolean) {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  const setWrldUser = useAuthStore((s) => s.setWrldUser)
  const wsRef = useRef<WebSocket | null>(null)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryDelayRef = useRef(1_000)
  const activeRef = useRef(false)

  useEffect(() => {
    if (!enabled) return

    activeRef.current = true

    function connect() {
      if (!activeRef.current) return

      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = async () => {
        try {
          const token = await getToken()
          if (!token || !activeRef.current) { ws.close(); return }
          ws.send(JSON.stringify({ type: 'authenticate', token }))
        } catch {
          ws.close()
        }
      }

      ws.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data as string)

          if (event.type === 'authenticated') {
            retryDelayRef.current = 1_000 // reset backoff on success
          }

          if (event.type === 'user_updated') {
            const current = useAuthStore.getState().wrldUser
            if (current) setWrldUser({ ...current, ...event.patch })
            // Mirror the patch into the currentUser query cache so query-readers
            // (e.g. the Library storage bar) update instantly, not just the store.
            qc.setQueryData<User>(CURRENT_USER_KEY, (prev) =>
              prev ? { ...prev, ...event.patch } : prev,
            )
            // Keep wallet cache in sync when balance fields are pushed
            if ('spaceBucks' in event.patch || 'stardust' in event.patch) {
              qc.setQueryData<WalletData>(['wallet'], (prev) =>
                prev ? { ...prev, ...event.patch } : prev,
              )
            }
          }

          if (event.type === 'recording_updated') {
            const incoming = event.recording as Recording
            qc.setQueryData<Recording[]>(['recordings'], (prev) => {
              if (!prev) {
                // No cache yet — trigger a fresh fetch
                qc.invalidateQueries({ queryKey: ['recordings'] })
                return prev
              }
              const idx = prev.findIndex((r) => r.id === incoming.id)
              if (idx === -1) return [incoming, ...prev]
              const next = [...prev]
              next[idx] = incoming
              return next
            })
          }
        } catch {}
      }

      ws.onclose = () => {
        wsRef.current = null
        if (!activeRef.current) return
        retryTimerRef.current = setTimeout(() => {
          retryDelayRef.current = Math.min(retryDelayRef.current * 2, MAX_RETRY_MS)
          connect()
        }, retryDelayRef.current)
      }
    }

    connect()

    return () => {
      activeRef.current = false
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [enabled])
}
