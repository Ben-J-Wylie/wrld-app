// src/components/features/clip/SavedClipSettingsSheet.tsx
//
// Standalone host for the per-clip settings drawer (SegmentSettingsSheet) over a single durable
// SavedClip — for surfaces that have a clip but NOT the Clips-grid's session/directives machinery
// (e.g. the profile / Me-tab saved-clip feed). Tapping a saved-clip row brings this up in place to
// edit the clip's preferences; it does NOT navigate to the clips page.
//
// It reads the clip's OWN exposed fields and writes via `bufferApi.patchClip` (the documented
// saved-clip edit endpoint, C4.4). Axes covered = Ben's profile-edit set: title · identity ·
// location precision · per-source on/off · delete. Visibility (the endpoint's public|anon|draft
// vocab predates the PB4 private|public axis) + tags aren't on the SavedClip read yet, so they're
// hidden here (full parity is an Aaron follow-up — expose visibility/tags on the saved-clip read).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { SegmentSettingsSheet } from './SegmentSettingsSheet'
import { KIND_TO_FEEDKIND, FEEDKIND_TO_KIND, SOURCE_RAIL_ORDER } from '@/components/features/stream/sourceMeta'
import type { FeedKind } from '@/components/features/broadcast/FeedThumb'
import { applySetting, mergeSettings, type SegSettings, type SettingsRange, type Precision } from '@/lib/segmentSettings'
import { wirePatch, feedSourcesToWire, persistDirectives, invalidateClipReads } from '@/lib/clipDirectives'
import { fromSavedClip, precisionToEditable, identityToEditable } from '@/types/clip'
import { useBuffer } from '@/hooks/useBuffer'
import { bufferApi, type SavedClip, type ClipPatch } from '@/api/buffer'

type Props = {
  clip: SavedClip | null
  visible: boolean
  onClose: () => void
}

function fmtTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}
function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
}

export function SavedClipSettingsSheet({ clip, visible, onClose }: Props) {
  const qc = useQueryClient()
  const { data: buffer } = useBuffer(!!clip)

  // Optimistic display patch so a toggle SLIDES immediately (the server read `clip.*` only updates
  // on refetch; without this the control reads the stale prop and doesn't move). Scoped to the open
  // clip's id — it auto-resets when a different clip opens (the `id !== clip.id` guard), no effect.
  const [optimistic, setOptimistic] = useState<{ id: string; patch: SegSettings } | null>(null)

  // Refetch every surface that reads the clip's axes so a resolved edit re-reads (shared core).
  const invalidate = useCallback(() => invalidateClipReads(qc), [qc])

  // CU2 — the clip's source session + a LOCAL copy of its `clipId=null` directives (the CU1
  // authority). Seeded on open so rapid toggles merge optimistically (matches the clips page). The
  // edit writes the DIRECTIVE (not `patchClip` on `Clip.*`, which CU1 resolves OVER → the masked
  // "locked toggle" bug). Legacy clips with no buffer session fall back to the clip-level path.
  const sid = clip?.bufferSessionId ?? null
  const session = sid ? buffer?.sessions.find((s) => s.id === sid) : undefined
  const rangesRef = useRef<SettingsRange[]>([])
  useEffect(() => {
    rangesRef.current = sid
      ? (session?.directives ?? []).map((d) => ({
          sessionId: sid,
          startMs: d.startAtMs,
          endMs: d.endAtMs,
          settings: {
            ...(d.visibility ? { visibility: d.visibility } : {}),
            ...(d.precision != null ? { precision: d.precision as Precision } : {}),
            ...(d.attributed !== undefined ? { identity: (d.attributed ? 'attributed' : 'anon') as 'attributed' | 'anon' } : {}),
            ...(d.sources != null ? { sources: d.sources } : {}),
            ...(d.title != null ? { title: d.title } : {}),
            ...(d.tags && d.tags.length ? { tags: d.tags } : {}),
            // CU3 D3 — round-trip the keep/retain axis so an edit doesn't drop an existing retain.
            ...(d.retain ? { keep: 'kept' as const } : {}),
          },
        }))
      : []
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clip?.id, sid])

  const apply = useCallback(
    (patch: SegSettings) => {
      if (!clip) return
      // Slide the control now (optimistic), regardless of which write path runs below.
      setOptimistic((o) => ({ id: clip.id, patch: mergeSettings(o && o.id === clip.id ? o.patch : {}, patch) }))
      // Legacy clip with no buffer session → the old clip-level path (recordings purged; rare).
      if (!sid) {
        const body: ClipPatch = {}
        if (patch.title !== undefined) body.title = patch.title ?? null
        if (patch.identity !== undefined) body.attributed = patch.identity === 'attributed'
        if (patch.precision !== undefined) body.locDisplayPrecision = patch.precision
        if (patch.sources) body.sources = feedSourcesToWire(patch.sources)
        if (Object.keys(body).length === 0) return
        bufferApi.patchClip(clip.id, body).then(invalidate).catch((e) => Alert.alert('Could not save', e?.message ?? 'Please try again.'))
        return
      }
      // The drawer keys `sources` by FeedKind; the directive wire keys by backend kind. Convert,
      // recompute the authoritative range list, and persist via the shared core (same path the
      // clips-grid editor uses — one wire mapping + one invalidate set).
      const next = applySetting(rangesRef.current, { sessionId: sid, startMs: clip.startAtMs, endMs: clip.endAtMs }, wirePatch(patch))
      rangesRef.current = next
      persistDirectives(qc, sid, next)
    },
    [clip, sid, qc, invalidate],
  )

  const onDelete = useCallback(
    (id: string) => {
      Alert.alert(
        'Delete clip',
        'Permanently delete this clip from the server and reclaim its storage? A copy is kept only if it was reported.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              bufferApi
                .deleteSavedClip(id)
                .then(() => qc.invalidateQueries({ queryKey: ['buffer', 'clips'] }))
                .catch((e) => Alert.alert('Could not delete', e?.message ?? 'Please try again.'))
              onClose()
            },
          },
        ],
      )
    },
    [qc, onClose],
  )

  // Build the sheet's `settings` + `availableSources` once per (clip, optimistic) — the sheet is
  // `memo`'d and wants referentially-stable props (a new object every render would reconcile it
  // mid-gesture). `display` = the server-resolved clip view + the optimistic patch (slides controls).
  const built = useMemo(() => {
    if (!clip) return null
    const avail: FeedKind[] = []
    const sourceVals: Record<string, boolean> = {}
    const fkSet = new Set<FeedKind>()
    for (const k of clip.kinds) {
      const fk = KIND_TO_FEEDKIND[k]
      if (fk && fk !== 'profile' && fk !== 'loc') fkSet.add(fk)
    }
    for (const fk of SOURCE_RAIL_ORDER) {
      if (!fkSet.has(fk)) continue
      avail.push(fk)
      const bk = FEEDKIND_TO_KIND[fk]
      sourceVals[fk] = bk ? clip.sources[bk] ?? true : true
    }
    // CU4 prep — the seed's scalar axes are read through the canonical clip adapter + vocab bridge
    // (one shape, one translation point) instead of inline field reads. Behaviour-preserving: the
    // bridge mappers are exact inverses of the prior inline logic (off↔private, attributed↔shown,
    // the 'Untitled clip'→null title rule lives in `fromSavedClip`). `sources` stays the drawer's
    // per-available-row map (display-specific), not the canonical backend-keyed map.
    const canon = fromSavedClip(clip)
    const seed: SegSettings = {
      visibility: canon.axes.visibility,
      precision: precisionToEditable(canon.axes.precision),
      identity: identityToEditable(canon.axes.identity),
      sources: sourceVals,
      title: canon.axes.title ?? undefined,
    }
    const display = optimistic && optimistic.id === clip.id ? mergeSettings(seed, optimistic.patch) : seed
    return {
      avail,
      settings: {
        visibility: display.visibility ?? 'public',
        precision: display.precision ?? 'exact',
        identity: display.identity ?? 'attributed',
        sources: display.sources ?? {},
        title: display.title,
        tags: display.tags,
      },
    }
  }, [clip, optimistic])

  if (!clip || !built) {
    // Keep the sheet mounted so the close animation can run; render an empty/invisible shell.
    // `key` distinct from the real clip below so React re-mounts (re-seeds the title `useState`)
    // when a clip opens — without it the input stays stuck on the empty shell's '' (the empty-title bug).
    return <SegmentSettingsSheet
      key="empty"
      visible={false}
      onClose={onClose}
      rangeLabel=""
      dateLabel=""
      lane="saved"
      onLaneChange={() => {}}
      showLane={false}
      showVisibility={false}
      showTags={false}
      manifestUrl={null}
      posterUrl={null}
      startMs={0}
      endMs={0}
      settings={{ visibility: 'public', precision: 'exact', identity: 'attributed', sources: {} }}
      availableSources={[]}
      onChange={() => {}}
    />
  }

  return (
    <SegmentSettingsSheet
      key={clip.id}
      visible={visible}
      onClose={onClose}
      rangeLabel={`${fmtTime(clip.startAtMs)}–${fmtTime(clip.endAtMs)}`}
      dateLabel={fmtDate(clip.startAtMs)}
      lane="saved"
      onLaneChange={() => {}}
      showLane={false}
      showVisibility={false}
      showTags={false}
      manifestUrl={clip.manifestUrl}
      posterUrl={clip.thumbnailUrl}
      startMs={clip.startAtMs}
      endMs={clip.endAtMs}
      settings={built.settings}
      availableSources={built.avail}
      onChange={apply}
      onDelete={() => onDelete(clip.id)}
    />
  )
}
