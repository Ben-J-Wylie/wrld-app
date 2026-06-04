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
// Each of the six fields (YEAR · MONTH · DAY · HH : MM : SS) is a vertical
// dial. The "selection band" — a centred strip with a top + bottom line — is
// the only filled surface; it's identical in blurred and focused states.
// Blurred clips to that one band row (no peeking neighbours); focused, the bar
// grows and the ±ghost neighbours come into view above/below over the globe.
// Every value change (tick or scrub) slides the dial one row — down = newer,
// up = older — so the motion cues which way to spin. Fields have fixed widths
// so a value change never reflows the layout. Drag a field to dial; Date
// arithmetic carries/borrows correctly; no future, floor at `minYear`.

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
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

// Fixed per-field widths so a value change never reflows the row.
// Sized for monoLabel (IBM Plex Mono caps, ~10px + letter-spacing).
const FIELD_W: Record<FieldKey, number> = {
  year: 34,
  month: 28,
  day: 20,
  hour: 20,
  minute: 20,
  second: 20,
}

const ROW_H = 28 // band height = one increment row (tightened top/bottom)
const COLLAPSED_H = ROW_H // blurred: only the band row shows
const EXPANDED_H = ROW_H * 5 // focused: centre + 2 above + 2 below
const STEP_PX = ROW_H // vertical drag distance per one unit step
// Window of cells rendered per field — wider than what's visible so the
// one-row slide animation always has a neighbour to scroll in.
const WINDOW = [3, 2, 1, 0, -1, -2, -3] // newer (top) → older (bottom)

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

  const playMs = Date.now() - offsetMs
  const playhead = new Date(playMs)
  const live = offsetMs <= 0

  // Direction of the latest playhead change → drives the dial slide
  // (+1 newer = scroll down, −1 older = scroll up). Updated after render.
  const prevPlayMs = useRef(playMs)
  const direction = playMs > prevPlayMs.current ? 1 : playMs < prevPlayMs.current ? -1 : 0
  useEffect(() => {
    prevPlayMs.current = playMs
  })

  // Refs the per-field PanResponders read so they never go stale.
  const offsetRef = useRef(offsetMs)
  offsetRef.current = offsetMs
  const onChangeRef = useRef(onOffsetChange)
  onChangeRef.current = onOffsetChange
  const expandedRef = useRef(expanded)
  expandedRef.current = expanded
  const maxOffset = Date.now() - new Date(minYear, 0, 1).getTime()

  // Absolute-from-gesture-start scrub: no drift from stale offset reads.
  function scrub(key: FieldKey, startPlayhead: Date, delta: number) {
    const next = stepDate(startPlayhead, key, delta)
    let newOffset = Date.now() - next.getTime()
    if (newOffset < 0) newOffset = 0
    if (newOffset > maxOffset) newOffset = maxOffset
    onChangeRef.current(newOffset)
  }

  const fieldProps = { playhead, direction, expandedRef, offsetRef, onScrub: scrub }

  return (
    <Animated.View style={[styles.bar, { height }, style]}>
      {/* Selection band — the only filled surface, identical blurred/focused. */}
      <View style={styles.bandWrap} pointerEvents="none">
        <View style={styles.band} />
      </View>

      <RNPressable onPress={() => setExpanded((e) => !e)} style={styles.press}>
        <View style={styles.row}>
          <Field fieldKey="year" {...fieldProps} />
          <Gap />
          <Field fieldKey="month" {...fieldProps} />
          <Gap />
          <Field fieldKey="day" {...fieldProps} />
          <Gap />
          <Field fieldKey="hour" {...fieldProps} />
          <Gap colon />
          <Field fieldKey="minute" {...fieldProps} />
          <Gap colon />
          <Field fieldKey="second" {...fieldProps} />
          <Gap />
          <View style={styles.statusSlot}>
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
        </View>
      </RNPressable>
    </Animated.View>
  )
}

function Gap({ colon }: { colon?: boolean }) {
  return (
    <View style={styles.gap}>
      {colon && (
        <Text variant="monoLabel" color={theme.colors.text.primary}>
          :
        </Text>
      )}
    </View>
  )
}

function Field({
  fieldKey,
  playhead,
  direction,
  expandedRef,
  offsetRef,
  onScrub,
}: {
  fieldKey: FieldKey
  playhead: Date
  direction: number
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
        // Drag down (dy>0) → newer (+); drag up → older (−).
        const delta = Math.round(g.dy / STEP_PX)
        onScrub(fieldKey, startPlayhead.current, delta)
      },
    }),
  ).current

  const current = formatField(playhead, fieldKey)

  // Dial slide: when the value changes, start the column one row off (so the
  // OLD value is at the band) and animate it home — newer scrolls down, older
  // scrolls up. useLayoutEffect sets the start offset before paint (no flash).
  const slide = useRef(new Animated.Value(0)).current
  const prevValue = useRef(current)
  useLayoutEffect(() => {
    if (prevValue.current !== current && direction !== 0) {
      slide.setValue(direction > 0 ? -ROW_H : ROW_H)
      Animated.timing(slide, {
        toValue: 0,
        duration: theme.motion.patterns.overlay.duration,
        easing: theme.motion.patterns.overlay.easing,
        useNativeDriver: true,
      }).start()
    }
    prevValue.current = current
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current])

  return (
    <View style={[styles.field, { width: FIELD_W[fieldKey] }]} {...responder.panHandlers}>
      <Animated.View style={{ transform: [{ translateY: slide }] }}>
        {WINDOW.map((delta) => {
          const dist = Math.abs(delta)
          const opacity = dist === 0 ? 1 : dist === 1 ? 0.5 : dist === 2 ? 0.28 : 0.12
          return (
            <View key={delta} style={styles.cell}>
              <Text variant="monoLabel" color={theme.colors.text.primary} style={{ opacity }}>
                {formatField(stepDate(playhead, fieldKey, delta), fieldKey)}
              </Text>
            </View>
          )
        })}
      </Animated.View>
    </View>
  )
}

const NOW_DOT = 7
const STATUS_W = 58

const styles = StyleSheet.create({
  bar: {
    overflow: 'hidden',
    // No background — the selection band (below) is the only filled surface.
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
    backgroundColor: theme.colors.bg.glass,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.colors.border.strong,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center', // centre the whole content (equal L/R margins)
    paddingHorizontal: theme.spacing.lg,
  },
  field: {
    // Full bar height (drag target) + clips its own WINDOW so blurred shows
    // only the band row; fixed width so values never reflow the layout.
    alignSelf: 'stretch',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cell: {
    height: ROW_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gap: {
    width: theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusSlot: {
    width: STATUS_W,
    alignItems: 'center',
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
})
