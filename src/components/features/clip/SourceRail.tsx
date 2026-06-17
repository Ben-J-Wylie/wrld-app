// src/components/features/clip/SourceRail.tsx
//
// Buffer viewer SOURCE SWITCHER — a vertical column of source icons overlaid on the
// scrub field. Tapping one chooses which captured track the field renders (camera →
// video, audio → waveform, location → map, a data channel → graph, identity → card).
//
// This is a VIEW switch, distinct from ClipSourcesDrawer (which is the save-set: which
// tracks get written into the saved clip). Presentational + selection-emitting: the
// parent owns which sources were captured and the currently-viewed one, and renders the
// matching view into the field's frame slot.
//
// A self-contained translucent-ink column so the icons read over any underlying view
// (dark video, light map, light identity card). Pass only the sources the session
// actually captured. See DESIGN.md Section 3 (Buffer-trim clip editor).

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Pressable } from '@/components/primitives/Pressable'
import { Icon } from '@/components/primitives/Icon'
import { theme } from '@/tokens/theme'

export type SourceRailItem = {
  key: string
  iconName: Parameters<typeof Icon>[0]['name']
  label: string
  // Not captured in this buffer → shown greyed and non-selectable.
  disabled?: boolean
}

// Dimmed cream for not-captured (disabled) source icons on the ink column.
const DISABLED_ICON = 'rgba(236,230,214,0.30)'

type Props = {
  sources: SourceRailItem[]
  value: string
  onChange: (key: string) => void
  // Column (default — the clip-editor field rail) or row (the stream view + clips-page rails,
  // which sit horizontally between the bottom controls). Same pill, same ink track, axis swapped.
  orientation?: 'vertical' | 'horizontal'
  style?: StyleProp<ViewStyle>
}

export function SourceRail({ sources, value, onChange, orientation = 'vertical', style }: Props) {
  if (sources.length === 0) return null
  return (
    <View style={[styles.rail, orientation === 'horizontal' && styles.railHorizontal, style]}>
      {sources.map((s) => {
        const active = !s.disabled && s.key === value
        return (
          <Pressable
            key={s.key}
            variant={s.disabled ? 'none' : 'subtle'}
            onPress={() => {
              if (!s.disabled) onChange(s.key)
            }}
            accessibilityRole="button"
            accessibilityLabel={s.label}
            accessibilityState={{ selected: active, disabled: !!s.disabled }}
            style={[styles.btn, active && styles.btnActive]}
          >
            <Icon
              name={s.iconName}
              size="sm"
              color={s.disabled ? DISABLED_ICON : theme.colors.text.inverse}
            />
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  rail: {
    // Translucent ink column so it reads over video, maps, or light cards alike.
    // Sized so the full capture suite (~11 sources) fits the field's height.
    backgroundColor: 'rgba(20,16,12,0.55)',
    borderRadius: theme.radius.full,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: 3,
    gap: 2,
    alignItems: 'center',
  },
  // Horizontal: a row track (swap padding so the pill stays snug on the short axis).
  railHorizontal: {
    flexDirection: 'row',
    paddingVertical: 3,
    paddingHorizontal: theme.spacing.xs,
    justifyContent: 'center',
  },
  btn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnActive: {
    backgroundColor: theme.colors.accent.default,
  },
})
