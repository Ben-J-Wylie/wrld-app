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

import { useCallback } from 'react'
import { Alert } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { SegmentSettingsSheet } from './SegmentSettingsSheet'
import { KIND_TO_FEEDKIND, FEEDKIND_TO_KIND, SOURCE_RAIL_ORDER } from '@/components/features/stream/sourceMeta'
import type { FeedKind } from '@/components/features/broadcast/FeedThumb'
import type { SegSettings, Precision } from '@/lib/segmentSettings'
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

  // Apply a partial drawer patch → the saved-clip endpoint, then refresh the saved-clip pool +
  // the time-machine availability feed (so an edit proliferates to the past pin / replay).
  const apply = useCallback(
    (id: string, patch: SegSettings) => {
      const body: ClipPatch = {}
      if (patch.title !== undefined) body.title = patch.title ?? null
      if (patch.identity !== undefined) body.attributed = patch.identity === 'attributed'
      if (patch.precision !== undefined) body.locDisplayPrecision = patch.precision
      if (patch.sources) {
        const wire: Record<string, boolean> = {}
        for (const [fk, v] of Object.entries(patch.sources)) {
          const k = FEEDKIND_TO_KIND[fk as FeedKind]
          if (k) wire[k] = v
        }
        body.sources = wire
      }
      if (Object.keys(body).length === 0) return
      bufferApi
        .patchClip(id, body)
        .then(() => {
          qc.invalidateQueries({ queryKey: ['buffer', 'clips'] }) // library + saved lane
          qc.invalidateQueries({ queryKey: ['clip'] }) // the clip viewer (time-machine rewatch)
          // Refetch the time-machine pin feeds so an edit (title / precision / identity) proliferates
          // to the rewatch globe. The pins come from `historical-clips` (windowed) / `avail-cell`
          // (Lane B); `historical-availability` is the third feed. All three keyed on time/cell, so
          // a held-instant view won't auto-refetch — invalidate them all.
          for (const k of ['historical-clips', 'avail-cell', 'historical-availability']) {
            qc.invalidateQueries({ queryKey: [k] })
          }
        })
        .catch((e) => Alert.alert('Could not save', e?.message ?? 'Please try again.'))
    },
    [qc],
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

  if (!clip) {
    // Keep the sheet mounted so the close animation can run; render an empty/invisible shell.
    return <SegmentSettingsSheet
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

  // The captured sources as FeedKinds (identity is its own axis; location has the precision axis) —
  // ordered by the shared rail order, value from the clip's stored per-source map.
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

  return (
    <SegmentSettingsSheet
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
      settings={{
        visibility: 'public',
        precision: (clip.locDisplayPrecision as Precision) ?? 'exact',
        identity: clip.attributed ? 'attributed' : 'anon',
        sources: sourceVals,
        // 'Untitled clip' is the backend's no-title fallback → treat as empty so the placeholder shows.
        title: clip.name && clip.name !== 'Untitled clip' ? clip.name : undefined,
      }}
      availableSources={avail}
      onChange={(patch) => apply(clip.id, patch)}
      onDelete={() => onDelete(clip.id)}
    />
  )
}
