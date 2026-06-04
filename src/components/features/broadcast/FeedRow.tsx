// src/components/features/broadcast/FeedRow.tsx
//
// Capture source row on the Go Live & Record arming screen — one per
// broadcastable layer. Redesigned 2026-06-03 for the clips initiative
// two-affordance model (see DESIGN.md 2026-06-03 decision-log entry):
// each source carries TWO independent affordances —
//   • Air — broadcast this source live
//   • Rec — save this source to the device (record set)
// All four combinations are valid (air-only, rec-only, both, neither).
//
// Sensitivity drives the consent gate: a `sensitive` source's Rec
// affordance shows a lock hint when off; the consumer intercepts
// `onRecChange(true)` to present the RecordConsentSheet before flipping.
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
// capturable track, so it composes the same thumb + meta layout but
// swaps a control into the affordance slot.
//
// FeedThumb is composed as the long-standing documented sub-component.
// Each row is a self-contained bordered card; the consumer stacks them
// with a gap.

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import type { ReactNode } from 'react'
import { Text } from '@/components/primitives/Text'
import { Toggle } from '@/components/primitives/Toggle'
import { Icon } from '@/components/primitives/Icon'
import { FeedThumb, type FeedKind } from './FeedThumb'
import { theme } from '@/tokens/theme'

export type SourceSensitivity = 'sensitive' | 'benign'
export type SourceAvailability = 'available' | 'denied' | 'disabled'

type Props = {
  kind: FeedKind
  label: string
  detail?: string
  sensitivity?: SourceSensitivity
  availability?: SourceAvailability
  air?: boolean
  onAirChange?: (v: boolean) => void
  rec?: boolean
  onRecChange?: (v: boolean) => void
  // When true and `rec` is off, the Rec affordance shows a lock hint.
  // The consumer routes `onRecChange(true)` through a consent step.
  recNeedsConsent?: boolean
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
  sensitivity,
  availability = 'available',
  air = false,
  onAirChange,
  rec = false,
  onRecChange,
  recNeedsConsent,
  trailing,
  footer,
  style,
}: Props) {
  const locked = availability !== 'available'
  const lockHint = !!recNeedsConsent && !rec && !locked
  const detailPrefix = availability === 'denied' ? 'PERMISSION DENIED · ' : ''
  // When the card is locked it already dims as a whole, so keep the thumb
  // at full opacity to avoid muddy double-dimming. Identity (trailing) and
  // active air/rec render full too; an idle available source dims its thumb.
  const thumbActive = trailing || locked ? true : air || rec

  return (
    <View style={[styles.card, locked && styles.dimmed, style]}>
      <View style={styles.row}>
        <FeedThumb kind={kind} active={thumbActive} />
        <View style={styles.col}>
          <View style={styles.nameRow}>
            <Text variant="bodyEmphasized" numberOfLines={1}>
              {label}
            </Text>
            {sensitivity && (
              <View
                style={[
                  styles.tag,
                  sensitivity === 'sensitive' ? styles.tagSensitive : styles.tagBenign,
                ]}
              >
                <Text
                  variant="monoLabel"
                  color={sensitivity === 'sensitive' ? theme.colors.accent.default : theme.colors.text.subtle}
                >
                  {sensitivity === 'sensitive' ? 'SENSITIVE' : 'BENIGN'}
                </Text>
              </View>
            )}
          </View>
          {detail && (
            <Text variant="monoCaption" color={theme.colors.text.muted} numberOfLines={2}>
              {detailPrefix}
              {detail}
            </Text>
          )}
        </View>
        {trailing ?? (
          <View style={styles.affs}>
            <View style={styles.aff}>
              <Text variant="monoLabel" color={air ? theme.colors.accent.default : theme.colors.text.subtle}>
                AIR
              </Text>
              <Toggle value={air} onValueChange={onAirChange ?? (() => {})} disabled={locked} accessibilityLabel={`${label} broadcast`} />
            </View>
            <View style={styles.aff}>
              <View style={styles.recLabel}>
                <Text variant="monoLabel" color={rec ? theme.colors.accent.default : theme.colors.text.subtle}>
                  REC
                </Text>
                {lockHint && <Icon name="lock" size="sm" color={theme.colors.text.subtle} />}
              </View>
              <Toggle value={rec} onValueChange={onRecChange ?? (() => {})} disabled={locked} accessibilityLabel={`${label} record`} />
            </View>
          </View>
        )}
      </View>
      {footer && <View style={styles.footer}>{footer}</View>}
    </View>
  )
}

// Footer indents to align under the meta column (thumb width + row gap).
const FOOTER_INDENT = 42 + theme.spacing.md

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
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  tag: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: theme.spacing.xxs,
  },
  tagSensitive: {
    borderColor: theme.colors.accent.border,
    backgroundColor: theme.colors.accent.surface,
  },
  tagBenign: {
    borderColor: theme.colors.border.strong,
    backgroundColor: 'transparent',
  },
  affs: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  aff: {
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  recLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  footer: {
    paddingTop: theme.spacing.sm,
    paddingLeft: FOOTER_INDENT,
  },
})
