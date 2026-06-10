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
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { GestureDetector, Gesture } from 'react-native-gesture-handler'
import { runOnJS } from 'react-native-reanimated'
import { theme } from '@/tokens/theme'

// Visual stays a thin hairline; the GRAB target is deliberately much larger —
// a taller track for vertical room, a finger-wide minimum thumb, and generous
// hitSlop around the thin thumb so a thin scrollbar is still easy to catch.
const MIN_THUMB = 44
const TRACK_H = 34
const RAIL_H = 4
const THUMB_H = 8
// Touch padding around the (thin) thumb. Vertical is sized to fill the track
// (THUMB_H + 2×SLOP ≈ TRACK_H) so the whole bar height is grabbable without
// spilling into the zoom toggle below; horizontal makes the thumb ends catchable.
const THUMB_HIT_SLOP = { top: 13, bottom: 13, left: 12, right: 12 }

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

  // Anchor the thumb at touch-down, then drag it by the gesture's translation.
  function onGrab() {
    startThumbX.current = thumbXRef.current
  }
  function onDrag(translationX: number) {
    const mtx = maxThumbXRef.current
    if (mtx <= 0) return
    const nx = Math.max(0, Math.min(mtx, startThumbX.current + translationX))
    onScrollToRef.current((nx / mtx) * maxScrollRef.current)
  }
  // RNGH Pan (not PanResponder) so a horizontal thumb drag claims the gesture and the
  // parent vertical ScrollView stays put — same arbitration as the timeline scrub and
  // the buffer field: `activeOffsetX` claims horizontal movement, `failOffsetY` lets a
  // vertical drag fall through to the page scroll. The enlarged grab target rides on
  // the gesture's hitSlop (bounded by the track height, so it works on Android too).
  const pan = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .failOffsetY([-12, 12])
    .hitSlop(THUMB_HIT_SLOP)
    .onBegin(() => {
      'worklet'
      runOnJS(onGrab)()
    })
    .onUpdate((e) => {
      'worklet'
      runOnJS(onDrag)(e.translationX)
    })

  return (
    <View
      style={[styles.track, style]}
      onLayout={(e) => setBarW(e.nativeEvent.layout.width)}
    >
      <View style={styles.rail} />
      <GestureDetector gesture={pan}>
        <View
          style={[
            styles.thumb,
            { width: thumbW, transform: [{ translateX: thumbX }] },
            !scrollable && styles.thumbInactive,
          ]}
        />
      </GestureDetector>
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
