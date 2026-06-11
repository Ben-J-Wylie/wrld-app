import { apiClient } from './client'

// The owner's rolling buffer, served owner-gated by the backend (R5 substrate).
// Each session is one go-live span; the time between sessions is a real-time gap
// the editor collapses. URLs are short-lived tokenized (buffer is NOT on the
// public /media path).
export type BufferTrackKind = 'camera' | 'audio' | 'screen' | 'location' | 'gyro' | 'compass'

export type BufferSession = {
  id: string
  // The stream's title at go-live, carried onto the session so the Clips grid can
  // label footage by title rather than its start time. Backend populates it (handoff
  // 2026-06-11); the grid falls back to the start time when absent.
  title?: string | null
  startedAt: string          // ISO
  endedAt: string | null     // ISO, null while still live
  durationSec: number
  // Time model (option b): the footage block occupies
  // [startedAt + mediaStartOffsetMs, + mediaDurationSec]; anything outside is a gap
  // (encoder warm-up at the head, the live HLS latency at the tail). `mediaDurationSec`
  // is the REAL flushed media (not wall-clock), updated live for the open session.
  // Optional for back-compat with an older backend (fall back to durationSec / 0).
  mediaDurationSec?: number
  mediaStartOffsetMs?: number
  kinds: BufferTrackKind[]
  playableKind: BufferTrackKind | null
  manifestUrl: string | null // tokenized HLS (unused by the thumbnail field, kept for later)
  thumbnailUrl: string | null // tokenized poster frame (camera sessions only)
  // Server-generated scrub filmstrip: lightweight per-interval frames shown while
  // dragging (and as the timeline strip) instead of seeking the HLS video. Build a
  // frame URL as `${baseUrl}/${idx}.jpg?t=${token}` where idx (1-based) =
  // floor(mediaSec / intervalSec) + 1, clamped to [1, frameCount]. Null when the
  // session has no playable frames (audio-only / empty). Fetched per on-screen window.
  filmstrip?: {
    intervalSec: number
    frameCount: number
    baseUrl: string
    token: string
  } | null
}

// One codec-uniform run of the camera buffer: a contiguous group of sessions
// that share a decoder config (init/SPS), served as a single HLS VOD with one
// EXT-X-MAP. Playing per-group (and swapping at boundaries) avoids the native
// AVPlayer/ExoPlayer wedge that a single mixed-codec stitch causes after a seek
// (backend item 5 — "resource unavailable"). `startSec` is the group's offset
// into the whole (gaps-collapsed) camera media timeline.
export type BufferGroup = {
  groupIndex: number
  startSec: number
  durationSec: number
  sessionCount: number
  manifestUrl: string  // tokenized HLS VOD for this group only (…?g=<groupIndex>)
}

export type BufferDescriptor = {
  earliestAt: string | null
  latestAt: string
  windowHours: number
  // Whole camera buffer concatenated into one VOD HLS playlist (all sessions
  // back-to-back, real-time gaps collapsed). LEGACY: can wedge native players
  // when sessions differ in codec config — prefer `allGroups`. Kept for
  // back-compat / fallback.
  allManifestUrl: string | null
  // Codec-uniform groups of the camera buffer (the AVPlayer-safe way to play
  // the whole buffer). Empty when there's no camera footage. Older backends
  // that predate the guard omit this — callers fall back to `allManifestUrl`.
  allGroups?: BufferGroup[]
  sessions: BufferSession[]  // chronological (oldest → newest)
}

export const bufferApi = {
  getMine: async (): Promise<BufferDescriptor> => {
    const res = await apiClient.get<BufferDescriptor>('/buffer/me')
    return res.data
  },

  // Promote a wall-clock span of the whole-buffer timeline into a durable saved
  // clip (R3 promote-on-publish, CROSS-SESSION). The span may cross buffer
  // sessions (a camera flip / portrait↔landscape rotation starts a new session);
  // the backend resolves the covered sessions and copies (uniform) or transcodes
  // (mixed orientation) the in-window footage. `startAtMs`/`endAtMs` are universal
  // wall-clock ms — the ClipEditScreen bracket is already in that space.
  saveClip: async (input: {
    startAtMs: number
    endAtMs: number
    name: string
    kinds: string[]
  }): Promise<{ clipId: string }> => {
    const res = await apiClient.post<{ clip: { id: string } }>('/buffer/me/clips', input)
    return { clipId: res.data.clip.id }
  },
}
