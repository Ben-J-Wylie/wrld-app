// src/components/features/clip/ClipToolRail.tsx
//
// Clip-editing tool rail for the buffer viewer — a vertical column of action icons
// (select current clip · set in · set out · delete selected · trim selected · save).
// Action-based: each button fires its `onPress` (no persistent selection), which is what
// distinguishes it from SourceRail (a view switch). Destructive tools (delete / trim)
// carry a `warn` tone (accent icon); disabled tools render greyed + inert. Presentational
// — the parent owns the in/out bracket + clip logic. Mirrors SourceRail's ink column so
// the two rails read as a pair on opposite edges of the field.
// See DESIGN.md Section 3 (Buffer-trim clip editor).

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Pressable } from '@/components/primitives/Pressable'
import { Icon } from '@/components/primitives/Icon'
import { theme } from '@/tokens/theme'

export type ClipToolItem = {
  key: string
  iconName: Parameters<typeof Icon>[0]['name']
  label: string
  onPress: () => void
  disabled?: boolean
  // 'warn' → destructive (delete / trim): accent icon.
  tone?: 'default' | 'warn'
}

// Dimmed cream for disabled tool icons on the ink column.
const DISABLED_ICON = 'rgba(236,230,214,0.30)'

type Props = {
  tools: ClipToolItem[]
  // 'rail' (default) — the dark translucent ink COLUMN overlaid on the field edge.
  // 'shelf' — a horizontal, transparent ROW of light icon buttons for a bottom shelf
  // (sits on the page background; matches BufferTransport's row).
  variant?: 'rail' | 'shelf'
  style?: StyleProp<ViewStyle>
}

export function ClipToolRail({ tools, variant = 'rail', style }: Props) {
  if (tools.length === 0) return null
  const shelf = variant === 'shelf'
  return (
    <View style={[shelf ? styles.shelf : styles.rail, style]}>
      {tools.map((t) => {
        const color = t.disabled
          ? shelf
            ? theme.colors.text.subtle
            : DISABLED_ICON
          : t.tone === 'warn'
            ? theme.colors.accent.default
            : shelf
              ? theme.colors.text.primary
              : theme.colors.text.inverse
        return (
          <Pressable
            key={t.key}
            variant={t.disabled ? 'none' : 'subtle'}
            onPress={() => {
              if (!t.disabled) t.onPress()
            }}
            accessibilityRole="button"
            accessibilityLabel={t.label}
            accessibilityState={{ disabled: !!t.disabled }}
            style={shelf ? styles.btnShelf : styles.btn}
          >
            <Icon name={t.iconName} size={shelf ? 'md' : 'sm'} color={color} />
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  rail: {
    backgroundColor: 'rgba(20,16,12,0.55)',
    borderRadius: theme.radius.full,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: 3,
    gap: 2,
    alignItems: 'center',
  },
  btn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Horizontal shelf row — light icons on the page background, sized to match the
  // BufferTransport step buttons so the two stacked shelves read as a set.
  shelf: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  btnShelf: {
    width: 40,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
