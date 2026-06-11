// src/components/features/clip/TimeGridlines.tsx
//
// Ghosted time-increment lines across the clips landing grid. The time axis is vertical
// (now at the top, scroll down = older); each line is a wall-clock tick with a small label
// in the left gutter. The increment adapts to the zoom (`pxPerMs`) so the lines stay a
// comfortable distance apart — a seconds→minutes→hours→days ladder. Only the lines inside
// the visible window are rendered (the content can be very tall when zoomed in).
//
// Axis-agnostic-ready: today it positions on Y; a future horizontal mode would swap to X.
// See DESIGN.md Section 3 (Clips landing grid).

import { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import { Text } from '@/components/primitives/Text'
import { theme } from '@/tokens/theme'

const SEC = 1000
const MIN = 60 * SEC
const HOUR = 60 * MIN
const DAY = 24 * HOUR
// Nice increments (ms), smallest → largest. The first whose on-screen spacing clears
// TARGET_SPACING_PX is used.
const INCREMENTS = [
  SEC, 5 * SEC, 15 * SEC, 30 * SEC, MIN, 2 * MIN, 5 * MIN, 15 * MIN, 30 * MIN,
  HOUR, 2 * HOUR, 3 * HOUR, 6 * HOUR, 12 * HOUR, DAY, 2 * DAY, 7 * DAY, 30 * DAY,
]
const TARGET_SPACING_PX = 70

type Props = {
  nowMs: number
  minMs: number // oldest instant on the axis
  pxPerMs: number
  scrollY: number
  viewportH: number
  gutterW: number
}

export function TimeGridlines({ nowMs, minMs, pxPerMs, scrollY, viewportH, gutterW }: Props) {
  const inc = useMemo(() => {
    if (pxPerMs <= 0) return DAY
    return INCREMENTS.find((i) => i * pxPerMs >= TARGET_SPACING_PX) ?? INCREMENTS[INCREMENTS.length - 1]!
  }, [pxPerMs])

  const lines = useMemo(() => {
    if (pxPerMs <= 0 || inc <= 0) return []
    const stepPx = inc * pxPerMs
    // Now sits at the BOTTOM of the time area; ticks step UPWARD into the past.
    const contentTimeH = (nowMs - minMs) * pxPerMs
    const maxI = Math.floor((nowMs - minMs) / inc) // oldest tick index (nearest the top)
    // y(i) = contentTimeH − i·stepPx, visible when y ∈ [scrollY, scrollY + viewportH].
    const from = Math.max(0, Math.floor((contentTimeH - scrollY - viewportH - stepPx) / stepPx))
    const to = Math.min(maxI, Math.ceil((contentTimeH - scrollY + stepPx) / stepPx))
    const out: { i: number; y: number; label: string }[] = []
    for (let i = from; i <= to; i++) {
      out.push({ i, y: contentTimeH - i * stepPx, label: i === 0 ? 'now' : fmtTick(nowMs - i * inc, inc) })
    }
    return out
  }, [nowMs, minMs, pxPerMs, inc, scrollY, viewportH])

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {lines.map(({ i, y, label }) => (
        <View key={i} style={[styles.row, { top: y }]}>
          <View style={[styles.line, i === 0 && styles.lineNow]} />
          <View style={[styles.labelWrap, { width: gutterW }]}>
            <Text variant="monoCaption" color={i === 0 ? theme.colors.accent.default : theme.colors.text.subtle}>
              {label}
            </Text>
          </View>
        </View>
      ))}
    </View>
  )
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function pad(n: number) {
  return String(n).padStart(2, '0')
}
function fmtTick(ms: number, inc: number): string {
  const d = new Date(ms)
  if (inc >= DAY) return `${MON[d.getMonth()]} ${d.getDate()}`
  if (inc < MIN) return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const styles = StyleSheet.create({
  row: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  // The ghosted line sits behind the lanes (the lanes are translucent at the edges).
  line: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: theme.colors.border.subtle,
  },
  lineNow: {
    backgroundColor: theme.colors.accent.border,
  },
  labelWrap: {
    // Label sits just ABOVE its line (so the bottom "now" tick stays visible), in the left
    // gutter, over a paper chip for legibility.
    position: 'absolute',
    bottom: 2,
    left: theme.spacing.xs,
    paddingHorizontal: 3,
    backgroundColor: theme.colors.bg.primary,
    borderRadius: theme.radius.md,
  },
})
