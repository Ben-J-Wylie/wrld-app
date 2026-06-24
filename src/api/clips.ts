import { apiClient } from './client'

// Public clip access — the Time Machine + clip-viewer surfaces. Distinct from
// `bufferApi` (the owner-gated rolling buffer + saved-clip management): these
// endpoints serve PUBLIC clips by id, to anyone.

// PB3.5 — a public time-interval (wall-clock ms) within a discover WINDOW. A pin's
// `intervals` are the spans where it's publicly discoverable (content span minus
// private DirectiveRanges minus `off`). The client shows the pin iff the playhead is
// inside one — interval membership resolved locally, no per-instant server sample.
export type Interval = { startMs: number; endMs: number }

// PB4 Lane B — one availability cell's payload (GET /clips/discover?planet&t&z&x&y).
// Discriminated by `mode`: 'pins' at high zoom (resolved locally by playhead ∈ interval),
// 'counts' at low zoom (a 60-entry per-minute alive-count series over the cell's hour).
export type AvailabilityCell =
  | { mode: 'pins'; planet: string; t: number; z: number; x: number; y: number; clips: ClipPin[]; bufferPins: BufferPin[] }
  | { mode: 'counts'; planet: string; t: number; z: number; x: number; y: number; bucketMs: number; counts: number[] }

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
  // PB3.5 (windowed feed only): public spans within the window. When present the client
  // resolves visibility locally (playhead ∈ interval); absent on the legacy `?at=` feed.
  intervals?: Interval[]
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
  // PB3.5 (windowed feed only): public spans within the window. A live session's open
  // interval ends at the window `to`; the client extends it to the live edge.
  intervals?: Interval[]
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
  // PB4 A4 — per-segment source enablement (buffer sessions only). Each window's `sources` is
  // backend-kind → on/off; the viewer hides a source over a window where it's toggled off.
  // Absent (saved clips) = no per-segment filtering (the `tracks` list already reflects enabled).
  sourceWindows?: { startAtMs: number; endAtMs: number; sources: Record<string, boolean> }[]
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

  // PB3.5 — the WINDOWED availability feed. Returns every public/gated pin with content in
  // [fromISO, toISO], each carrying its public `intervals` within the window. The client
  // holds this and resolves pin visibility locally as the playhead scrubs (no per-tick
  // query). Behind the AVAILABILITY_FEED flag until the backend ships it.
  discoverWindow: async (
    fromISO: string,
    toISO: string,
  ): Promise<{ clips: ClipPin[]; bufferPins: BufferPin[] }> => {
    const res = await apiClient.get<{ clips: ClipPin[]; bufferPins?: BufferPin[] }>(
      '/clips/discover',
      { params: { from: fromISO, to: toISO } },
    )
    return { clips: res.data.clips ?? [], bufferPins: res.data.bufferPins ?? [] }
  },

  // PB4 Lane B — ONE space-time availability cell `(planet,t,z,x,y)`. Cacheable
  // (Cache-Control max-age 30 + ETag). High zoom → `{mode:'pins', clips, bufferPins}`
  // (each with `intervals`, geo+time bounded to the cell); low zoom → `{mode:'counts',
  // bucketMs, counts}` (a per-minute alive-count series over the cell's hour — read
  // counts[floor((T − t·AVAILABILITY_TILE_MS)/bucketMs)]). The client holds the cells in
  // view × scrub-time and resolves locally; the push channel invalidates a cell on edit.
  discoverCell: async (
    planet: string,
    t: number,
    z: number,
    x: number,
    y: number,
  ): Promise<AvailabilityCell> => {
    const res = await apiClient.get<AvailabilityCell>('/clips/discover', {
      params: { planet, t, z, x, y },
    })
    return res.data
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
        sourceWindows?: { startAtMs: number; endAtMs: number; sources: Record<string, boolean> }[]
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
      sourceWindows: s.sourceWindows,
    }
  },
}
