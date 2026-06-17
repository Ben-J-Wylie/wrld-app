import { apiClient } from './client'

// The owner's rolling buffer, served owner-gated by the backend (R5 substrate).
// Each session is one go-live span; the time between sessions is a real-time gap
// the editor collapses. URLs are short-lived tokenized (buffer is NOT on the
// public /media path).
export type BufferTrackKind =
  | 'camera'
  | 'audio'
  | 'screen'
  | 'location'
  | 'gyro'
  | 'compass'
  | 'accel'
  | 'speed'
  | 'torch'
  | 'chat'
  // A companion DATA track of the audio source (not a source kind itself): the broadcaster's
  // audioLevel (0..1) sampled ~10 Hz, recorded so a clip's audio WAVEFORM can replay/scrub at the
  // playhead (SP6a item 4, Aaron). Lives on `dataUrls.audiolevel`; the audio source view reads it.
  | 'audiolevel'

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
  // Per-data-source tokenized `.jsonl` URL (C6): location/gyro/compass/accel/speed/
  // torch/chat. The editor fetches the viewed data track for the session under the
  // playhead and replays it through the design renderers. Absent for media-only sessions.
  dataUrls?: Partial<Record<BufferTrackKind, string>>
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
  // The server's wall-clock (epoch ms) when this response was built. The Clips timeline runs its
  // "now" clock in the SERVER domain — `nowUI = Date.now() + (serverNowMs − Date.now())`, slewed per
  // fetch — so the reaper/now edges align with the server-clock-anchored clip geometry (no device skew).
  // Optional for back-compat with an older backend (the app falls back to the device clock).
  serverNowMs?: number
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

  // C5 — the SAVED-clip pool (durable Clip rows) that backs the Clips-grid saved
  // lane. Separate from the rolling buffer; survives eviction. Only `status:'ready'`
  // clips are returned, so a just-saved clip appears once processing finishes.
  listSavedClips: async (): Promise<SavedClip[]> => {
    const res = await apiClient.get<{ clips: SavedClip[] }>('/buffer/me/clips')
    return res.data.clips
  },

  // C5 — un-save: delete the durable copy + reclaim the saved-clip quota. The
  // rolling buffer is untouched, so the clip's footage stays in the buffer lane.
  deleteSavedClip: async (id: string): Promise<void> => {
    await apiClient.delete(`/buffer/me/clips/${id}`)
  },

  // ── C4: editable-manifest (draft ↔ saved) ──
  // List a lane: 'saved' (default), 'draft' (buffered-lane drafts), or 'all'.
  listClips: async (lane: ClipLane = 'saved'): Promise<SavedClip[]> => {
    const res = await apiClient.get<{ clips: SavedClip[] }>(`/buffer/me/clips?lane=${lane}`)
    return res.data.clips
  },

  // Create a DRAFT over a buffer window (no copy, no quota). Returns the clip id.
  createDraft: async (input: { startAtMs: number; endAtMs: number; name?: string }): Promise<{ clipId: string }> => {
    const res = await apiClient.post<{ clip: { id: string } }>('/buffer/me/clips/draft', input)
    return { clipId: res.data.clip.id }
  },

  // Edit a draft's manifest (ranges / sources / overrides). Works for drafts;
  // saved-clip edits are also supported (C4.4).
  patchClip: async (id: string, patch: ClipPatch): Promise<void> => {
    await apiClient.patch(`/buffer/me/clips/${id}`, patch)
  },

  // Promote a draft → saved (materialise its enabled ranges). NO body — Fastify
  // rejects an empty JSON body, so `post(url)` with no data is intentional.
  saveDraft: async (id: string): Promise<{ clipId: string }> => {
    const res = await apiClient.post<{ clip: { id: string } }>(`/buffer/me/clips/${id}/save`)
    return { clipId: res.data.clip.id }
  },
}

// One contiguous in-window slice of a buffer session — the manifest body (C4).
export type ClipRange = { bufferSessionId: string; startAtMs: number; endAtMs: number; ordinal: number }

// A clip (C4 manifest). The same row lives in two states via `saved`:
//   draft (saved:false) — a manifest over the buffer, no copy, private, editable;
//   saved (saved:true)  — its in-bounds footage materialised to durable storage.
// `kinds` is the ENABLED sources only; `sources` is the full per-kind enabled map.
export type SavedClip = {
  id: string
  name: string
  startAtMs: number
  endAtMs: number
  thumbnailUrl: string | null
  manifestUrl: string | null // playable HLS — durable when saved, buffer-stitched when draft
  bufferSessionId: string | null // the source buffer session (exact "one lane" link)
  kinds: BufferTrackKind[]
  saved: boolean
  ranges: ClipRange[]
  sources: Record<string, boolean>
  attributed: boolean
  locDisplayPrecision: string | null
}

export type ClipLane = 'saved' | 'draft' | 'all'

// The editable-manifest PATCH (C4) — every field optional; the server replaces the
// manifest (ranges are the authoritative full list) and recomputes outer bounds.
export type ClipPatch = {
  ranges?: { bufferSessionId: string; startAtMs: number; endAtMs: number }[]
  sources?: Record<string, boolean>
  attributed?: boolean
  locDisplayPrecision?: string | null
  title?: string
  visibility?: 'public' | 'anon' | 'draft'
}
