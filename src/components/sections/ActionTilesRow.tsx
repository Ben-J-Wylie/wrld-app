// src/components/sections/ActionTilesRow.tsx
//
// Equal-width grid of action tiles. 3-up (default) or 4-up via the
// `cols` prop. Each tile = icon + title + small descriptor + optional
// `primary` flag for accent emphasis (Wallet's main "Top Up" / "Send"
// etc.). Used by Wallet v2 quick actions and generic shortcut shelves.

import type { ComponentProps } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Pressable } from '@/components/primitives/Pressable'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { theme } from '@/tokens/theme'

type IconName = ComponentProps<typeof Icon>['name']

export type ActionTile = {
  id: string
  iconName: IconName
  title: string
  descriptor?: string
  onPress: () => void
  primary?: boolean
}

type Props = {
  tiles: ActionTile[]
  cols?: 2 | 3 | 4
  style?: StyleProp<ViewStyle>
}

export function ActionTilesRow({ tiles, cols = 3, style }: Props) {
  return (
    <View style={[styles.row, { gap: theme.spacing.sm }, style]}>
      {tiles.map((t) => (
        <Pressable
          key={t.id}
          variant="subtle"
          onPress={t.onPress}
          accessibilityRole="button"
          accessibilityLabel={t.title}
          style={[
            styles.tile,
            t.primary && styles.tilePrimary,
            { flexBasis: `${100 / cols}%` },
          ]}
        >
          <Icon
            name={t.iconName}
            size="md"
            color={t.primary ? theme.colors.accent.default : theme.colors.text.primary}
          />
          <Text variant="bodyEmphasized" numberOfLines={1}>
            {t.title}
          </Text>
          {t.descriptor && (
            <Text variant="monoCaption" color={theme.colors.text.muted} numberOfLines={1}>
              {t.descriptor}
            </Text>
          )}
        </Pressable>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tile: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    backgroundColor: theme.colors.bg.elevated,
    gap: theme.spacing.xs,
    alignItems: 'flex-start',
  },
  tilePrimary: {
    borderColor: theme.colors.accent.default,
    backgroundColor: theme.colors.accent.surface,
  },
})
