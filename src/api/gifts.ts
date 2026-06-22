import { apiClient } from './client'
import type { GiftCatalogItem } from '@/types'

export const giftsApi = {
  // The 5 gift types with their live Space Bucks values. Server is the source of
  // truth for value — the client renders the rail from this and never sends an
  // amount when gifting (it sends only the gift id via mediasoup signaling).
  catalog: async (): Promise<GiftCatalogItem[]> => {
    const res = await apiClient.get<{ gifts: GiftCatalogItem[] }>('/gifts/catalog')
    return res.data.gifts
  },

  // Offline gift (creator profile / clip) — the gift equivalent of usersApi.tip.
  // Creator-only + self-gift enforced server-side. The client sends only the
  // gift id; the value is resolved server-side. Returns the sender's new balance.
  send: async (
    handle: string,
    body: { giftType: string; clipId?: string; idempotencyKey?: string },
  ): Promise<{ newBalance: number; emoji: string; amount: number; spaceBucksPerDollar: number }> => {
    const res = await apiClient.post<{ newBalance: number; emoji: string; amount: number; spaceBucksPerDollar: number }>(
      `/users/${handle}/gift`,
      body,
    )
    return res.data
  },
}
