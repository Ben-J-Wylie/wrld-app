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

export type MutedUser = {
  id: string
  handle: string
  displayName: string
  avatarUrl: string | null
  scope: string
  mutedAt: string
}

// Context for the appeal surface. In token mode it comes from GET /appeal/context
// (the signed emailed link); in session mode the client derives it from the cached
// suspended user. Same shape either way so the screen renders identically.
export type AppealContext = {
  handle: string
  displayName: string | null
  suspended: boolean
  permanent: boolean
  suspendedUntil: string | null
  suspendedReason: string | null
  alreadyAppealed: boolean
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

  // ─── Account deletion (soft delete + grace-period reactivation) ───────────
  // DELETE schedules deletion (sets deletedAt; Clerk + PII survive until the
  // anonymise job runs after the grace period), so the user can still sign in and
  // reactivate during the window. Returns the scheduled anonymisation date.
  deleteAccount: async (): Promise<{ deletedAt: string; anonymizeAt: string }> => {
    const res = await apiClient.delete<{ ok: true; deletedAt: string; anonymizeAt: string }>('/users/me')
    return res.data
  },

  // Cancel a pending deletion within the grace period (clears deletedAt).
  reactivateAccount: async (): Promise<void> => {
    await apiClient.post('/users/me/reactivate')
  },

  // Active vs scheduled-for-deletion. /auth/me 403s a deleted account, so this is
  // how the app learns an account is in its grace period (to show the gate).
  accountStatus: async (): Promise<
    | { status: 'active' }
    | { status: 'pending_deletion'; deletedAt: string; anonymizeAt: string }
  > => {
    const res = await apiClient.get('/users/me/account-status')
    return res.data
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

  // Report a user (distinct from blocking) — raises a moderation case.
  report: async (handle: string, reason: string, detail?: string): Promise<string> => {
    const res = await apiClient.post<{ ok: boolean; reportId: string }>(`/users/${handle}/report`, {
      reason,
      detail,
    })
    return res.data.reportId
  },

  // Report a single chat message (keyed on the sender for the moderation queue).
  reportChatMessage: async (messageId: string, reason?: string, detail?: string): Promise<string> => {
    const res = await apiClient.post<{ ok: boolean; reportId: string }>(`/chat/${messageId}/report`, {
      reason,
      detail,
    })
    return res.data.reportId
  },

  // Appeal a suspension — surfaces to admins; never auto-actions anything.
  appeal: async (message: string): Promise<void> => {
    await apiClient.post('/users/me/appeal', { message })
  },

  // Token path (the emailed appeal link, deep-linked via wrld://appeal?t=…). No
  // session needed — the signed token identifies the appellant, so it works even
  // for a hard-banned account that can't otherwise reach the form.
  appealContext: async (token: string): Promise<AppealContext> => {
    const res = await apiClient.get<AppealContext>('/appeal/context', { params: { t: token } })
    return res.data
  },

  appealWithToken: async (token: string, message: string): Promise<void> => {
    await apiClient.post('/appeal', { t: token, message })
  },

  // The users the current user has blocked (Settings management list).
  getBlocks: async (): Promise<BlockedUser[]> => {
    const res = await apiClient.get<{ blocks: BlockedUser[] }>('/users/me/blocks')
    return res.data.blocks
  },

  // Mute / unmute a user. Soft, silent, one-directional: you stop seeing their
  // chat + reactions; they're unaffected and unaware (follows/tips/streams are
  // untouched). Filtering is client-side; these rows are the durable,
  // cross-device source the client syncs. See wrld-backend/docs/design/user-mute.md.
  mute: async (handle: string): Promise<void> => {
    await apiClient.post(`/users/${handle}/mute`)
  },

  unmute: async (handle: string): Promise<void> => {
    await apiClient.delete(`/users/${handle}/mute`)
  },

  // The users the current user has muted — the Settings list AND the mute set
  // the client filters live chat/reactions against (handle-keyed).
  getMutes: async (): Promise<MutedUser[]> => {
    const res = await apiClient.get<{ mutes: MutedUser[] }>('/users/me/mutes')
    return res.data.mutes
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
  ): Promise<{ subscribed: boolean; currentPeriodEnd: string | null; pastDue?: boolean; cancelAtPeriodEnd?: boolean }> => {
    const res = await apiClient.get<{
      subscribed: boolean
      currentPeriodEnd: string | null
      pastDue?: boolean
      cancelAtPeriodEnd?: boolean
    }>(`/users/${handle}/subscription-status`)
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

  // Undo a pending cancel before the period ends — the sub renews as normal.
  // Mirrors the platform-tier resume; only valid while still access-granting
  // (active/past_due) and flagged cancelAtPeriodEnd.
  resumeSubscription: async (handle: string): Promise<void> => {
    await apiClient.post(`/users/${handle}/subscribe/resume`)
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
