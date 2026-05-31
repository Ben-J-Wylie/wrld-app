// src/components/features/clip/LayerEditorRow.tsx
//
// Row inside the Clip Edit layers panel. Icon-tile + name/description
// column + tone-status pill + Toggle + row-menu IconButton. Deleted
// state strikes through the name and adds a "perm-cut" affordance.
//
// Variants:
//   default   — standard layer (cam / audio / loc / gyro / compass)
//   id-layer  — toggling this anonymizes the clip retroactively;
//               the description copy is consumer-driven, but the
//               feature surfaces the same UI as `default`. v0.2
//               adds no extra wiring — the consumer drives the
//               anonymize flow.

import type { ComponentProps } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Pressable } from '@/components/primitives/Pressable'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { IconButton } from '@/components/primitives/IconButton'
import { Toggle } from '@/components/primitives/Toggle'
import { theme } from '@/tokens/theme'

type IconName = ComponentProps<typeof Icon>['name']
type Variant = 'default' | 'id-layer'
export type LayerEditorState = 'on' | 'off' | 'deleted'

type Props = {
  variant?: Variant
  iconName: IconName
  name: string
  status?: string
  description?: string
  state: LayerEditorState
  onToggle: (on: boolean) => void
  onMenu?: () => void
  onUndelete?: () => void
  style?: StyleProp<ViewStyle>
}

export function LayerEditorRow({
  iconName,
  name,
  status,
  description,
  state,
  onToggle,
  onMenu,
  onUndelete,
  style,
}: Props) {
  const isOn = state === 'on'
  const isDeleted = state === 'deleted'

  return (
    <View style={[styles.row, isDeleted && styles.deleted, style]}>
      <View style={[styles.iconTile, isOn && styles.iconTileOn]}>
        <Icon
          name={iconName}
          size="md"
          color={
            isDeleted
              ? theme.colors.accent.default
              : isOn
                ? theme.colors.accent.default
                : theme.colors.text.muted
          }
        />
      </View>
      <View style={styles.col}>
        <View style={styles.titleRow}>
          <Text
            variant="bodyEmphasized"
            numberOfLines={1}
            style={isDeleted ? styles.strike : undefined}
          >
            {name}
          </Text>
          {status && (
            <View style={[styles.statusPill, isOn ? styles.statusPillOn : styles.statusPillOff]}>
              <Text
                variant="monoLabel"
                color={isOn ? theme.colors.accent.default : theme.colors.text.subtle}
              >
                {status}
              </Text>
            </View>
          )}
        </View>
        {description && (
          <Text variant="monoCaption" color={theme.colors.text.muted} numberOfLines={2}>
            {description}
          </Text>
        )}
        {isDeleted && onUndelete && (
          <Pressable
            variant="default"
            onPress={onUndelete}
            accessibilityRole="button"
            accessibilityLabel="Restore layer"
            hitSlop={8}
            style={styles.undeleteBtn}
          >
            <Text variant="monoLabel" color={theme.colors.accent.default}>
              RESTORE
            </Text>
          </Pressable>
        )}
      </View>
      {!isDeleted && (
        <Toggle value={isOn} onValueChange={onToggle} accessibilityLabel={name} />
      )}
      {onMenu && (
        <IconButton
          name="more-vertical"
          variant="ghost"
          size="md"
          onPress={onMenu}
          accessibilityLabel={`${name} options`}
        />
      )}
    </View>
  )
}

const ICON_TILE = 34

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    backgroundColor: theme.colors.bg.elevated,
  },
  deleted: {
    borderStyle: 'dashed',
    borderColor: theme.colors.accent.default,
    backgroundColor: theme.colors.accent.surface,
  },
  iconTile: {
    width: ICON_TILE,
    height: ICON_TILE,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bg.panel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconTileOn: {
    backgroundColor: theme.colors.accent.surface,
    borderWidth: 1,
    borderColor: theme.colors.accent.border,
  },
  col: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    flexWrap: 'wrap',
  },
  statusPill: {
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 1,
    borderRadius: theme.radius.full,
    borderWidth: 1,
  },
  statusPillOn: {
    borderColor: theme.colors.accent.border,
    backgroundColor: theme.colors.accent.surface,
  },
  statusPillOff: {
    borderColor: theme.colors.border.subtle,
  },
  strike: {
    textDecorationLine: 'line-through',
  },
  undeleteBtn: {
    alignSelf: 'flex-start',
    marginTop: 4,
  },
})
