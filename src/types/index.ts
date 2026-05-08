export type User = {
  id: string
  email: string
  displayName: string
  avatarUrl?: string
}

export type Stream = {
  id: string
  hostId: string
  host?: { id: string; displayName: string; avatarUrl?: string | null }
  hostDisplayName?: string
  title: string
  lat: number
  lng: number
  startedAt: string // ISO timestamp
  viewerCount: number
  thumbnailUrl?: string | null
  isLive: boolean
  mediasoupRoomId?: string | null
  distanceKm?: number
}

export type StreamLayer = {
  id: string
  type: 'audio' | 'video' | 'overlay' | 'chat'
  enabled: boolean
  config?: Record<string, unknown>
}
