export type User = {
  id: string
  clerkUserId: string
  email: string
  handle: string
  displayName: string
  avatarUrl: string | null
  avatarUserSet: boolean
  lastHandleChangeAt: string | null
  createdAt: string
}

export type PublicUser = {
  id: string
  handle: string
  displayName: string
  avatarUrl: string | null
  createdAt: string
  followerCount: number
  followingCount: number
  isFollowing: boolean
}

export type SourceType = 'camera' | 'audio'

export type Stream = {
  id: string
  hostId: string
  host?: { id: string; handle: string; displayName: string; avatarUrl: string | null }
  hostDisplayName?: string
  title: string
  lat: number
  lng: number
  startedAt: string // ISO timestamp
  viewerCount: number
  thumbnailUrl?: string | null
  isLive: boolean
  mediasoupRoomId?: string | null
  sources: SourceType[]
  distanceKm?: number
  distanceMeters?: number
}
