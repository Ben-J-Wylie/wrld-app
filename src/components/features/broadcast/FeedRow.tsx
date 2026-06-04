// src/components/features/broadcast/FeedRow.tsx
//
// Capture source row on the Go Live & Record arming screen — one per
// broadcastable layer (cam / audio / screen / loc / gyro / compass).
// Redesigned 2026-06-03 for the clips initiative two-affordance model
// (see DESIGN.md 2026-06-03 decision-log entry): each source carries
// TWO independent affordances —
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
//   denied    — OS permission declined; dimmed, toggles disabled
//   disabled  — not available on this device / backend; dimmed
//
// FeedThumb is composed as the long-standing documented sub-component.
// Rows render border-less (no outer card) so a parent can group them in
// a single bordered container with hairline dividers; `showBorderTop`
// follows the SettingsRow grouping contract.

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
  air: boolean
  onAirChange: (v: boolean) => void
  rec: boolean
  onRecChange: (v: boolean) => void
  // When true and `rec` is off, the Rec affordance shows a lock hint.
  // The consumer routes `onRecChange(true)` through a consent step.
  recNeedsConsent?: boolean
  // Full-width slot rendered below the row (e.g. location precision).
  footer?: ReactNode
  showBorderTop?: boolean
  style?: StyleProp<ViewStyle>
}

// Footer indents to align under the meta column (thumb width + row gap).
const FOOTER_INDENT = 42 + theme.spacing.md

export function FeedRow({
  kind,
  label,
  detail,
  sensitivity,
  availability = 'available',
  air,
  onAirChange,
  rec,
  onRecChange,
  recNeedsConsent,
  footer,
  showBorderTop = true,
  style,
}: Props) {
  const locked = availability !== 'available'
  const lockHint = !!recNeedsConsent && !rec && !locked
  const detailPrefix =
    availability === 'denied'
      ? 'PERMISSION DENIED · '
      : availability === 'disabled'
        ? 'COMING SOON · '
        : ''

  return (
    <View style={[styles.wrap, showBorderTop && styles.borderTop, locked && styles.dimmed, style]}>
      <View style={styles.row}>
        <FeedThumb kind={kind} active={(air || rec) && !locked} />
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
        <View style={styles.affs}>
          <View style={styles.aff}>
            <Text variant="monoLabel" color={air ? theme.colors.accent.default : theme.colors.text.subtle}>
              AIR
            </Text>
            <Toggle value={air} onValueChange={onAirChange} disabled={locked} accessibilityLabel={`${label} broadcast`} />
          </View>
          <View style={styles.aff}>
            <View style={styles.recLabel}>
              <Text variant="monoLabel" color={rec ? theme.colors.accent.default : theme.colors.text.subtle}>
                REC
              </Text>
              {lockHint && <Icon name="lock" size="sm" color={theme.colors.text.subtle} />}
            </View>
            <Toggle value={rec} onValueChange={onRecChange} disabled={locked} accessibilityLabel={`${label} record`} />
          </View>
        </View>
      </View>
      {footer && <View style={styles.footer}>{footer}</View>}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
  },
  borderTop: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.subtle,
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
