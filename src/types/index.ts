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
  creatorReady: boolean
  // saved-clip pool
  usedStorageBytes: number
  storageQuotaBytes: number
  // rolling-buffer pool (R2 dual-pool) — present on /auth/me; optional for resilience
  bufferUsedBytes?: number
  bufferByteCapBytes?: number
  bufferWindowHours?: number
  bufferEarliestAt?: string | null
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
  tippable: boolean // creator-only: can receive tips (Stardust). Gates the tip button.
  subscriptionEnabled: boolean
  subscriptionPriceUsd: number | null  // monthly price in cents
  giftsReceived?: GiftCollectionItem[]
  giftsReceivedTotal?: number          // total Space Bucks value of gifts received (display only)
}

// A gift type the viewer can send, with its live Space Bucks value (from GET /gifts/catalog).
export type GiftCatalogItem = {
  id: string
  emoji: string
  label: string
  value: number
}

// One row of a streamer's profile gift collection.
export type GiftCollectionItem = {
  giftType: string
  emoji: string
  label: string
  count: number
  totalValue: number  // summed Space Bucks value received for this type (display only)
}

export type WalletTransaction = {
  id: string
  type: 'spaceBucksSpent' | 'stardustEarned' | 'cashout' | 'topup'
  amount: number
  counterpartHandle?: string
  streamTitle?: string
  message?: string | null  // optional tipper note (tips only)
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
  // The stream's title at go-live, so the Clips grid can label a saved clip by title
  // (not its start time). Backend populates it (handoff 2026-06-11); falls back to time.
  title?: string | null
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
  streamRoomId?: string | null   // live mediasoup room — what /stream/[id] joins
  streamSubscribersOnly?: boolean // live stream is ALSO subscriber-only → ticket alone won't grant entry
  title: string
  description: string | null
  scheduledAt: string      // ISO UTC
  timezone: string         // creator's IANA timezone
  durationMinutes: number | null
  priceUsd: number         // cents
  priceSb: number          // Space Bucks price (escrow rail); defaults to priceUsd
  subscribersFreeAccess: boolean
  subscribersOnly?: boolean        // creator declared: stream is also subscriber-only
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
  // Null for PRIVATE streams (locationPrecision 'off'): the backend strips the
  // real coordinate before it ever leaves the server. Such streams are placed
  // on the Haven island client-side (by stream id), not by these fields.
  lat: number | null
  lng: number | null
  // IANA timezone of the broadcaster's location (e.g. "America/New_York"),
  // derived server-side from the real coordinates. Used to show the
  // broadcaster's local time on the stream screens.
  timezone?: string | null
  startedAt: string // ISO timestamp
  viewerCount: number
  thumbnailUrl?: string | null
  isLive: boolean
  mediasoupRoomId?: string | null
  sources: SourceType[]
  subscribersOnly?: boolean
  // Present when this live stream is a PPV event broadcast — lets the viewer UI
  // badge it as PPV + show the event title, and detect pause vs end.
  ppvEvent?: { id: string; title: string; status: string } | null
  // 'off' = PRIVATE — discoverable only on the Haven planet, with no real coords.
  locationPrecision?: 'exact' | 'city' | 'country' | 'off'
  distanceKm?: number
  distanceMeters?: number
  // External cams (ext-<slug>) have no mediasoup room — they're watched as a live
  // HLS pull off the rolling buffer at `liveUrl`, not over WebRTC. The stream view
  // branches on `isExternal` (play the HLS) instead of joining a room.
  isExternal?: boolean
  liveUrl?: string | null
}
