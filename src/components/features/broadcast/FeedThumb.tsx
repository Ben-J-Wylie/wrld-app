// src/components/features/broadcast/FeedThumb.tsx
//
// Per-layer animated mini visualization. Each variant has a distinct
// treatment that suggests the data shape of the underlying sensor.
// Used inside FeedRow (76×60 thumb on the Go Live arming screen) and
// as Clip Edit preview fallbacks (lg variant).
//
// v1 uses static / Animated.View patterns rather than SVG. Each layer
// gets a recognizable hint of motion or layout; fidelity is "design
// system" rather than "exact mock illustration." When real
// illustration assets land, the per-layer renderers swap in place.

import { useEffect, useRef } from 'react'
import type { ComponentProps } from 'react'
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { theme } from '@/tokens/theme'

// The first seven are the v0.2 sensor model; speed / torch / temp /
// motion are v0.3+ earmarked sources that ship UI-present (a static
// glyph thumb) ahead of capture wiring.
export type FeedKind =
  | 'cam'
  | 'audio'
  | 'screen'
  | 'loc'
  | 'gyro'
  | 'compass'
  | 'profile'
  | 'speed'
  | 'torch'
  | 'temp'
  | 'motion'
  | 'accel'
  | 'chat'

type IconName = ComponentProps<typeof Icon>['name']

// v0.3+ earmarked sources render a static Feather glyph rather than a
// bespoke animated visualization.
const GLYPH: Partial<Record<FeedKind, IconName>> = {
  speed: 'fast-forward',
  torch: 'zap',
  temp: 'thermometer',
  motion: 'activity',
  accel: 'move',
  chat: 'message-circle',
}

type Size = 'md' | 'lg'

type Props = {
  kind: FeedKind
  size?: Size
  active?: boolean
  style?: StyleProp<ViewStyle>
}

const DIM: Record<Size, { w: number; h: number }> = {
  md: { w: 76, h: 60 },
  lg: { w: 160, h: 110 },
}

export function FeedThumb({ kind, size = 'md', active = true, style }: Props) {
  const { w, h } = DIM[size]
  return (
    <View
      style={[
        styles.frame,
        { width: w, height: h, opacity: active ? 1 : 0.45 },
        style,
      ]}
    >
      {renderKind(kind, active, w, h)}
    </View>
  )
}

function renderKind(kind: FeedKind, active: boolean, w: number, h: number) {
  switch (kind) {
    case 'cam':
      return <CamViewfinder w={w} h={h} />
    case 'audio':
      return <AudioBars active={active} />
    case 'screen':
      return <ScreenDevice />
    case 'loc':
      return <LocPing active={active} />
    case 'gyro':
      return <GyroCube active={active} />
    case 'compass':
      return <CompassRose active={active} />
    case 'profile':
      return <ProfileSilhouette />
    case 'speed':
    case 'torch':
    case 'temp':
    case 'motion':
    case 'accel':
    case 'chat':
      return <GlyphThumb name={GLYPH[kind]!} />
  }
}

function GlyphThumb({ name }: { name: IconName }) {
  return (
    <View style={styles.center}>
      <View style={styles.glyphTile}>
        <Icon name={name} size="lg" color={theme.colors.text.muted} />
      </View>
    </View>
  )
}

function CamViewfinder({ w, h }: { w: number; h: number }) {
  const corner = 10
  return (
    <View style={styles.center}>
      <View style={[styles.viewfinder, { width: w * 0.7, height: h * 0.6 }]}>
        <View style={[styles.cornerCommon, styles.cornerTL, { width: corner, height: corner }]} />
        <View style={[styles.cornerCommon, styles.cornerTR, { width: corner, height: corner }]} />
        <View style={[styles.cornerCommon, styles.cornerBL, { width: corner, height: corner }]} />
        <View style={[styles.cornerCommon, styles.cornerBR, { width: corner, height: corner }]} />
      </View>
    </View>
  )
}

function AudioBars({ active }: { active: boolean }) {
  const heights = useRef([6, 12, 18, 14, 8, 16, 10].map((h) => new Animated.Value(h))).current
  useEffect(() => {
    if (!active) return
    const loop = Animated.loop(
      Animated.parallel(
        heights.map((v, i) =>
          Animated.sequence([
            Animated.delay(i * 60),
            Animated.timing(v, { toValue: 6 + Math.random() * 18, duration: 400, useNativeDriver: false }),
            Animated.timing(v, { toValue: 6 + Math.random() * 18, duration: 400, useNativeDriver: false }),
          ]),
        ),
      ),
    )
    loop.start()
    return () => loop.stop()
  }, [active])
  return (
    <View style={[styles.center, styles.row]}>
      {heights.map((v, i) => (
        <Animated.View
          key={i}
          style={[styles.audioBar, { height: v }]}
        />
      ))}
    </View>
  )
}

function ScreenDevice() {
  return (
    <View style={styles.center}>
      <View style={styles.screenDevice}>
        <View style={styles.screenLights}>
          <View style={[styles.light, { backgroundColor: '#FF5F57' }]} />
          <View style={[styles.light, { backgroundColor: '#FEBC2E' }]} />
          <View style={[styles.light, { backgroundColor: '#28C840' }]} />
        </View>
      </View>
    </View>
  )
}

function LocPing({ active }: { active: boolean }) {
  const scale = useRef(new Animated.Value(0)).current
  const opacity = useRef(new Animated.Value(0.6)).current
  useEffect(() => {
    if (!active) return
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, { toValue: 0, duration: 0, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 3, duration: 1500, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.6, duration: 0, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 1500, useNativeDriver: true }),
        ]),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [active])
  return (
    <View style={styles.center}>
      <View style={styles.locGrid} />
      <View style={styles.locPinWrap}>
        <Animated.View style={[styles.locRing, { transform: [{ scale }], opacity }]} />
        <View style={styles.locPin} />
      </View>
    </View>
  )
}

function GyroCube({ active }: { active: boolean }) {
  const rot = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (!active) return
    const loop = Animated.loop(
      Animated.timing(rot, { toValue: 1, duration: 3000, useNativeDriver: true }),
    )
    loop.start()
    return () => loop.stop()
  }, [active])
  const rotate = rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })
  return (
    <View style={styles.center}>
      <Animated.View style={[styles.gyroCube, { transform: [{ rotate }, { rotateX: '35deg' }] }]} />
    </View>
  )
}

function CompassRose({ active }: { active: boolean }) {
  const rot = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (!active) return
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(rot, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(rot, { toValue: -0.5, duration: 1800, useNativeDriver: true }),
        Animated.timing(rot, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [active])
  const rotate = rot.interpolate({ inputRange: [-1, 1], outputRange: ['-180deg', '180deg'] })
  return (
    <View style={styles.center}>
      <View style={styles.compassDial}>
        <Animated.View style={[styles.compassNeedle, { transform: [{ rotate }] }]} />
        <Text variant="monoLabel" color={theme.colors.text.subtle} style={styles.compassN}>
          N
        </Text>
      </View>
    </View>
  )
}

function ProfileSilhouette() {
  return (
    <View style={styles.center}>
      <View style={styles.profileBust}>
        <Icon name="user" size="lg" color={theme.colors.text.muted} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    backgroundColor: theme.colors.bg.panel,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  viewfinder: {
    position: 'relative',
  },
  cornerCommon: {
    position: 'absolute',
    borderColor: theme.colors.text.muted,
  },
  cornerTL: { top: 0, left: 0, borderLeftWidth: 2, borderTopWidth: 2 },
  cornerTR: { top: 0, right: 0, borderRightWidth: 2, borderTopWidth: 2 },
  cornerBL: { bottom: 0, left: 0, borderLeftWidth: 2, borderBottomWidth: 2 },
  cornerBR: { bottom: 0, right: 0, borderRightWidth: 2, borderBottomWidth: 2 },
  audioBar: {
    width: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.text.muted,
  },
  screenDevice: {
    width: 40,
    height: 28,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: theme.colors.text.muted,
    backgroundColor: theme.colors.bg.elevated,
    overflow: 'hidden',
  },
  screenLights: {
    flexDirection: 'row',
    gap: 3,
    padding: 4,
  },
  light: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  locGrid: {
    ...StyleSheet.absoluteFillObject,
    borderColor: theme.colors.border.subtle,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    opacity: 0.5,
  },
  locPinWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  locRing: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: theme.colors.accent.default,
  },
  locPin: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.accent.default,
  },
  gyroCube: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: theme.colors.text.muted,
    backgroundColor: theme.colors.bg.elevated,
  },
  compassDial: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compassNeedle: {
    position: 'absolute',
    width: 2,
    height: 26,
    backgroundColor: theme.colors.accent.default,
  },
  compassN: {
    position: 'absolute',
    top: -2,
  },
  profileBust: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.bg.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
  },
  glyphTile: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bg.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
  },
})
