// src/components/features/chat/ChatMessage.tsx
//
// Inline chat message. Renders a single line: bold role-coded handle
// followed by plain body text. Text-shadow is applied so the message
// stays legible when overlaid on the live video.
//
// Roles:
//   self    — your own handle, in the primary accent (`accent.default`)
//   user    — everyone else, in the secondary accent (`accent.bright`)
//   mod     — handle in `warn` amber (community moderator)
//   host    — handle in `accent.default` (broadcaster, the room owner)
//   system  — full mono-caps line, no handle (e.g. "USER JOINED",
//             "STREAM ENDED")
//
// API is consumer-flat — the chat overlay/section passes raw
// `{ role, handle, body }` per message. The feature does not own scroll,
// list virtualization, or send semantics.

import { StyleSheet, Text as RNText, View, type StyleProp, type ViewStyle } from 'react-native'
import { Text } from '@/components/primitives/Text'
import { theme } from '@/tokens/theme'

export type ChatRole = 'self' | 'user' | 'mod' | 'host' | 'system'

type Props = {
  role?: ChatRole
  handle?: string
  body: string
  style?: StyleProp<ViewStyle>
}

const HANDLE_COLOR: Record<Exclude<ChatRole, 'system'>, string> = {
  self: theme.colors.accent.default, // your own handle — primary accent
  user: theme.colors.accent.bright, // everyone else — secondary (lighter) accent
  mod: theme.colors.warn,
  host: theme.colors.accent.default,
}

const SHADOW = {
  textShadowColor: 'rgba(0,0,0,0.6)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 2,
}

export function ChatMessage({ role = 'user', handle, body, style }: Props) {
  if (role === 'system') {
    return (
      <View style={[styles.row, style]}>
        <Text variant="monoLabel" color={theme.colors.text.inverse} style={SHADOW}>
          {body}
        </Text>
      </View>
    )
  }

  return (
    <View style={[styles.row, style]}>
      <RNText style={styles.line}>
        {handle && (
          <Text variant="bodyEmphasized" color={HANDLE_COLOR[role]} style={SHADOW}>
            {handle}{' '}
          </Text>
        )}
        <Text variant="body" color={theme.colors.text.inverse} style={SHADOW}>
          {body}
        </Text>
      </RNText>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: 2,
  },
  line: {
    flexShrink: 1,
  },
})
