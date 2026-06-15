// src/components/features/clip/BufferTransport.tsx
//
// Buffer-trim clip editor (clips initiative). The transport row beneath the buffer
// scrub field — seven controls, left → right:
//   |◀ head of buffer · ‹‹ prev clip edge · ‹ frame back · ▶/⏸ play · › frame forward ·
//   ›› next clip edge · ▶| tail of buffer
//
// The frame buttons are TAP-or-HOLD: a tap steps one frame; a press-and-hold plays
// (forward for ›, reverse for ‹) until released. The clip-edge buttons land on BOTH
// clip heads and tails (hence the double chevron). Presentational: the parent
// (ClipEditScreen) owns the playhead math, the one-frame step size, and forward/reverse
// playback; this component just routes taps vs holds.
//
// See DESIGN.md Section 3 (Buffer-trim clip editor).

import { useRef } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { Pressable } from '@/components/primitives/Pressable'
import { Icon } from '@/components/primitives/Icon'
import { theme } from '@/tokens/theme'

const HOLD_MS = 240 // press longer than this → hold (play) instead of a single-frame tap

type Props = {
  playing: boolean
  // Riding the reaper edge: motion vs the footage that CAN'T be paused (the reaper eats on a timer).
  // Shows a distinct slashed-pause icon — "playing, but pause is unavailable here". Takes precedence
  // over `playing` for the icon. (You leave the reaper ride via a drag / a forward transport button /
  // wheeling the clock ahead / NOW — or pressing this, which plays forward off the oldest edge.)
  reaping?: boolean
  onToStart: () => void
  onPrevClip: () => void
  onFrameBack: () => void
  onFrameBackHold: (held: boolean) => void
  onTogglePlay: () => void
  onFrameForward: () => void
  onFrameForwardHold: (held: boolean) => void
  onNextClip: () => void
  onToEnd: () => void
  canPrev?: boolean
  canNext?: boolean
  canFrameBack?: boolean
  canFrameForward?: boolean
  style?: StyleProp<ViewStyle>
}

export function BufferTransport({
  playing,
  reaping = false,
  onToStart,
  onPrevClip,
  onFrameBack,
  onFrameBackHold,
  onTogglePlay,
  onFrameForward,
  onFrameForwardHold,
  onNextClip,
  onToEnd,
  canPrev = true,
  canNext = true,
  canFrameBack = true,
  canFrameForward = true,
  style,
}: Props) {
  return (
    <View style={[styles.row, style]}>
      <StepButton icon="skip-back" label="Head of buffer" onPress={onToStart} />
      <StepButton icon="chevrons-left" label="Previous clip edge" onPress={onPrevClip} disabled={!canPrev} />
      <HoldStepButton
        icon="chevron-left"
        label="Frame back (hold to reverse)"
        onStep={onFrameBack}
        onHold={onFrameBackHold}
        disabled={!canFrameBack}
      />
      <Pressable
        variant="default"
        onPress={onTogglePlay}
        accessibilityRole="button"
        accessibilityLabel={reaping ? 'Playing — riding the reaper edge (can’t pause)' : playing ? 'Pause' : 'Play'}
        style={styles.playBtn}
      >
        {reaping ? (
          <View style={styles.slashWrap}>
            <Icon name="pause" size={20} color={theme.colors.text.inverse} />
            {/* Slashed-pause = "playing, but pause is unavailable". The accent-coloured channel under
                the white line separates the slash from the white pause bars so it reads clearly. */}
            <View style={styles.slashChannel} pointerEvents="none" />
            <View style={styles.slashLine} pointerEvents="none" />
          </View>
        ) : (
          <Icon name={playing ? 'pause' : 'play'} size={20} color={theme.colors.text.inverse} />
        )}
      </Pressable>
      <HoldStepButton
        icon="chevron-right"
        label="Frame forward (hold to play)"
        onStep={onFrameForward}
        onHold={onFrameForwardHold}
        disabled={!canFrameForward}
      />
      <StepButton icon="chevrons-right" label="Next clip edge" onPress={onNextClip} disabled={!canNext} />
      <StepButton icon="skip-forward" label="Tail of buffer" onPress={onToEnd} />
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
      hitSlop={6}
      style={styles.stepBtn}
    >
      <Icon name={icon} size="md" color={disabled ? theme.colors.text.subtle : theme.colors.text.primary} />
    </Pressable>
  )
}

// Tap = one-frame step; press-and-hold (past HOLD_MS) = play until release.
function HoldStepButton({
  icon,
  label,
  onStep,
  onHold,
  disabled,
}: {
  icon: keyof typeof Feather.glyphMap
  label: string
  onStep: () => void
  onHold: (held: boolean) => void
  disabled?: boolean
}) {
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const holding = useRef(false)
  const clearTimer = () => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
  }
  return (
    <Pressable
      variant={disabled ? 'none' : 'default'}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={styles.stepBtn}
      onPressIn={() => {
        holding.current = false
        clearTimer()
        holdTimer.current = setTimeout(() => {
          holding.current = true
          onHold(true)
        }, HOLD_MS)
      }}
      onPressOut={() => {
        clearTimer()
        if (holding.current) {
          holding.current = false
          onHold(false)
        } else {
          onStep()
        }
      }}
    >
      <Icon name={icon} size="md" color={disabled ? theme.colors.text.subtle : theme.colors.text.primary} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  stepBtn: {
    width: 40,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accent.default,
  },
  slashWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The diagonal "can't pause" slash: a thin white line sitting in a slightly wider accent-coloured
  // channel, so it stays legible where it crosses the white pause bars.
  slashChannel: {
    position: 'absolute',
    width: 30,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.colors.accent.default,
    transform: [{ rotate: '-45deg' }],
  },
  slashLine: {
    position: 'absolute',
    width: 30,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: theme.colors.text.inverse,
    transform: [{ rotate: '-45deg' }],
  },
})
