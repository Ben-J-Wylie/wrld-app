import { useEffect, useRef, useState } from 'react'
import { View, Text, FlatList, StyleSheet, Animated, Pressable, Dimensions } from 'react-native'
import { theme } from '@/tokens/theme'
import { useStreamsNearStream } from '@/hooks/useStreamsNearStream'
import { NearbyStreamThumbnail } from './NearbyStreamThumbnail'
import { NearbyStreamRow } from './NearbyStreamRow'
import type { Stream } from '@/types'

const SHEET_HEIGHT = Dimensions.get('window').height * 0.82

type Props = {
  currentStreamId: string
  visible: boolean
  onHop: (stream: Stream) => void
}

export function NearbyStreamsDrawer({ currentStreamId, visible, onHop }: Props) {
  const { data: streams = [] } = useStreamsNearStream(currentStreamId, visible)
  const [expanded, setExpanded] = useState(false)
  const slideAnim = useRef(new Animated.Value(0)).current
  const expandAnim = useRef(new Animated.Value(0)).current

  // Collapse expanded state when drawer hides
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
      {/* Mini drawer */}
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
        pointerEvents={visible && !expanded ? 'box-none' : 'none'}
      >
        <View style={styles.drawerHeader}>
          <View style={styles.handle} />
          {streams.length > 0 && (
            <Pressable style={styles.seeAllBtn} onPress={() => setExpanded(true)} hitSlop={8}>
              <Text style={styles.seeAllText}>See all</Text>
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
            <NearbyStreamThumbnail stream={item} onPress={() => onHop(item)} />
          )}
        />
      </Animated.View>

      {/* Full-screen sheet */}
      <Animated.View
        style={[
          styles.sheet,
          {
            opacity: expandAnim,
            transform: [{
              translateY: expandAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [SHEET_HEIGHT, 0],
              }),
            }],
          },
        ]}
        pointerEvents={expanded ? 'box-none' : 'none'}
      >
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Nearby streams</Text>
          <Pressable onPress={() => setExpanded(false)} hitSlop={12}>
            <Text style={styles.closeBtn}>✕</Text>
          </Pressable>
        </View>
        <FlatList
          data={streams}
          keyExtractor={(s) => s.id}
          contentContainerStyle={styles.sheetList}
          renderItem={({ item }) => (
            <NearbyStreamRow stream={item} onPress={() => { setExpanded(false); onHop(item) }} />
          )}
        />
      </Animated.View>
    </>
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
  seeAllText: {
    ...theme.typography.caption,
    color: theme.colors.accent.default,
    fontWeight: '600',
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
  sheetTitle: {
    ...theme.typography.heading,
    color: theme.colors.text.primary,
  },
  closeBtn: {
    ...theme.typography.body,
    color: theme.colors.text.muted,
  },
  sheetList: {
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
})
