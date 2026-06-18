// src/components/features/discovery/PlanetSwitcher.tsx
//
// The planet switch control on the globe. A glass pill: ‹ glyph + name ›.
// Tap a chevron — or swipe the centre — to move to the neighbouring planet;
// the big move between worlds is the globe's job (it pulls back to space, swaps
// the planet, and dives back in), this is just the control that requests it.
// The centre chip slides in from the
// direction you came from so the change reads directional.
//
// Presentational + registry-driven: it renders whatever planets it's given
// (id / name / Feather glyph), so adding a planet to the registry surfaces it
// here automatically. Clamped (not cyclic) — chevrons dim at the ends.

import { useEffect, useRef } from 'react'
import {
  Animated,
  PanResponder,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { Pressable } from '@/components/primitives/Pressable'
import { Icon } from '@/components/primitives/Icon'
import { Text } from '@/components/primitives/Text'
import { theme } from '@/tokens/theme'
import type { Feather } from '@expo/vector-icons'

const SWIPE_COMMIT = 40 // px of horizontal drag before a swipe steps planets

export type PlanetOption = {
  id: string
  name: string
  glyph: string
}

type Props = {
  planets: PlanetOption[]
  activeId: string
  onChange: (id: string) => void
  /** Locked while a glide transition is mid-flight so taps don't stack. */
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}

export function PlanetSwitcher({ planets, activeId, onChange, disabled, style }: Props) {
  const index = Math.max(0, planets.findIndex((p) => p.id === activeId))
  const active = planets[index] ?? planets[0]
  const canPrev = index > 0
  const canNext = index < planets.length - 1

  const prevIndexRef = useRef(index)
  const slide = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const dir =
      index > prevIndexRef.current ? 1 : index < prevIndexRef.current ? -1 : 0
    prevIndexRef.current = index
    if (dir === 0) return
    // New chip enters offset from the direction of travel, then settles.
    slide.setValue(dir * 20)
    Animated.spring(slide, {
      toValue: 0,
      useNativeDriver: true,
      stiffness: 220,
      damping: 20,
      mass: 0.8,
    }).start()
  }, [index, slide])

  function step(delta: number) {
    if (disabled) return
    const target = planets[index + delta]
    if (!target) return
    onChange(target.id)
  }

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderRelease: (_, g) => {
        if (g.dx <= -SWIPE_COMMIT) step(1)
        else if (g.dx >= SWIPE_COMMIT) step(-1)
      },
    }),
  ).current

  if (!active) return null

  return (
    <View style={[styles.container, disabled && styles.disabled, style]}>
      <Pressable
        variant="none"
        onPress={() => step(-1)}
        disabled={disabled || !canPrev}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Previous planet"
        style={styles.chevron}
      >
        <Icon
          name="chevron-left"
          size="md"
          color={canPrev ? theme.colors.text.primary : theme.colors.text.subtle}
        />
      </Pressable>

      <View style={styles.center} {...pan.panHandlers}>
        <Animated.View
          style={[styles.chip, { transform: [{ translateX: slide }] }]}
        >
          <Icon
            name={active.glyph as keyof typeof Feather.glyphMap}
            size="md"
            color={theme.colors.text.primary}
          />
          <Text variant="monoLabel" color={theme.colors.text.primary}>
            {active.name}
          </Text>
        </Animated.View>
      </View>

      <Pressable
        variant="none"
        onPress={() => step(1)}
        disabled={disabled || !canNext}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Next planet"
        style={styles.chevron}
      >
        <Icon
          name="chevron-right"
          size="md"
          color={canNext ? theme.colors.text.primary : theme.colors.text.subtle}
        />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    height: 34,
    paddingHorizontal: theme.spacing.xs,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border.strong,
    backgroundColor: theme.colors.bg.glass,
  },
  disabled: { opacity: 0.6 },
  chevron: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    minWidth: 96,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
})
