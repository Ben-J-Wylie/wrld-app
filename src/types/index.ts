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
  notifyOnFollowedLive: boolean
  notifyOnNearbyLive: boolean
  spaceBucks: number
  stardust: number
  dateOfBirth?: string
  locationPrecision?: 'city' | 'country' | 'off'
  creatorReady: boolean
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

export type WalletTransaction = {
  id: string
  type: 'spaceBucksSpent' | 'stardustEarned' | 'cashout' | 'topup'
  amount: number
  counterpartHandle?: string
  streamTitle?: string
  status?: 'pending' | 'paid' | 'rejected'
  priceCents?: number
  createdAt: string
}

export type WalletData = {
  spaceBucks: number
  stardust: number
  lockedStardust: number
  readyStardust: number
  transactions: WalletTransaction[]
}

export type CashoutRequest = {
  id: string
  amount: number
  dollarValue: number
  status: 'pending' | 'paid' | 'rejected'
  createdAt: string
  processedAt: string | null
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
