// src/components/features/clip/FilmStrip.tsx
//
// The shared film-strip primitive — the canonical clip-block fill used by EVERY timeline
// (Clips-page ClipBlock + the segment-shelf SegmentPreview). One implementation so they can't
// drift (see DESIGN.md decision log 2026-06-24 "Timeline core principles").
//
// A FILM STRIP: square rounded frame cells with a sprocket-hole band above and below. The cell
// size is CONSTANT regardless of zoom (a wider clip fits MORE cells; a cell never stretches).
// Absolute-fills its parent — the caller provides the bounding container (ClipBlock's top span /
// SegmentPreview's clip block).
//
// SMOOTHNESS: a stable set of Views that only TRANSLATES (never scales, so the texture stays
// crisp). `memo`'d on the CELL COUNT — a sub-cell width change (a 1 s tick, a per-frame live
// build) doesn't re-render the cells; only crossing a whole cell does. When `cellLeftSv` is given
// (the clip's animated content-left) the strip phase-anchors to the global grid so cells skate
// (revealed at now, consumed at the reaper) + line up across snip seams; omitted (static) → phase 0.

import { memo } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated'
import { Image } from 'expo-image'
import { theme } from '@/tokens/theme'

export const FILM_SPROCKET_H = 6 // height of each sprocket band (top + bottom)
export const FILM_GAP = 4 // gap between cells
export const FILM_CELL = 22 // square cell size — CONSTANT across zoom
export const FILM_PITCH = FILM_CELL + FILM_GAP // one cell's footprint on the grid
export const FILM_SPK_PITCH = FILM_PITCH / 2 // two sprockets per cell
export const FILM_SPK_W = 4
export const FILM_MAX_CELLS = 140 // backstop so a very wide (zoomed-in) clip can't render unbounded cells

// How many cells the strip renders for a given clip width (+ a 2-cell buffer so the smoothly-growing
// (UI-thread) clip edge always has pre-rendered cells to reveal — no gap-then-pop at the now edge).
export function filmCellCount(widthPx?: number) {
  return Math.min(FILM_MAX_CELLS, Math.max(1, Math.ceil(((widthPx ?? FILM_PITCH) + FILM_PITCH * 2) / FILM_PITCH)))
}

export const FilmStrip = memo(
  function FilmStrip({ cellLeftSv, widthPx, posterUrl }: { cellLeftSv?: SharedValue<number>; widthPx?: number; posterUrl?: string | null }) {
    const cells = filmCellCount(widthPx)
    const sprockets = cells * 2
    // Translate the whole strip by the clip's content-left modulo the pitch → its cells land on the
    // global grid (k·PITCH). For the reaper-clamped oldest clip cellLeftSv is animated, so the strip
    // skates and the leftmost cells clip away (consumed); for the rest it's static + the content scroll
    // moves it for free. A static fallback (phase 0) covers no-SV consumers (the shelf / gallery).
    const rowStyle = useAnimatedStyle(() => {
      const left = cellLeftSv ? cellLeftSv.value : 0
      const phase = ((left % FILM_PITCH) + FILM_PITCH) % FILM_PITCH
      return { transform: [{ translateX: -phase }] }
    })
    return (
      <Animated.View
        style={[styles.filmRow, rowStyle, { width: cells * FILM_PITCH }]}
        pointerEvents="none"
        renderToHardwareTextureAndroid
        shouldRasterizeIOS
      >
        <View style={styles.sprocketBand}>
          {Array.from({ length: sprockets }).map((_, i) => (
            <View key={i} style={styles.sprocket} />
          ))}
        </View>
        <View style={styles.cellBand}>
          {Array.from({ length: cells }).map((_, i) => (
            <View key={i} style={styles.filmCell}>
              {posterUrl ? <Image source={{ uri: posterUrl }} style={styles.filmImg} contentFit="cover" transition={120} /> : null}
            </View>
          ))}
        </View>
        <View style={styles.sprocketBand}>
          {Array.from({ length: sprockets }).map((_, i) => (
            <View key={i} style={styles.sprocket} />
          ))}
        </View>
      </Animated.View>
    )
  },
  // Re-render ONLY when the visible cell count changes (or the frame source) — not on every sub-cell
  // width tick. cellLeftSv is a stable ref; the animated translate updates on the UI thread regardless.
  (a, b) => a.cellLeftSv === b.cellLeftSv && a.posterUrl === b.posterUrl && filmCellCount(a.widthPx) === filmCellCount(b.widthPx),
)

const styles = StyleSheet.create({
  filmRow: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    flexDirection: 'column',
    justifyContent: 'space-between',
    paddingVertical: 1,
  },
  // A horizontal band of sprocket holes (top + bottom), denser than the cells (two per cell).
  sprocketBand: { height: FILM_SPROCKET_H, flexDirection: 'row', alignItems: 'center' },
  sprocket: {
    width: FILM_SPK_W,
    height: 3,
    borderRadius: 1.5,
    marginRight: FILM_SPK_PITCH - FILM_SPK_W,
    backgroundColor: theme.colors.border.strong,
  },
  // The row of square rounded film cells (the frames), constant size regardless of zoom.
  cellBand: { flexDirection: 'row', alignItems: 'center' },
  filmCell: {
    width: FILM_CELL,
    height: FILM_CELL,
    marginRight: FILM_GAP,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: theme.colors.border.strong,
    backgroundColor: theme.colors.bg.panelHi,
    overflow: 'hidden',
  },
  filmImg: { width: '100%', height: '100%' },
})
