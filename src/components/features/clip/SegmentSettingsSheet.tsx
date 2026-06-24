// src/components/features/clip/SegmentSettingsSheet.tsx
//
// PB4(a) — the per-segment settings panel (the decided UX: tap a segment → this sheet).
// Every axis is FIRST-CLASS + EQUAL (a source toggle reads the same weight as private/public):
// visibility · location precision · identity · per-source on/off (for the time-machine viewer).
//
// PRESENTATIONAL ONLY. It shows the segment's RESOLVED settings (override ?? go-live default) and
// emits a partial patch on change; the screen owns the piecewise model (segmentSettings.ts), the
// PATCH, and which sources the segment captured. `availableSources` = the segment's captured kinds.

import { memo } from 'react'
import { Dimensions, StyleSheet, View } from 'react-native'
import { BottomSheet } from '@/components/primitives/BottomSheet'
import { Pressable } from '@/components/primitives/Pressable'
import { SegmentedToggle } from '@/components/primitives/SegmentedToggle'
import { Toggle } from '@/components/primitives/Toggle'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { SOURCE_META } from '@/components/features/stream/sourceMeta'
import type { FeedKind } from '@/components/features/broadcast/FeedThumb'
import type { SegSettings, Visibility, Precision, Identity } from '@/lib/segmentSettings'
import { theme } from '@/tokens/theme'

type Props = {
  visible: boolean
  onClose: () => void
  /** Label for the segment span, e.g. "0:12–0:34". */
  rangeLabel: string
  /** Resolved settings for the segment (override merged over the go-live defaults). */
  settings: Required<Pick<SegSettings, 'visibility' | 'precision' | 'identity'>> & {
    sources: Record<string, boolean>
  }
  /** The kinds this segment actually captured (drives the per-source rows). */
  availableSources: FeedKind[]
  /** Emit a partial override for the segment. */
  onChange: (patch: SegSettings) => void
}

const VISIBILITY_OPTIONS: { value: Visibility; label: string }[] = [
  { value: 'public', label: 'PUBLIC' },
  { value: 'private', label: 'PRIVATE' },
]
const PRECISION_OPTIONS: { value: Precision; label: string }[] = [
  { value: 'exact', label: 'EXACT' },
  { value: 'city', label: 'CITY' },
  { value: 'country', label: 'COUNTRY' },
  { value: 'off', label: 'OFF' },
]
// Identity is separate from visibility: it's whose name shows on public content (vs anon).
const IDENTITY_OPTIONS: { value: Identity; label: string }[] = [
  { value: 'attributed', label: 'SHOWN' },
  { value: 'anon', label: 'ANON' },
]

// Memoised — it lives inside a high-churn screen (ClipsScreen re-renders on every playhead
// commit). Without this the sheet subtree reconciles mid-tap and cancels the scrim press +
// grabber pan, so it "won't close". Props must be referentially stable (the screen useCallbacks
// onChange/onClose + folds rangeLabel/settings into a memo).
export const SegmentSettingsSheet = memo(function SegmentSettingsSheet({
  visible,
  onClose,
  rangeLabel,
  settings,
  availableSources,
  onChange,
}: Props) {
  // Grow with content (title + 3 axis rows + a sources header + one row per source), capped at
  // ~85% of the screen — the BottomSheet scrolls past the cap (e.g. all sources armed).
  const rowCount = 3 + (availableSources.length ? 1 + availableSources.length : 0)
  const height = Math.min(160 + rowCount * 58, Math.round(Dimensions.get('window').height * 0.85))
  return (
    <BottomSheet visible={visible} onClose={onClose} variant="peek" peekHeight={height} dragToDismiss scrollable>
      <View style={styles.body}>
        <View style={styles.header}>
          <Text variant="bodyEmphasized" style={styles.title}>
            Segment {rangeLabel}
          </Text>
          <Pressable
            variant="subtle"
            hitSlop={12}
            accessibilityLabel="Close"
            onPress={onClose}
          >
            <Icon name="x" size="md" color={theme.colors.text.muted} />
          </Pressable>
        </View>

        <Row label="Visibility">
          <SegmentedToggle options={VISIBILITY_OPTIONS} value={settings.visibility} onChange={(v) => onChange({ visibility: v })} />
        </Row>
        <Row label="Location">
          <SegmentedToggle options={PRECISION_OPTIONS} value={settings.precision} onChange={(v) => onChange({ precision: v })} />
        </Row>
        <Row label="Identity">
          <SegmentedToggle options={IDENTITY_OPTIONS} value={settings.identity} onChange={(v) => onChange({ identity: v })} />
        </Row>

        {availableSources.length > 0 && (
          <View style={styles.sources}>
            <Text variant="monoCaption" color={theme.colors.text.muted} style={styles.sourcesLabel}>
              SOURCES
            </Text>
            {availableSources.map((kind) => (
              <View key={kind} style={styles.sourceRow}>
                <Icon name={SOURCE_META[kind].icon} size="sm" color={theme.colors.text.muted} />
                <Text variant="body" style={styles.sourceName}>
                  {SOURCE_META[kind].label}
                </Text>
                <Toggle
                  value={settings.sources[kind] ?? true}
                  onValueChange={(on) => onChange({ sources: { [kind]: on } })}
                />
              </View>
            ))}
          </View>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { marginBottom: theme.spacing.xs },
  row: { gap: theme.spacing.xs },
  rowLabel: {},
  sources: { gap: theme.spacing.sm, marginTop: theme.spacing.xs },
  sourcesLabel: {},
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  sourceName: { flex: 1 },
})
