// src/components/primitives/TimelineZoomControl.tsx
//
// Buffer-trim clip editor (clips initiative · C2). Discrete zoom-level switch above
// the BufferTimeline — All / Hours / Min / Sec. Continuous pinch is the gesture;
// this is the four-stop control.
//
// Per the DESIGN.md proposal recommendation, this is a thin preset over
// `SegmentedToggle` (mono labels, four fixed options) rather than a bespoke
// primitive — it exists so consumers don't re-declare the zoom options at every
// call site. Promote to a standalone implementation only if the timeline grows
// zoom-specific affordances.

import { SegmentedToggle } from './SegmentedToggle'
import type { StyleProp, ViewStyle } from 'react-native'

export type TimelineZoom = 'all' | 'hours' | 'min' | 'sec'

const OPTIONS: { value: TimelineZoom; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'hours', label: 'Hours' },
  { value: 'min', label: 'Min' },
  { value: 'sec', label: 'Sec' },
]

type Props = {
  value: TimelineZoom
  onChange: (next: TimelineZoom) => void
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}

export function TimelineZoomControl({ value, onChange, disabled, style }: Props) {
  return (
    <SegmentedToggle
      options={OPTIONS}
      value={value}
      onChange={onChange}
      disabled={disabled}
      style={style}
    />
  )
}
