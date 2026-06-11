// src/components/features/clip/ClipLane.tsx
//
// One lane of the clips landing grid — a column that positions its clips to scale on the
// shared vertical time axis (top = distance below "now", height = duration × pxPerMs). The
// buffered lane and the saved lane are two of these side by side.
//
// Sub-columns: a single broadcasting device records sequentially, so its clips never
// overlap in time → one column. Concurrent recordings from multiple devices DO overlap →
// the lane splits the overlapping run into side-by-side sub-columns (greedy interval
// colouring) so each clip stays visible + tappable. With today's single-device data this
// is always one column. See DESIGN.md Section 3 (Clips landing grid).

import { useMemo } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { ClipBlock, type ClipTone } from './ClipBlock'

export type LaneClip = {
  id: string
  startMs: number
  endMs: number
  label: string
  sublabel?: string
  posterUrl?: string | null
}

const SUBCOL_GAP_PCT = 1.5 // % gap between sub-columns when a lane splits

export type ClipPos = { top: number; height: number }

type Props = {
  clips: LaneClip[]
  tone: ClipTone
  // The host's per-clip layout (`top`/`height` on the shared collapsed-gap axis). The
  // host reserves each clip's FLOORED height so blocks never overlap. (Axis-agnostic: a
  // horizontal mode would return left/width.)
  posOf: (id: string) => ClipPos | undefined
  onOpenClip?: (clip: LaneClip) => void
  // Drag-to-cross: when set, clips can be dragged across to the other lane (buffered → save,
  // saved → un-save). `reachPx` is the distance to the other lane; `onMoveClip` commits.
  reachPx?: number
  onMoveClip?: (clip: LaneClip) => void
  style?: StyleProp<ViewStyle>
}

export function ClipLane({ clips, tone, posOf, onOpenClip, reachPx, onMoveClip, style }: Props) {
  // Buffered clips drag RIGHT (→ saved); saved clips drag LEFT (→ buffered).
  const dragDir: 1 | -1 = tone === 'buffered' ? 1 : -1
  // Assign each clip to a sub-column so overlapping clips sit side by side.
  const { colOf, colCount } = useMemo(() => assignColumns(clips), [clips])

  return (
    <View style={[styles.lane, style]}>
      {clips.map((c) => {
        const p = posOf(c.id)
        if (!p) return null
        const top = p.top
        const height = p.height
        const col = colOf.get(c.id) ?? 0
        const widthPct = 100 / colCount
        const leftPct = col * widthPct
        return (
          <View
            key={c.id}
            style={[
              styles.slot,
              {
                top,
                height,
                left: `${leftPct + (colCount > 1 ? SUBCOL_GAP_PCT / 2 : 0)}%`,
                width: `${widthPct - (colCount > 1 ? SUBCOL_GAP_PCT : 0)}%`,
              },
            ]}
          >
            <ClipBlock
              heightPx={height}
              label={c.label}
              sublabel={c.sublabel}
              posterUrl={c.posterUrl}
              tone={tone}
              onOpen={onOpenClip ? () => onOpenClip(c) : undefined}
              dragDir={onMoveClip ? dragDir : undefined}
              reachPx={reachPx}
              onCross={onMoveClip ? () => onMoveClip(c) : undefined}
            />
          </View>
        )
      })}
    </View>
  )
}

// Greedy interval colouring: sort by start, drop each clip into the first column whose last
// clip has already ended. `colCount` = how many columns were needed (1 when nothing overlaps).
function assignColumns(clips: LaneClip[]): { colOf: Map<string, number>; colCount: number } {
  const colOf = new Map<string, number>()
  const colEnds: number[] = [] // last endMs placed in each column
  const sorted = [...clips].sort((a, b) => a.startMs - b.startMs)
  for (const c of sorted) {
    let col = colEnds.findIndex((end) => end <= c.startMs)
    if (col === -1) {
      col = colEnds.length
      colEnds.push(c.endMs)
    } else {
      colEnds[col] = c.endMs
    }
    colOf.set(c.id, col)
  }
  return { colOf, colCount: Math.max(1, colEnds.length) }
}

const styles = StyleSheet.create({
  lane: {
    flex: 1,
  },
  slot: {
    position: 'absolute',
  },
})
