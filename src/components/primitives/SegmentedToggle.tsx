// src/components/primitives/SegmentedToggle.tsx
//
// Mutually-exclusive single-select row inside a pill container. Distinct
// from `Chip` because the segments share a container and only one can
// be active; pressing a segment unpresses the others. Animated indicator
// glides from the previous selection to the new one.
//
// Variants:
//   default — active indicator is `text.primary` (warm ink); active
//             label is `text.inverse` (cream)
//   accent  — active indicator is `accent.default` (warm crimson);
//             active label is `text.inverse` (cream) — used for the
//             ANON-tagged segment on My Profile, e.g.
//
// Sizes: single canonical h:30 (inner segments h:24 after 3px padding).
//
// Equal-width segments. The container's width comes from its parent —
// the primitive is alignSelf:'stretch' by default. Pass a fixed-width
// parent if you want a compact pill, otherwise it fills the row.

import { useEffect, useRef, useState } from 'react'
import {
  Animated,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { Pressable } from './Pressable'
import { Text } from './Text'
import { theme } from '@/tokens/theme'

const HEIGHT = 30
const INNER_PAD = 3

type Variant = 'default' | 'accent'

type Option<T extends string> = { value: T; label: string }

type Props<T extends string> = {
  options: Option<T>[]
  value: T
  onChange: (next: T) => void
  variant?: Variant
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}

export function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
  variant = 'default',
  disabled,
  style,
}: Props<T>) {
  const [containerWidth, setContainerWidth] = useState(0)
  const activeIndex = options.findIndex((o) => o.value === value)
  const innerWidth = containerWidth > 0 ? containerWidth - 2 * INNER_PAD : 0
  const segWidth = options.length > 0 ? innerWidth / options.length : 0
  const indicatorX = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (segWidth <= 0 || activeIndex < 0) return
    Animated.spring(indicatorX, {
      toValue: activeIndex * segWidth,
      useNativeDriver: true,
      stiffness: 220,
      damping: 22,
      mass: 0.9,
    }).start()
  }, [activeIndex, segWidth, indicatorX])

  function handleLayout(e: LayoutChangeEvent) {
    setContainerWidth(e.nativeEvent.layout.width)
  }

  const indicatorBg =
    variant === 'accent' ? theme.colors.accent.default : theme.colors.text.primary

  return (
    <View
      style={[styles.container, disabled && styles.disabled, style]}
      onLayout={handleLayout}
    >
      {segWidth > 0 && activeIndex >= 0 && (
        <Animated.View
          style={[
            styles.indicator,
            {
              width: segWidth,
              backgroundColor: indicatorBg,
              transform: [{ translateX: indicatorX }],
            },
          ]}
        />
      )}
      {options.map((opt) => {
        const active = opt.value === value
        const labelColor = active
          ? theme.colors.text.inverse
          : theme.colors.text.muted
        return (
          <Pressable
            key={opt.value}
            variant="none"
            onPress={() => onChange(opt.value)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={opt.label}
            accessibilityState={{ selected: active, disabled: !!disabled }}
            style={[styles.segment, { width: segWidth || undefined }]}
          >
            <Text variant="monoLabel" color={labelColor}>
              {opt.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: HEIGHT,
    borderRadius: HEIGHT / 2,
    borderWidth: 1,
    borderColor: theme.colors.border.strong,
    padding: INNER_PAD,
    position: 'relative',
    alignSelf: 'stretch',
  },
  indicator: {
    position: 'absolute',
    top: INNER_PAD,
    left: INNER_PAD,
    bottom: INNER_PAD,
    borderRadius: (HEIGHT - 2 * INNER_PAD) / 2,
  },
  segment: {
    height: HEIGHT - 2 * INNER_PAD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.4,
  },
})
