// src/components/features/broadcast/BroadcastStatusIndicator.tsx
//
// Persistent during-broadcast readout that distinguishes what's ON AIR
// from what's only RECORDING (clips initiative, 2026-06-03 decision-log
// entry; planned in DESIGN.md Section 3 as a feature-or-inline call —
// shipped here as a reusable feature). Required by the capture guardrail:
// nothing is recorded silently, so the broadcaster always sees an
// indicator while any source is capturing.
//
// Three situations are conveyed from the air/rec data, no mode prop
// needed:
//   • live + recording the same set      → "On air & recording"
//   • live but recording a larger set    → "Recording more than airing"
//   • recording but not live             → "Recording to device only"
//
// Reads over arbitrary live video, so it uses the same translucent
// dark-glass treatment as StreamScreen's other over-content HUD surfaces.
// Per DESIGN.md mechanical criterion 1, the dark-glass rgba values are a
// documented exception pending a `bg.darkGlass` token — flagged below.

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import type { ComponentProps } from 'react'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { theme } from '@/tokens/theme'

type IconName = ComponentProps<typeof Icon>['name']

export type AirRecSource = {
  label: string
  iconName: IconName
  air: boolean
  rec: boolean
}

type Props = {
  sources: AirRecSource[]
  headerLabel?: string
  note?: string
  style?: StyleProp<ViewStyle>
}

// Dark-glass over-video tones — documented exception to criterion 1
// (no cream-palette token reads on top of arbitrary live video). Mirrors
// StreamScreen's room-info overlay treatment; collapses into a
// `bg.darkGlass` token when that lands.
const GLASS_BG = 'rgba(20,16,13,0.68)'
const GLASS_BORDER = 'rgba(255,240,225,0.18)'
const GLASS_DIVIDER = 'rgba(255,240,225,0.10)'

function derive(sources: AirRecSource[]) {
  const aired = sources.filter((s) => s.air).length
  const recorded = sources.filter((s) => s.rec).length
  if (aired === 0) {
    return { header: 'Recording to device only', note: 'Nothing is being broadcast — saving privately' }
  }
  if (recorded > aired) {
    return { header: 'Recording more than you’re airing', note: 'Some sources are saving but not broadcasting' }
  }
  return { header: 'On air & recording', note: 'Everything on air is also saved to your device' }
}

export function BroadcastStatusIndicator({ sources, headerLabel, note, style }: Props) {
  const auto = derive(sources)

  return (
    <View style={[styles.panel, style]}>
      <View style={styles.header}>
        <Text variant="monoLabel" color={theme.colors.text.inverse}>
          {headerLabel ?? auto.header}
        </Text>
        <View style={styles.recBadge}>
          <View style={styles.recDot} />
          <Text variant="monoLabel" color={theme.colors.accent.default}>
            REC
          </Text>
        </View>
      </View>

      <View>
        {sources.map((s, i) => (
          <View key={s.label} style={[styles.row, i > 0 && styles.rowBorder]}>
            <Icon name={s.iconName} size="sm" color={theme.colors.text.inverse} />
            <Text variant="bodyEmphasized" color={theme.colors.text.inverse} style={styles.rowName} numberOfLines={1}>
              {s.label}
            </Text>
            <View style={styles.chips}>
              <Chip kind={s.air ? 'air' : 'off'} label="Air" />
              <Chip kind={s.rec ? 'rec' : 'off'} label="Rec" />
            </View>
          </View>
        ))}
      </View>

      <View style={styles.note}>
        <View style={styles.noteDot} />
        <Text variant="monoLabel" color={theme.colors.text.inverse} style={styles.noteText}>
          {note ?? auto.note}
        </Text>
      </View>
    </View>
  )
}

function Chip({ kind, label }: { kind: 'air' | 'rec' | 'off'; label: string }) {
  if (kind === 'air') {
    return (
      <View style={[styles.chip, styles.chipAir]}>
        <Text variant="monoLabel" color={theme.colors.text.inverse}>
          {label}
        </Text>
      </View>
    )
  }
  if (kind === 'rec') {
    return (
      <View style={[styles.chip, styles.chipRec]}>
        <View style={styles.chipRecDot} />
        <Text variant="monoLabel" color={theme.colors.text.inverse}>
          {label}
        </Text>
      </View>
    )
  }
  return (
    <View style={[styles.chip, styles.chipOff]}>
      <Text variant="monoLabel" color={theme.colors.text.inverse}>
        {label}
      </Text>
    </View>
  )
}

const DOT = 7

const styles = StyleSheet.create({
  panel: {
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: GLASS_DIVIDER,
  },
  recBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  recDot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: theme.colors.accent.default,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: GLASS_DIVIDER,
  },
  rowName: {
    flex: 1,
    minWidth: 0,
  },
  chips: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: theme.spacing.xxs,
  },
  chipAir: {
    backgroundColor: theme.colors.accent.default,
    borderColor: theme.colors.accent.default,
  },
  chipRec: {
    backgroundColor: 'transparent',
    borderColor: GLASS_BORDER,
  },
  chipRecDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.accent.default,
  },
  chipOff: {
    opacity: 0.4,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: GLASS_DIVIDER,
  },
  noteDot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: theme.colors.accent.default,
    marginTop: 3,
  },
  noteText: {
    flex: 1,
    minWidth: 0,
  },
})
