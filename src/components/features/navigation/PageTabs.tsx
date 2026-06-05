// src/components/features/navigation/PageTabs.tsx
//
// Underline page-tabs — the "hybrid navigation" affordance (2026-06-05
// prototype). Sits under the ScreenHeader and switches between sibling
// sub-pages of an area (e.g. Wallet → Balance / Top Up / Cash Out) by swapping
// content in place — no route push, no back arrow. Distinct from
// `SegmentedToggle` (a pill filter control); these read as navigation.
//
// Generic over the tab key so callers keep a typed union. Presentational —
// the host owns the active key + the content swap.

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Pressable } from '@/components/primitives/Pressable'
import { Text } from '@/components/primitives/Text'
import { theme } from '@/tokens/theme'

type Tab<T extends string> = { key: T; label: string }

type Props<T extends string> = {
  tabs: Tab<T>[]
  value: T
  onChange: (key: T) => void
  style?: StyleProp<ViewStyle>
}

export function PageTabs<T extends string>({ tabs, value, onChange, style }: Props<T>) {
  return (
    <View style={[styles.row, style]}>
      {tabs.map((t) => {
        const active = t.key === value
        return (
          <Pressable
            key={t.key}
            variant="default"
            onPress={() => onChange(t.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={styles.tab}
          >
            <Text
              variant={active ? 'bodyEmphasized' : 'body'}
              color={active ? theme.colors.text.primary : theme.colors.text.muted}
            >
              {t.label}
            </Text>
            <View style={[styles.underline, active && styles.underlineActive]} />
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.subtle,
  },
  tab: {
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingTop: theme.spacing.sm,
  },
  // Underline sits flush on the row's bottom border; matches the text width
  // (the tab is content-sized, the underline stretches to it).
  underline: {
    alignSelf: 'stretch',
    height: 2,
    borderRadius: 1,
    backgroundColor: 'transparent',
  },
  underlineActive: {
    backgroundColor: theme.colors.accent.default,
  },
})
