// src/components/sections/ClipSourceView.tsx
//
// The recorded-clip analog of SourceStage's renderer dispatch: given the resolved data
// for the clip's currently-viewed source, render the matching playback feature full-bleed.
// Unlike SourceStage (live, instantaneous values) these are PLAYBACK renderers — each takes
// a `progress` (0..1) playhead across the recorded track, so the whole track's shape shows
// with the playhead position lit. SECTION tier (it dispatches across many features).
//
// Camera/screen are NOT handled here — the clip viewer owns the video frame (poster, gap
// card, live feed, VOD reload cover are all camera-specific). This section renders only the
// data/audio/map/chat sources a captured clip can replay. The SourceRail (the switch) is the
// clip viewer's overlay; this is just the picture for the selected source.
//
// PRESENTATIONAL — the screen resolves the track samples (useDataTrack + dataTrackRender) and
// the per-session progress, and hands them in. See HANDOFF-source-visualizers-2026-06-12.md.

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { SourceWaveform } from '@/components/features/clip/SourceWaveform'
import { SourceTelemetryGraph } from '@/components/features/clip/SourceTelemetryGraph'
import { SourceLocationTrail } from '@/components/features/clip/SourceLocationTrail'
import { SourceChatLog, type ChatLogMessage } from '@/components/features/clip/SourceChatLog'

type LngLat = [number, number]

// Resolved data for the clip's selected source. `kind` matches the viewed source.
export type ClipSourceRender =
  | { kind: 'audio'; peaks: number[]; progress: number }
  | { kind: 'location'; path: LngLat[]; position?: LngLat }
  | { kind: 'compass' | 'gyro' | 'accel' | 'speed'; values: number[]; progress: number; reading: string }
  | { kind: 'chat'; messages: ChatLogMessage[]; progress: number }

const TELEMETRY_META: Record<'compass' | 'gyro' | 'accel' | 'speed', { label: string; iconName: 'compass' | 'navigation' | 'activity' | 'fast-forward' }> = {
  compass: { label: 'COMPASS', iconName: 'compass' },
  gyro: { label: 'GYRO', iconName: 'navigation' },
  accel: { label: 'ACCEL', iconName: 'activity' },
  speed: { label: 'SPEED', iconName: 'fast-forward' },
}

type Props = {
  source: ClipSourceRender
  style?: StyleProp<ViewStyle>
}

export function ClipSourceView({ source, style }: Props) {
  // A dark field behind the picture so the camera video underneath never bleeds through
  // (the clip viewer keeps the VideoView mounted under this so audio + the player survive
  // a source switch). Each visualizer fills with its own opaque surface; this is the fallback.
  return <View style={[styles.field, style]}>{renderSource(source)}</View>
}

function renderSource(s: ClipSourceRender) {
  switch (s.kind) {
    case 'audio':
      return <SourceWaveform peaks={s.peaks} progress={s.progress} style={styles.fill} />
    case 'location':
      return <SourceLocationTrail path={s.path} position={s.position} style={styles.fill} />
    case 'compass':
    case 'gyro':
    case 'accel':
    case 'speed':
      return (
        <SourceTelemetryGraph
          values={s.values}
          progress={s.progress}
          label={TELEMETRY_META[s.kind].label}
          iconName={TELEMETRY_META[s.kind].iconName}
          reading={s.reading}
          style={styles.fill}
        />
      )
    case 'chat':
      return <SourceChatLog messages={s.messages} progress={s.progress} style={styles.fill} />
  }
}

const styles = StyleSheet.create({
  // Fallback field colour (matches the visualizers' dark wrap) in case one renders translucent.
  field: { flex: 1, alignSelf: 'stretch', backgroundColor: '#1a1612' },
  // Inner fill must NOT set a backgroundColor — each Source* feature owns its own surface.
  fill: { flex: 1, alignSelf: 'stretch' },
})
