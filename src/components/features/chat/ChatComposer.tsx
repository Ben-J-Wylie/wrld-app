// src/components/features/chat/ChatComposer.tsx
//
// Rectangle chat input (radius.md, bg.elevated — same as the search / title
// fields) + circular accent send button. The composer is a controlled feature
// — value/onChangeText/onSubmit are passed in. State derives from `sending` +
// content + `authenticated`.
//
// States:
//   empty     — Send disabled (greyed via IconButton disabled).
//   has-text  — Send enabled (accent-filled circle).
//   sending   — Input non-editable, send icon swaps to spinner.
//   unauth    — Field non-editable, "Sign in to chat" placeholder;
//               tapping anywhere fires `onAuthRequest` so the screen
//               can present its sign-up modal (Phase 10 pattern).
//
// Only the compact height is overridden via the `style` prop on Input; the
// radius / background / border come straight from the primitive (no new
// variant — see DESIGN.md Section 3 Input note).

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
  suspended?: boolean
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
  suspended = false,
  onAuthRequest,
  placeholder = 'Say something…',
  style,
}: Props) {
  const canSend = authenticated && !suspended && !sending && value.trim().length > 0

  // Suspended: chat is disabled (the server drops it anyway). Show a non-editable
  // field that says so, with the send button greyed.
  if (suspended) {
    return (
      <View style={[styles.row, style]}>
        <Input
          value=""
          editable={false}
          placeholder="Chat disabled while suspended"
          pointerEvents="none"
          style={styles.input}
        />
        <IconButton name="send" variant="accent" size="lg" onPress={() => {}} accessibilityLabel="Chat disabled" disabled />
      </View>
    )
  }

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

// Field height matches the round send/flip buttons so all three line up.
const FIELD_HEIGHT = 44
const SEND_DIM = 44

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  input: {
    flex: 1,
    height: FIELD_HEIGHT,
    // radius.md + bg.elevated + border come from the Input primitive — a
    // rectangle field matching the search / title fields (no pill override).
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
