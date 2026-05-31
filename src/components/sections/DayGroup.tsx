// src/components/sections/DayGroup.tsx
//
// Day header (TODAY / YESTERDAY / APR 22) + optional summary on the
// right + slotted child rows. Used by Wallet v2 transaction grouping.
// The shape works for any timeline-grouping surface (chat-by-day,
// notifications-by-day).

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Text } from '@/components/primitives/Text'
import { theme } from '@/tokens/theme'

type Props = {
  label: string
  summary?: string
  children: React.ReactNode
  showBorderTop?: boolean
  style?: StyleProp<ViewStyle>
}

export function DayGroup({ label, summary, children, showBorderTop = true, style }: Props) {
  return (
    <View style={[styles.group, showBorderTop && styles.borderTop, style]}>
      <View style={styles.header}>
        <Text variant="monoLabel" color={theme.colors.text.subtle}>
          {label}
        </Text>
        {summary && (
          <Text variant="monoCaption" color={theme.colors.text.muted}>
            {summary}
          </Text>
        )}
      </View>
      <View>{children}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  group: {
    paddingTop: theme.spacing.sm,
  },
  borderTop: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.subtle,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xs,
  },
})
