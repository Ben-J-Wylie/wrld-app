// src/components/features/chat/ChatComposer.tsx
//
// Round-pill chat input + circular accent send button. The composer
// is a controlled feature — value/onChangeText/onSubmit are passed in.
// State derives from `sending` + content + `authenticated`.
//
// States:
//   empty     — Send disabled (greyed via IconButton disabled).
//   has-text  — Send enabled (accent-filled circle).
//   sending   — Input non-editable, send icon swaps to spinner.
//   unauth    — Field non-editable, "Sign in to chat" placeholder;
//               tapping anywhere fires `onAuthRequest` so the screen
//               can present its sign-up modal (Phase 10 pattern).
//
// The 999-radius pill shape + 40-tall override is applied via the
// `style` prop on Input so the existing Input primitive stays the same
// (no new variant — see DESIGN.md Section 3 Input note).

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Pressable } from '@/components/primitives/Pressable'
import { Input } from '@/components/primitives/Input'
import { IconButton } from '@/components/primitives/IconButton'
import { Spinner } from '@/components/primitives/Spinner'
import { theme } from '@/tokens/theme'

type Props = {
  value: string
  onChangeText: (v: string) => void
  onSubmit: () => void
  sending?: boolean
  authenticated?: boolean
  onAuthRequest?: () => void
  placeholder?: string
  style?: StyleProp<ViewStyle>
}

export function ChatComposer({
  value,
  onChangeText,
  onSubmit,
  sending = false,
  authenticated = true,
  onAuthRequest,
  placeholder = 'Say something…',
  style,
}: Props) {
  const canSend = authenticated && !sending && value.trim().length > 0

  if (!authenticated) {
    return (
      <Pressable
        variant="subtle"
        onPress={onAuthRequest}
        accessibilityRole="button"
        accessibilityLabel="Sign in to chat"
        style={[styles.row, style]}
      >
        <Input
          value=""
          editable={false}
          placeholder="Sign in to chat"
          pointerEvents="none"
          style={styles.input}
        />
        <IconButton
          name="send"
          variant="accent"
          size="lg"
          onPress={onAuthRequest ?? (() => {})}
          accessibilityLabel="Sign in to send"
          disabled
        />
      </Pressable>
    )
  }

  return (
    <View style={[styles.row, style]}>
      <Input
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        editable={!sending}
        returnKeyType="send"
        onSubmitEditing={canSend ? onSubmit : undefined}
        blurOnSubmit={false}
        style={styles.input}
      />
      {sending ? (
        <View style={styles.spinnerSlot}>
          <Spinner size="md" color={theme.colors.accent.default} />
        </View>
      ) : (
        <IconButton
          name="send"
          variant="accent"
          size="lg"
          onPress={onSubmit}
          accessibilityLabel="Send message"
          disabled={!canSend}
        />
      )}
    </View>
  )
}

const PILL_HEIGHT = 40
const SEND_DIM = 44

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  input: {
    flex: 1,
    height: PILL_HEIGHT,
    borderRadius: theme.radius.full,
    paddingHorizontal: theme.spacing.lg,
  },
  spinnerSlot: {
    width: SEND_DIM,
    height: SEND_DIM,
    borderRadius: SEND_DIM / 2,
    backgroundColor: theme.colors.accent.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
