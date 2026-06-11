// src/components/features/clip/ZoomButton.tsx
//
// The zoom control used by the buffer-trim timeline AND the clips landing grid: a single
// icon button where a TAP = one zoom step and a press-and-hold (past ZOOM_HOLD_TRIGGER_MS)
// = a smooth continuous zoom until release. Same tap-vs-hold shape as the transport's frame
// buttons. Presentational + gesture-only — the host owns the actual zoom maths.
//
// See DESIGN.md Section 3 (Buffer-trim clip editor).

import { useRef, type ComponentProps } from 'react'
import { StyleSheet } from 'react-native'
import { Pressable } from '@/components/primitives/Pressable'
import { Icon } from '@/components/primitives/Icon'
import { theme } from '@/tokens/theme'

// Press longer than this → smooth-zoom hold (not a tap).
export const ZOOM_HOLD_TRIGGER_MS = 240

type Props = {
  icon: ComponentProps<typeof Icon>['name']
  label: string
  onTap: () => void
  onHold: (held: boolean) => void
  disabled?: boolean
}

export function ZoomButton({ icon, label, onTap, onHold, disabled }: Props) {
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
      variant={disabled ? 'none' : 'subtle'}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={styles.zoomBtn}
      onPressIn={() => {
        holding.current = false
        clearTimer()
        holdTimer.current = setTimeout(() => {
          holding.current = true
          onHold(true)
        }, ZOOM_HOLD_TRIGGER_MS)
      }}
      onPressOut={() => {
        clearTimer()
        if (holding.current) {
          holding.current = false
          onHold(false)
        } else {
          onTap()
        }
      }}
    >
      <Icon name={icon} size="md" color={disabled ? theme.colors.text.subtle : theme.colors.text.muted} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  zoomBtn: {
    width: 38,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
