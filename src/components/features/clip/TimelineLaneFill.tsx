// src/components/features/clip/TimelineLaneFill.tsx
//
// Per-source segment fill for the STACKED buffer timeline. Every source's timeline shares
// the SAME segment/gap geometry — a clip spans a recording duration, so all sources align
// with identical gaps — and only the *fill* of each recorded segment differs by source.
// This renders that idiomatic mini-representation for the non-camera sources (camera uses
// the real film-frame filmstrip, which stays in BufferTimeline).
//
// PLACEHOLDER visuals, deterministic from the segment id so they don't flicker on
// re-render — until per-source mini-data (waveform peaks / telemetry samples / chat
// density) is wired from the buffer descriptor (Aaron's lane). The marks are calm/neutral;
// BufferTimeline handles selected-vs-dim emphasis at the lane level.
//
// See DESIGN.md Section 3 (Buffer-trim clip editor · stacked source lanes).

import { memo } from 'react'
import { StyleSheet, View } from 'react-native'
import type { ComponentProps } from 'react'
import { Icon } from '@/components/primitives/Icon'
import { theme } from '@/tokens/theme'

export type TimelineLaneKind =
  | 'camera'
  | 'audio'
  | 'location'
  | 'compass'
  | 'gyro'
  | 'identity'
  | 'chat'
  | 'screen'
  | 'motion'
  | 'speed'
  | 'temp'
  | 'torch'

type IconName = ComponentProps<typeof Icon>['name']
type Variant = 'wave' | 'trace' | 'trail' | 'ticks' | 'flat'

// Source kind → fill idiom. Camera is 'flat' here as a safe default but is never routed
// through this component (BufferTimeline renders the real filmstrip for it).
const VARIANT: Record<TimelineLaneKind, Variant> = {
  camera: 'flat',
  audio: 'wave',
  compass: 'trace',
  gyro: 'trace',
  motion: 'trace',
  speed: 'trace',
  temp: 'trace',
  location: 'trail',
  chat: 'ticks',
  identity: 'flat',
  screen: 'flat',
  torch: 'flat',
}

// Faint centred glyph for the otherwise-blank 'flat' sources, so a stacked identity /
// screen / torch lane still reads as itself even with no signal to plot.
const FLAT_ICON: Partial<Record<TimelineLaneKind, IconName>> = {
  identity: 'user',
  screen: 'monitor',
  torch: 'zap',
}

type Props = {
  kind: TimelineLaneKind
  // Stable seed (the segment id) → deterministic marks that don't churn on re-render.
  seedId: string
  widthPx: number
  // The segment's first cell gets a matching left border when something to its left can't
  // own the separator (head edge / a preceding gap), mirroring the camera filmstrip rule.
  leftBorder?: boolean
}

// Memoized — the stacked timeline re-renders on every playhead tick / scroll; a fill only
// needs to recompute when its kind / seed / width / border actually change (i.e. on zoom),
// not on scrub. This keeps the expanded stack cheap.
export const TimelineLaneFill = memo(function TimelineLaneFill({ kind, seedId, widthPx, leftBorder }: Props) {
  const variant = VARIANT[kind]
  return (
    <View style={[styles.cell, leftBorder && styles.cellLeft]} pointerEvents="none">
      {variant === 'wave' && <Wave seedId={seedId} widthPx={widthPx} />}
      {variant === 'trace' && <Trace seedId={seedId} widthPx={widthPx} />}
      {variant === 'trail' && <Trail widthPx={widthPx} />}
      {variant === 'ticks' && <Ticks seedId={seedId} widthPx={widthPx} />}
      {variant === 'flat' && <Flat icon={FLAT_ICON[kind]} />}
    </View>
  )
})

// ── fill variants ─────────────────────────────────────────────────────────────

// Audio — a centred amplitude waveform (accent bars).
function Wave({ seedId, widthPx }: { seedId: string; widthPx: number }) {
  const n = Math.max(3, Math.min(80, Math.round(widthPx / 6)))
  const vals = seedFloats(seedId + ':wave', n)
  return (
    <View style={styles.waveRow}>
      {vals.map((v, i) => (
        <View key={i} style={[styles.waveBar, { height: `${18 + v * 70}%` }]} />
      ))}
    </View>
  )
}

// Telemetry (compass / gyro / motion / speed / temp) — a muted dotted signal trace.
function Trace({ seedId, widthPx }: { seedId: string; widthPx: number }) {
  const n = Math.max(4, Math.min(64, Math.round(widthPx / 7)))
  const vals = seedFloats(seedId + ':trace', n)
  return (
    <View style={styles.traceRow}>
      {vals.map((v, i) => (
        <View key={i} style={styles.traceCol}>
          <View style={[styles.traceDot, { top: `${12 + v * 74}%` }]} />
        </View>
      ))}
    </View>
  )
}

// Location — a route line with evenly spaced node dots.
function Trail({ widthPx }: { widthPx: number }) {
  const n = Math.max(2, Math.min(40, Math.round(widthPx / 16)))
  return (
    <View style={styles.trailWrap}>
      <View style={styles.trailLine} />
      <View style={styles.trailRow}>
        {Array.from({ length: n }).map((_, i) => (
          <View key={i} style={styles.trailDot} />
        ))}
      </View>
    </View>
  )
}

// Chat — bottom-anchored message ticks at varying density (some columns empty).
function Ticks({ seedId, widthPx }: { seedId: string; widthPx: number }) {
  const n = Math.max(6, Math.min(100, Math.round(widthPx / 5)))
  const vals = seedFloats(seedId + ':ticks', n)
  return (
    <View style={styles.ticksRow}>
      {vals.map((v, i) => (
        <View key={i} style={styles.ticksCol}>
          {v > 0.55 && <View style={[styles.tick, { height: `${24 + v * 46}%` }]} />}
        </View>
      ))}
    </View>
  )
}

// Identity / screen / torch — a flat lane with a faint centred glyph.
function Flat({ icon }: { icon?: IconName }) {
  if (!icon) return <View style={styles.flat} />
  return (
    <View style={styles.flat}>
      <Icon name={icon} size="sm" color={theme.colors.text.subtle} />
    </View>
  )
}

// ── deterministic noise ─────────────────────────────────────────────────────────

// FNV-1a seed → a mulberry32 sequence of n floats in [0,1). Stable per seed string, so a
// segment's marks are identical across re-renders (no flicker) but differ per segment.
function seedFloats(seed: string, n: number): number[] {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    h += 0x6d2b79f5
    let t = h
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    out.push(((t ^ (t >>> 14)) >>> 0) / 4294967296)
  }
  return out
}

const styles = StyleSheet.create({
  cell: {
    flex: 1,
    paddingVertical: 6,
    justifyContent: 'center',
    // One rule across the strip: every cell draws a 1px RIGHT border (matches the camera
    // filmstrip's cell separators), the segment's first cell adds a left border when
    // nothing to its left owns the line.
    borderRightWidth: 1,
    borderRightColor: theme.colors.border.strong,
  },
  cellLeft: {
    borderLeftWidth: 1,
    borderLeftColor: theme.colors.border.strong,
  },
  // wave
  waveRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  waveBar: {
    flex: 1,
    minWidth: 1,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accent.default,
  },
  // trace
  traceRow: {
    flex: 1,
    flexDirection: 'row',
  },
  traceCol: {
    flex: 1,
    alignItems: 'center',
  },
  traceDot: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: theme.colors.text.muted,
  },
  // trail
  trailWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  trailLine: {
    position: 'absolute',
    left: 2,
    right: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: theme.colors.accent.border,
  },
  trailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  trailDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: theme.colors.accent.default,
  },
  // ticks
  ticksRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 1,
  },
  ticksCol: {
    flex: 1,
    justifyContent: 'flex-end',
    minWidth: 1,
  },
  tick: {
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accent.default,
  },
  // flat
  flat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
