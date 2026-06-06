import { apiClient } from './client'

// The owner's rolling buffer, served owner-gated by the backend (R5 substrate).
// Each session is one go-live span; the time between sessions is a real-time gap
// the editor collapses. URLs are short-lived tokenized (buffer is NOT on the
// public /media path).
export type BufferTrackKind = 'camera' | 'audio' | 'screen' | 'location' | 'gyro' | 'compass'

export type BufferSession = {
  id: string
  startedAt: string          // ISO
  endedAt: string | null     // ISO, null while still live
  durationSec: number
  kinds: BufferTrackKind[]
  playableKind: BufferTrackKind | null
  manifestUrl: string | null // tokenized HLS (unused by the thumbnail field, kept for later)
  thumbnailUrl: string | null // tokenized poster frame (camera sessions only)
}

export type BufferDescriptor = {
  earliestAt: string | null
  latestAt: string
  windowHours: number
  // Whole camera buffer concatenated into one VOD HLS playlist (all sessions
  // back-to-back, real-time gaps collapsed) so the field scrubs continuously.
  allManifestUrl: string | null
  sessions: BufferSession[]  // chronological (oldest → newest)
}

export const bufferApi = {
  getMine: async (): Promise<BufferDescriptor> => {
    const res = await apiClient.get<BufferDescriptor>('/buffer/me')
    return res.data
  },

  // Promote a span of one buffer session into a durable saved clip (R3
  // promote-on-publish). Backend returns 501 until R3 lands.
  saveClip: async (input: {
    sessionId: string
    startSec: number
    endSec: number
    name: string
    kinds: string[]
  }): Promise<{ clipId: string }> => {
    const res = await apiClient.post<{ clip: { id: string } }>('/buffer/me/clips', input)
    return { clipId: res.data.clip.id }
  },
}
