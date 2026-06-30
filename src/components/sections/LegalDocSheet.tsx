// src/components/sections/LegalDocSheet.tsx
//
// In-flow legal-doc reader for the onboarding wizards. Presents the doc in a
// modal over the current screen instead of navigating to the legal route, so
// reading a policy never leaves (or resets) the signup/creator wizard. The
// standalone LegalDocScreen (reached from Settings) is the navigable version.

import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Icon } from '@/components/primitives/Icon'
import { Text } from '@/components/primitives/Text'
import { MarkdownView } from './MarkdownView'
import { useLegalDoc } from '@/hooks/useLegalDoc'
import { theme } from '@/tokens/theme'

export function LegalDocSheet({ slug, onClose }: { slug: string; onClose: () => void }) {
  const { data: doc, isLoading } = useLegalDoc(slug)
  // The header shows the title, so drop a leading `# Title` H1 from the body.
  const body = doc?.markdown.replace(/^\s*#\s+.*\n+/, '') ?? ''

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text variant="heading">{doc?.title ?? 'Legal'}</Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={12}>
            <Icon name="x" size="md" color={theme.colors.text.primary} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.body}>
          {isLoading
            ? <ActivityIndicator color={theme.colors.accent.default} style={styles.loading} />
            : <MarkdownView markdown={body} />}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.bg.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.subtle,
  },
  body: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xxxl,
  },
  loading: {
    marginTop: theme.spacing.xxxl,
  },
})
