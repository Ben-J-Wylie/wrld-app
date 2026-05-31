// src/components/features/clip/Timeline.tsx
//
// Clip Edit timeline. 44-tall track with a waveform background, a
// scrubber playhead, and optional trim handles that define the
// "active" region. Trimmed-out regions get a dark hatched overlay.
//
// State tuple: { duration, scrub, trimStart, trimEnd } — consumer
// drives all four values; this feature provides:
//
//   • PanResponder drag on the playhead (emits `onScrub(t)`)
//   • PanResponder drag on each trim handle (emits
//     `onTrimChange({start, end})`)
//   • Auto-clamping (scrub stays in [trimStart, trimEnd], handles
//     stay apart, both stay in [0, duration])
//
// Waveform is approximated with a row of mono-height bars from a
// pseudo-random seed; consumer can pass `waveformPeaks: number[]`
// to drive real audio data.

import { useMemo, useRef, useState } from 'react'
import {
  PanResponder,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { Text } from '@/components/primitives/Text'
import { theme } from '@/tokens/theme'

type Props = {
  duration: number
  scrub: number
  trimStart?: number
  trimEnd?: number
  waveformPeaks?: number[]
  onScrub: (t: number) => void
  onTrimChange?: (range: { start: number; end: number }) => void
  style?: StyleProp<ViewStyle>
}

const TRACK_HEIGHT = 44
const HANDLE_W = 12

export function Timeline({
  duration,
  scrub,
  trimStart,
  trimEnd,
  waveformPeaks,
  onScrub,
  onTrimChange,
  style,
}: Props) {
  const [width, setWidth] = useState(0)
  const trackRef = useRef<View>(null)
  const hasTrim = trimStart !== undefined && trimEnd !== undefined && !!onTrimChange
  const tStart = trimStart ?? 0
  const tEnd = trimEnd ?? duration

  const peaks = useMemo(
    () => waveformPeaks ?? defaultPeaks(64),
    [waveformPeaks],
  )

  const tToX = (t: number) => (duration <= 0 ? 0 : (t / duration) * width)
  const xToT = (x: number) =>
    duration <= 0 ? 0 : Math.max(0, Math.min(duration, (x / Math.max(1, width)) * duration))

  function makePanResponder(getStartT: () => number, applyDelta: (next: number) => void) {
    let startT = 0
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startT = getStartT()
      },
      onPanResponderMove: (_e, g) => {
        if (width <= 0) return
        const delta = (g.dx / width) * duration
        applyDelta(startT + delta)
      },
    })
  }

  const scrubPan = useRef(
    makePanResponder(
      () => scrub,
      (next) => onScrub(Math.max(tStart, Math.min(tEnd, next))),
    ),
  ).current

  const startPan = useRef(
    makePanResponder(
      () => tStart,
      (next) => {
        if (!hasTrim) return
        const clamped = Math.max(0, Math.min(tEnd - 0.1, next))
        onTrimChange!({ start: clamped, end: tEnd })
      },
    ),
  ).current

  const endPan = useRef(
    makePanResponder(
      () => tEnd,
      (next) => {
        if (!hasTrim) return
        const clamped = Math.max(tStart + 0.1, Math.min(duration, next))
        onTrimChange!({ start: tStart, end: clamped })
      },
    ),
  ).current

  function onLayout(e: LayoutChangeEvent) {
    setWidth(e.nativeEvent.layout.width)
  }

  return (
    <View style={style}>
      <View ref={trackRef} style={styles.track} onLayout={onLayout}>
        <View style={styles.peaks} pointerEvents="none">
          {peaks.map((h, i) => (
            <View
              key={i}
              style={[styles.peakBar, { height: 4 + h * (TRACK_HEIGHT - 8) }]}
            />
          ))}
        </View>
        {hasTrim && (
          <>
            <View
              style={[
                styles.trimOverlay,
                { left: 0, width: tToX(tStart) },
              ]}
              pointerEvents="none"
            />
            <View
              style={[
                styles.trimOverlay,
                { left: tToX(tEnd), right: 0 },
              ]}
              pointerEvents="none"
            />
            <View
              style={[
                styles.trimRegion,
                { left: tToX(tStart), width: Math.max(0, tToX(tEnd) - tToX(tStart)) },
              ]}
              pointerEvents="none"
            />
            <View
              style={[styles.handle, { left: tToX(tStart) - HANDLE_W / 2 }]}
              {...startPan.panHandlers}
            >
              <View style={styles.handleGrip} />
            </View>
            <View
              style={[styles.handle, { left: tToX(tEnd) - HANDLE_W / 2 }]}
              {...endPan.panHandlers}
            >
              <View style={styles.handleGrip} />
            </View>
          </>
        )}
        <View
          style={[styles.playhead, { left: tToX(scrub) - 2 }]}
          {...scrubPan.panHandlers}
        >
          <View style={styles.playheadStem} />
          <View style={styles.playheadKnob} />
        </View>
      </View>
      <View style={styles.timeRow}>
        <Text variant="monoCaption" color={theme.colors.text.muted}>
          {formatTime(scrub)}
        </Text>
        <Text variant="monoCaption" color={theme.colors.text.muted}>
          {formatTime(duration)}
        </Text>
      </View>
    </View>
  )
}

function defaultPeaks(count: number): number[] {
  const out: number[] = []
  for (let i = 0; i < count; i++) {
    out.push(0.3 + 0.7 * Math.abs(Math.sin(i * 1.7)))
  }
  return out
}

function formatTime(t: number): string {
  const total = Math.max(0, Math.floor(t))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

const styles = StyleSheet.create({
  track: {
    height: TRACK_HEIGHT,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bg.elevated,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    overflow: 'visible',
    position: 'relative',
  },
  peaks: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 4,
  },
  peakBar: {
    width: 2,
    borderRadius: 1,
    backgroundColor: theme.colors.text.subtle,
  },
  trimOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.30)',
  },
  trimRegion: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: theme.colors.accent.default,
  },
  handle: {
    position: 'absolute',
    top: -4,
    bottom: -4,
    width: HANDLE_W,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleGrip: {
    width: HANDLE_W,
    height: TRACK_HEIGHT + 8,
    borderRadius: 3,
    backgroundColor: theme.colors.accent.default,
  },
  playhead: {
    position: 'absolute',
    top: -6,
    bottom: -6,
    width: 4,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  playheadStem: {
    width: 2,
    flex: 1,
    backgroundColor: theme.colors.text.primary,
  },
  playheadKnob: {
    position: 'absolute',
    top: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.text.primary,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
})
