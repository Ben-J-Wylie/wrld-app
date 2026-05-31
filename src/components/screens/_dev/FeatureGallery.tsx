// src/components/screens/_dev/FeatureGallery.tsx
//
// Dev-only gallery exercising every FEATURE (`src/components/features/`).
// Companion to `PrimitiveGallery` and `SectionGallery`. Each feature
// shipped in 12.5+ adds a section below.
//
// Reachable in dev via expo-router push to `/(app)/feature-gallery`.

import { View, StyleSheet } from 'react-native'
import { ScreenScroll } from '@/components/sections/ScreenScroll'
import { Text } from '@/components/primitives/Text'
import { LivePill } from '@/components/features/stream/LivePill'
import { theme } from '@/tokens/theme'

export function FeatureGallery() {
  return (
    <ScreenScroll contentContainerStyle={styles.scroll}>
      <Text variant="display">Feature gallery</Text>
      <Text variant="caption" color={theme.colors.text.muted}>
        Sub-phase 12.5+ build progress. Each feature ships with its variants exercised here.
      </Text>

      <Section title="LivePill">
        <Row label="md (default)">
          <LivePill />
        </Row>
        <Row label="sm">
          <LivePill size="sm" />
        </Row>
        <Row label="paired">
          <View style={styles.row}>
            <LivePill size="sm" />
            <LivePill />
          </View>
        </Row>
      </Section>
    </ScreenScroll>
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

function GalleryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.galleryRow}>
      <Text variant="caption" color={theme.colors.text.subtle} style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowContent}>{children}</View>
    </View>
  )
}

// Local alias so the markup reads `<Row>` like the primitive gallery does
const Row = GalleryRow

const styles = StyleSheet.create({
  scroll: { padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: theme.spacing.xxxl },
  section: { gap: theme.spacing.sm, marginTop: theme.spacing.xl },
  galleryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.subtle,
  },
  rowLabel: { width: 110, paddingTop: 2 },
  rowContent: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    flexWrap: 'wrap',
  },
})
