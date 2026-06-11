// src/components/features/clip/SourceChatLog.tsx
//
// Chat source view for the buffer viewer — a stand-in transcript that fills the scrub
// field when the CHAT source is selected. Renders captured messages as a stacked log
// with @handle + text; the row nearest the playhead reads accent ("now"), older rows
// muted. Dependency-free (pure Views), so it works without a native module. Light
// (paper) surface — chat is metadata-over-stream, not media.
//
// PLACEHOLDER: until the buffer descriptor exposes a real chat track (Aaron's lane),
// the parent feeds mock messages. The prop shape is already the real one — only the
// source of `messages` changes when the track lands. See DESIGN.md Section 3
// (Buffer-trim clip editor).

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Icon } from '@/components/primitives/Icon'
import { Text } from '@/components/primitives/Text'
import { theme } from '@/tokens/theme'

export type ChatLogMessage = { handle: string; text: string }

type Props = {
  messages: ChatLogMessage[]
  progress?: number // 0..1 playhead position across the messages
  label?: string
  style?: StyleProp<ViewStyle>
}

// Self-contained mock so the gallery (and the editor before the track lands) renders
// without external data.
const MOCK_MESSAGES: ChatLogMessage[] = [
  { handle: 'kai.dc', text: 'this view is unreal 🔥' },
  { handle: 'mara', text: 'where is this?' },
  { handle: 'theo', text: 'turn the camera left!' },
  { handle: 'jules', text: 'following now' },
  { handle: 'sam', text: 'how long are you live for?' },
]

export function SourceChatLog({ messages = MOCK_MESSAGES, progress = 1, label = 'CHAT', style }: Props) {
  const rows = messages.length ? messages : MOCK_MESSAGES
  // The "live" row is the one the playhead has reached — everything past it is muted
  // (hasn't been said yet at this point in the buffer).
  const liveIndex = Math.round((rows.length - 1) * progress)

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.log}>
        {rows.map((m, i) => {
          const future = i > liveIndex
          return (
            <View key={i} style={[styles.bubble, future && styles.bubbleFuture]}>
              <Text variant="monoLabel" color={future ? theme.colors.text.subtle : theme.colors.accent.default}>
                @{m.handle}
              </Text>
              <Text
                variant="caption"
                color={future ? theme.colors.text.subtle : theme.colors.text.primary}
                numberOfLines={2}
              >
                {m.text}
              </Text>
            </View>
          )
        })}
      </View>
      <View style={styles.tag}>
        <Icon name="message-circle" size="sm" color={theme.colors.text.muted} />
        <Text variant="monoLabel" color={theme.colors.text.muted}>
          {label}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: theme.colors.bg.panelHi,
    justifyContent: 'center',
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  log: {
    gap: theme.spacing.xs,
  },
  bubble: {
    alignSelf: 'flex-start',
    maxWidth: '90%',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bg.panel,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    gap: 2,
  },
  bubbleFuture: {
    opacity: 0.5,
  },
  tag: {
    position: 'absolute',
    bottom: theme.spacing.md,
    right: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
})
