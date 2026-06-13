// src/components/features/clip/ClipLane.tsx
//
// One lane of the clips landing grid — a column that positions its clips to scale on the
// shared vertical time axis (top = distance below "now", height = duration × pxPerMs). The
// buffered lane and the saved lane are two of these side by side.
//
// One clip per time region (full width): a saved clip is a single source of truth, and a
// saved session is hidden from the buffer lane (the host moves it), so clips in a lane
// never overlap → no sub-columns. (Concurrent multi-device capture, if it ever lands, is a
// future conversation.) See DESIGN.md Section 3 (Clips landing grid).

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { ClipBlock, type ClipTone } from './ClipBlock'

export type LaneClip = {
  id: string
  startMs: number
  endMs: number
  label: string
  sublabel?: string
  posterUrl?: string | null
  manifestUrl?: string | null // playable HLS for the sticky ClipViewer
  sourceSessionId?: string | null // a saved clip's source buffer session (exact "one lane" link)
  draftId?: string | null // set when this is an unsaved DRAFT (→ saveDraft on materialise)
  parentSavedId?: string | null // set on a PIECE of a scissor-split SAVED clip (→ trim the parent)
}

export type ClipPos = { top: number; height: number }

type Props = {
  clips: LaneClip[]
  tone: ClipTone
  // The host's per-clip layout (`top`/`height` on the shared collapsed-gap axis). The
  // host reserves each clip's FLOORED height so blocks never overlap. (Axis-agnostic: a
  // horizontal mode would return left/width.)
  posOf: (id: string) => ClipPos | undefined
  onSelectClip?: (clip: LaneClip) => void // single tap → preview in the viewer
  onOpenClip?: (clip: LaneClip) => void // double tap → editor
  // Drag-to-cross: when set, clips can be dragged across to the other lane (buffered → save,
  // saved → un-save). `reachPx` is the distance to the other lane; `onMoveClip` commits.
  reachPx?: number
  onMoveClip?: (clip: LaneClip) => void
  selectedId?: string | null
  style?: StyleProp<ViewStyle>
}

export function ClipLane({ clips, tone, posOf, onSelectClip, onOpenClip, reachPx, onMoveClip, selectedId, style }: Props) {
  // Buffered clips drag RIGHT (→ saved); saved clips drag LEFT (→ buffered).
  const dragDir: 1 | -1 = tone === 'buffered' ? 1 : -1

  return (
    <View style={[styles.lane, style]}>
      {clips.map((c) => {
        const p = posOf(c.id)
        if (!p) return null
        return (
          <View key={c.id} style={[styles.slot, { top: p.top, height: p.height }]}>
            <ClipBlock
              heightPx={p.height}
              label={c.label}
              sublabel={c.sublabel}
              posterUrl={c.posterUrl}
              tone={tone}
              selected={selectedId === c.id}
              onSelect={onSelectClip ? () => onSelectClip(c) : undefined}
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

const styles = StyleSheet.create({
  lane: {
    flex: 1,
  },
  slot: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
})
