// src/components/screens/_dev/FeatureGallery.tsx
//
// Dev-only gallery exercising every FEATURE (`src/components/features/`).
// Companion to `PrimitiveGallery` and `SectionGallery`. Each feature
// shipped in 12.5+ adds a section below.
//
// Reachable in dev via expo-router push to `/(app)/feature-gallery`.

import { ScrollView, View, StyleSheet } from 'react-native'
import { ScreenScroll } from '@/components/sections/ScreenScroll'
import { Text } from '@/components/primitives/Text'
import { LivePill } from '@/components/features/stream/LivePill'
import { StreamCard } from '@/components/features/stream/StreamCard'
import { VideoPreviewTile } from '@/components/features/stream/VideoPreviewTile'
import { BroadcasterRow } from '@/components/features/user/BroadcasterRow'
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

      <Section title="StreamCard">
        <Row label="trending (horizontal scroll)">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.trendingScroll}
          >
            <StreamCard
              thumbnailUrl="https://picsum.photos/seed/wrld1/200/120"
              title="Atlantic Ave · street fest"
              viewerCount={1400}
              city="BROOKLYN"
              channel="CH 12"
              onPress={() => {}}
            />
            <StreamCard
              thumbnailUrl="https://picsum.photos/seed/wrld2/200/120"
              title="Golden Gate overlook"
              viewerCount={9120}
              city="SAN FRANCISCO"
              channel="CH 08"
              onPress={() => {}}
            />
            <StreamCard
              thumbnailUrl="https://picsum.photos/seed/wrld3/200/120"
              title="Aurora — north-facing"
              viewerCount={6400}
              city="REYKJAVÍK"
              channel="CH 41"
              onPress={() => {}}
            />
          </ScrollView>
        </Row>
        <Row label="preview (16:10 hero)">
          <StreamCard
            variant="preview"
            thumbnailUrl="https://picsum.photos/seed/wrldhero/640/400"
            title="Drumline forming up"
            viewerCount={1400}
            channel="CH 12 · STREET"
            onPress={() => {}}
          />
        </Row>
        <Row label="compact (sheet row)">
          <View style={styles.stack}>
            <StreamCard
              variant="compact"
              thumbnailUrl="https://picsum.photos/seed/wrld4/200/120"
              title="Food truck row across the street"
              viewerCount={620}
              city="BROOKLYN"
              channel="CH 18"
              onPress={() => {}}
            />
            <StreamCard
              variant="compact"
              thumbnailUrl="https://picsum.photos/seed/wrld5/200/120"
              title="Rooftop view — whole block in frame"
              viewerCount={2100}
              city="BROOKLYN"
              channel="CH 09"
              onPress={() => {}}
            />
          </View>
        </Row>
        <Row label="no thumbnail">
          <StreamCard
            title="Audio-only · pirate radio"
            viewerCount={250}
            city="NYC"
            channel="CH 99"
            onPress={() => {}}
          />
        </Row>
        <Row label="not live">
          <StreamCard
            thumbnailUrl="https://picsum.photos/seed/wrldoff/200/120"
            title="Yesterday's stream"
            viewerCount={0}
            isLive={false}
            city="BROOKLYN"
            channel="CH 12"
            onPress={() => {}}
          />
        </Row>
      </Section>

      <Section title="VideoPreviewTile">
        <Row label="live (default 16:10)">
          <VideoPreviewTile
            thumbnailUrl="https://picsum.photos/seed/wrldtile1/640/400"
            viewerCount={1400}
            channel="CH 12 · STREET"
            onPress={() => {}}
          />
        </Row>
        <Row label="play (clip hero)">
          <VideoPreviewTile
            variant="play"
            thumbnailUrl="https://picsum.photos/seed/wrldtile2/640/400"
            channel="CH 08 · NIGHT"
            onPress={() => {}}
          />
        </Row>
        <Row label="play, no overlays">
          <VideoPreviewTile
            variant="play"
            thumbnailUrl="https://picsum.photos/seed/wrldtile3/640/400"
          />
        </Row>
        <Row label="no thumbnail">
          <VideoPreviewTile viewerCount={42} channel="CH 99" />
        </Row>
        <Row label="16:9 aspect override">
          <VideoPreviewTile
            variant="play"
            thumbnailUrl="https://picsum.photos/seed/wrldtile4/640/360"
            aspectRatio={16 / 9}
            viewerCount={250}
          />
        </Row>
      </Section>

      <Section title="BroadcasterRow">
        <Row label="default">
          <BroadcasterRow
            avatarUrl="https://i.pravatar.cc/100?u=kai"
            displayName="Kai DC"
            handle="kai.dc"
            followerCount={1200}
          />
        </Row>
        <Row label="no follower count">
          <BroadcasterRow
            avatarUrl="https://i.pravatar.cc/100?u=mira"
            displayName="Mira B"
            handle="mira.b"
          />
        </Row>
        <Row label="initials avatar">
          <BroadcasterRow
            displayName="Jules"
            handle="jules"
            followerCount={42}
          />
        </Row>
        <Row label="no follow button">
          <BroadcasterRow
            avatarUrl="https://i.pravatar.cc/100?u=ben"
            displayName="Ben Wylie"
            handle="benwy"
            followerCount={8200}
            showFollowButton={false}
          />
        </Row>
        <Row label="chip (over video)">
          <View style={styles.videoBg}>
            <BroadcasterRow
              variant="chip"
              avatarUrl="https://i.pravatar.cc/100?u=kai"
              displayName="Kai DC"
              handle="kai.dc"
            />
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
  trendingScroll: {
    gap: theme.spacing.sm,
    paddingRight: theme.spacing.sm,
  },
  stack: {
    gap: theme.spacing.sm,
  },
  videoBg: {
    aspectRatio: 16 / 9,
    backgroundColor: '#1d1410',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    justifyContent: 'flex-start',
  },
})
