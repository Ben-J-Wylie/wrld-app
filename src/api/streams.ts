import { apiClient } from './client'
import type { Stream } from '@/types'

/**
 * Phase 4 will flesh these out against the real backend.
 * Signatures roughed in here so feature code can compile against them.
 */

export const streamsApi = {
  list: async (): Promise<Stream[]> => {
    const res = await apiClient.get<{ streams: Stream[] }>('/streams')
    return res.data.streams
  },

  near: async (lat: number, lng: number, radiusKm = 50): Promise<Stream[]> => {
    const res = await apiClient.get<{ streams: Stream[] }>('/streams/near', {
      params: { lat, lng, radiusKm },
    })
    return res.data.streams
  },

  get: async (id: string): Promise<Stream> => {
    const res = await apiClient.get<{ stream: Stream }>(`/streams/${id}`)
    return res.data.stream
  },

  getByRoom: async (roomId: string): Promise<Stream> => {
    const res = await apiClient.get<{ stream: Stream }>(`/streams/room/${roomId}`)
    return res.data.stream
  },

  create: async (input: { title: string; lat: number; lng: number }): Promise<Stream> => {
    const res = await apiClient.post<Stream>('/streams', input)
    return res.data
  },

  heartbeat: async (id: string): Promise<void> => {
    await apiClient.post(`/streams/${id}/heartbeat`)
  },

  end: async (id: string): Promise<void> => {
    await apiClient.delete(`/streams/${id}`)
  },
}
