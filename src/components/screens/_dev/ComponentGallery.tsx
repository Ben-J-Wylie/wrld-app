// src/components/screens/_dev/ComponentGallery.tsx
//
// Dev-only gallery exercising every primitive variant. Mechanical
// criterion #4 (DESIGN.md): "renders without errors and covers every
// primitive variant (default, pressed, disabled, loading where
// applicable)." Each primitive shipped in 12.4 adds a section below.
//
// Reachable in dev via expo-router push to `/(app)/gallery`. The route
// is registered with `href: null` so it does not appear in the tab bar.

import { ScrollView, View, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Text } from '@/components/primitives/Text'
import { theme } from '@/tokens/theme'

export function ComponentGallery() {
  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text variant="display">Component gallery</Text>
        <Text variant="caption" color={theme.colors.text.muted}>
          Sub-phase 12.4 build progress. Each primitive ships with its variants exercised here.
        </Text>

        <Section title="Text">
          <Row label="display"><Text variant="display">A live planet</Text></Row>
          <Row label="heading"><Text variant="heading">Nearby streams</Text></Row>
          <Row label="body"><Text variant="body">The drumline forms up at the corner.</Text></Row>
          <Row label="bodyEmphasized"><Text variant="bodyEmphasized">Open broadcast</Text></Row>
          <Row label="caption"><Text variant="caption">1.4K watching · 0.4 mi</Text></Row>
          <Row label="monoLabel"><Text variant="monoLabel">streams</Text></Row>
          <Row label="monoCaption"><Text variant="monoCaption">BROOKLYN, NY</Text></Row>
          <Row label="monoValue"><Text variant="monoValue">40.6829° N</Text></Row>
        </Section>
      </ScrollView>
    </SafeAreaView>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="monoLabel" color={theme.colors.text.subtle}>{title}</Text>
      <View>{children}</View>
    </View>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text variant="caption" color={theme.colors.text.subtle} style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowContent}>{children}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg.primary },
  scroll: { padding: theme.spacing.lg, gap: theme.spacing.md },
  section: { gap: theme.spacing.sm, marginTop: theme.spacing.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.subtle,
  },
  rowLabel: { width: 110, paddingTop: 2 },
  rowContent: { flex: 1 },
})
