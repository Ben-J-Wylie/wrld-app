// src/components/features/clip/TimelineScrollbar.tsx
//
// Buffer-trim clip editor (clips initiative · C2). The thin horizontal scrollbar
// under the BufferTimeline — it replaced the discrete zoom toggle (2026-06-06). It
// represents the WHOLE buffer: the thumb's length is the visible fraction
// (viewport / content), so a short thumb = zoomed in, a full-width thumb = fully
// zoomed out. The thumb position is the scroll offset; dragging it pans the timeline.
//
// Presentational + gesture-emitting: the parent (BufferTimeline) owns content width,
// viewport, and scroll offset; this maps a thumb drag back to an offset via onScrollTo.
// Flat hairline styling per the design principles (no accent — it's a control, not a
// "look here").

import { useRef, useState } from 'react'
import { PanResponder, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { theme } from '@/tokens/theme'

const MIN_THUMB = 28
const TRACK_H = 22
const RAIL_H = 4
const THUMB_H = 8

type Props = {
  contentWidth: number
  viewport: number
  scrollOffset: number
  onScrollTo: (offset: number) => void
  style?: StyleProp<ViewStyle>
}

export function TimelineScrollbar({ contentWidth, viewport, scrollOffset, onScrollTo, style }: Props) {
  const [barW, setBarW] = useState(0)

  const scrollable = contentWidth > viewport + 1
  const frac = contentWidth > 0 ? Math.min(1, viewport / contentWidth) : 1
  const thumbW = Math.max(MIN_THUMB, barW * frac)
  const maxThumbX = Math.max(0, barW - thumbW)
  const maxScroll = Math.max(0, contentWidth - viewport)
  const thumbX = maxScroll > 0 ? (scrollOffset / maxScroll) * maxThumbX : 0

  // Refs so the once-created PanResponder reads fresh geometry.
  const startThumbX = useRef(0)
  const maxThumbXRef = useRef(maxThumbX)
  const maxScrollRef = useRef(maxScroll)
  const thumbXRef = useRef(thumbX)
  const onScrollToRef = useRef(onScrollTo)
  maxThumbXRef.current = maxThumbX
  maxScrollRef.current = maxScroll
  thumbXRef.current = thumbX
  onScrollToRef.current = onScrollTo

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 1,
      onPanResponderGrant: () => {
        startThumbX.current = thumbXRef.current
      },
      onPanResponderMove: (_e, g) => {
        const mtx = maxThumbXRef.current
        if (mtx <= 0) return
        const nx = Math.max(0, Math.min(mtx, startThumbX.current + g.dx))
        onScrollToRef.current((nx / mtx) * maxScrollRef.current)
      },
    }),
  ).current

  return (
    <View
      style={[styles.track, style]}
      onLayout={(e) => setBarW(e.nativeEvent.layout.width)}
    >
      <View style={styles.rail} />
      <View
        style={[
          styles.thumb,
          { width: thumbW, transform: [{ translateX: thumbX }] },
          !scrollable && styles.thumbInactive,
        ]}
        hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
        {...pan.panHandlers}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  track: {
    height: TRACK_H,
    justifyContent: 'center',
  },
  rail: {
    height: RAIL_H,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.border.subtle,
  },
  thumb: {
    position: 'absolute',
    left: 0,
    top: (TRACK_H - THUMB_H) / 2,
    height: THUMB_H,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.text.muted,
  },
  thumbInactive: {
    // Fully zoomed out (thumb spans the whole rail) — quieter, non-actionable.
    backgroundColor: theme.colors.text.subtle,
  },
})
