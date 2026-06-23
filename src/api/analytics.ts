// src/api/analytics.ts
//
// Typed client for the Pro-only creator analytics endpoint. Near-verbatim
// port of wrld-web's `src/api/analytics.ts` — the backend
// (GET /users/me/analytics) is shared and already live, gated server-side on
// tier === 'pro' (403 otherwise). We mirror that gate client-side in the hook.
//
// Caveats baked into the response (surfaced in the UI):
//   • watch-time / unique-viewer / top-viewer / top-supporter metrics are
//     signed-in only (anonymous viewers have no identity).
//   • country / city / reach / heatmap include EVERYONE (anon + signed-in),
//     resolved from the audience-geo capture.
//   • all audience-geo + activity data is forward-only — it accrues from new
//     viewer activity after the mediasoup deploy; there's no backfill.

import { apiClient } from './client'

export type AnalyticsRange = '7d' | '30d' | '90d' | 'all'

export type AnalyticsSummary = {
  streamCount: number
  broadcastSeconds: number
  hoursStreamed: number
  peakConcurrentViewers: number
  totalReach: number              // every viewer (anon + auth) via geo pings
  uniqueSignedInViewers: number
  viewerSessions: number
  repeatViewers: number
  totalWatchHours: number
  avgWatchMinutes: number
  followers: number
  followersGained: number
  activeSubscribers: number
  newSubscribers: number
  mrrUsd: number
  tipsUsd: number
  ppvUsd: number
  totalRevenueUsd: number
  cancelledSubscribers: number
  netSubscribers: number
  signedInReach: number
  anonymousReach: number
  signedInRate: number          // % of reach that is signed in
  // Space Bucks (🚀) / Stardust (✨), $0.01/unit
  spaceBucksPurchased: number        // Space Bucks topped up
  spaceBucksPurchasedUsd: number
  tipsReceivedSpaceBucks: number     // gross Space Bucks from tippers
  stardustEarned: number             // net Stardust credited (cash-outable)
  stardustEarnedUsd: number
  // Gifts — pure Space Bucks sink (never Stardust, never cash-outable)
  giftsReceivedCount: number
  giftsReceivedSpaceBucks: number
}

export type AnalyticsPoint = {
  date: string                    // YYYY-MM-DD
  followers: number               // cumulative
  followersGained: number
  uniqueViewers: number
  watchHours: number
  tipsUsd: number
  ppvUsd: number
  revenueUsd: number
}

export type AnalyticsGeo = { countryCode: string; viewers: number }

export type AnalyticsCity = { city: string; countryCode: string; viewers: number }

export type AnalyticsTopStream = {
  id: string
  title: string
  startedAt: string
  peakViewers: number
  watchHours: number
  tipsUsd: number
}

export type AnalyticsTopClip = {
  id: string
  title: string | null
  viewCount: number
  createdAt: string
}

export type AnalyticsTopViewer = {
  id: string
  handle: string
  displayName: string | null
  avatarUrl: string | null
  sessions: number
  watchSeconds: number
}

export type AnalyticsTopSupporter = {
  id: string
  handle: string
  displayName: string | null
  avatarUrl: string | null
  tipCount: number
  spaceBucks: number
}

export type AnalyticsGiftBreakdown = {
  giftType: string
  emoji: string
  label: string
  count: number
  spaceBucks: number
}

export type AnalyticsTopGifter = {
  id: string
  handle: string
  displayName: string | null
  avatarUrl: string | null
  giftCount: number
  spaceBucks: number
}

export type AnalyticsActivityCell = { dow: number; hour: number; count: number }

export type AnalyticsPpvEvent = {
  id: string
  title: string
  status: string
  scheduledAt: string
  priceUsd: number
  attendees: number
  grossRevenueUsd: number
  netRevenueUsd: number
}

export type AnalyticsData = {
  range: AnalyticsRange
  since: string
  summary: AnalyticsSummary
  timeseries: AnalyticsPoint[]
  geo: AnalyticsGeo[]
  topCities: AnalyticsCity[]
  topStreams: AnalyticsTopStream[]
  topClips: AnalyticsTopClip[]
  topViewers: AnalyticsTopViewer[]
  topSupporters: AnalyticsTopSupporter[]
  giftsBreakdown: AnalyticsGiftBreakdown[]
  topGifters: AnalyticsTopGifter[]
  activity: AnalyticsActivityCell[]
  ppvEvents: AnalyticsPpvEvent[]
}

// The device's IANA timezone so the activity heatmap buckets viewer joins by
// the creator's local day/hour. Hermes ships full Intl on SDK 54 / RN 0.81, so
// this resolves the real zone (same approach as wrld-web); UTC fallback if it
// ever throws.
function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

export const analyticsApi = {
  get: async (range: AnalyticsRange): Promise<AnalyticsData> => {
    const { data } = await apiClient.get<AnalyticsData>('/users/me/analytics', {
      params: { range, tz: deviceTimezone() },
    })
    return data
  },
}
