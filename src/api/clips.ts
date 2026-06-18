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

// One public/gated buffer session alive at a scrubbed instant — a globe pin in
// playback mode (PB1). Additive alongside ClipPin; only present when the backend's
// PUBLIC_BUFFER_ENABLED flag is on. `accessTier` drives the locked-pin treatment;
// owner-private sessions are never returned. Open via the buffer-session viewer
// (`/clip/[id]?source=buffer`).
export type BufferPin = {
  source: 'buffer'
  sessionId: string
  title: string | null
  lat: number
  lng: number
  locationPrecision: 'exact' | 'city' | 'country'
  sessionStartMs: number
  sessionEndMs: number
  seekOffsetSec: number
  accessTier: 'public' | 'subscriber' | 'ppv'
  subscriptionPriceUsd?: number | null
  ppvEventId?: string | null
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
  // Surviving public content alive at the given instant — the Time Machine pin feed.
  // `clips` = saved public clips (unchanged); `bufferPins` = public/gated rolling-buffer
  // sessions (PB1, additive — empty unless the backend's PUBLIC_BUFFER_ENABLED flag is on).
  discover: async (atISO: string): Promise<{ clips: ClipPin[]; bufferPins: BufferPin[] }> => {
    const res = await apiClient.get<{ clips: ClipPin[]; bufferPins?: BufferPin[] }>(
      '/clips/discover',
      { params: { at: atISO } },
    )
    return { clips: res.data.clips ?? [], bufferPins: res.data.bufferPins ?? [] }
  },

  // One clip for playback. 403s on a subscribers-only clip without a subscription.
  get: async (id: string): Promise<ClipDetail> => {
    const res = await apiClient.get<{ clip: ClipDetail }>(`/clips/${id}`)
    return res.data.clip
  },

  // PB1 — a public buffer session for playback (GET /buffer/session/:id, the clips/:id
  // analog). Normalised into ClipDetail so the viewer is source-agnostic. 403 when the
  // session is subscriber/ppv-gated and the caller lacks access; 404 when owner-private
  // / flag off / not found.
  getBufferSession: async (id: string): Promise<ClipDetail> => {
    const res = await apiClient.get<{
      session: {
        id: string
        title: string | null
        startAtMs: number
        endAtMs: number
        accessTier: 'public' | 'subscriber' | 'ppv'
        manifestUrl: string | null
        tracks: ClipTrack[]
        host: { id: string; handle: string; displayName: string; avatarUrl: string | null }
      }
    }>(`/buffer/session/${id}`)
    const s = res.data.session
    return {
      id: s.id,
      title: s.title,
      status: 'ready',
      manifestUrl: s.manifestUrl,
      thumbnailUrl: null,
      subscribersOnly: s.accessTier !== 'public',
      hostId: s.host.id,
      host: s.host,
      startAtMs: s.startAtMs,
      endAtMs: s.endAtMs,
      tracks: s.tracks,
    }
  },
}
