// src/components/features/stream/StreamTile.tsx
//
// Per-sensor tile for the Viewer Sheet's STREAMS strip — one tile per
// active broadcaster layer (cam / audio / screen / loc / gyro / compass
// / profile-ID, see Phase 14 sensor model).
//
// Visual: vertical tile, ~80 tall, ~84 min-wide. Icon-square (28) on
// top, mono-caps label in the middle, value/spec below ("1080p",
// "48 kHz", "GPS", "192°", "OFF" for inactive). When `active` is true
// the tile gets a 2px accent border + brighter text; when false it
// dims to 0.45 opacity. Pressable wrapper supplies scale press
// feedback.
//
// Consumer-flat API — feature stays domain-blind. The Viewer Sheet
// (a section) maps a domain layer (`{ kind: 'cam', ... }`) into
// `{ iconName: 'video', label: 'CAM', value: '1080p', active: true }`
// before passing it in.

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { Pressable } from '@/components/primitives/Pressable'
import { Text } from '@/components/primitives/Text'
import { theme } from '@/tokens/theme'

type Props = {
  iconName: keyof typeof Feather.glyphMap
  label: string
  value: string
  active?: boolean
  onPress?: () => void
  style?: StyleProp<ViewStyle>
}

export function StreamTile({
  iconName,
  label,
  value,
  active = true,
  onPress,
  style,
}: Props) {
  const borderColor = active ? theme.colors.accent.default : theme.colors.border.subtle
  const borderWidth = active ? 2 : 1
  const labelColor = active ? theme.colors.text.primary : theme.colors.text.muted
  const valueColor = active ? theme.colors.text.primary : theme.colors.text.subtle

  const body = (
    <>
      <View style={[styles.iconSquare, { borderColor }]}>
        <Feather
          name={iconName}
          size={16}
          color={active ? theme.colors.accent.default : theme.colors.text.muted}
        />
      </View>
      <Text variant="monoLabel" color={labelColor} numberOfLines={1}>
        {label}
      </Text>
      <Text variant="monoCaption" color={valueColor} numberOfLines={1}>
        {value}
      </Text>
    </>
  )

  const tileStyle = [
    styles.tile,
    { borderColor, borderWidth },
    !active && styles.inactive,
    style,
  ]

  if (onPress) {
    return (
      <Pressable
        variant="subtle"
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label} ${value}`}
        style={tileStyle}
      >
        {body}
      </Pressable>
    )
  }
  return <View style={tileStyle}>{body}</View>
}

const TILE_W = 84
const TILE_H = 80
const ICON_SQUARE = 28

const styles = StyleSheet.create({
  tile: {
    width: TILE_W,
    height: TILE_H,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bg.elevated,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: theme.spacing.xs,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconSquare: {
    width: ICON_SQUARE,
    height: ICON_SQUARE,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inactive: {
    opacity: 0.45,
  },
})
