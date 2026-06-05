// src/components/features/broadcast/RewindLadder.tsx
//
// Rolling Buffer (Always-On Rewind) initiative — June 2026. The per-tier
// ladder shown on the subscription screen: each paid step extends the rewind
// window AND the capture resolution, so the upgrade reads on both axes
// (Free 24h/720p · Plus 3 days/1080p · Pro 7 days/1440p).
//
// Reads the ladder from `@/lib/tierCaps` (the single source of truth that
// Aaron's `getUserMedia` cap also reads). `currentTier` highlights the
// viewer's plan. Presentational — the subscription screen drops it in.
//
// See the Rolling Buffer initiative in CLAUDE.md + DESIGN.md decision log.

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { theme } from '@/tokens/theme'
import { TIER_LADDER, type Tier } from '@/lib/tierCaps'

type Props = {
  // Highlights the viewer's current plan, if known.
  currentTier?: Tier
  style?: StyleProp<ViewStyle>
}

export function RewindLadder({ currentTier, style }: Props) {
  return (
    <View style={[styles.ladder, style]}>
      {TIER_LADDER.map((cap) => {
        const current = cap.tier === currentTier
        const labelColor = current ? theme.colors.accent.default : theme.colors.text.primary
        return (
          <View key={cap.tier} style={[styles.row, current && styles.rowCurrent]}>
            <View style={styles.head}>
              <Text variant="bodyEmphasized" color={labelColor}>
                {cap.label}
              </Text>
              {current && (
                <Text variant="monoLabel" color={theme.colors.accent.default}>
                  Current
                </Text>
              )}
            </View>
            <View style={styles.specs}>
              <View style={styles.spec}>
                <Icon name="rotate-ccw" size="sm" color={theme.colors.text.muted} />
                <Text variant="monoValue" color={theme.colors.text.primary}>
                  {cap.windowLabel}
                </Text>
              </View>
              <View style={styles.spec}>
                <Icon name="video" size="sm" color={theme.colors.text.muted} />
                <Text variant="monoValue" color={theme.colors.text.primary}>
                  {cap.resolutionLabel}
                </Text>
              </View>
            </View>
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  ladder: {
    gap: theme.spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.bg.elevated,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  rowCurrent: {
    backgroundColor: theme.colors.accent.surface,
    borderColor: theme.colors.accent.border,
  },
  head: {
    gap: 2,
  },
  specs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.lg,
  },
  spec: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
})
