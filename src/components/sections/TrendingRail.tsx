// src/components/sections/TrendingRail.tsx
//
// Section header ("Trending now" + optional "See all" link) + a
// horizontal scroll of StreamCard.trending items. Renders empty state
// when `streams` is empty.

import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Pressable } from '@/components/primitives/Pressable'
import { Text } from '@/components/primitives/Text'
import { StreamCard } from '@/components/features/stream/StreamCard'
import { theme } from '@/tokens/theme'

export type TrendingStream = {
  id: string
  thumbnailUrl?: string | null
  title: string
  viewerCount: number
  channel?: string
  city?: string
  isLive?: boolean
  onPress?: () => void
}

type Props = {
  title?: string
  streams: TrendingStream[]
  onTapAll?: () => void
  emptyLabel?: string
  style?: StyleProp<ViewStyle>
}

export function TrendingRail({
  title = 'Trending now',
  streams,
  onTapAll,
  emptyLabel = 'No streams nearby',
  style,
}: Props) {
  return (
    <View style={[styles.section, style]}>
      <View style={styles.header}>
        <Text variant="heading">{title}</Text>
        {onTapAll && (
          <Pressable
            variant="default"
            onPress={onTapAll}
            accessibilityRole="button"
            accessibilityLabel="See all"
            hitSlop={8}
          >
            <Text variant="bodyEmphasized" color={theme.colors.accent.default}>
              See all
            </Text>
          </Pressable>
        )}
      </View>
      {streams.length === 0 ? (
        <Text variant="caption" color={theme.colors.text.muted}>
          {emptyLabel}
        </Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          {streams.map((s) => (
            <StreamCard
              key={s.id}
              thumbnailUrl={s.thumbnailUrl}
              title={s.title}
              viewerCount={s.viewerCount}
              channel={s.channel}
              city={s.city}
              isLive={s.isLive}
              onPress={s.onPress}
            />
          ))}
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    gap: theme.spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scroll: {
    gap: theme.spacing.sm,
    paddingRight: theme.spacing.sm,
  },
})
