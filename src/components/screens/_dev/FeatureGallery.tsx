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
import { CoordHUD } from '@/components/features/stream/CoordHUD'
import { StreamTile } from '@/components/features/stream/StreamTile'
import { ChatMessage } from '@/components/features/chat/ChatMessage'
import { ChatComposer } from '@/components/features/chat/ChatComposer'
import { StreamStateBanner } from '@/components/features/stream/StreamStateBanner'
import { ReactionRail } from '@/components/features/stream/ReactionRail'
import { SettingsRow } from '@/components/features/settings/SettingsRow'
import { ToastBanner } from '@/components/features/feedback/ToastBanner'
import { SearchBar } from '@/components/features/discovery/SearchBar'
import { Toggle } from '@/components/primitives/Toggle'
import { Button } from '@/components/primitives/Button'
import { BroadcasterRow } from '@/components/features/user/BroadcasterRow'
import { useState } from 'react'
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

      <Section title="CoordHUD">
        <Row label="viewer-sheet (4-col)">
          <CoordHUD
            items={[
              { label: 'LAT', value: '40.6782' },
              { label: 'LON', value: '-73.9442' },
              { label: 'ELEV', value: '12m' },
              { label: 'UPTIME', value: '00:14:27' },
            ]}
          />
        </Row>
        <Row label="with pending">
          <CoordHUD
            items={[
              { label: 'LAT', value: '40.6782' },
              { label: 'LON', value: '-73.9442' },
              { label: 'ELEV', value: '—', pending: true },
              { label: 'GPS', value: '...', pending: true },
            ]}
          />
        </Row>
        <Row label="broadcast-live (over video)">
          <View style={styles.videoBg}>
            <CoordHUD
              variant="broadcast-live"
              items={[
                { label: 'LAT', value: '40.6782' },
                { label: 'LON', value: '-73.9442' },
                { label: 'HDG', value: '192°' },
                { label: 'UPTIME', value: '00:14:27' },
              ]}
            />
          </View>
        </Row>
        <Row label="broadcast-live pending">
          <View style={styles.videoBg}>
            <CoordHUD
              variant="broadcast-live"
              items={[
                { label: 'LAT', value: '...', pending: true },
                { label: 'LON', value: '...', pending: true },
                { label: 'HDG', value: '—', pending: true },
                { label: 'UPTIME', value: '00:00:03' },
              ]}
            />
          </View>
        </Row>
      </Section>

      <Section title="StreamTile">
        <Row label="active (default)">
          <View style={styles.row}>
            <StreamTile iconName="video" label="CAM" value="1080p" />
            <StreamTile iconName="mic" label="AUD" value="48 kHz" />
            <StreamTile iconName="map-pin" label="LOC" value="GPS" />
          </View>
        </Row>
        <Row label="inactive (faded)">
          <View style={styles.row}>
            <StreamTile iconName="monitor" label="SCRN" value="OFF" active={false} />
            <StreamTile iconName="navigation" label="GYR" value="OFF" active={false} />
            <StreamTile iconName="compass" label="HDG" value="OFF" active={false} />
          </View>
        </Row>
        <Row label="mixed (typical viewer sheet)">
          <View style={styles.row}>
            <StreamTile iconName="video" label="CAM" value="1080p" onPress={() => {}} />
            <StreamTile iconName="mic" label="AUD" value="48 kHz" onPress={() => {}} />
            <StreamTile iconName="map-pin" label="LOC" value="GPS" onPress={() => {}} />
            <StreamTile iconName="compass" label="HDG" value="192°" onPress={() => {}} />
            <StreamTile iconName="monitor" label="SCRN" value="OFF" active={false} onPress={() => {}} />
          </View>
        </Row>
      </Section>

      <Section title="ChatMessage">
        <Row label="user (default)">
          <View style={styles.chatBg}>
            <ChatMessage role="user" handle="@mira" body="that drone shot is wild" />
            <ChatMessage role="user" handle="@kai" body="where is this exactly?" />
          </View>
        </Row>
        <Row label="host (broadcaster)">
          <View style={styles.chatBg}>
            <ChatMessage role="host" handle="@bw" body="brooklyn — atlantic ave fest" />
          </View>
        </Row>
        <Row label="mod">
          <View style={styles.chatBg}>
            <ChatMessage role="mod" handle="@jules" body="keep it kind everyone 🙏" />
          </View>
        </Row>
        <Row label="system">
          <View style={styles.chatBg}>
            <ChatMessage role="system" body="STREAM PAUSED · RESUMING" />
          </View>
        </Row>
      </Section>

      <Section title="ChatComposer">
        <Row label="empty"><ChatComposerDemo initial="" /></Row>
        <Row label="has-text"><ChatComposerDemo initial="awesome stream" /></Row>
        <Row label="sending"><ChatComposerDemo initial="awesome stream" sending /></Row>
        <Row label="unauthenticated">
          <ChatComposerDemo initial="" authenticated={false} />
        </Row>
      </Section>

      <Section title="StreamStateBanner">
        <Row label="disconnected">
          <StreamStateBanner variant="disconnected" onDismiss={() => {}} />
        </Row>
        <Row label="ended (auto-dismiss disabled here)">
          <StreamStateBanner variant="ended" autoDismissMs={0} onDismiss={() => {}} />
        </Row>
        <Row label="resumed (tappable)">
          <StreamStateBanner variant="resumed" onTap={() => {}} onDismiss={() => {}} />
        </Row>
      </Section>

      <Section title="ReactionRail">
        <Row label="default (over video)">
          <View style={styles.reactionBg}>
            <ReactionRail
              reactions={[
                { kind: 'heart', emoji: '❤️', count: 42 },
                { kind: 'fire', emoji: '🔥', count: 18, on: true },
                { kind: 'clap', emoji: '👏', count: 7 },
                { kind: 'wow', emoji: '😮' },
              ]}
              burst={[]}
              onReact={() => {}}
              onBurstDismiss={() => {}}
            />
          </View>
        </Row>
        <Row label="unauthenticated">
          <View style={styles.reactionBg}>
            <ReactionRail
              reactions={[
                { kind: 'heart', emoji: '❤️' },
                { kind: 'fire', emoji: '🔥' },
                { kind: 'clap', emoji: '👏' },
                { kind: 'wow', emoji: '😮' },
              ]}
              burst={[]}
              authenticated={false}
              onReact={() => {}}
              onAuthRequest={() => {}}
              onBurstDismiss={() => {}}
            />
          </View>
        </Row>
        <Row label="with burst (live)">
          <ReactionRailBurstDemo />
        </Row>
      </Section>

      <Section title="SettingsRow">
        <Row label="default (group)">
          <View style={styles.settingsGroup}>
            <SettingsRow
              iconName="credit-card"
              title="Plan"
              value="Free · View all plans"
              arrow
              showBorderTop={false}
              onPress={() => {}}
            />
            <SettingsRow
              iconName="bell"
              title="Notifications"
              value="Followed live, nearby live"
              arrow
              onPress={() => {}}
            />
            <SettingsRow
              iconName="lock"
              title="Privacy"
              value="Location · Profile visibility"
              arrow
              onPress={() => {}}
            />
          </View>
        </Row>
        <Row label="highlight (identity)">
          <View style={styles.settingsGroup}>
            <SettingsRow
              variant="highlight"
              iconName="at-sign"
              title="@benwy"
              value="Tap to edit handle"
              arrow
              showBorderTop={false}
              onPress={() => {}}
            />
            <SettingsRow
              iconName="user"
              title="Display name"
              value="Ben Wylie"
              arrow
              onPress={() => {}}
            />
          </View>
        </Row>
        <Row label="with Toggle">
          <SettingsRowToggleDemo />
        </Row>
        <Row label="no icon (text-only)">
          <View style={styles.settingsGroup}>
            <SettingsRow
              title="Terms of service"
              arrow
              showBorderTop={false}
              onPress={() => {}}
            />
            <SettingsRow title="Privacy policy" arrow onPress={() => {}} />
            <SettingsRow title="Sign out" onPress={() => {}} />
          </View>
        </Row>
      </Section>

      <Section title="ToastBanner">
        <Row label="all variants (no auto-dismiss)">
          <View style={styles.stack}>
            <ToastBanner
              variant="accent"
              body="Handle changed to @benwy"
              autoDismissMs={0}
              onDismiss={() => {}}
            />
            <ToastBanner
              variant="warn"
              body="Connection unstable — reactions may delay"
              autoDismissMs={0}
              onDismiss={() => {}}
            />
            <ToastBanner
              variant="err"
              body="Couldn't send tip — try again in a moment"
              autoDismissMs={0}
              onDismiss={() => {}}
            />
            <ToastBanner
              variant="success"
              body="100 🚀 sent to @kai.dc"
              autoDismissMs={0}
              onDismiss={() => {}}
            />
          </View>
        </Row>
        <Row label="interactive (auto-dismiss 3.5s)">
          <ToastBannerDemo />
        </Row>
      </Section>

      <Section title="SearchBar">
        <Row label="default (empty)">
          <SearchBarDemo />
        </Row>
        <Row label="with seeded value (clear-X)">
          <SearchBarDemo initial="atlantic ave" />
        </Row>
        <Row label="no clear callback (no X)">
          <SearchBarDemo initial="kai" omitClear />
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

function SearchBarDemo({
  initial = '',
  omitClear,
}: {
  initial?: string
  omitClear?: boolean
}) {
  const [value, setValue] = useState(initial)
  return (
    <SearchBar
      value={value}
      onChangeText={setValue}
      onClear={omitClear ? undefined : () => setValue('')}
    />
  )
}

function ToastBannerDemo() {
  const [toast, setToast] = useState<
    { id: number; variant: 'accent' | 'warn' | 'err' | 'success'; body: string } | null
  >(null)
  function show(variant: 'accent' | 'warn' | 'err' | 'success', body: string) {
    setToast({ id: Date.now(), variant, body })
  }
  return (
    <View style={styles.stack}>
      <View style={styles.row}>
        <Button label="accent" onPress={() => show('accent', 'Handle changed to @benwy')} />
        <Button label="warn" onPress={() => show('warn', 'Connection unstable')} />
        <Button label="err" onPress={() => show('err', "Couldn't send tip")} />
        <Button label="success" onPress={() => show('success', '100 🚀 sent to @kai.dc')} />
      </View>
      {toast && (
        <ToastBanner
          key={toast.id}
          variant={toast.variant}
          body={toast.body}
          onDismiss={() => setToast(null)}
        />
      )}
    </View>
  )
}

function SettingsRowToggleDemo() {
  const [followedLive, setFollowedLive] = useState(true)
  const [nearbyLive, setNearbyLive] = useState(false)
  return (
    <View style={styles.settingsGroup}>
      <SettingsRow
        iconName="bell"
        title="Someone I follow goes live"
        value="Get notified when a streamer you follow starts streaming"
        right={<Toggle value={followedLive} onValueChange={setFollowedLive} />}
        showBorderTop={false}
      />
      <SettingsRow
        iconName="map-pin"
        title="Live stream nearby"
        value="Get notified when someone is streaming near your last location"
        right={<Toggle value={nearbyLive} onValueChange={setNearbyLive} />}
      />
    </View>
  )
}

function ReactionRailBurstDemo() {
  const [burst, setBurst] = useState<{ id: number; kind: string }[]>([])
  function fire(kind: string) {
    setBurst((b) => [...b, { id: Date.now() + Math.random(), kind }])
  }
  function dismiss(id: number) {
    setBurst((b) => b.filter((e) => e.id !== id))
  }
  return (
    <View style={styles.reactionBg}>
      <ReactionRail
        reactions={[
          { kind: 'heart', emoji: '❤️', count: burst.filter((b) => b.kind === 'heart').length },
          { kind: 'fire', emoji: '🔥', count: burst.filter((b) => b.kind === 'fire').length },
          { kind: 'clap', emoji: '👏', count: burst.filter((b) => b.kind === 'clap').length },
          { kind: 'wow', emoji: '😮', count: burst.filter((b) => b.kind === 'wow').length },
        ]}
        burst={burst}
        onReact={fire}
        onBurstDismiss={dismiss}
      />
    </View>
  )
}

function ChatComposerDemo({
  initial,
  sending,
  authenticated,
}: {
  initial: string
  sending?: boolean
  authenticated?: boolean
}) {
  const [value, setValue] = useState(initial)
  return (
    <ChatComposer
      value={value}
      onChangeText={setValue}
      onSubmit={() => setValue('')}
      sending={sending}
      authenticated={authenticated}
      onAuthRequest={() => {}}
    />
  )
}

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
  chatBg: {
    backgroundColor: '#1d1410',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: 2,
  },
  settingsGroup: {
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
  },
  reactionBg: {
    minHeight: 240,
    backgroundColor: '#1d1410',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    justifyContent: 'flex-end',
  },
})
