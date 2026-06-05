// src/components/features/broadcast/FeedRow.tsx
//
// Capture source row on the Go Live & Record arming screen — one per
// broadcastable layer. Two independent affordances per source —
//   • Air — broadcast this source live
//   • Rec — save this source to the device (record set)
// All four combinations are valid (air-only, rec-only, both, neither).
//
// Availability gates selectability:
//   available — both toggles live
//   denied    — OS permission declined; dimmed, toggles disabled,
//               "PERMISSION DENIED ·" detail prefix
//   disabled  — not available yet (capture pending / v0.3+ earmarked);
//               dimmed, toggles disabled. The detail text carries the
//               specific status — no auto prefix.
//
// `trailing` replaces the Air/Rec affordances entirely — used by the
// Identity row, which is a flag (Attributed / Anon) rather than a
// capturable track.
//
// Note (2026-06-03): the sensitivity badges (SENSITIVE/BENIGN) and the
// record consent lock-hint were removed for now — the record-consent
// flow is disabled at the screen level. The two-affordance model and the
// on-air-vs-recording indicator remain. See DESIGN.md decision log.
//
// FeedThumb is composed as the long-standing documented sub-component.
// Each row is a self-contained bordered card; the consumer stacks them
// with a gap.

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import type { ReactNode } from 'react'
import { Text } from '@/components/primitives/Text'
import { Toggle } from '@/components/primitives/Toggle'
import { FeedThumb, type FeedKind } from './FeedThumb'
import { theme } from '@/tokens/theme'

export type SourceAvailability = 'available' | 'denied' | 'disabled'

type Props = {
  kind: FeedKind
  label: string
  detail?: string
  availability?: SourceAvailability
  air?: boolean
  onAirChange?: (v: boolean) => void
  rec?: boolean
  onRecChange?: (v: boolean) => void
  // Whether to render the Rec affordance. Recording moved to the stream
  // view (a single Record button records the aired set) — the dashboard
  // arms Air only, so it sets showRec={false}. The gallery keeps it true
  // to document the two-affordance capability.
  showRec?: boolean
  // Whether to render the Air toggle. Rows whose on/off is governed by a
  // footer control (e.g. Location — its precision multistate has a
  // PRIVATE = off option) set showAir={false} so there's no redundant toggle.
  showAir?: boolean
  // Replaces the FeedThumb in the leading slot (e.g. a state-dependent icon
  // tile for Location precision / Identity).
  leading?: ReactNode
  // While the broadcast hasn't gone live, on-toggles render in the
  // "armed" (cued, outline-not-fill) state; once live they fill accent.
  live?: boolean
  // Replaces the Air/Rec affordances (e.g. the Identity flag control).
  trailing?: ReactNode
  // Full-width slot rendered below the row (e.g. location precision).
  footer?: ReactNode
  style?: StyleProp<ViewStyle>
}

export function FeedRow({
  kind,
  label,
  detail,
  availability = 'available',
  air = false,
  onAirChange,
  rec = false,
  onRecChange,
  showRec = true,
  showAir = true,
  leading,
  live = false,
  trailing,
  footer,
  style,
}: Props) {
  const locked = availability !== 'available'
  const detailPrefix = availability === 'denied' ? 'PERMISSION DENIED · ' : ''
  // When the card is locked it already dims as a whole, so keep the thumb
  // at full opacity to avoid muddy double-dimming. Identity (trailing) and
  // active air/rec render full too; an idle available source dims its thumb.
  const thumbActive = trailing || locked ? true : air || rec

  return (
    <View style={[styles.card, locked && styles.dimmed, style]}>
      <View style={styles.row}>
        {leading ?? <FeedThumb kind={kind} active={thumbActive} />}
        <View style={styles.col}>
          <Text variant="bodyEmphasized" numberOfLines={1}>
            {label}
          </Text>
          {detail && (
            <Text variant="monoCaption" color={theme.colors.text.muted} numberOfLines={2}>
              {detailPrefix}
              {detail}
            </Text>
          )}
        </View>
        {trailing ?? ((showAir || showRec) ? (
          <View style={styles.affs}>
            {showAir && (
              <View style={styles.aff}>
                <Text variant="monoLabel" color={air ? theme.colors.accent.default : theme.colors.text.subtle}>
                  AIR
                </Text>
                <Toggle value={air} armed={!live} onValueChange={onAirChange ?? (() => {})} disabled={locked} accessibilityLabel={`${label} broadcast`} />
              </View>
            )}
            {showRec && (
              <View style={styles.aff}>
                <Text variant="monoLabel" color={rec ? theme.colors.accent.default : theme.colors.text.subtle}>
                  REC
                </Text>
                <Toggle value={rec} armed={!live} onValueChange={onRecChange ?? (() => {})} disabled={locked} accessibilityLabel={`${label} record`} />
              </View>
            )}
          </View>
        ) : null)}
      </View>
      {footer && <View style={styles.footer}>{footer}</View>}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    backgroundColor: theme.colors.bg.elevated,
  },
  dimmed: {
    opacity: 0.55,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  col: {
    flex: 1,
    gap: theme.spacing.xxs,
    minWidth: 0,
  },
  affs: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  aff: {
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  footer: {
    // Full card-content width — symmetric gutters left and right (the
    // card's own horizontal padding), not indented under the meta column.
    paddingTop: theme.spacing.sm,
  },
})
