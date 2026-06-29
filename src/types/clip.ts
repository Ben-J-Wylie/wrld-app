// src/types/clip.ts
//
// CU4 prep (the canonical clip type) — the ONE shape every clip surface is a projection of.
// Today a clip wears five different faces with overlapping-but-divergent fields:
//   ClipPin / BufferPin (globe discovery) · ClipDetail (viewer) · SavedClip (library/profile)
//   · LaneClip (clips-grid timeline, internal to ClipsScreen)
// CU4 collapses the backend to one `Clip = range + axes over Track`; this is the app-side target
// it resolves to. SLICE 1 (this file): the canonical types + the editable↔resolved vocab bridge +
// adapters that COMPILE-PROVE each surface type is a faithful projection (if a surface couldn't
// map, tsc would fail here). No surface's runtime is rewired yet — that's the incremental slices
// that follow, one surface at a time with a device check. Until then this file is the contract +
// the proof, and new code should read/return `CanonicalClip` rather than a surface-specific shape.
//
// Vocab note: this uses the §5 / backend `ResolvedAxes` vocabulary (`identity: shown|anon`,
// `precision: …|private`, `keep`), NOT the legacy app `SegSettings` vocab (`attributed`, `off`,
// no keep). The bridge below is the single translation point; CU4's rename deletes the divergence.

import type { ClipPin, BufferPin, ClipDetail } from '@/api/clips'
import type { SavedClip } from '@/api/buffer'
import type { LaneClip } from '@/components/features/clip/ClipLane'
import type { SegSettings } from '@/lib/segmentSettings'

export type ClipSource = 'clip' | 'buffer'

export type ClipHost = {
  id: string
  handle: string
  displayName: string
  avatarUrl: string | null
}

// The access/monetization projection — "who may watch," NOT a clip content axis (decision
// 2026-06-26, Aaron-confirmed). Sibling to `axes`, populated only by discovery projections; absent
// on library/viewer ones. Derived from the gate + host-subscription/PpvEvent joins server-side.
export type ClipAccess = {
  tier: 'public' | 'subscriber' | 'ppv'
  subscriptionPriceUsd?: number | null
  ppvEventId?: string | null
}

// The 7 orthogonal axes, RESOLVED (the §5 north-star vocab; mirrors the backend `ResolvedAxes`).
// `sources` is backend-kind keyed (camera/audio/location/…); `keep` is the retention/lane axis.
export type ResolvedAxes = {
  title: string | null
  tags: string[]
  visibility: 'public' | 'private'
  identity: 'shown' | 'anon'
  precision: 'exact' | 'city' | 'country' | 'private'
  sources: Record<string, boolean>
  keep: 'kept' | 'reapable'
}

// The one clip shape. A clip IS a range (`startAtMs`–`endAtMs`) + the 7 resolved axes, over its
// source footage. `host` is null for the owner's own library item (no separate host carried).
// `lat`/`lng` are present on discovery projections, null on viewer/library ones. A surface adapter
// fills what its source carries and defaults the rest (documented per-adapter).
export type CanonicalClip = {
  id: string
  source: ClipSource
  startAtMs: number
  endAtMs: number
  host: ClipHost | null
  axes: ResolvedAxes
  // Access/monetization — present on discovery projections, absent on library/viewer ones.
  access?: ClipAccess
  lat: number | null
  lng: number | null
  subscribersOnly: boolean
  manifestUrl: string | null
}

// ── editable ↔ resolved vocab bridge (the single translation point) ──────────────────────────
// `SegSettings` (the drawer's editable shape) uses the legacy vocab; `ResolvedAxes` uses §5's.
// Precision: editable 'off' ⇄ resolved 'private'. Identity: editable 'attributed' ⇄ resolved 'shown'.

export function precisionToResolved(p: SegSettings['precision'] | null | undefined): ResolvedAxes['precision'] {
  switch (p) {
    case 'city':
    case 'country':
      return p
    case 'off':
      return 'private'
    default:
      return 'exact'
  }
}
export function precisionToEditable(p: ResolvedAxes['precision']): NonNullable<SegSettings['precision']> {
  return p === 'private' ? 'off' : p
}
export function identityToResolved(i: SegSettings['identity'] | null | undefined): ResolvedAxes['identity'] {
  return i === 'anon' ? 'anon' : 'shown'
}
export function identityToEditable(i: ResolvedAxes['identity']): NonNullable<SegSettings['identity']> {
  return i === 'anon' ? 'anon' : 'attributed'
}

// Project a partial editable patch (the drawer) onto resolved axes (caller owns `sources` keying).
export function editableToResolvedAxes(s: SegSettings): Partial<ResolvedAxes> {
  const out: Partial<ResolvedAxes> = {}
  if (s.title !== undefined) out.title = s.title ?? null
  if (s.tags !== undefined) out.tags = s.tags
  if (s.visibility !== undefined) out.visibility = s.visibility
  if (s.identity !== undefined) out.identity = identityToResolved(s.identity)
  if (s.precision !== undefined) out.precision = precisionToResolved(s.precision)
  if (s.sources !== undefined) out.sources = s.sources
  return out
}

// ── surface adapters — each PROVES its type is a faithful projection of CanonicalClip ──────────
// (compile-time: the returned object must be a complete CanonicalClip from the surface's fields.)

const anonHost = (h: ClipHost): boolean => h.id === '' || h.handle === 'anonymous'

// Discovery pin → canonical. Axes the pin carries: title, precision, identity (from host). It's on
// a public discovery feed → visibility 'public', and it survived → keep 'kept'; tags/sources unknown.
export function fromClipPin(c: ClipPin): CanonicalClip {
  return {
    id: c.id,
    source: 'clip',
    startAtMs: c.clipStartMs,
    endAtMs: c.clipEndMs,
    host: c.host,
    axes: {
      title: c.title,
      tags: [],
      visibility: 'public',
      identity: anonHost(c.host) ? 'anon' : 'shown',
      precision: c.locationPrecision,
      sources: {},
      keep: 'kept',
    },
    // ClipPin carries the gate but no price/ppv → derive tier from it.
    access: { tier: c.subscribersOnly ? 'subscriber' : 'public' },
    lat: c.lat,
    lng: c.lng,
    subscribersOnly: c.subscribersOnly,
    manifestUrl: null,
  }
}

export function fromBufferPin(b: BufferPin): CanonicalClip {
  return {
    id: b.sessionId,
    source: 'buffer',
    startAtMs: b.sessionStartMs,
    endAtMs: b.sessionEndMs,
    host: b.host,
    axes: {
      title: b.title,
      tags: [],
      visibility: 'public',
      identity: anonHost(b.host) ? 'anon' : 'shown',
      precision: b.locationPrecision,
      sources: {},
      keep: 'kept',
    },
    access: {
      tier: b.accessTier,
      subscriptionPriceUsd: b.subscriptionPriceUsd ?? null,
      ppvEventId: b.ppvEventId ?? null,
    },
    lat: b.lat,
    lng: b.lng,
    subscribersOnly: b.accessTier !== 'public',
    manifestUrl: null,
  }
}

// Viewer detail → canonical. Carries title/identity/media but no precision/tags/keep (the viewer
// renders none) → defaulted. `source` is 'buffer' when there's no /media manifest copy (PB2
// retain-in-place serves from the buffer) — best-effort; the viewer already knows its own source.
export function fromClipDetail(c: ClipDetail): CanonicalClip {
  return {
    id: c.id,
    source: 'clip',
    startAtMs: c.startAtMs ?? 0,
    endAtMs: c.endAtMs ?? 0,
    host: c.host,
    // CU4-c — canonical §5 axes (cd77ea9); fall back to the prior defaults when a field is absent.
    axes: {
      title: c.title,
      tags: c.tags ?? [],
      visibility: c.visibility === 'private' ? 'private' : 'public',
      identity: c.identity ?? (anonHost(c.host) ? 'anon' : 'shown'),
      precision: c.precision ?? 'exact',
      sources: {},
      keep: c.keep ?? 'kept',
    },
    lat: null,
    lng: null,
    subscribersOnly: c.subscribersOnly,
    manifestUrl: c.manifestUrl,
  }
}

// Library/profile saved item → canonical. The owner's own item (host null). Carries the editable
// axes (precision/identity/sources/title); visibility/tags aren't on the read yet (backend #12) →
// defaulted; `saved` → keep 'kept'.
export function fromSavedClip(c: SavedClip): CanonicalClip {
  return {
    id: c.id,
    source: c.saved ? 'clip' : 'buffer',
    startAtMs: c.startAtMs,
    endAtMs: c.endAtMs,
    host: null,
    // CU4-c — read the canonical §5 axes surfaced on the response (wrld-backend cd77ea9); fall back
    // to the legacy fields (kept until CU5) when a field is absent (pre-deploy / older backend).
    // `sources` wasn't surfaced as a canonical column — stays on the legacy per-kind map until CU4-d.
    axes: {
      title: c.title !== undefined ? c.title : (c.name && c.name !== 'Untitled clip' ? c.name : null),
      tags: c.tags ?? [],
      visibility: c.visibility === 'private' ? 'private' : 'public',
      identity: c.identity ?? (c.attributed ? 'shown' : 'anon'),
      precision: c.precision ?? precisionToResolved((c.locDisplayPrecision as SegSettings['precision']) ?? undefined),
      sources: c.sources,
      keep: c.keep ?? (c.saved ? 'kept' : 'reapable'),
    },
    lat: null,
    lng: null,
    subscribersOnly: false,
    manifestUrl: c.manifestUrl,
  }
}

// Clips-grid timeline block → canonical. A geometry+label view: it carries only the range, the
// display `label` (the title, or a time fallback), and media — no axes. So everything but
// title/geometry/media is defaulted; `sourceSessionId` (its "one lane" link) is not part of the
// canonical content shape. Owner's own grid (host null).
export function fromLaneClip(c: LaneClip): CanonicalClip {
  return {
    id: c.id,
    source: 'buffer',
    startAtMs: c.startMs,
    endAtMs: c.endMs,
    host: null,
    axes: {
      title: c.label,
      tags: [],
      visibility: 'public',
      identity: 'shown',
      precision: 'exact',
      sources: {},
      keep: 'kept',
    },
    lat: null,
    lng: null,
    subscribersOnly: false,
    manifestUrl: c.manifestUrl ?? null,
  }
}
