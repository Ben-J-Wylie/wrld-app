import { apiClient } from './client'
import type { PpvEvent } from '@/types'

export type CreatePpvEventData = {
  title: string
  description?: string
  scheduledAt: string      // ISO UTC
  timezone: string
  durationMinutes?: number
  priceUsd: number         // cents
  subscribersFreeAccess?: boolean
  maxCapacity?: number
  replayAccess?: boolean
}

export type UpdatePpvEventData = {
  title?: string
  description?: string | null
  durationMinutes?: number | null
  replayAccess?: boolean
  scheduledAt?: string
  subscribersFreeAccess?: boolean
  maxCapacity?: number | null
}

export type CreateEventResult = { event: PpvEvent; warning?: 'duration_unknown_overlap' }
export type EventOverlapError = { error: 'event_overlap'; conflictingEventId: string; conflictingEventTitle: string }

export const ppvApi = {
  createEvent: async (data: CreatePpvEventData): Promise<CreateEventResult> => {
    const res = await apiClient.post<CreateEventResult>('/ppv-events', data)
    return res.data
  },

  listMyScheduledEvents: async (): Promise<PpvEvent[]> => {
    const res = await apiClient.get<{ events: PpvEvent[] }>('/ppv-events', {
      params: { status: 'scheduled' },
    })
    return res.data.events
  },

  listMyEvents: async (status?: string): Promise<PpvEvent[]> => {
    const res = await apiClient.get<{ events: PpvEvent[] }>('/ppv-events', {
      params: status ? { status } : {},
    })
    return res.data.events
  },

  listAllEvents: async (): Promise<PpvEvent[]> => {
    const res = await apiClient.get<{ events: PpvEvent[] }>('/ppv-events/discover')
    return res.data.events
  },

  getMyEvent: async (id: string): Promise<PpvEvent> => {
    const res = await apiClient.get<{ event: PpvEvent }>(`/ppv-events/${id}`)
    return res.data.event
  },

  updateEvent: async (id: string, data: UpdatePpvEventData): Promise<{ event?: PpvEvent; warning?: 'duration_unknown_overlap'; ok?: boolean }> => {
    const res = await apiClient.patch<{ event?: PpvEvent; warning?: 'duration_unknown_overlap'; ok?: boolean }>(`/ppv-events/${id}`, data)
    return res.data
  },

  cancelEvent: async (id: string): Promise<{ refundCount: number }> => {
    const res = await apiClient.post<{ ok: boolean; refundCount: number }>(`/ppv-events/${id}/cancel`)
    return { refundCount: res.data.refundCount }
  },

  // End an event — marks it 'ended', clearing the PPV go-live gate so the host
  // can stream normally. Ends the live broadcast if one is running. No refunds
  // (ticket holders keep their access).
  endEvent: async (id: string): Promise<void> => {
    await apiClient.post(`/ppv-events/${id}/end`)
  },

  deleteEvent: async (id: string): Promise<void> => {
    await apiClient.delete(`/ppv-events/${id}`)
  },

  // Public: upcoming events for a creator profile
  getCreatorEvents: async (handle: string): Promise<PpvEvent[]> => {
    const res = await apiClient.get<{ events: PpvEvent[] }>(`/users/${handle}/ppv-events`)
    return res.data.events
  },

  // Viewer: create checkout session (returns { free, url })
  createAccessSession: async (eventId: string): Promise<{ free: boolean; url: string | null }> => {
    const res = await apiClient.post<{ free: boolean; url: string | null }>(
      `/ppv-events/${eventId}/access-session`,
    )
    return res.data
  },

  // Viewer: check access status
  getAccessStatus: async (eventId: string): Promise<{ hasAccess: boolean; free: boolean }> => {
    const res = await apiClient.get<{ hasAccess: boolean; free: boolean }>(
      `/ppv-events/${eventId}/access-status`,
    )
    return res.data
  },
}
