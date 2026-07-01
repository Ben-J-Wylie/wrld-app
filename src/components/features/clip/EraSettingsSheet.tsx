// src/components/features/clip/EraSettingsSheet.tsx
//
// The ONE settings drawer (clean-cut) — edit any value of a single Era. Replaces
// SegmentSettingsSheet + SavedClipSettingsSheet: there is one rules object now, so there is one
// editor. Every axis is first-class + equal (a source toggle reads the same weight as PRIVATE/PUBLIC):
// visibility · keep (lane) · identity · location precision · per-source on/off · access (subscribers-
// only, content rating) · title · tags.
//
// Self-contained host: takes an `Era` (its concrete values) + display context, writes each change
// straight to `erasApi.patch(era.id, …)` (no directive/coalesce/inherit — the Era IS the truth),
// optimistically slides the toggle, and invalidates every surface that reads an era (owner timeline,
// the viewer, the discover feeds) so an edit proliferates everywhere.

import { memo, useCallback, useMemo, useState } from 'react'
import { Alert, Dimensions, StyleSheet, View } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { BottomSheet } from '@/components/primitives/BottomSheet'
import { SegmentedToggle } from '@/components/primitives/SegmentedToggle'
import { Input } from '@/components/primitives/Input'
import { Chip } from '@/components/primitives/Chip'
import { Text } from '@/components/primitives/Text'
import { Pressable } from '@/components/primitives/Pressable'
import { Icon } from '@/components/primitives/Icon'
import { SegmentPreview } from './SegmentPreview'
import { SOURCE_META, FEEDKIND_TO_KIND } from '@/components/features/stream/sourceMeta'
import type { FeedKind } from '@/components/features/broadcast/FeedThumb'
import { erasApi } from '@/api/eras'
import type { Era, EraPatch, Visibility, Identity, Precision, Keep, ContentRating } from '@/types/era'
import { theme } from '@/tokens/theme'

type Props = {
  visible: boolean
  onClose: () => void
  /** The era being edited (its current concrete values). Key the sheet by era.id so state resets. */
  era: Era
  /** Time-of-day span label, e.g. "3:04–3:05 PM". */
  rangeLabel: string
  /** Date label, e.g. "Sat, Jun 14". */
  dateLabel: string
  /** Clip media for the preview viewer + timeline. */
  manifestUrl: string | null
  posterUrl: string | null
  /** The kinds this era's recording captured (drives the per-source rows). */
  availableSources: FeedKind[]
  /** Show the Lane (keep) toggle. Hide once the reaper has reached this era (no longer re-laneable). */
  showLane?: boolean
  /** Called after a successful permanent delete (parent closes + refetches). */
  onDeleted?: () => void
}

// All controls are multistate toggles, OFF/least → ON/most reading left→right (Ben's order).
const VISIBILITY_OPTIONS: { value: Visibility; label: string }[] = [
  { value: 'private', label: 'PRIVATE' },
  { value: 'public', label: 'PUBLIC' },
]
const KEEP_OPTIONS: { value: Keep; label: string }[] = [
  { value: 'reapable', label: 'BUFFERED' },
  { value: 'kept', label: 'SAVED' },
]
const IDENTITY_OPTIONS: { value: Identity; label: string }[] = [
  { value: 'anon', label: 'ANON' },
  { value: 'shown', label: 'SHOWN' },
]
const PRECISION_OPTIONS: { value: Precision; label: string }[] = [
  { value: 'private', label: 'OFF' },
  { value: 'country', label: 'COUNTRY' },
  { value: 'city', label: 'CITY' },
  { value: 'exact', label: 'EXACT' },
]
const RATING_OPTIONS: { value: ContentRating; label: string }[] = [
  { value: 'general', label: 'GENERAL' },
  { value: 'adult', label: 'ADULT' },
]
const ON_OFF_OPTIONS: { value: 'off' | 'on'; label: string }[] = [
  { value: 'off', label: 'OFF' },
  { value: 'on', label: 'ON' },
]
const SUBS_OPTIONS: { value: 'off' | 'on'; label: string }[] = [
  { value: 'off', label: 'EVERYONE' },
  { value: 'on', label: 'SUBSCRIBERS' },
]
// The per-source rows, in Ben's fixed order (only those the era captured render).
const SHEET_SOURCE_ORDER: FeedKind[] = ['cam', 'audio', 'chat', 'compass', 'gyro', 'accel', 'speed', 'torch']

// Memoised — it lives inside a high-churn screen (ClipsScreen re-renders on every playhead commit).
export const EraSettingsSheet = memo(function EraSettingsSheet({
  visible,
  onClose,
  era,
  rangeLabel,
  dateLabel,
  manifestUrl,
  posterUrl,
  availableSources,
  showLane = true,
  onDeleted,
}: Props) {
  const qc = useQueryClient()
  // Optimistic patch so a toggle slides immediately (the server read updates on invalidate).
  const [optimistic, setOptimistic] = useState<EraPatch>({})
  const v = useMemo(() => ({ ...era, ...optimistic }), [era, optimistic])

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['me', 'recordings'] })
    qc.invalidateQueries({ queryKey: ['era', era.id] })
    qc.invalidateQueries({ queryKey: ['discover-cell'] })
  }, [qc, era.id])

  const patch = useCallback(
    (p: EraPatch) => {
      setOptimistic((o) => ({ ...o, ...p }))
      erasApi
        .patch(era.id, p)
        .then(invalidate)
        .catch(() => {
          setOptimistic((o) => {
            const next = { ...o }
            for (const k of Object.keys(p)) delete (next as any)[k]
            return next
          })
          Alert.alert('Could not save', 'That change did not save. Please try again.')
        })
    },
    [era.id, invalidate],
  )

  // Local input state (committed on change/submit). Parent keys the sheet by era.id so this resets.
  const [title, setTitle] = useState(era.title ?? '')
  const [tags, setTags] = useState<string[]>(era.tags ?? [])
  const [tagDraft, setTagDraft] = useState('')
  const commitTitle = () => patch({ title: title.trim() || null })
  const addTags = () => {
    const next = [...tags]
    for (const raw of tagDraft.split(',')) {
      const t = raw.trim()
      if (t && !next.includes(t)) next.push(t)
    }
    setTagDraft('')
    if (next.length !== tags.length) {
      setTags(next)
      patch({ tags: next })
    }
  }
  const removeTag = (t: string) => {
    const next = tags.filter((x) => x !== t)
    setTags(next)
    patch({ tags: next })
  }

  const del = () => {
    Alert.alert('Delete permanently?', 'This removes the footage from the server. It cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          erasApi
            .delete(era.id)
            .then(() => {
              invalidate()
              onDeleted?.()
              onClose()
            })
            .catch(() => Alert.alert('Could not delete', 'Please try again.'))
        },
      },
    ])
  }

  const orderedSources = SHEET_SOURCE_ORDER.filter((k) => availableSources.includes(k))
  const rowCount = 4 + (showLane ? 1 : 0) + orderedSources.length + 1 // vis+id+loc+rating + lane + sources + tags
  const height = Math.min(220 + rowCount * 58, Math.round(Dimensions.get('window').height * 0.85))

  return (
    <BottomSheet visible={visible} onClose={onClose} variant="peek" peekHeight={height} dragToDismiss scrollable>
      <View style={styles.body}>
        <SegmentPreview
          manifestUrl={manifestUrl}
          posterUrl={posterUrl}
          startMs={era.startAtMs}
          endMs={era.endAtMs ?? era.startAtMs}
          titleValue={title}
          onTitleChangeText={setTitle}
          onTitleCommit={commitTitle}
          dateLabel={dateLabel}
          rangeLabel={rangeLabel}
          onClose={onClose}
        />

        <Row label="Visibility">
          <SegmentedToggle options={VISIBILITY_OPTIONS} value={v.visibility} onChange={(x) => patch({ visibility: x })} />
        </Row>
        {showLane && (
          <Row label="Lane">
            <SegmentedToggle options={KEEP_OPTIONS} value={v.keep} onChange={(x) => patch({ keep: x })} />
          </Row>
        )}
        <Row label="Identity">
          <SegmentedToggle options={IDENTITY_OPTIONS} value={v.identity} onChange={(x) => patch({ identity: x })} />
        </Row>
        <Row label="Location">
          <SegmentedToggle options={PRECISION_OPTIONS} value={v.precision} onChange={(x) => patch({ precision: x })} />
        </Row>
        <Row label="Access">
          <SegmentedToggle
            options={SUBS_OPTIONS}
            value={v.subscribersOnly ? 'on' : 'off'}
            onChange={(x) => patch({ subscribersOnly: x === 'on' })}
          />
        </Row>
        <Row label="Rating">
          <SegmentedToggle options={RATING_OPTIONS} value={v.contentRating} onChange={(x) => patch({ contentRating: x })} />
        </Row>

        {orderedSources.map((kind) => {
          const bk = FEEDKIND_TO_KIND[kind] ?? kind
          return (
            <Row key={kind} label={SOURCE_META[kind].label}>
              <SegmentedToggle
                options={ON_OFF_OPTIONS}
                value={(v.sources?.[bk] ?? true) ? 'on' : 'off'}
                onChange={(x) => patch({ sources: { ...(v.sources ?? {}), [bk]: x === 'on' } })}
              />
            </Row>
          )
        })}

        <View style={styles.sources}>
          <Text variant="monoCaption" color={theme.colors.text.muted} style={styles.sourcesLabel}>
            TAGS
          </Text>
          {tags.length > 0 && (
            <View style={styles.tagRow}>
              {tags.map((t) => (
                <Chip key={t} label={t} selected onPress={() => removeTag(t)} />
              ))}
            </View>
          )}
          <Input
            value={tagDraft}
            onChangeText={setTagDraft}
            onSubmitEditing={addTags}
            onEndEditing={addTags}
            placeholder="Add a tag"
            returnKeyType="done"
          />
        </View>

        <Pressable variant="subtle" accessibilityLabel="Delete clip permanently" onPress={del} style={styles.deleteBtn}>
          <Icon name="trash-2" size="sm" color={theme.colors.accent.default} />
          <Text variant="bodyEmphasized" color={theme.colors.accent.default}>
            Delete clip
          </Text>
        </Pressable>
      </View>
    </BottomSheet>
  )
})

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text variant="body" style={styles.rowLabel}>
        {label}
      </Text>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md, gap: theme.spacing.md },
  row: { gap: theme.spacing.xs },
  rowLabel: {},
  sources: { gap: theme.spacing.sm, marginTop: theme.spacing.xs },
  sourcesLabel: {},
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
})
