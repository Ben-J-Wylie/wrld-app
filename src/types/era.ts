// src/types/era.ts
//
// The unified-manifest client types — the one rules object (`Era`) over a `Recording`, matching
// the clean-cut backend (wrld-backend 4ddac43, CONTENT.md §5). ONE object type: the axes +
// access/rating + housekeeping are all VALUES on the Era, not sub-types. Supersedes the old
// SavedClip/ClipDetail/ClipPin/BufferSession/BufferTrack shapes.

export type Visibility = 'public' | 'private'
export type Identity = 'shown' | 'anon'
export type Precision = 'exact' | 'city' | 'country' | 'private'
export type Keep = 'kept' | 'reapable'
export type ContentRating = 'general' | 'adult'

// The per-era editable values (representation axes + access/rating). All concrete — no inherit/null
// (except title, which is genuinely nullable).
export type EraValues = {
  title: string | null
  tags: string[]
  visibility: Visibility
  identity: Identity
  precision: Precision
  sources: Record<string, boolean> // { [kind]: bool } — which captured sources this era exposes
  keep: Keep
  subscribersOnly: boolean
  ppvEventId: string | null
  contentRating: ContentRating
}

// A partial edit sent to PATCH /eras/:id (any subset of the values). "save" = { keep: 'kept' }.
export type EraPatch = Partial<EraValues>

// An Era row (owner timeline + the viewer's era block). `endAtMs` null = live (the open era).
export type Era = EraValues & {
  id: string
  recordingId: string
  startAtMs: number
  endAtMs: number | null
  thumbnailUrl: string | null
  viewCount?: number
}

export type Host = { id: string; handle: string; displayName: string; avatarUrl: string | null }
export type Interval = { startMs: number; endMs: number }

// ── GET /me/recordings — the owner timeline (Recording + its Eras + survivingRegions) ──
export type MyRecording = {
  id: string
  startedAt: string // ISO
  endedAt: string | null // ISO; null = live
  lat: number | null
  lng: number | null
  kinds: string[]
  survivingRegions: Interval[] // contiguous on-disk footage regions (eviction gaps = holes between)
  eras: Era[]
}

// ── GET /discover?planet&t&z&x&y — the one globe feed (live + time machine) ──
export type DiscoverPin = {
  eraId: string
  recordingId: string
  startAtMs: number
  endAtMs: number | null
  lat: number // DISPLAY coords (obfuscated to match precision)
  lng: number
  title: string | null
  precision: Precision
  identity: Identity
  sources: Record<string, boolean>
  intervals: Interval[] // surviving-footage spans within the pin (evicted excluded)
  host: Host | null // null when identity=anon
  access: { subscribersOnly: boolean; ppvEventId: string | null }
}
export type DiscoverResult = { planet: string; t: number; z: number; x: number; y: number; count: number; pins: DiscoverPin[] }

// ── GET /eras/:id — the viewer (era + recording + per-source footage URLs) ──
export type EraSourceUrl = { kind: string; manifestUrl: string | null; dataUrl: string | null }
export type EraDetail = {
  era: Era & { viewCount: number }
  recording: { id: string; kinds: string[]; startedAt: string; endedAt: string | null; lat: number | null; lng: number | null }
  host: Host | null
  sources: EraSourceUrl[] // included (not source:false) kinds → tokenized HLS / .jsonl URLs
  thumbnailUrl: string
}
