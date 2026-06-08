import { apiClient } from './client'
import { getClerkToken } from '@/lib/clerkToken'
import { env } from '@/lib/env'
import { applyRemoteCaptureLadder, type CaptureLadder } from '@/lib/tierCaps'
import type { User, PublicUser, WalletData, CashoutRequest } from '@/types'

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

  updateNotificationPreferences: async (prefs: {
    notifyOnFollowedLive?: boolean
    notifyOnNearbyLive?: boolean
  }): Promise<{ notifyOnFollowedLive: boolean; notifyOnNearbyLive: boolean }> => {
    const res = await apiClient.patch<{
      preferences: { notifyOnFollowedLive: boolean; notifyOnNearbyLive: boolean }
    }>('/users/me/notification-preferences', prefs)
    return res.data.preferences
  },

  getSubscriptionStatus: async (handle: string): Promise<{ subscribed: boolean; currentPeriodEnd: string | null }> => {
    const res = await apiClient.get<{ subscribed: boolean; currentPeriodEnd: string | null }>(
      `/users/${handle}/subscription-status`,
    )
    return res.data
  },

  createSubscribeSession: async (handle: string): Promise<{ url: string }> => {
    const res = await apiClient.post<{ url: string }>(`/users/${handle}/subscribe-session`)
    return res.data
  },

  cancelSubscription: async (handle: string): Promise<void> => {
    await apiClient.delete(`/users/${handle}/subscribe`)
  },

  getSubscriptionSettings: async (): Promise<{
    subscriptionEnabled: boolean
    subscriptionPriceUsd: number | null
    onboardingComplete: boolean
    stripeConnectId: string | null
    subscriberCount: number
    estimatedMrrUsd: number
  }> => {
    const res = await apiClient.get<{
      subscriptionEnabled: boolean
      subscriptionPriceUsd: number | null
      onboardingComplete: boolean
      stripeConnectId: string | null
      subscriberCount: number
      estimatedMrrUsd: number
    }>('/users/me/subscription/settings')
    return res.data
  },

  startSubscriptionOnboard: async (): Promise<{ url: string }> => {
    const res = await apiClient.post<{ url: string }>('/users/me/subscription/onboard')
    return res.data
  },

  updateSubscriptionSettings: async (settings: {
    subscriptionPriceUsd?: number
    subscriptionEnabled?: boolean
  }): Promise<void> => {
    await apiClient.patch('/users/me/subscription/settings', settings)
  },

  getSubscriptionDashboardUrl: async (): Promise<{ url: string }> => {
    const res = await apiClient.get<{ url: string }>('/users/me/subscription/dashboard')
    return res.data
  },
}
