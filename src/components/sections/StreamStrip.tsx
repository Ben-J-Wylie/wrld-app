// src/components/sections/StreamStrip.tsx
//
// Header ("STREAMS" + "X OF Y" count) + horizontal scroll of
// StreamTile items. Used to display which sensor layers a broadcast
// is delivering.

import type { ComponentProps } from 'react'
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { StreamTile } from '@/components/features/stream/StreamTile'
import { theme } from '@/tokens/theme'

type IconName = ComponentProps<typeof Icon>['name']

export type StreamStripLayer = {
  id: string
  iconName: IconName
  label: string
  value: string
  active?: boolean
  onPress?: () => void
}

type Props = {
  title?: string
  layers: StreamStripLayer[]
  style?: StyleProp<ViewStyle>
}

export function StreamStrip({ title = 'STREAMS', layers, style }: Props) {
  const activeCount = layers.filter((l) => l.active !== false).length
  return (
    <View style={[styles.section, style]}>
      <View style={styles.header}>
        <Text variant="monoLabel" color={theme.colors.text.subtle}>
          {title}
        </Text>
        <Text variant="monoLabel" color={theme.colors.text.muted}>
          {activeCount} OF {layers.length}
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {layers.map((l) => (
          <StreamTile
            key={l.id}
            iconName={l.iconName}
            label={l.label}
            value={l.value}
            active={l.active !== false}
            onPress={l.onPress}
          />
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    gap: theme.spacing.xs,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  scroll: {
    gap: theme.spacing.xs,
  },
})
