// src/components/features/stream/NearbyStreamsDrawer.tsx
//
// Phase 7 multi-angle hop UX — survives 12.6 as the container, but its
// internals migrated: NearbyStreamRow + NearbyStreamThumbnail retired,
// replaced by StreamCard (compact + trending variants). Distance lives
// in the `city` slot since StreamCard's consumer-flat API doesn't
// surface stream.distanceMeters directly.

import { useEffect, useRef, useState } from 'react'
import {
  Animated,
  Dimensions,
  FlatList,
  StyleSheet,
  View,
} from 'react-native'
import { theme } from '@/tokens/theme'
import { useStreamsNearStream } from '@/hooks/useStreamsNearStream'
import { StreamCard } from './StreamCard'
import { Text } from '@/components/primitives/Text'
import { IconButton } from '@/components/primitives/IconButton'
import { Pressable } from '@/components/primitives/Pressable'
import type { Stream } from '@/types'

const SHEET_HEIGHT = Dimensions.get('window').height * 0.82

type Props = {
  currentStreamId: string
  visible: boolean
  onHop: (stream: Stream) => void
}

function distanceLabel(stream: Stream): string | undefined {
  if (stream.distanceMeters === undefined) return undefined
  return `${stream.distanceMeters}m`
}

export function NearbyStreamsDrawer({ currentStreamId, visible, onHop }: Props) {
  const { data: streams = [] } = useStreamsNearStream(currentStreamId, visible)
  const [expanded, setExpanded] = useState(false)
  const slideAnim = useRef(new Animated.Value(0)).current
  const expandAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!visible) setExpanded(false)
  }, [visible])

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: visible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start()
  }, [visible, slideAnim])

  useEffect(() => {
    Animated.timing(expandAnim, {
      toValue: expanded ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start()
  }, [expanded, expandAnim])

  return (
    <>
      {/* Mini drawer — horizontal scroll of StreamCard.trending */}
      <Animated.View
        style={[
          styles.drawer,
          {
            opacity: slideAnim,
            transform: [
              {
                translateY: slideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [120, 0],
                }),
              },
            ],
          },
        ]}
        pointerEvents={visible && !expanded ? 'box-none' : 'none'}
      >
        <View style={styles.drawerHeader}>
          <View style={styles.handle} />
          {streams.length > 0 && (
            <Pressable
              variant="default"
              onPress={() => setExpanded(true)}
              accessibilityRole="button"
              accessibilityLabel="See all nearby streams"
              hitSlop={8}
              style={styles.seeAllBtn}
            >
              <Text variant="bodyEmphasized" color={theme.colors.accent.default}>
                See all
              </Text>
            </Pressable>
          )}
        </View>
        <FlatList
          data={streams}
          keyExtractor={(s) => s.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <StreamCard
              variant="trending"
              thumbnailUrl={item.thumbnailUrl}
              title={item.title}
              viewerCount={item.viewerCount}
              city={distanceLabel(item)}
              isLive={item.isLive}
              onPress={() => onHop(item)}
            />
          )}
        />
      </Animated.View>

      {/* Full-screen sheet — vertical list of StreamCard.compact */}
      <Animated.View
        style={[
          styles.sheet,
          {
            opacity: expandAnim,
            transform: [
              {
                translateY: expandAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [SHEET_HEIGHT, 0],
                }),
              },
            ],
          },
        ]}
        pointerEvents={expanded ? 'box-none' : 'none'}
      >
        <View style={styles.sheetHeader}>
          <Text variant="heading">Nearby streams</Text>
          <IconButton
            name="x"
            variant="ghost"
            size="md"
            onPress={() => setExpanded(false)}
            accessibilityLabel="Close nearby streams"
          />
        </View>
        <FlatList
          data={streams}
          keyExtractor={(s) => s.id}
          contentContainerStyle={styles.sheetList}
          renderItem={({ item }) => (
            <StreamCard
              variant="compact"
              thumbnailUrl={item.thumbnailUrl}
              title={item.title}
              viewerCount={item.viewerCount}
              city={distanceLabel(item)}
              isLive={item.isLive}
              onPress={() => {
                setExpanded(false)
                onHop(item)
              }}
            />
          )}
        />
      </Animated.View>
    </>
  )
}

const styles = StyleSheet.create({
  // Mini drawer floats over the video; dark backdrop is intentional
  // (no dark-glass surface token yet — same situation as the empty
  // card on GlobeScreen).
  drawer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(10,10,15,0.92)',
    paddingBottom: 32,
    paddingTop: 10,
    borderTopLeftRadius: theme.radius.md,
    borderTopRightRadius: theme.radius.md,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border.subtle,
  },
  seeAllBtn: {
    position: 'absolute',
    right: theme.spacing.md,
  },
  list: {
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    backgroundColor: theme.colors.bg.primary,
    borderTopLeftRadius: theme.radius.md,
    borderTopRightRadius: theme.radius.md,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: theme.colors.border.subtle,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.subtle,
  },
  sheetList: {
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
})
