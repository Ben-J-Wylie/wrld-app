import { useState, useEffect, useCallback } from 'react'
import { signalingClient } from '@/lib/mediasoupSignaling'
import { getClerkToken } from '@/lib/clerkToken'
import { env } from '@/lib/env'

export type SignalingStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'authenticated'
  | 'in-room'
  | 'error'

type Producer = { id: string; kind: string }

export function useSignaling() {
  const [status, setStatus] = useState<SignalingStatus>('idle')
  const [roomId, setRoomId] = useState<string | null>(null)
  const [producers, setProducers] = useState<Producer[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    return signalingClient.onClose(() => {
      setStatus('idle')
      setRoomId(null)
      setProducers([])
    })
  }, [])

  const connect = useCallback(async () => {
    setStatus('connecting')
    setError(null)
    await signalingClient.connect(env.mediasoupWssUrl)
    setStatus('connected')

    const token = await getClerkToken()
    if (token) {
      await signalingClient.authenticate(token)
      setStatus('authenticated')
    }
  }, [])

  const createRoom = useCallback(async (meta: { title: string; lat: number; lng: number; layers: string[] }) => {
    const id = await signalingClient.createRoom(meta)
    setRoomId(id)
    setStatus('in-room')
    return id
  }, [])

  const joinRoom = useCallback(async (id: string) => {
    const prods = await signalingClient.joinRoom(id)
    setRoomId(id)
    setProducers(prods)
    setStatus('in-room')
  }, [])

  const disconnect = useCallback(() => {
    signalingClient.disconnect()
    setStatus('idle')
    setRoomId(null)
    setProducers([])
    setError(null)
  }, [])

  return { status, roomId, producers, error, setError, connect, createRoom, joinRoom, disconnect }
}
