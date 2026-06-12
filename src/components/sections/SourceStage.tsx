// src/components/sections/SourceStage.tsx
//
// The live "universal remote" for a stream's sources. One switchboard that renders the
// selected source full-bleed and overlays a SourceRail to switch between the stream's
// available sources. SECTION tier (it composes many features), per the tier rule that
// features don't compose features.
//
// Render split (the one rule that keeps the design layer clean):
//   • Data / visual / map sources (audio · compass · gyro · motion · accel · speed ·
//     temp · torch · location · identity · chat) → rendered directly by their feature.
//   • Camera & screen (live WebRTC video) → rendered via an injected `slot` the SCREEN
//     fills with an <RTCView>. The design system stays WebRTC-free; same pattern as
//     BufferScrubField's frameSlot.
//
// PRESENTATIONAL — it takes the resolved data for the selected source and renders it.
// The data plumbing (telemetry path, getStats, RTCView) is the screen/hooks lane; see
// HANDOFF-source-visualizers-2026-06-12.md.

import type { ReactNode } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import type { FeedKind } from '@/components/features/broadcast/FeedThumb'
import { SOURCE_META } from '@/components/features/stream/sourceMeta'
import { SourceRail } from '@/components/features/clip/SourceRail'
import { AudioVisualizer } from '@/components/features/stream/AudioVisualizer'
import { CompassVisualizer } from '@/components/features/stream/CompassVisualizer'
import { GyroVisualizer } from '@/components/features/stream/GyroVisualizer'
import { MotionVisualizer } from '@/components/features/stream/MotionVisualizer'
import { AccelerometerVisualizer } from '@/components/features/stream/AccelerometerVisualizer'
import { SpeedVisualizer } from '@/components/features/stream/SpeedVisualizer'
import { TemperatureVisualizer } from '@/components/features/stream/TemperatureVisualizer'
import { TorchVisualizer } from '@/components/features/stream/TorchVisualizer'
import { SourceLocationTrail } from '@/components/features/clip/SourceLocationTrail'
import { SourceIdentityCard } from '@/components/features/clip/SourceIdentityCard'
import { SourceChatLog, type ChatLogMessage } from '@/components/features/clip/SourceChatLog'

type LngLat = [number, number]

// Resolved data for one source. `kind` must match the currently-selected source.
export type SourceRender =
  | { kind: 'cam'; slot: ReactNode } // injected <RTCView> (screen lane)
  | { kind: 'screen'; slot: ReactNode } // injected <RTCView> (screen lane)
  | { kind: 'audio'; level: number; variant?: 'waveform' | 'orb' }
  | { kind: 'compass'; heading: number }
  | { kind: 'gyro'; pitch: number; roll: number }
  | { kind: 'motion'; intensity: number }
  | { kind: 'accel'; x: number; y: number; z: number }
  | { kind: 'speed'; mps: number; unit?: 'kmh' | 'mph' }
  | { kind: 'temp'; celsius: number; unit?: 'c' | 'f' }
  | { kind: 'torch'; on: boolean; level?: number }
  | { kind: 'loc'; path: LngLat[]; position?: LngLat }
  | { kind: 'profile'; displayName: string; handle: string; avatarUrl?: string | null; attributed?: boolean; meta?: { label: string; value: string }[] }
  | { kind: 'chat'; messages: ChatLogMessage[] }

type Props = {
  /** The stream's available sources (drives the rail). */
  sources: FeedKind[]
  /** Currently-selected source kind. */
  selected: FeedKind
  onSelect: (kind: FeedKind) => void
  /** Resolved data for the selected source (its `kind` must equal `selected`). */
  source: SourceRender
  /** Has the selected data source produced a sample yet? (idle until true) */
  active?: boolean
  style?: StyleProp<ViewStyle>
}

export function SourceStage({ sources, selected, onSelect, source, active = true, style }: Props) {
  return (
    <View style={[styles.fill, style]}>
      {renderSource(source, active)}
      {sources.length > 1 && (
        <SourceRail
          sources={sources.map((k) => ({ key: k, iconName: SOURCE_META[k].icon, label: SOURCE_META[k].label }))}
          value={selected}
          onChange={(k) => onSelect(k as FeedKind)}
          style={styles.rail}
        />
      )}
    </View>
  )
}

function renderSource(s: SourceRender, active: boolean) {
  switch (s.kind) {
    case 'cam':
    case 'screen':
      return <View style={styles.fill}>{s.slot}</View>
    case 'audio':
      return <AudioVisualizer level={s.level} variant={s.variant} active={active} style={styles.fill} />
    case 'compass':
      return <CompassVisualizer heading={s.heading} active={active} style={styles.fill} />
    case 'gyro':
      return <GyroVisualizer pitch={s.pitch} roll={s.roll} active={active} style={styles.fill} />
    case 'motion':
      return <MotionVisualizer intensity={s.intensity} active={active} style={styles.fill} />
    case 'accel':
      return <AccelerometerVisualizer x={s.x} y={s.y} z={s.z} active={active} style={styles.fill} />
    case 'speed':
      return <SpeedVisualizer mps={s.mps} unit={s.unit} active={active} style={styles.fill} />
    case 'temp':
      return <TemperatureVisualizer celsius={s.celsius} unit={s.unit} active={active} style={styles.fill} />
    case 'torch':
      return <TorchVisualizer on={s.on} level={s.level} active={active} style={styles.fill} />
    case 'loc':
      return <SourceLocationTrail path={s.path} position={s.position} style={styles.fill} />
    case 'profile':
      return (
        <SourceIdentityCard
          displayName={s.displayName}
          handle={s.handle}
          avatarUrl={s.avatarUrl}
          attributed={s.attributed ?? true}
          meta={s.meta}
          style={styles.fill}
        />
      )
    case 'chat':
      return <SourceChatLog messages={s.messages} style={styles.fill} />
  }
}

const styles = StyleSheet.create({
  fill: { flex: 1, alignSelf: 'stretch' },
  rail: {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: [{ translateY: -120 }],
  },
})
