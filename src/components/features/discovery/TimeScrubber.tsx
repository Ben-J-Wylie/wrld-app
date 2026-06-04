// src/components/features/discovery/TimeScrubber.tsx
//
// The WRLD time machine — a long thin horizontal "running clock" that sits
// just above the globe's bottom drawer. (Time Machine initiative, 2026-06-04;
// see CLAUDE.md + DESIGN.md decision log.)
//
// Model: a single `offsetMs` behind the present (0 = live). The playhead =
// `Date.now() - offsetMs`, recomputed every second, so:
//   • offset 0  → reads as a live ticking clock; the globe is live.
//   • offset >0 → the playhead ticks forward from the scrubbed instant at 1×
//     (real-time PLAYBACK), and the globe replays the surviving clips/pins
//     alive at the playhead (backend: Aaron). A "NOW" button returns to live.
//
// Six fields — YR · MO · DY · HR · MIN · SEC — each independently spinnable.
// Collapsed: just the ticking values. Tap to expand: each field shows ghosted
// neighbours above/below to hint it can be spun; drag a field vertically to
// step it (Date arithmetic carries/borrows correctly — spinning MIN past 00
// rolls the hour, etc.). Can't spin into the future (clamped at now) or before
// `minYear`.
//
// This is the UI half; the globe consumes `offsetMs` to drive the historical
// replay query (stubbed until the backend lands).

import { useEffect, useRef, useState } from 'react'
import {
  Animated,
  PanResponder,
  Pressable as RNPressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { Pressable } from '@/components/primitives/Pressable'
import { Text } from '@/components/primitives/Text'
import { theme } from '@/tokens/theme'

type FieldKey = 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second'

const FIELD_LABEL: Record<FieldKey, string> = {
  year: 'YEAR',
  month: 'MONTH',
  day: 'DAY',
  hour: 'HR',
  minute: 'MIN',
  second: 'SEC',
}

const MONTH_ABBR = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

const COLLAPSED_H = 50
const EXPANDED_H = 104
const STEP_PX = 26 // vertical drag distance per one unit step

function fieldValue(d: Date, key: FieldKey): number {
  switch (key) {
    case 'year': return d.getFullYear()
    case 'month': return d.getMonth() + 1
    case 'day': return d.getDate()
    case 'hour': return d.getHours()
    case 'minute': return d.getMinutes()
    case 'second': return d.getSeconds()
  }
}

// Step a date by `delta` units of `key`. Native Date arithmetic carries and
// borrows correctly across all fields (and variable month/year lengths).
function stepDate(d: Date, key: FieldKey, delta: number): Date {
  const n = new Date(d)
  switch (key) {
    case 'year': n.setFullYear(n.getFullYear() + delta); break
    case 'month': n.setMonth(n.getMonth() + delta); break
    case 'day': n.setDate(n.getDate() + delta); break
    case 'hour': n.setHours(n.getHours() + delta); break
    case 'minute': n.setMinutes(n.getMinutes() + delta); break
    case 'second': n.setSeconds(n.getSeconds() + delta); break
  }
  return n
}

function pad(n: number, digits: number): string {
  return String(Math.abs(n)).padStart(digits, '0')
}

// Display string per field: month → 3-letter abbreviation, hours in 24h,
// everything else zero-padded.
function formatField(d: Date, key: FieldKey): string {
  switch (key) {
    case 'year': return String(d.getFullYear())
    case 'month': return MONTH_ABBR[d.getMonth()]! // getMonth() is always 0–11
    default: return pad(fieldValue(d, key), 2)
  }
}

type Props = {
  offsetMs: number
  onOffsetChange: (ms: number) => void
  minYear?: number
  style?: StyleProp<ViewStyle>
}

export function TimeScrubber({ offsetMs, onOffsetChange, minYear = 2026, style }: Props) {
  const [expanded, setExpanded] = useState(false)
  // Force a re-render every second so the playhead ticks (live and playback).
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => (t + 1) % 60), 1000)
    return () => clearInterval(id)
  }, [])

  const height = useRef(new Animated.Value(COLLAPSED_H)).current
  useEffect(() => {
    Animated.timing(height, {
      toValue: expanded ? EXPANDED_H : COLLAPSED_H,
      duration: theme.motion.patterns.overlay.duration,
      easing: theme.motion.patterns.overlay.easing,
      useNativeDriver: false,
    }).start()
  }, [expanded, height])

  const playhead = new Date(Date.now() - offsetMs)
  const live = offsetMs <= 0

  // Refs the per-field PanResponders read so they never go stale.
  const offsetRef = useRef(offsetMs)
  offsetRef.current = offsetMs
  const onChangeRef = useRef(onOffsetChange)
  onChangeRef.current = onOffsetChange
  const expandedRef = useRef(expanded)
  expandedRef.current = expanded
  const maxOffset = Date.now() - new Date(minYear, 0, 1).getTime()

  // Absolute-from-gesture-start scrub: avoids drift from stale offset reads
  // during a fast drag. `delta` is in time units for the field (+ newer / − older).
  function scrub(key: FieldKey, startPlayhead: Date, delta: number) {
    const next = stepDate(startPlayhead, key, delta)
    let newOffset = Date.now() - next.getTime()
    if (newOffset < 0) newOffset = 0
    if (newOffset > maxOffset) newOffset = maxOffset
    onChangeRef.current(newOffset)
  }

  return (
    <Animated.View style={[styles.bar, { height }, style]}>
      {/* Raw RN Pressable (not the primitive): the primitive routes `style`
          to an inner Animated.View whose flex:1 can't resolve, collapsing the
          content. RN Pressable takes flex:1 directly. No scale feedback wanted
          on the whole bar anyway. */}
      <RNPressable onPress={() => setExpanded((e) => !e)} style={styles.press}>
        <View style={styles.row}>
          {(['year', 'month', 'day'] as FieldKey[]).map((key) => (
            <Field
              key={key}
              fieldKey={key}
              playhead={playhead}
              expanded={expanded}
              expandedRef={expandedRef}
              offsetRef={offsetRef}
              onScrub={scrub}
            />
          ))}
          {/* HH : MM : SS — tight group with colons */}
          <View style={styles.timeGroup}>
            <Field fieldKey="hour" playhead={playhead} expanded={expanded} expandedRef={expandedRef} offsetRef={offsetRef} onScrub={scrub} />
            <Text variant="monoLabel" color={theme.colors.text.inverse} style={styles.colon}>:</Text>
            <Field fieldKey="minute" playhead={playhead} expanded={expanded} expandedRef={expandedRef} offsetRef={offsetRef} onScrub={scrub} />
            <Text variant="monoLabel" color={theme.colors.text.inverse} style={styles.colon}>:</Text>
            <Field fieldKey="second" playhead={playhead} expanded={expanded} expandedRef={expandedRef} offsetRef={offsetRef} onScrub={scrub} />
          </View>
          {live ? (
            <View style={styles.liveTag}>
              <View style={styles.liveDot} />
              <Text variant="monoLabel" color={theme.colors.text.inverse}>
                LIVE
              </Text>
            </View>
          ) : (
            <Pressable variant="default" onPress={() => onOffsetChange(0)} style={styles.nowBtn}>
              <View style={styles.nowDot} />
              <Text variant="monoLabel" color={theme.colors.text.inverse}>
                NOW
              </Text>
            </Pressable>
          )}
        </View>
      </RNPressable>
    </Animated.View>
  )
}

function Field({
  fieldKey,
  playhead,
  expanded,
  expandedRef,
  offsetRef,
  onScrub,
}: {
  fieldKey: FieldKey
  playhead: Date
  expanded: boolean
  expandedRef: React.MutableRefObject<boolean>
  offsetRef: React.MutableRefObject<number>
  onScrub: (key: FieldKey, startPlayhead: Date, delta: number) => void
}) {
  const startPlayhead = useRef<Date>(playhead)
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => expandedRef.current && Math.abs(g.dy) > 4,
      onPanResponderGrant: () => {
        startPlayhead.current = new Date(Date.now() - offsetRef.current)
      },
      onPanResponderMove: (_, g) => {
        // Wheel physics: newer value sits above, older below. Drag down (dy>0)
        // brings the newer value to centre (+); drag up brings the older (−).
        const delta = Math.round(g.dy / STEP_PX)
        onScrub(fieldKey, startPlayhead.current, delta)
      },
    }),
  ).current

  const current = formatField(playhead, fieldKey)
  const above = formatField(stepDate(playhead, fieldKey, 1), fieldKey)
  const below = formatField(stepDate(playhead, fieldKey, -1), fieldKey)

  return (
    <View style={styles.field} {...responder.panHandlers}>
      {expanded && (
        <Text variant="monoLabel" color={theme.colors.text.inverse} style={styles.ghost}>
          {above}
        </Text>
      )}
      <Text variant="monoLabel" color={theme.colors.text.inverse}>
        {current}
      </Text>
      {expanded && (
        <>
          <Text variant="monoLabel" color={theme.colors.text.inverse} style={styles.ghost}>
            {below}
          </Text>
          <Text variant="monoLabel" color={theme.colors.text.inverse} style={styles.fieldLabel}>
            {FIELD_LABEL[fieldKey]}
          </Text>
        </>
      )}
    </View>
  )
}

const NOW_DOT = 7

const styles = StyleSheet.create({
  bar: {
    // No background for now — sits directly over the globe. (A translucent
    // gradient below may come later.) Cream text carries the legibility.
    overflow: 'hidden',
  },
  press: {
    flex: 1,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
  },
  field: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xxs,
  },
  colon: {
    opacity: 0.6,
  },
  ghost: {
    opacity: 0.3,
  },
  fieldLabel: {
    marginTop: theme.spacing.xxs,
    opacity: 0.55,
  },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  liveDot: {
    width: NOW_DOT,
    height: NOW_DOT,
    borderRadius: NOW_DOT / 2,
    backgroundColor: theme.colors.text.inverse,
  },
  nowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accent.default,
  },
  nowDot: {
    width: NOW_DOT,
    height: NOW_DOT,
    borderRadius: NOW_DOT / 2,
    backgroundColor: theme.colors.text.inverse,
  },
})
