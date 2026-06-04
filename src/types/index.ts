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
  tier: 'free' | 'plus' | 'pro'
  suspendedUntil: string | null
  suspendedReason: string | null
  dateOfBirth?: string
  locationPrecision?: 'exact' | 'city' | 'country' | 'off'
  creatorReady: boolean
  usedStorageBytes: number
  storageQuotaBytes: number
  subscriptionEnabled: boolean
  subscriptionPriceUsd: number | null
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
  subscriptionEnabled: boolean
  subscriptionPriceUsd: number | null  // monthly price in cents
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

export type Recording = {
  id: string
  streamId: string
  status: 'recording' | 'ready' | 'failed' | 'expired'
  manifestUrl: string | null
  thumbnailUrl: string | null
  durationSec: number | null
  sizeBytes: number
  startedAt: string   // ISO timestamp
  endedAt: string | null
  expiresAt: string | null
  _count: { clips: number }
}

export type PpvEvent = {
  id: string
  hostId: string
  host?: { id: string; handle: string; displayName: string; avatarUrl: string | null }
  streamId: string | null
  title: string
  description: string | null
  scheduledAt: string      // ISO UTC
  timezone: string         // creator's IANA timezone
  durationMinutes: number | null
  priceUsd: number         // cents
  subscribersFreeAccess: boolean
  maxCapacity: number | null
  replayAccess: boolean
  status: 'scheduled' | 'live' | 'ended' | 'cancelled'
  purchaseCount: number
  thumbnailUrl: string | null
  hasAccess?: boolean      // viewer-facing: true if viewer has purchased or has subscriber free access
  grossRevenueCents?: number
  netRevenueCents?: number
  createdAt?: string
}

export type Stream = {
  id: string
  hostId: string
  host?: { id: string; handle: string; displayName: string; avatarUrl: string | null; subscriptionPriceUsd?: number | null }
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
  subscribersOnly?: boolean
  locationPrecision?: 'exact' | 'city' | 'country'
  distanceKm?: number
  distanceMeters?: number
}
