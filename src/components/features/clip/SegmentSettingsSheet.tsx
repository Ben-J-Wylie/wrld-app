// src/components/features/clip/SegmentSettingsSheet.tsx
//
// PB4(a) — the per-segment settings panel (the decided UX: tap a segment → this sheet).
// Every axis is FIRST-CLASS + EQUAL (a source toggle reads the same weight as private/public):
// visibility · location precision · identity · per-source on/off (for the time-machine viewer).
//
// PRESENTATIONAL ONLY. It shows the segment's RESOLVED settings (override ?? go-live default) and
// emits a partial patch on change; the screen owns the piecewise model (segmentSettings.ts), the
// PATCH, and which sources the segment captured. `availableSources` = the segment's captured kinds.

import { memo, useState } from 'react'
import { Dimensions, StyleSheet, View } from 'react-native'
import { BottomSheet } from '@/components/primitives/BottomSheet'
import { SegmentedToggle } from '@/components/primitives/SegmentedToggle'
import { Input } from '@/components/primitives/Input'
import { Chip } from '@/components/primitives/Chip'
import { Text } from '@/components/primitives/Text'
import { Pressable } from '@/components/primitives/Pressable'
import { Icon } from '@/components/primitives/Icon'
import { SegmentPreview } from './SegmentPreview'
import { SOURCE_META } from '@/components/features/stream/sourceMeta'
import type { FeedKind } from '@/components/features/broadcast/FeedThumb'
import type { SegSettings, Visibility, Precision, Identity } from '@/lib/segmentSettings'
import { theme } from '@/tokens/theme'

type Props = {
  visible: boolean
  onClose: () => void
  /** Time-of-day span label, e.g. "3:04–3:05 PM". */
  rangeLabel: string
  /** Date label, e.g. "Sat, Jun 14". */
  dateLabel: string
  /** Which lane the segment is in (drives + reflects the Lane toggle). */
  lane: 'buffered' | 'saved'
  /** Move the segment between lanes (save / un-save). */
  onLaneChange: (lane: 'buffered' | 'saved') => void
  /** Hide the Lane toggle once the reaper has reached this segment (no longer movable). */
  showLane: boolean
  /** Clip media for the preview viewer + timeline. */
  manifestUrl: string | null
  posterUrl: string | null
  startMs: number
  endMs: number
  /** Resolved settings for the segment (override merged over the go-live defaults). */
  settings: Required<Pick<SegSettings, 'visibility' | 'precision' | 'identity'>> & {
    sources: Record<string, boolean>
    title?: string
    tags?: string[]
  }
  /** The kinds this segment actually captured (drives the per-source rows). */
  availableSources: FeedKind[]
  /** Show the Visibility (private/public) row. Default true. The standalone saved-clip editor
   *  hides it — the saved-clip endpoint doesn't yet expose visibility on read (full parity is an
   *  Aaron follow-up); Ben's profile-edit axes are title/location/identity/sources. */
  showVisibility?: boolean
  /** Show the Tags block. Default true. Hidden in the standalone saved-clip editor (tags aren't
   *  on the saved-clip read yet — same follow-up as visibility). */
  showTags?: boolean
  /** Emit a partial override for the segment. */
  onChange: (patch: SegSettings) => void
  /** Permanently delete the whole clip (drop from the server + reclaim; a copy survives only via
   *  the reporting path). The screen confirms + calls the API. Omit to hide the button. */
  onDelete?: () => void
  /** Permanently delete one captured source's track (the only destructive per-source edit, distinct
   *  from the on/off visibility toggle). The screen confirms + calls the API. Omit to hide. */
  onDeleteSource?: (kind: FeedKind) => void
}

// All controls are multistate toggles, OFF/least → ON/most reading left→right (Ben's order).
const LANE_OPTIONS: { value: 'buffered' | 'saved'; label: string }[] = [
  { value: 'buffered', label: 'BUFFERED' },
  { value: 'saved', label: 'SAVED' },
]
const VISIBILITY_OPTIONS: { value: Visibility; label: string }[] = [
  { value: 'private', label: 'PRIVATE' },
  { value: 'public', label: 'PUBLIC' },
]
// Identity is separate from visibility: it's whose name shows on public content (vs anon).
const IDENTITY_OPTIONS: { value: Identity; label: string }[] = [
  { value: 'anon', label: 'ANON' },
  { value: 'attributed', label: 'SHOWN' },
]
const PRECISION_OPTIONS: { value: Precision; label: string }[] = [
  { value: 'off', label: 'OFF' },
  { value: 'country', label: 'COUNTRY' },
  { value: 'city', label: 'CITY' },
  { value: 'exact', label: 'EXACT' },
]
const ON_OFF_OPTIONS: { value: 'off' | 'on'; label: string }[] = [
  { value: 'off', label: 'OFF' },
  { value: 'on', label: 'ON' },
]
// The per-source rows, in Ben's order (only those the segment actually captured render).
const SHEET_SOURCE_ORDER: FeedKind[] = ['cam', 'audio', 'chat', 'compass', 'gyro', 'accel', 'speed', 'torch']

// Memoised — it lives inside a high-churn screen (ClipsScreen re-renders on every playhead
// commit). Without this the sheet subtree reconciles mid-tap and cancels the scrim press +
// grabber pan, so it "won't close". Props must be referentially stable (the screen useCallbacks
// onChange/onClose + folds rangeLabel/settings into a memo).
export const SegmentSettingsSheet = memo(function SegmentSettingsSheet({
  visible,
  onClose,
  rangeLabel,
  dateLabel,
  lane,
  onLaneChange,
  showLane,
  manifestUrl,
  posterUrl,
  startMs,
  endMs,
  settings,
  availableSources,
  showVisibility = true,
  showTags = true,
  onChange,
  onDelete,
  onDeleteSource,
}: Props) {
  // The segment's captured sources, in Ben's fixed order.
  const orderedSources = SHEET_SOURCE_ORDER.filter((k) => availableSources.includes(k))
  // Local input state (committed to the screen on change/submit). The parent keys this sheet by
  // segment id, so this state resets to the segment's saved values each time it opens.
  const [title, setTitle] = useState(settings.title ?? '')
  const [tags, setTags] = useState<string[]>(settings.tags ?? [])
  const [tagDraft, setTagDraft] = useState('')
  const commitTitle = () => onChange({ title: title.trim() || undefined })
  const addTags = () => {
    const next = [...tags]
    for (const raw of tagDraft.split(',')) {
      const t = raw.trim()
      if (t && !next.includes(t)) next.push(t)
    }
    setTagDraft('')
    if (next.length !== tags.length) {
      setTags(next)
      onChange({ tags: next })
    }
  }
  const removeTag = (t: string) => {
    const next = tags.filter((x) => x !== t)
    setTags(next)
    onChange({ tags: next })
  }
  // Grow with content (title + lane + 3 axes + one row per source + tags), capped at ~85% of the
  // screen — the BottomSheet scrolls past the cap (e.g. all sources armed).
  const rowCount =
    2 + (showVisibility ? 1 : 0) + (showLane ? 1 : 0) + orderedSources.length + (showTags ? 1 : 0)
  const height = Math.min(190 + rowCount * 58, Math.round(Dimensions.get('window').height * 0.85))
  return (
    <BottomSheet visible={visible} onClose={onClose} variant="peek" peekHeight={height} dragToDismiss scrollable>
      <View style={styles.body}>
        <SegmentPreview
          manifestUrl={manifestUrl}
          posterUrl={posterUrl}
          startMs={startMs}
          endMs={endMs}
          titleValue={title}
          onTitleChangeText={setTitle}
          onTitleCommit={commitTitle}
          dateLabel={dateLabel}
          rangeLabel={rangeLabel}
          onClose={onClose}
        />

        {/* All controls are multistate toggles, in a fixed order. Visibility above Lane; Lane hides
            once the reaper has reached the clip (re-laning would need a snip — the drawer is
            prefs-only, the dashboard/live edges do the snipping). */}
        {showVisibility && (
          <Row label="Visibility">
            <SegmentedToggle options={VISIBILITY_OPTIONS} value={settings.visibility} onChange={(v) => onChange({ visibility: v })} />
          </Row>
        )}
        {showLane && (
          <Row label="Lane">
            <SegmentedToggle options={LANE_OPTIONS} value={lane} onChange={onLaneChange} />
          </Row>
        )}
        <Row label="Identity">
          <SegmentedToggle options={IDENTITY_OPTIONS} value={settings.identity} onChange={(v) => onChange({ identity: v })} />
        </Row>
        <Row label="Location">
          <SegmentedToggle options={PRECISION_OPTIONS} value={settings.precision} onChange={(v) => onChange({ precision: v })} />
        </Row>
        {orderedSources.map((kind) => (
          <Row key={kind} label={SOURCE_META[kind].label}>
            <View style={styles.sourceCtl}>
              <View style={styles.sourceToggle}>
                <SegmentedToggle
                  options={ON_OFF_OPTIONS}
                  value={(settings.sources[kind] ?? true) ? 'on' : 'off'}
                  onChange={(v) => onChange({ sources: { [kind]: v === 'on' } })}
                />
              </View>
              {onDeleteSource && (
                <Pressable
                  variant="subtle"
                  hitSlop={8}
                  accessibilityLabel={`Delete ${SOURCE_META[kind].label} permanently`}
                  onPress={() => onDeleteSource(kind)}
                >
                  <Icon name="trash-2" size="sm" color={theme.colors.text.muted} />
                </Pressable>
              )}
            </View>
          </Row>
        ))}

        {showTags && (
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
        )}

        {/* Permanent delete — drops the clip from the server + reclaims (a copy survives only via
            the reporting path). The screen confirms + calls the API. */}
        {onDelete && (
          <Pressable variant="subtle" accessibilityLabel="Delete clip permanently" onPress={onDelete} style={styles.deleteBtn}>
            <Icon name="trash-2" size="sm" color={theme.colors.accent.default} />
            <Text variant="bodyEmphasized" color={theme.colors.accent.default}>
              Delete clip
            </Text>
          </Pressable>
        )}
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
  sourceCtl: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  // The toggle flexes to fill the row beside the trash icon — otherwise it sizes to its intrinsic
  // (full) width + the trash pushes the row past the right edge.
  sourceToggle: { flex: 1 },
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
