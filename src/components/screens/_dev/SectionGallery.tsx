// src/components/screens/_dev/SectionGallery.tsx
//
// Dev-only gallery exercising every SECTION (`src/components/sections/`).
// Companion to `PrimitiveGallery` and `FeatureGallery`.
//
// Sections are *regions of a screen* — many can't be sensibly inlined
// inside another scroll (e.g. `ScreenScroll` IS the wrapper of every
// gallery; `WizardShell` is a full-screen scaffold). Where a section
// makes sense as an inline preview (`TrendingRail`, `CategoryChipRow`,
// `StreamStrip`) it gets a row here; the full-screen ones get a note
// pointing to where they're already in use.
//
// Reachable in dev via expo-router push to `/(app)/section-gallery`.

import { View, StyleSheet } from 'react-native'
import { ScreenScroll } from '@/components/sections/ScreenScroll'
import { Text } from '@/components/primitives/Text'
import { theme } from '@/tokens/theme'

export function SectionGallery() {
  return (
    <ScreenScroll contentContainerStyle={styles.scroll}>
      <Text variant="display">Section gallery</Text>
      <Text variant="caption" color={theme.colors.text.muted}>
        Sub-phase 12.5+ build progress. Sections are regions of a screen;
        some are inline-previewable, others wrap entire screens.
      </Text>

      <Section title="ScreenScroll">
        <Text variant="body" color={theme.colors.text.muted}>
          You're looking at it. This entire gallery (and every other
          form-bearing screen on `main`) wraps in a `ScreenScroll`. There's
          no "inline" preview because the section IS the scroll viewport.
        </Text>
        <Text variant="monoCaption" color={theme.colors.text.subtle}>
          Used in: Login, Signup, Onboarding, Me, Dashboard,
          CreatorOnboarding inner steps, all three gallery pages.
        </Text>
      </Section>
    </ScreenScroll>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="monoLabel" color={theme.colors.text.subtle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  scroll: { padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: theme.spacing.xxxl },
  section: { gap: theme.spacing.sm, marginTop: theme.spacing.xl },
  sectionBody: {
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.subtle,
  },
})
