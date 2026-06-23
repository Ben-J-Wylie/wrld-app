import { apiClient } from './client'
import { getClerkToken } from '@/lib/clerkToken'
import { env } from '@/lib/env'
import { applyRemoteCaptureLadder, type CaptureLadder } from '@/lib/tierCaps'
import type { User, PublicUser, WalletData, CashoutRequest } from '@/types'

export type BlockedUser = {
  id: string
  handle: string
  displayName: string
  avatarUrl: string | null
  blockedAt: string
}

// The notification preference flags (mirrors the backend
// PATCH /users/me/notification-preferences body + response).
export type NotificationPreferences = {
  notifyOnFollowedLive: boolean
  notifyOnNearbyLive: boolean
  notifyOnTip: boolean
  notifyOnSubscribedLive: boolean
  notifyOnPpvReminder: boolean
  notifyOnGift: boolean
  notifyOnFollower: boolean
  notifyOnSubscriber: boolean
}

export const usersApi = {
  getMe: async (): Promise<User> => {
    const res = await apiClient.get<{ user: User; captureLadder?: Partial<CaptureLadder> }>('/auth/me')
    // Cache the admin-tunable capture ladder for offline-resilient go-live caps.
    void applyRemoteCaptureLadder(res.data.captureLadder)
    return res.data.user
  },

  updateProfile: async (data: { displayName?: string; handle?: string }): Promise<User> => {
    const res = await apiClient.patch<{ user: User }>('/users/me', data)
    return res.data.user
  },

  uploadAvatar: async (uri: string, mimeType: string): Promise<User> => {
    const ext = mimeType.split('/')[1] ?? 'jpg'
    const formData = new FormData()
    formData.append('file', { uri, type: mimeType, name: `avatar.${ext}` } as unknown as Blob)
    const token = await getClerkToken()
    const res = await fetch(`${env.apiBaseUrl}/users/me/avatar`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    })
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
    const data = await res.json() as { user: User }
    return data.user
  },

  getUser: async (identifier: string): Promise<PublicUser> => {
    const res = await apiClient.get<{ user: PublicUser }>(`/users/${identifier}`)
    return res.data.user
  },

  search: async (q: string): Promise<PublicUser[]> => {
    const res = await apiClient.get<{ users: PublicUser[] }>('/users/search', { params: { q } })
    return res.data.users
  },

  follow: async (handle: string): Promise<void> => {
    await apiClient.post(`/users/${handle}/follow`)
  },

  unfollow: async (handle: string): Promise<void> => {
    await apiClient.delete(`/users/${handle}/follow`)
  },

  // Block / unblock (bidirectional hiding; block also drops mutual follows).
  block: async (handle: string): Promise<void> => {
    await apiClient.post(`/users/${handle}/block`)
  },

  unblock: async (handle: string): Promise<void> => {
    await apiClient.delete(`/users/${handle}/block`)
  },

  // The users the current user has blocked (Settings management list).
  getBlocks: async (): Promise<BlockedUser[]> => {
    const res = await apiClient.get<{ blocks: BlockedUser[] }>('/users/me/blocks')
    return res.data.blocks
  },

  // The users currently subscribed to me (active/past_due), most-recent first.
  getSubscribers: async (): Promise<Array<{ id: string; handle: string; displayName: string; avatarUrl: string | null }>> => {
    const res = await apiClient.get<{ subscribers: Array<{ id: string; handle: string; displayName: string; avatarUrl: string | null }> }>('/users/me/subscribers')
    return res.data.subscribers
  },

  // Tip a creator from their profile (or a clip). Creator-only + self-tip are
  // enforced server-side. Returns the tipper's new Space Bucks balance.
  tip: async (
    handle: string,
    body: { amount: number; message?: string; clipId?: string; idempotencyKey?: string },
  ): Promise<{ newBalance: number; spaceBucksPerDollar: number }> => {
    const res = await apiClient.post<{ newBalance: number; spaceBucksPerDollar: number }>(
      `/users/${handle}/tip`,
      body,
    )
    return res.data
  },

  registerPushToken: async (data: {
    token: string
    platform: 'ios' | 'android'
    timezone?: string
    lat?: number
    lng?: number
  }): Promise<void> => {
    await apiClient.post('/users/me/push-subscription', data)
  },

  unregisterPushToken: async (token: string): Promise<void> => {
    await apiClient.delete('/users/me/push-subscription', { data: { token } })
  },

  getWallet: async (): Promise<WalletData> => {
    const res = await apiClient.get<WalletData>('/users/me/wallet')
    return res.data
  },

  requestCashout: async (amount: number): Promise<{ request: CashoutRequest }> => {
    const res = await apiClient.post<{ request: CashoutRequest }>('/users/me/cashout', { amount })
    return res.data
  },

  getCashoutRequests: async (): Promise<CashoutRequest[]> => {
    const res = await apiClient.get<{ requests: CashoutRequest[] }>('/users/me/cashout-requests')
    return res.data.requests
  },

  topUpSpaceBucks: async (amount: number, priceCents: number): Promise<{ spaceBucks: number }> => {
    const res = await apiClient.post<{ spaceBucks: number }>('/users/me/space-bucks/top-up', { amount, priceCents })
    return res.data
  },

  saveCreatorOnboarding: async (data: {
    dateOfBirth?: string
    complete?: boolean
  }): Promise<User> => {
    const res = await apiClient.patch<{ user: User }>('/users/me/creator-onboarding', data)
    return res.data.user
  },

  updateNotificationPreferences: async (
    prefs: Partial<NotificationPreferences>,
  ): Promise<NotificationPreferences> => {
    const res = await apiClient.patch<{
      preferences: NotificationPreferences
    }>('/users/me/notification-preferences', prefs)
    return res.data.preferences
  },

  getSubscriptionStatus: async (
    handle: string,
  ): Promise<{ subscribed: boolean; currentPeriodEnd: string | null; pastDue?: boolean }> => {
    const res = await apiClient.get<{ subscribed: boolean; currentPeriodEnd: string | null; pastDue?: boolean }>(
      `/users/${handle}/subscription-status`,
    )
    return res.data
  },

  // Mint a short-lived billing handoff token + the branded /billing URL. The app
  // opens webUrl in the browser so a past-due subscriber can update their card with
  // no web login (same rail as createSubscribeSession). Stripe rails only — IAP
  // past-due is fixed in the App Store / Play, not here.
  createBillingSession: async (): Promise<{ token: string; webUrl: string }> => {
    const res = await apiClient.post<{ token: string; webUrl: string }>('/users/me/billing/session')
    return res.data
  },

  // `webUrl` is the branded wrld.cam/subscribe page (carries the session token so the
  // subscriber pays there with no web login); `url` is the legacy Stripe-hosted-checkout
  // redirect, kept as a fallback for older backends that don't return webUrl yet.
  createSubscribeSession: async (
    handle: string,
  ): Promise<{ url: string; webUrl?: string; sessionId?: string }> => {
    const res = await apiClient.post<{ url: string; webUrl?: string; sessionId?: string }>(
      `/users/${handle}/subscribe-session`,
    )
    return res.data
  },

  cancelSubscription: async (handle: string): Promise<void> => {
    await apiClient.delete(`/users/${handle}/subscribe`)
  },

  getSubscriptionSettings: async (): Promise<{
    subscriptionEnabled: boolean
    subscriptionTier: number | null
    subscriptionPriceUsd: number | null
    onboardingComplete: boolean
    stripeConnectId: string | null
    subscriberCount: number
    estimatedMrrCents: number
  }> => {
    const res = await apiClient.get<{
      subscriptionEnabled: boolean
      subscriptionTier: number | null
      subscriptionPriceUsd: number | null
      onboardingComplete: boolean
      stripeConnectId: string | null
      subscriberCount: number
      estimatedMrrCents: number
    }>('/users/me/subscription/settings')
    return res.data
  },

  startSubscriptionOnboard: async (): Promise<{ url: string }> => {
    const res = await apiClient.post<{ url: string }>('/users/me/subscription/onboard')
    return res.data
  },

  // Fixed-tier model: the creator picks a tier (1..N from the shared ladder), not an
  // arbitrary price. The backend derives the price from the tier and only accepts
  // subscriptionTier / subscriptionEnabled (an arbitrary subscriptionPriceUsd is
  // ignored). Keep this in lockstep with the backend PATCH schema.
  updateSubscriptionSettings: async (settings: {
    subscriptionTier?: number
    subscriptionEnabled?: boolean
  }): Promise<void> => {
    await apiClient.patch('/users/me/subscription/settings', settings)
  },

  getSubscriptionDashboardUrl: async (): Promise<{ url: string }> => {
    const res = await apiClient.get<{ url: string }>('/users/me/subscription/dashboard')
    return res.data
  },
}
