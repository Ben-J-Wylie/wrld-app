// src/lib/clipDirectives.ts
//
// CU2/CU4 prep — the ONE place the app turns a per-segment settings edit into the wire shape and
// persists it. Before this, the SegSettings↔directive mapping (FeedKind↔backend-kind source keys,
// the `SettingsRange[] → SegmentDirective[]` build) + the post-edit invalidate set were copy-pasted
// in `ClipsScreen` (the clips-grid editor) and `SavedClipSettingsSheet` (the library/profile host).
// Two copies = drift risk (add an axis in one, forget the other). This collapses them to one core,
// the foundation for the "one drawer / one canonical clip" consolidation (CU4).
//
// The AUTHORITY is the `clipId = null` session DirectiveRange rows (CU1↔CU2 contract); a settings
// edit writes them via `bufferApi.patchDirectives`. The sheet works in `FeedKind`; the wire works in
// backend kind — convert at this boundary, nowhere else.

import type { QueryClient } from '@tanstack/react-query'
import { FEEDKIND_TO_KIND, KIND_TO_FEEDKIND } from '@/components/features/stream/sourceMeta'
import type { FeedKind } from '@/components/features/broadcast/FeedThumb'
import type { SegSettings, SettingsRange } from '@/lib/segmentSettings'
import { bufferApi, type SegmentDirective } from '@/api/buffer'

// FeedKind-keyed per-source map (the sheet's shape) → backend-kind-keyed (the wire's shape).
export function feedSourcesToWire(sources: Record<string, boolean>): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  for (const [fk, v] of Object.entries(sources)) {
    const k = FEEDKIND_TO_KIND[fk as FeedKind]
    if (k) out[k] = v
  }
  return out
}

// Backend-kind-keyed per-source map (the wire / a stored directive) → FeedKind-keyed (the sheet).
export function wireSourcesToFeed(sources: Record<string, boolean>): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  for (const [bk, v] of Object.entries(sources)) {
    const fk = KIND_TO_FEEDKIND[bk]
    if (fk) out[fk] = v
  }
  return out
}

// A settings patch from the sheet (FeedKind sources) → the same patch with wire-keyed sources.
// Non-source axes pass through untouched. Returns the input unchanged when there are no sources.
export function wirePatch(patch: SegSettings): SegSettings {
  if (!patch.sources) return patch
  return { ...patch, sources: feedSourcesToWire(patch.sources) }
}

// A coalesced `SettingsRange[]` (for one session) → the `SegmentDirective[]` wire payload. Only the
// axes a range actually sets are emitted (absent = inherit). Identity maps to the `attributed` bool.
export function rangesToDirectives(ranges: SettingsRange[], sessionId: string): SegmentDirective[] {
  return ranges
    .filter((r) => r.sessionId === sessionId)
    .map((r) => ({
      startAtMs: Math.round(r.startMs),
      endAtMs: Math.round(r.endMs),
      ...(r.settings.visibility ? { visibility: r.settings.visibility } : {}),
      ...(r.settings.precision ? { precision: r.settings.precision } : {}),
      ...(r.settings.identity ? { attributed: r.settings.identity === 'attributed' } : {}),
      ...(r.settings.sources ? { sources: r.settings.sources } : {}),
      ...(r.settings.title ? { title: r.settings.title } : {}),
      ...(r.settings.tags && r.settings.tags.length ? { tags: r.settings.tags } : {}),
    }))
}

// Every surface that READS a clip's resolved axes, so a write re-reads. The `clipId=null` directive
// is the one authority; the reads resolve it via `resolveClipAxes` (server) / `resolvePinAxes`
// (pins) / `settingsAt` (buffer-lane label). All are keyed on time/cell/id, so a held view won't
// auto-refetch — invalidate them all (harmless when a feed isn't cached):
//  - ['buffer','me']  the session directives → the buffer-lane timeline label
//  - ['buffer','clips'] the library + saved lane
//  - ['clip']  the clip viewer (time-machine rewatch)
//  - historical-clips / avail-cell / historical-availability  the time-machine pins
export function invalidateClipReads(qc: QueryClient): void {
  qc.invalidateQueries({ queryKey: ['buffer', 'me'] })
  qc.invalidateQueries({ queryKey: ['buffer', 'clips'] })
  qc.invalidateQueries({ queryKey: ['clip'] })
  for (const k of ['historical-clips', 'avail-cell', 'historical-availability']) {
    qc.invalidateQueries({ queryKey: [k] })
  }
}

// The single persist path: write a session's full per-range directive list, then invalidate every
// read. Used by both edit hosts. Swallows errors (optimistic UI already reflects the change).
export function persistDirectives(
  qc: QueryClient,
  sessionId: string,
  ranges: SettingsRange[],
): void {
  bufferApi
    .patchDirectives(sessionId, rangesToDirectives(ranges, sessionId))
    .then(() => invalidateClipReads(qc))
    .catch(() => {})
}
