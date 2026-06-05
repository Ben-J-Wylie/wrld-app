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
// The Record button is removed from the UI for now (2026-06-04). The record
// *functionality* is untouched in StreamScreen (start/stop/command/pending);
// the props below stay optional so the second button can be reinstated
// without touching consumers.

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Pressable } from '@/components/primitives/Pressable'
import { Text } from '@/components/primitives/Text'
import { theme } from '@/tokens/theme'

type Props = {
  isLive: boolean
  liveDisabled?: boolean
  onLivePress: () => void
  // Record affordance — kept for when the button returns; currently unused.
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
