// src/components/features/clip/BufferTransport.tsx
//
// Buffer-trim clip editor (clips initiative). The transport row beneath the buffer
// scrub field: five controls — |◀ beginning of buffer · ‹ previous clip · play/pause ·
// next clip › · end of buffer ▶| . Presentational: the parent (ClipEditScreen) owns the
// playhead math (where each jump lands) and passes the handlers + `playing` state; the
// outer two never disable (always a buffer start/end), the clip-step buttons disable at
// the edges via `canPrev` / `canNext`.
//
// See DESIGN.md Section 3 (Buffer-trim clip editor).

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { Pressable } from '@/components/primitives/Pressable'
import { Icon } from '@/components/primitives/Icon'
import { theme } from '@/tokens/theme'

type Props = {
  playing: boolean
  onToStart: () => void
  onPrev: () => void
  onTogglePlay: () => void
  onNext: () => void
  onToEnd: () => void
  canPrev?: boolean
  canNext?: boolean
  style?: StyleProp<ViewStyle>
}

export function BufferTransport({
  playing,
  onToStart,
  onPrev,
  onTogglePlay,
  onNext,
  onToEnd,
  canPrev = true,
  canNext = true,
  style,
}: Props) {
  return (
    <View style={[styles.row, style]}>
      <StepButton icon="skip-back" label="Beginning of buffer" onPress={onToStart} />
      <StepButton icon="chevron-left" label="Previous clip" onPress={onPrev} disabled={!canPrev} />
      <Pressable
        variant="default"
        onPress={onTogglePlay}
        accessibilityRole="button"
        accessibilityLabel={playing ? 'Pause' : 'Play'}
        style={styles.playBtn}
      >
        <Icon name={playing ? 'pause' : 'play'} size={26} color={theme.colors.text.inverse} />
      </Pressable>
      <StepButton icon="chevron-right" label="Next clip" onPress={onNext} disabled={!canNext} />
      <StepButton icon="skip-forward" label="End of buffer" onPress={onToEnd} />
    </View>
  )
}

function StepButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: keyof typeof Feather.glyphMap
  label: string
  onPress: () => void
  disabled?: boolean
}) {
  return (
    <Pressable
      variant={disabled ? 'none' : 'default'}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={styles.stepBtn}
    >
      <Icon name={icon} size="lg" color={disabled ? theme.colors.text.subtle : theme.colors.text.primary} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xl,
  },
  stepBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accent.default,
  },
})
