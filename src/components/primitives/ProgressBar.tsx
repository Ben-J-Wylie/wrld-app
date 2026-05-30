// src/components/primitives/ProgressBar.tsx
//
// Step progress indicator. Sits at the top of every wizard step
// (Onboarding x 4 wizards, Report multi-step modal, future flows).
//
// Modes:
//   bars (default) — segmented thin bars across the width; one bar per
//                    step, accent-filled up to `current`, line color
//                    after. 3px tall.
//   dots           — centered row of small dots, same fill semantics.
//                    6px diameter. Use for short flows (2–4 steps).
//
// Consumer passes `total` (step count) + `current` (number of completed
// steps; 0 = nothing started, `total` = everything done).

import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { theme } from '@/tokens/theme'

type Mode = 'bars' | 'dots'

type Props = {
  total: number
  current: number
  mode?: Mode
  style?: StyleProp<ViewStyle>
}

export function ProgressBar({ total, current, mode = 'bars', style }: Props) {
  if (total < 1) return null
  const items = Array.from({ length: total }, (_, i) => i < current)

  if (mode === 'dots') {
    return (
      <View style={[styles.dotsRow, style]}>
        {items.map((filled, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor: filled
                  ? theme.colors.accent.default
                  : theme.colors.border.strong,
              },
            ]}
          />
        ))}
      </View>
    )
  }

  return (
    <View style={[styles.barsRow, style]}>
      {items.map((filled, i) => (
        <View
          key={i}
          style={[
            styles.bar,
            {
              backgroundColor: filled
                ? theme.colors.accent.default
                : theme.colors.border.strong,
            },
          ]}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  barsRow: {
    flexDirection: 'row',
    gap: 4,
    alignSelf: 'stretch',
  },
  bar: {
    flex: 1,
    height: 3,
    borderRadius: 1.5,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    alignSelf: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
})
