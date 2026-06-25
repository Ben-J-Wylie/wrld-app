// src/components/features/broadcast/LaneToggle.tsx
//
// Dashboard go-live LANE control (PB4 / unified manifest — U1). Picks whether the live broadcast
// prints into the BUFFER lane (time-windowed; the reaper clears it; no storage) or the SAVED lane
// (kept until deleted; counts against storage quota). A flag, like Identity / Chat — same row
// idiom (icon tile + label/detail + a SegmentedToggle).
//
// PRESENTATIONAL. WIRED (U1, 2026-06-25): the dashboard owns the value via `captureConfig.lane`
// and forwards it on `createRoom` (Aaron's go-live-lane backend is deployed). Per CONTENT.md §5,
// the lane is just one per-range setting; this is the now-edge starting choice. (Visibility is the
// one per-range setting deliberately NOT exposed on the dashboard — live is always public.)

import { StyleSheet, View } from 'react-native'
import { SegmentedToggle } from '@/components/primitives/SegmentedToggle'
import { Icon } from '@/components/primitives/Icon'
import { Text } from '@/components/primitives/Text'
import { theme } from '@/tokens/theme'

export type CaptureLane = 'buffer' | 'saved'

const LANE_OPTIONS: { value: CaptureLane; label: string }[] = [
  { value: 'buffer', label: 'BUFFER' },
  { value: 'saved', label: 'SAVED' },
]

type Props = {
  value: CaptureLane
  onChange: (v: CaptureLane) => void
  /** Override the auto detail line (e.g. to fold in remaining-storage context). */
  detail?: string
}

export function LaneToggle({ value, onChange, detail }: Props) {
  const auto =
    value === 'saved'
      ? 'Saved — kept until you delete it · uses storage'
      : 'Buffer — the reaper clears it · no storage'
  return (
    <View style={styles.row}>
      <View style={styles.head}>
        <View style={styles.tile}>
          <Icon name={value === 'saved' ? 'save' : 'rotate-ccw'} size="lg" color={theme.colors.accent.default} />
        </View>
        <View style={styles.labelCol}>
          <Text variant="bodyEmphasized">Record to</Text>
          <Text variant="monoCaption" color={theme.colors.text.muted}>
            {detail ?? auto}
          </Text>
        </View>
      </View>
      <SegmentedToggle options={LANE_OPTIONS} value={value} onChange={onChange} />
    </View>
  )
}

const styles = StyleSheet.create({
  row: { gap: theme.spacing.sm, paddingVertical: theme.spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  // Matches the dashboard's Identity/Location leading-icon tile.
  tile: {
    width: 76,
    height: 60,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bg.panel,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelCol: { flex: 1, gap: theme.spacing.xxs },
})
