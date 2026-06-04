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
// Styled like DOBWheel: each of the six fields (YEAR · MONTH · DAY · HH:MM:SS)
// is a vertical wheel framed by a centred band (two horizontal lines). Blurred
// (collapsed) shows only the centre value; tapped (expanded) the bar grows and
// the ±2 ghost neighbours fade in above/below, just like the DOBWheel.
// Drag a field vertically to scrub (Date arithmetic carries/borrows correctly;
// no future, floor at `minYear`). Sits on the drawer's translucent glass so the
// dark ink reads over the globe.

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

const MONTH_ABBR = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

const ROW_H = 26
const COLLAPSED_H = ROW_H + 24 // centre row + breathing room
const EXPANDED_H = ROW_H * 5 // centre + 2 above + 2 below (DOBWheel's 5 rows)
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

  const fieldProps = { playhead, expanded, expandedRef, offsetRef, onScrub: scrub }

  return (
    <Animated.View style={[styles.bar, { height }, style]}>
      {/* Centred band — two horizontal lines framing the centre value, like DOBWheel. */}
      <View style={styles.bandWrap} pointerEvents="none">
        <View style={styles.band} />
      </View>

      <RNPressable onPress={() => setExpanded((e) => !e)} style={styles.press}>
        <View style={styles.row}>
          {(['year', 'month', 'day'] as FieldKey[]).map((key) => (
            <Field key={key} fieldKey={key} {...fieldProps} />
          ))}
          {/* HH : MM : SS — tight group with colons */}
          <View style={styles.timeGroup}>
            <Field fieldKey="hour" {...fieldProps} />
            <Text variant="bodyEmphasized" color={theme.colors.text.primary}>:</Text>
            <Field fieldKey="minute" {...fieldProps} />
            <Text variant="bodyEmphasized" color={theme.colors.text.primary}>:</Text>
            <Field fieldKey="second" {...fieldProps} />
          </View>
          {live ? (
            <View style={styles.liveTag}>
              <View style={styles.liveDot} />
              <Text variant="monoLabel" color={theme.colors.text.muted}>
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

      {/* Edge fade so the ±2 ghosts soften at the top/bottom (expanded only). */}
      {expanded && (
        <>
          <View style={styles.fadeTop} pointerEvents="none" />
          <View style={styles.fadeBottom} pointerEvents="none" />
        </>
      )}
    </Animated.View>
  )
}

// Deltas top→bottom: newer values above, older below (wheel physics).
const COLLAPSED_DELTAS = [0]
const EXPANDED_DELTAS = [2, 1, 0, -1, -2]

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
        // Drag down (dy>0) brings the newer value to centre (+); up → older (−).
        const delta = Math.round(g.dy / STEP_PX)
        onScrub(fieldKey, startPlayhead.current, delta)
      },
    }),
  ).current

  const deltas = expanded ? EXPANDED_DELTAS : COLLAPSED_DELTAS

  return (
    <View style={styles.field} {...responder.panHandlers}>
      {deltas.map((delta) => {
        const dist = Math.abs(delta)
        const opacity = dist === 0 ? 1 : dist === 1 ? 0.55 : 0.3
        return (
          <View key={delta} style={styles.cell}>
            <Text
              variant={dist === 0 ? 'bodyEmphasized' : 'body'}
              color={theme.colors.text.primary}
              style={{ opacity }}
            >
              {formatField(stepDate(playhead, fieldKey, delta), fieldKey)}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

const NOW_DOT = 7

const styles = StyleSheet.create({
  bar: {
    overflow: 'hidden',
    // Retract from fully-transparent: the drawer's translucent glass so the
    // dark DOBWheel-style ink reads over the globe and reads continuous with
    // the drawer below.
    backgroundColor: theme.colors.bg.glass,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.subtle,
  },
  press: {
    flex: 1,
  },
  bandWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
  },
  band: {
    height: ROW_H,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.colors.border.strong,
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
  },
  cell: {
    height: ROW_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xxs,
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
    backgroundColor: theme.colors.text.muted,
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
  fadeTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: ROW_H,
    backgroundColor: theme.colors.bg.glass,
    opacity: 0.6,
  },
  fadeBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: ROW_H,
    backgroundColor: theme.colors.bg.glass,
    opacity: 0.6,
  },
})
