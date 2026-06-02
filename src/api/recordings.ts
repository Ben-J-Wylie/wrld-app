import { apiClient } from './client'
import type { Recording } from '@/types'

export const recordingsApi = {
  list: async (): Promise<Recording[]> => {
    const res = await apiClient.get<{ recordings: Recording[] }>('/recordings')
    return res.data.recordings
  },

  start: async (streamId: string): Promise<{ recordingId: string }> => {
    const res = await apiClient.post<{ recording: { id: string } }>('/recordings', { streamId })
    return { recordingId: res.data.recording.id }
  },

  stop: async (recordingId: string): Promise<void> => {
    await apiClient.post(`/recordings/${recordingId}/stop`)
  },
}
