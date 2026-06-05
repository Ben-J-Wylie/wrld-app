// src/components/features/broadcast/GoLiveRecordBar.tsx
//
// The shared broadcast control, used identically on the dashboard and the
// stream view. State is driven by the global broadcastStore so both surfaces
// always read the same thing as you navigate between them.
//
// Single full-width button, two visual states:
//   not live → "Go Live"   · light accent-tint fill + accent border/label
//   live     → "End Stream" · solid accent (red) fill + cream label
//
// The Record verb is retired (Rolling Buffer initiative, June 2026): going
// live IS recording — the stream continuously fills a rolling buffer, so there
// is no Record button by design. The durable capture verb is now "Save a clip"
// (see SaveClipButton), retroactive over the buffer. The optional record props
// below are a vestigial compat shim so existing consumers
// (Dashboard / StreamScreen) keep type-checking until Aaron rewires the verb
// in those screens (the design→main seam); this component renders Go Live /
// End Stream only and ignores them.

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Pressable } from '@/components/primitives/Pressable'
import { Text } from '@/components/primitives/Text'
import { theme } from '@/tokens/theme'

type Props = {
  isLive: boolean
  liveDisabled?: boolean
  onLivePress: () => void
  // Record affordance — vestigial compat shim (recording is implicit while
  // live under the rolling-buffer model); ignored. Remove with the Dashboard /
  // StreamScreen rewire.
  isRecording?: boolean
  recordDisabled?: boolean
  onRecordPress?: () => void
  style?: StyleProp<ViewStyle>
}

export function GoLiveRecordBar({ isLive, liveDisabled, onLivePress, style }: Props) {
  return (
    <View style={[styles.row, style]}>
      <Pressable
        variant="default"
        onPress={onLivePress}
        disabled={liveDisabled}
        accessibilityRole="button"
        accessibilityLabel={isLive ? 'End stream' : 'Go live'}
        style={[styles.btn, isLive ? styles.btnLive : styles.btnIdle]}
      >
        <Text
          variant="bodyEmphasized"
          color={isLive ? theme.colors.text.inverse : theme.colors.accent.default}
        >
          {isLive ? 'End Stream' : 'Go Live'}
        </Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    width: '100%',
  },
  btn: {
    height: 54,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Not live: light red tint fill + accent border/label.
  btnIdle: {
    backgroundColor: theme.colors.accent.surface,
    borderColor: theme.colors.accent.border,
  },
  // Live: solid red fill.
  btnLive: {
    backgroundColor: theme.colors.accent.default,
    borderColor: theme.colors.accent.default,
  },
})
