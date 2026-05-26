import { useState, useEffect, useCallback, useRef } from 'react'
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
  | 'dropped'

type Producer = { id: string; kind: string }

export function useSignaling() {
  const [status, setStatus] = useState<SignalingStatus>('idle')
  const [roomId, setRoomId] = useState<string | null>(null)
  const [producers, setProducers] = useState<Producer[]>([])
  const [viewerCount, setViewerCount] = useState(0)
  const [streamEnded, setStreamEnded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Distinguishes intentional disconnect() calls from unexpected network drops.
  const intentionalRef = useRef(false)

  useEffect(() => {
    const unsub = signalingClient.onMessage((msg) => {
      if (msg.type === 'viewerCountUpdated') setViewerCount(msg.viewerCount)
      if (msg.type === 'broadcasterLeft') setStreamEnded(true)
    })
    return unsub
  }, [])

  useEffect(() => {
    return signalingClient.onClose((code) => {
      if (intentionalRef.current) {
        setStatus('idle')
      } else if (code === 4001) {
        // Server explicitly closed our socket because the broadcaster left.
        // Treat identically to receiving a broadcasterLeft WS message.
        setStreamEnded(true)
      } else {
        setStatus('dropped')
      }
      intentionalRef.current = false
      setRoomId(null)
      setProducers([])
      setViewerCount(0)
    })
  }, [])

  const connect = useCallback(async () => {
    setStatus('connecting')
    setError(null)
    setStreamEnded(false)
    try {
      await signalingClient.connect(env.mediasoupWssUrl)
      setStatus('connected')
      const token = await getClerkToken()
      if (token) {
        await signalingClient.authenticate(token)
        setStatus('authenticated')
      }
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Connection failed')
      throw err
    }
  }, [])

  const createRoom = useCallback(async (meta: { title: string; lat: number; lng: number; sources: string[] }) => {
    try {
      const id = await signalingClient.createRoom(meta)
      setRoomId(id)
      setStatus('in-room')
      return id
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Failed to create room')
      throw err
    }
  }, [])

  const joinRoom = useCallback(async (id: string) => {
    try {
      const prods = await signalingClient.joinRoom(id)
      setRoomId(id)
      setProducers(prods)
      setStatus('in-room')
      return prods
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Failed to join stream')
      throw err
    }
  }, [])

  const disconnect = useCallback(() => {
    intentionalRef.current = true
    signalingClient.disconnect()
    setStatus('idle')
    setRoomId(null)
    setProducers([])
    setError(null)
  }, [])

  return {
    status, setStatus,
    roomId,
    producers,
    viewerCount,
    streamEnded,
    error, setError,
    connect,
    createRoom,
    joinRoom,
    disconnect,
  }
}
