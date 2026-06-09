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
}
