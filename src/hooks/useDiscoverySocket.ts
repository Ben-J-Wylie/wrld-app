import { useEffect, useRef, useState } from 'react'
import type { Stream } from '@/types'

const BASE = (process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://api.wrld.cam')
  .replace('https://', 'wss://')
  .replace('http://', 'ws://')
const DISCOVERY_URL = `${BASE}/streams/discovery`

export function useDiscoverySocket(): Stream[] {
  const [streams, setStreams] = useState<Stream[]>([])
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectDelayRef = useRef(1_000)
  const unmountedRef = useRef(false)

  useEffect(() => {
    unmountedRef.current = false
    connect()
    return () => {
      unmountedRef.current = true
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      wsRef.current?.close()
    }
  }, [])

  function connect() {
    if (unmountedRef.current) return
    const ws = new WebSocket(DISCOVERY_URL)
    wsRef.current = ws

    ws.onopen = () => {
      reconnectDelayRef.current = 1_000
    }

    ws.onmessage = (e) => {
      try {
        handleEvent(JSON.parse(e.data as string))
      } catch {}
    }

    ws.onclose = () => {
      if (unmountedRef.current) return
      reconnectTimerRef.current = setTimeout(() => {
        reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 2, 30_000)
        connect()
      }, reconnectDelayRef.current)
    }
  }

  function handleEvent(event: Record<string, unknown>) {
    switch (event.type) {
      case 'snapshot':
        setStreams(event.streams as Stream[])
        break
      case 'stream_started':
        setStreams(prev => {
          const without = prev.filter(s => s.id !== (event.stream as Stream).id)
          return [...without, event.stream as Stream]
        })
        break
      case 'stream_ended':
        setStreams(prev => prev.filter(s => s.mediasoupRoomId !== event.mediasoupRoomId))
        break
      case 'location_updated':
        setStreams(prev => prev.map(s =>
          s.mediasoupRoomId === event.mediasoupRoomId
            ? { ...s, lat: event.lat as number, lng: event.lng as number }
            : s,
        ))
        break
      case 'viewer_count_updated':
        setStreams(prev => prev.map(s =>
          s.mediasoupRoomId === event.mediasoupRoomId
            ? { ...s, viewerCount: event.viewerCount as number }
            : s,
        ))
        break
    }
  }

  return streams
}
