// src/components/sections/ActionSheet.tsx
//
// Bottom sheet hosting a header row + a list of action rows + a
// Cancel row. Action rows are `{ icon?, label, onPress, tone? }` —
// `tone='warn'` paints the row in accent (single-accent rule covers
// destructive). Used for profile kebab menus, clip-edit row-menus,
// and other contextual menus.

import type { ComponentProps } from 'react'
import { Dimensions, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BottomSheet } from '@/components/primitives/BottomSheet'
import { Pressable } from '@/components/primitives/Pressable'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { theme } from '@/tokens/theme'

type IconName = ComponentProps<typeof Icon>['name']

export type ActionSheetAction = {
  id: string
  label: string
  iconName?: IconName
  tone?: 'default' | 'warn'
  onPress: () => void
}

type Props = {
  visible: boolean
  onClose: () => void
  header?: string
  actions: ActionSheetAction[]
  cancelLabel?: string
  style?: StyleProp<ViewStyle>
}

export function ActionSheet({
  visible,
  onClose,
  header,
  actions,
  cancelLabel = 'Cancel',
  style,
}: Props) {
  const insets = useSafeAreaInsets()
  // Size the sheet to its content (the default `peek` is a fixed 280 → longer
  // lists clip the bottom rows). Generous per-row estimate; cap at 85% of the
  // screen and scroll past that.
  const ROW_H = 52
  const needed =
    24 /* grabber */ + (header ? 44 : 0) + actions.length * ROW_H +
    64 /* cancel + its margin */ + theme.spacing.md + insets.bottom
  const maxH = Math.round(Dimensions.get('window').height * 0.85)
  const scrollable = needed > maxH

  return (
    <BottomSheet visible={visible} onClose={onClose} peekHeight={Math.min(needed, maxH)} scrollable={scrollable}>
      <View style={[style, !scrollable && { paddingBottom: insets.bottom }]}>
        {header && (
          <View style={styles.header}>
            <Text variant="monoLabel" color={theme.colors.text.subtle}>
              {header}
            </Text>
          </View>
        )}
        <View style={styles.list}>
          {actions.map((a, i) => {
            const ink =
              a.tone === 'warn' ? theme.colors.accent.default : theme.colors.text.primary
            return (
              <Pressable
                key={a.id}
                variant="subtle"
                onPress={() => {
                  onClose()
                  a.onPress()
                }}
                accessibilityRole="button"
                accessibilityLabel={a.label}
                style={[styles.row, i > 0 && styles.rowBorder]}
              >
                {a.iconName && <Icon name={a.iconName} size="md" color={ink} />}
                <Text variant="bodyEmphasized" color={ink}>
                  {a.label}
                </Text>
              </Pressable>
            )
          })}
        </View>
        <Pressable
          variant="subtle"
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={cancelLabel}
          style={[styles.row, styles.cancel]}
        >
          <Text variant="bodyEmphasized" color={theme.colors.text.muted}>
            {cancelLabel}
          </Text>
        </Pressable>
      </View>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  list: {
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bg.elevated,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    overflow: 'hidden',
    marginHorizontal: theme.spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.subtle,
  },
  cancel: {
    marginTop: theme.spacing.sm,
    marginHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bg.elevated,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    justifyContent: 'center',
  },
})
