// src/components/features/settings/SettingsRow.tsx
//
// Generic settings row — icon tile + title (+ optional value/sub) +
// right affordance (chevron arrow / Toggle / Pill / etc.). Border-top
// hairline so rows stack into a grouped list without the parent
// needing to render its own dividers.
//
// Variants:
//   default   — neutral row (the common case)
//   highlight — accent-tinted background, used for the primary
//               identity row (Handle) in the Settings header
//
// Grouping rows into cards / sections is the parent's job. The feature
// only owns one row's visuals + press behavior. Pass `arrow` for a
// chevron, or any node as `right` (Toggle, AccountIDPill, custom).

import type { ReactNode } from 'react'
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import type { ComponentProps } from 'react'
import { Pressable } from '@/components/primitives/Pressable'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { theme } from '@/tokens/theme'

type Variant = 'default' | 'highlight'
type IconName = ComponentProps<typeof Icon>['name']

type Props = {
  variant?: Variant
  iconName?: IconName
  title: string
  value?: string
  right?: ReactNode
  arrow?: boolean
  showBorderTop?: boolean
  onPress?: () => void
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
}

export function SettingsRow({
  variant = 'default',
  iconName,
  title,
  value,
  right,
  arrow,
  showBorderTop = true,
  onPress,
  accessibilityLabel,
  style,
}: Props) {
  const rightSlot =
    right ?? (arrow || onPress ? <Icon name="chevron-right" size="md" color={theme.colors.text.subtle} /> : null)

  const body = (
    <>
      {iconName && (
        <View style={[styles.iconTile, variant === 'highlight' && styles.iconTileHighlight]}>
          <Icon
            name={iconName}
            size="md"
            color={
              variant === 'highlight' ? theme.colors.accent.default : theme.colors.text.primary
            }
          />
        </View>
      )}
      <View style={styles.col}>
        <Text variant="bodyEmphasized" numberOfLines={1}>
          {title}
        </Text>
        {value && (
          <Text
            variant="caption"
            color={theme.colors.text.muted}
            numberOfLines={2}
          >
            {value}
          </Text>
        )}
      </View>
      {rightSlot && <View style={styles.rightSlot}>{rightSlot}</View>}
    </>
  )

  const rowStyle = [
    styles.row,
    variant === 'highlight' && styles.rowHighlight,
    showBorderTop && styles.borderTop,
    style,
  ]

  if (onPress) {
    return (
      <Pressable
        variant="subtle"
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
        style={rowStyle}
      >
        {body}
      </Pressable>
    )
  }
  return <View style={rowStyle}>{body}</View>
}

const ICON_TILE = 36

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.bg.elevated,
  },
  rowHighlight: {
    backgroundColor: theme.colors.accent.surface,
  },
  borderTop: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.subtle,
  },
  iconTile: {
    width: ICON_TILE,
    height: ICON_TILE,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bg.panel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconTileHighlight: {
    backgroundColor: theme.colors.accent.surface,
    borderWidth: 1,
    borderColor: theme.colors.accent.border,
  },
  col: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  rightSlot: {
    flexShrink: 0,
  },
})
