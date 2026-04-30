export type User = {
  id: string
  email: string
  displayName: string
  avatarUrl?: string
}

export type Stream = {
  id: string
  hostId: string
  hostDisplayName: string
  title: string
  lat: number
  lng: number
  startedAt: string // ISO timestamp
  viewerCount: number
  thumbnailUrl?: string
  isLive: boolean
}

export type StreamLayer = {
  id: string
  type: 'audio' | 'video' | 'overlay' | 'chat'
  enabled: boolean
  config?: Record<string, unknown>
}
