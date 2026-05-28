import { apiClient } from './client'
import { getClerkToken } from '@/lib/clerkToken'
import { env } from '@/lib/env'
import type { User, PublicUser, WalletData, CashoutRequest } from '@/types'

export const usersApi = {
  getMe: async (): Promise<User> => {
    const res = await apiClient.get<{ user: User }>('/auth/me')
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

  topUpSpaceBucks: async (): Promise<{ spaceBucks: number }> => {
    const res = await apiClient.post<{ spaceBucks: number }>('/users/me/space-bucks/top-up')
    return res.data
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
}
