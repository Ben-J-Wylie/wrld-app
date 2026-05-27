import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useRef, useState } from 'react'
import { theme } from '@/lib/theme'
import type { ChatMessage } from '@/hooks/useSignaling'

type Props = {
  messages: ChatMessage[]
  isSignedIn: boolean
  onSend: (text: string) => void
  onAuthRequest: () => void
}

export function ChatOverlay({ messages, isSignedIn, onSend, onAuthRequest }: Props) {
  const [draft, setDraft] = useState('')
  const listRef = useRef<FlatList>(null)

  function handleSend() {
    const text = draft.trim()
    if (!text) return
    onSend(text)
    setDraft('')
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(_, i) => i.toString()}
        renderItem={({ item }) => (
          <View style={styles.messageRow}>
            <Text style={styles.handle}>@{item.from}</Text>
            <Text style={styles.text}> {item.text}</Text>
          </View>
        )}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={styles.empty}>No messages yet</Text>
        }
      />

      <View style={styles.inputRow}>
        {isSignedIn ? (
          <>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder="Say something…"
              placeholderTextColor={theme.colors.textMuted}
              returnKeyType="send"
              onSubmitEditing={handleSend}
              maxLength={500}
              blurOnSubmit={false}
            />
            <Pressable
              onPress={handleSend}
              style={({ pressed }) => [styles.sendBtn, pressed && styles.sendBtnPressed]}
              disabled={!draft.trim()}
            >
              <Text style={styles.sendText}>↑</Text>
            </Pressable>
          </>
        ) : (
          <Pressable onPress={onAuthRequest} style={styles.anonPrompt}>
            <Text style={styles.anonText}>Sign in to chat</Text>
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(10,10,15,0.85)',
  },
  list: { flex: 1 },
  listContent: {
    padding: theme.spacing.sm,
    gap: theme.spacing.xs,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  messageRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingVertical: 2,
  },
  handle: {
    ...theme.typography.caption,
    color: theme.colors.accent,
    fontWeight: '600',
  },
  text: {
    ...theme.typography.caption,
    color: theme.colors.text,
    flexShrink: 1,
  },
  empty: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: theme.spacing.md,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  input: {
    flex: 1,
    height: 36,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.bgElevated,
    paddingHorizontal: theme.spacing.md,
    color: theme.colors.text,
    fontSize: 14,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnPressed: { opacity: 0.7 },
  sendText: { color: '#fff', fontSize: 18, fontWeight: '700', lineHeight: 20 },
  anonPrompt: {
    flex: 1,
    height: 36,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  anonText: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
})
