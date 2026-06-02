import { apiClient } from './client'

export const recordingsApi = {
  start: async (streamId: string): Promise<{ recordingId: string }> => {
    const res = await apiClient.post<{ recording: { id: string } }>('/recordings', { streamId })
    return { recordingId: res.data.recording.id }
  },

  stop: async (recordingId: string): Promise<void> => {
    await apiClient.post(`/recordings/${recordingId}/stop`)
  },
}
