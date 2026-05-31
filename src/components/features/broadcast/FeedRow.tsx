// src/components/features/broadcast/FeedRow.tsx
//
// Row used on the Go Live arming screen — one per broadcastable
// layer (cam / audio / screen / loc / gyro / compass / profile).
// FeedThumb on the left + meta column + Toggle. State drives
// border + background tone:
//   armed         — accent border + accent.surface bg
//   broadcasting  — accent border + accent.surface bg + accent label
//   off           — neutral
//   denied        — opacity 0.55 (OS permission declined)
//   disabled      — opacity 0.45, Toggle disabled

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Text } from '@/components/primitives/Text'
import { Toggle } from '@/components/primitives/Toggle'
import { FeedThumb, type FeedKind } from './FeedThumb'
import { theme } from '@/tokens/theme'

export type FeedState = 'off' | 'armed' | 'broadcasting' | 'denied' | 'disabled'

type Props = {
  kind: FeedKind
  label: string
  detail?: string
  state: FeedState
  on: boolean
  onToggle: (v: boolean) => void
  style?: StyleProp<ViewStyle>
}

export function FeedRow({ kind, label, detail, state, on, onToggle, style }: Props) {
  const isArmed = state === 'armed' || state === 'broadcasting'
  const isDenied = state === 'denied'
  const isDisabled = state === 'disabled'

  return (
    <View
      style={[
        styles.row,
        isArmed && styles.armed,
        (isDenied || isDisabled) && styles.dimmed,
        style,
      ]}
    >
      <FeedThumb kind={kind} active={isArmed && !isDisabled} />
      <View style={styles.col}>
        <Text variant="bodyEmphasized" numberOfLines={1}>
          {label}
        </Text>
        {detail && (
          <Text
            variant="monoCaption"
            color={isArmed ? theme.colors.accent.default : theme.colors.text.muted}
            numberOfLines={2}
          >
            {state === 'broadcasting' ? 'BROADCASTING · ' : ''}
            {state === 'denied' ? 'PERMISSION DENIED · ' : ''}
            {detail}
          </Text>
        )}
      </View>
      <Toggle
        value={on}
        onValueChange={onToggle}
        disabled={isDisabled || isDenied}
        accessibilityLabel={label}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    backgroundColor: theme.colors.bg.elevated,
  },
  armed: {
    borderColor: theme.colors.accent.default,
    backgroundColor: theme.colors.accent.surface,
  },
  dimmed: {
    opacity: 0.55,
  },
  col: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
})
