// src/components/features/broadcast/GoLiveRecordBar.tsx
//
// The shared broadcast control: two matched, side-by-side buttons used
// identically on the dashboard and the stream view. State is driven by the
// global broadcastStore so both surfaces always read the same labels.
//
//   Live button:   "Go Live"  (idle)  →  "End Stream"  (live)
//   Record button: "Record"   (idle)  →  "Stop Recording" (recording)
//
// Semantics (wired by the consumer):
//   • Go Live      — start the stream, no recording.
//   • Record       — start the stream (if needed) AND start recording.
//   • Stop Recording — stop recording only; the stream keeps running.
//   • End Stream   — stop recording (if any) AND the stream.
//
// Both buttons share one style (equal width, same height/variant) so the
// pair reads as a single control.

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Button } from '@/components/primitives/Button'
import { theme } from '@/tokens/theme'

type Props = {
  isLive: boolean
  isRecording: boolean
  liveDisabled?: boolean
  recordDisabled?: boolean
  onLivePress: () => void
  onRecordPress: () => void
  style?: StyleProp<ViewStyle>
}

export function GoLiveRecordBar({
  isLive,
  isRecording,
  liveDisabled,
  recordDisabled,
  onLivePress,
  onRecordPress,
  style,
}: Props) {
  return (
    <View style={[styles.row, style]}>
      {/* The Button primitive applies `style` to an inner view, so `flex:1`
          on the Button itself doesn't split the row — wrap each in a flex
          View instead. */}
      <View style={styles.btnWrap}>
        <Button
          label={isLive ? 'End Stream' : 'Go Live'}
          variant="primary"
          onPress={onLivePress}
          disabled={liveDisabled}
        />
      </View>
      <View style={styles.btnWrap}>
        <Button
          label={isRecording ? 'Stop Recording' : 'Record'}
          variant="primary"
          onPress={onRecordPress}
          disabled={recordDisabled}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  btnWrap: {
    flex: 1,
  },
})
