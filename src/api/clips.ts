import { apiClient } from './client'

// Public clip access — the Time Machine + clip-viewer surfaces. Distinct from
// `bufferApi` (the owner-gated rolling buffer + saved-clip management): these
// endpoints serve PUBLIC clips by id, to anyone.

// One surviving clip alive at a scrubbed instant — a globe pin in playback mode.
// Returned by GET /clips/discover?at=<ISO>. The backend honours the clip's CURRENT
// precision + identity (reversible — decision A): an anon clip reports host
// 'anonymous'; an 'off'-precision clip is excluded entirely.
export type ClipPin = {
  id: string
  recordingId: string | null // null for buffer-promoted clips (open via `id`)
  title: string | null
  lat: number
  lng: number
  locationPrecision: 'exact' | 'city' | 'country'
  // Where to seek the clip to land on the playhead instant: T − clipStart, clamped
  // to [0, clip length]. Always valid because a pin only exists when start ≤ T ≤ end.
  seekOffsetSec: number
  clipStartMs: number
  clipEndMs: number
  subscribersOnly: boolean
  host: { id: string; handle: string; displayName: string; avatarUrl: string | null }
}

// One captured/included source track on a clip (durable public /media/clips URLs).
// `manifestUrl` for media kinds (camera/audio/screen); `dataUrl` (NDJSON) for data
// kinds (location/gyro/compass/accel/speed/torch/chat/audiolevel).
export type ClipTrack = {
  kind: string
  manifestUrl: string | null
  dataUrl: string | null
}

// The full clip row for the viewer (GET /clips/:id). `manifestUrl` is the primary
// playable HLS track (camera, else audio); null for a clip with no playable media.
// `startAtMs`/`endAtMs` are the clip's absolute wall-clock window (the broadcast
// clock + data-track sampling read it); `tracks` drives the switchable source rail.
export type ClipDetail = {
  id: string
  title: string | null
  status: string
  manifestUrl: string | null
  thumbnailUrl: string | null
  subscribersOnly: boolean
  hostId: string
  host: { id: string; handle: string; displayName: string; avatarUrl: string | null }
  startAtMs: number | null
  endAtMs: number | null
  tracks: ClipTrack[]
}

export const clipsApi = {
  // Surviving public clips alive at the given instant — the Time Machine pin feed.
  discover: async (atISO: string): Promise<ClipPin[]> => {
    const res = await apiClient.get<{ clips: ClipPin[] }>('/clips/discover', {
      params: { at: atISO },
    })
    return res.data.clips
  },

  // One clip for playback. 403s on a subscribers-only clip without a subscription.
  get: async (id: string): Promise<ClipDetail> => {
    const res = await apiClient.get<{ clip: ClipDetail }>(`/clips/${id}`)
    return res.data.clip
  },
}
