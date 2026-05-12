import { useEffect, useRef } from 'react'
import { View, FlatList, StyleSheet, Animated } from 'react-native'
import { theme } from '@/lib/theme'
import { useStreamsNearStream } from '@/hooks/useStreamsNearStream'
import { NearbyStreamThumbnail } from './NearbyStreamThumbnail'
import type { Stream } from '@/types'

type Props = {
  currentStreamId: string
  visible: boolean
  onHop: (stream: Stream) => void
}

export function NearbyStreamsDrawer({ currentStreamId, visible, onHop }: Props) {
  const { data: streams = [] } = useStreamsNearStream(currentStreamId, visible)
  const slideAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: visible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start()
  }, [visible, slideAnim])

  return (
    <Animated.View
      style={[
        styles.drawer,
        {
          opacity: slideAnim,
          transform: [{
            translateY: slideAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [120, 0],
            }),
          }],
        },
      ]}
      pointerEvents={visible ? 'box-none' : 'none'}
    >
      <View style={styles.handle} />
      <FlatList
        data={streams}
        keyExtractor={(s) => s.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <NearbyStreamThumbnail stream={item} onPress={() => onHop(item)} />
        )}
      />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  drawer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(10,10,15,0.92)',
    paddingBottom: 32,
    paddingTop: 10,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    alignSelf: 'center',
    marginBottom: theme.spacing.sm,
  },
  list: {
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.sm,
  },
})
