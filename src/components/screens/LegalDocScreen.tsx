// src/components/screens/LegalDocScreen.tsx
//
// Viewer for a single legal/policy document (Terms of Service, Community Rules,
// Creator Guidelines, Privacy Policy). The body is admin-editable Markdown served
// by GET /legal/:slug, so wording changes are live with no app build. Reached from
// the creator-onboarding TOS step and from Settings → LEGAL.

import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { ScreenScroll } from '@/components/sections/ScreenScroll'
import { ScreenHeader } from '@/components/sections/ScreenHeader'
import { MarkdownView } from '@/components/sections/MarkdownView'
import { Text } from '@/components/primitives/Text'
import { Button } from '@/components/primitives/Button'
import { useLegalDoc } from '@/hooks/useLegalDoc'
import { theme } from '@/tokens/theme'

export function LegalDocScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const { data: doc, isLoading, isError, refetch, isRefetching } = useLegalDoc(String(slug))

  // Reached only from Settings (the onboarding wizards read docs in an in-flow
  // sheet, not by navigating here). This screen is a tab (href: null), so
  // router.back() is a no-op — navigate to Settings explicitly.
  const goBack = () => router.navigate('/(app)/settings')

  // The header shows the document title, so drop a leading `# Title` H1 from the
  // body to avoid showing it twice.
  const body = doc?.markdown.replace(/^\s*#\s+.*\n+/, '') ?? ''

  return (
    <ScreenScroll
      header={<ScreenHeader title={doc?.title ?? 'Legal'} onBack={goBack} />}
      contentContainerStyle={styles.content}
    >
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.accent.default} />
        </View>
      ) : isError || !doc ? (
        <View style={styles.center}>
          <Text variant="body" color={theme.colors.text.muted} style={styles.errorText}>
            Couldn't load this document. Check your connection and try again.
          </Text>
          <Button variant="primary" label="Try again" onPress={() => refetch()} loading={isRefetching} />
        </View>
      ) : (
        <MarkdownView markdown={body} />
      )}
    </ScreenScroll>
  )
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xxxl,
  },
  center: {
    paddingTop: theme.spacing.xxxl,
    alignItems: 'center',
    gap: theme.spacing.lg,
  },
  errorText: {
    textAlign: 'center',
  },
})
