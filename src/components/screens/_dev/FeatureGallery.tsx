// src/components/screens/_dev/FeatureGallery.tsx
//
// Dev-only gallery exercising every FEATURE (`src/components/features/`).
// Companion to `PrimitiveGallery` and `SectionGallery`. Each feature
// shipped in 12.5+ adds a section below.
//
// Reachable in dev via expo-router push to `/(app)/feature-gallery`.

import { Alert, ScrollView, View, StyleSheet } from 'react-native'
import { ScreenScroll } from '@/components/sections/ScreenScroll'
import { Text } from '@/components/primitives/Text'
import { LivePill } from '@/components/features/stream/LivePill'
import { StreamCard } from '@/components/features/stream/StreamCard'
import { VideoPreviewTile } from '@/components/features/stream/VideoPreviewTile'
import { CoordHUD } from '@/components/features/stream/CoordHUD'
import { StreamTile } from '@/components/features/stream/StreamTile'
import { AudioVisualizer, type AudioVisualizerVariant } from '@/components/features/stream/AudioVisualizer'
import { CompassVisualizer } from '@/components/features/stream/CompassVisualizer'
import { GyroVisualizer } from '@/components/features/stream/GyroVisualizer'
import { MotionVisualizer } from '@/components/features/stream/MotionVisualizer'
import { AccelerometerVisualizer } from '@/components/features/stream/AccelerometerVisualizer'
import { SpeedVisualizer } from '@/components/features/stream/SpeedVisualizer'
import { TemperatureVisualizer } from '@/components/features/stream/TemperatureVisualizer'
import { TorchVisualizer } from '@/components/features/stream/TorchVisualizer'
import { ChatMessage } from '@/components/features/chat/ChatMessage'
import { ChatComposer } from '@/components/features/chat/ChatComposer'
import { StreamStateBanner } from '@/components/features/stream/StreamStateBanner'
import { ReactionRail } from '@/components/features/stream/ReactionRail'
import { SettingsRow } from '@/components/features/settings/SettingsRow'
import { ToastBanner } from '@/components/features/feedback/ToastBanner'
import { SearchBar } from '@/components/features/discovery/SearchBar'
import { ScaleBar } from '@/components/features/discovery/ScaleBar'
import { PlanetSwitcher } from '@/components/features/discovery/PlanetSwitcher'
import { TimeScrubber } from '@/components/features/discovery/TimeScrubber'
import { LiveClockBar } from '@/components/features/discovery/LiveClockBar'
import { PlaceResult } from '@/components/features/discovery/PlaceResult'
import { SwapCard } from '@/components/features/identity/SwapCard'
import { AccountIDPill } from '@/components/features/user/AccountIDPill'
import { MetaStrip } from '@/components/features/user/MetaStrip'
import { SocialChip } from '@/components/features/user/SocialChip'
import { PassportCard } from '@/components/features/user/PassportCard'
import { AvatarPicker } from '@/components/features/user/AvatarPicker'
import { ContextBanner } from '@/components/features/onboarding/ContextBanner'
import { ReassuranceCard } from '@/components/features/onboarding/ReassuranceCard'
import { SuggestionChipRow } from '@/components/features/onboarding/SuggestionChipRow'
import { RulesChecklist } from '@/components/features/onboarding/RulesChecklist'
import { ConsentRow } from '@/components/features/onboarding/ConsentRow'
import { SocialAuthButton } from '@/components/features/auth/SocialAuthButton'
import { AuthChoiceList } from '@/components/features/auth/AuthChoiceList'
import { PasswordStrengthMeter } from '@/components/features/auth/PasswordStrengthMeter'
import { PursesCard } from '@/components/features/wallet/PursesCard'
import { TransactionRow } from '@/components/features/wallet/TransactionRow'
import { BundleCard } from '@/components/features/wallet/BundleCard'
import { AmountInput } from '@/components/features/wallet/AmountInput'
import { BankCard } from '@/components/features/wallet/BankCard'
import { FeedThumb } from '@/components/features/broadcast/FeedThumb'
import { FeedRow } from '@/components/features/broadcast/FeedRow'
import { GoBar } from '@/components/features/broadcast/GoBar'
import { GoLiveRecordBar } from '@/components/features/broadcast/GoLiveRecordBar'
import { ArmButton } from '@/components/features/broadcast/ArmButton'
import { RecordConsentSheet } from '@/components/features/broadcast/RecordConsentSheet'
import { BroadcastStatusIndicator } from '@/components/features/broadcast/BroadcastStatusIndicator'
import { BufferWindowLabel } from '@/components/features/broadcast/BufferWindowLabel'
import { SaveClipButton } from '@/components/features/broadcast/SaveClipButton'
import { RewindLadder } from '@/components/features/broadcast/RewindLadder'
import { LaneToggle, type CaptureLane } from '@/components/features/broadcast/LaneToggle'
import { PageTabs } from '@/components/features/navigation/PageTabs'
import { ClipCard } from '@/components/features/clip/ClipCard'
import { ClipPreview } from '@/components/features/clip/ClipPreview'
import { LayerEditorRow } from '@/components/features/clip/LayerEditorRow'
import { Timeline } from '@/components/features/clip/Timeline'
import { GapMarker } from '@/components/features/clip/GapMarker'
import { SavedClipRegion } from '@/components/features/clip/SavedClipRegion'
import { ClipBracket } from '@/components/features/clip/ClipBracket'
import { BufferTimeline, type TimelineLane } from '@/components/features/clip/BufferTimeline'
import { BufferScrubField } from '@/components/features/clip/BufferScrubField'
import { BufferTransport } from '@/components/features/clip/BufferTransport'
import { SourceRail, type SourceRailItem } from '@/components/features/clip/SourceRail'
import { SourceWaveform } from '@/components/features/clip/SourceWaveform'
import { SourceTelemetryGraph } from '@/components/features/clip/SourceTelemetryGraph'
import { SourceLocationTrail } from '@/components/features/clip/SourceLocationTrail'
import { SourceIdentityCard } from '@/components/features/clip/SourceIdentityCard'
import { SourceChatLog } from '@/components/features/clip/SourceChatLog'
import { ClipSourcesDrawer, type ClipSource } from '@/components/features/clip/ClipSourcesDrawer'
import { SavedClipRow } from '@/components/features/clip/SavedClipRow'
import { TimelineScrollbar } from '@/components/features/clip/TimelineScrollbar'
import { TimelineLaneFill, type TimelineLaneKind } from '@/components/features/clip/TimelineLaneFill'
import { ClipBlock } from '@/components/features/clip/ClipBlock'
import { ClipLane, type LaneClip } from '@/components/features/clip/ClipLane'
import { TimeGapMarker } from '@/components/features/clip/TimeGapMarker'
import { ClipTimeRuler } from '@/components/features/clip/ClipTimeRuler'
import { ClipViewer } from '@/components/features/clip/ClipViewer'
import { ClipsTimeline } from '@/components/features/clip/ClipsTimeline'
import { FilmStrip } from '@/components/features/clip/FilmStrip'
import { SegmentPreview } from '@/components/features/clip/SegmentPreview'
import { SegmentSettingsSheet } from '@/components/features/clip/SegmentSettingsSheet'
import type { SegSettings, Visibility, Precision, Identity } from '@/lib/segmentSettings'
import type { FeedKind } from '@/components/features/broadcast/FeedThumb'
import { DiscoveryHandoffCard } from '@/components/features/stream/DiscoveryHandoffCard'
import { LegalAcceptanceCard } from '@/components/features/onboarding/LegalAcceptanceCard'
import { ContextStrip } from '@/components/features/report/ContextStrip'
import { ReasonRow } from '@/components/features/report/ReasonRow'
import { PermissionPrePromptCard } from '@/components/features/permissions/PermissionPrePromptCard'
import { AgeGateCard } from '@/components/features/onboarding/AgeGateCard'
import { DOBWheel } from '@/components/features/onboarding/DOBWheel'
import { LocationGranularityPicker } from '@/components/features/onboarding/LocationGranularityPicker'
import { Toggle } from '@/components/primitives/Toggle'
import { Button } from '@/components/primitives/Button'
import { Icon } from '@/components/primitives/Icon'
import { SegmentedToggle } from '@/components/primitives/SegmentedToggle'
import { Pressable } from '@/components/primitives/Pressable'
import { BroadcasterRow } from '@/components/features/user/BroadcasterRow'
import { useState, useMemo, useEffect, useRef, type ComponentProps } from 'react'
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

      <Section title="AudioVisualizer">
        <Row label="waveform (synthetic level)">
          <View style={styles.audioVizFrame}>
            <AudioVisualizerDemo variant="waveform" />
          </View>
        </Row>
        <Row label="orb (synthetic level)">
          <View style={styles.audioVizFrame}>
            <AudioVisualizerDemo variant="orb" />
          </View>
        </Row>
        <Row label="idle (no audio)">
          <View style={styles.audioVizFrame}>
            <AudioVisualizer level={0} active={false} variant="waveform" />
          </View>
        </Row>
      </Section>

      <Section title="Sensor visualizers (synthetic telemetry)">
        <Row label="compass">
          <View style={styles.audioVizFrame}>
            <SensorVizDemo kind="compass" />
          </View>
        </Row>
        <Row label="gyro (attitude)">
          <View style={styles.audioVizFrame}>
            <SensorVizDemo kind="gyro" />
          </View>
        </Row>
        <Row label="motion intensity (accel → 1 scalar)">
          <View style={styles.audioVizFrame}>
            <SensorVizDemo kind="motion" />
          </View>
        </Row>
        <Row label="accelerometer (3-axis x/y/z)">
          <View style={styles.audioVizFrame}>
            <SensorVizDemo kind="accel" />
          </View>
        </Row>
        <Row label="speed (km/h)">
          <View style={styles.audioVizFrame}>
            <SensorVizDemo kind="speed" />
          </View>
        </Row>
        <Row label="ambient temp">
          <View style={styles.audioVizFrame}>
            <SensorVizDemo kind="temp" />
          </View>
        </Row>
        <Row label="torch status">
          <View style={styles.audioVizFrame}>
            <SensorVizDemo kind="torch" />
          </View>
        </Row>
        <Row label="idle (no signal)">
          <View style={styles.audioVizFrame}>
            <CompassVisualizer heading={0} active={false} />
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
        <Row label="self (you — primary accent) vs others (secondary accent)">
          <View style={styles.chatBg}>
            <ChatMessage role="self" handle="@you" body="on my way, save me a spot" />
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

      <Section title="TimeScrubber">
        <Row label="live (ticking) — tap to expand, drag a field to scrub">
          <TimeScrubberDemo />
        </Row>
        <Row label="interactive=false — passive live readout (no tap/scrub)">
          <View style={styles.darkStage}>
            <TimeScrubber offsetMs={0} onOffsetChange={() => {}} interactive={false} />
          </View>
        </Row>
      </Section>

      <Section title="LiveClockBar">
        <Row label="live readout — the WRLD clock as footer chrome (Dashboard / Stream)">
          <View style={styles.darkStage}>
            <LiveClockBar />
          </View>
        </Row>
      </Section>

      <Section title="ScaleBar">
        <Row label="continental (equator, zoom 3)">
          <ScaleBar centerLat={0} zoom={3} maxWidthPx={140} />
        </Row>
        <Row label="regional (NYC, zoom 8)">
          <ScaleBar centerLat={40.71} zoom={8} maxWidthPx={140} />
        </Row>
        <Row label="city (London, zoom 13)">
          <ScaleBar centerLat={51.51} zoom={13} maxWidthPx={140} />
        </Row>
        <Row label="street (Tokyo, zoom 17)">
          <ScaleBar centerLat={35.68} zoom={17} maxWidthPx={140} />
        </Row>
        <Row label="imperial unit (NYC, zoom 8)">
          <ScaleBar centerLat={40.71} zoom={8} maxWidthPx={140} unit="imperial" />
        </Row>
      </Section>

      <Section title="PlanetSwitcher">
        <Row label="tap a chevron or swipe the chip to switch planets">
          <View style={styles.darkStage}>
            <PlanetSwitcherDemo />
          </View>
        </Row>
        <Row label="disabled (mid-glide)">
          <View style={styles.darkStage}>
            <PlanetSwitcher
              planets={PLANET_DEMO}
              activeId="earth"
              onChange={() => {}}
              disabled
            />
          </View>
        </Row>
      </Section>

      <Section title="PlaceResult">
        <Row label="city with region">
          <PlaceResult name="Paris" region="France" onPress={() => {}} />
        </Row>
        <Row label="city with full region path">
          <PlaceResult
            name="Brooklyn"
            region="New York, United States"
            onPress={() => {}}
          />
        </Row>
        <Row label="with live stream count">
          <PlaceResult name="Tokyo" region="Japan" streamCount={12} onPress={() => {}} />
        </Row>
        <Row label="single result, no region">
          <PlaceResult name="Reykjavík" onPress={() => {}} />
        </Row>
        <Row label="non-interactive (no onPress)">
          <PlaceResult name="Svalbard" region="Norway" />
        </Row>
      </Section>

      <Section title="SwapCard">
        <Row label="handle change">
          <SwapCard fromValue="@user_8j2k1" toValue="@benwy" />
        </Row>
        <Row label="display-name change (custom labels)">
          <SwapCard
            fromLabel="WAS"
            fromValue="Ben"
            toLabel="NOW"
            toValue="Ben Wylie"
          />
        </Row>
        <Row label="long values truncate">
          <SwapCard
            fromValue="@a_really_long_old_handle_name_for_overflow_test"
            toValue="@a_really_long_new_handle_name_for_overflow_test"
          />
        </Row>
      </Section>

      <Section title="AccountIDPill">
        <Row label="default">
          <AccountIDPill accountId="0042-887-1156" />
        </Row>
        <Row label="raw cuid (auto-formatted)">
          <AccountIDPill accountId="clxq7w9kk000008l4a8z9b1c2" />
        </Row>
      </Section>

      <Section title="MetaStrip">
        <Row label="2 rows, all fields">
          <MetaStrip
            rows={[
              [{ value: '1.2k followers' }, { value: 'Joined May 2026' }],
              [{ value: 'Brooklyn, NY' }, { value: 'they/them' }],
            ]}
          />
        </Row>
        <Row label="row hides when all items empty">
          <MetaStrip
            rows={[
              [{ value: '42 followers' }, { value: 'Joined May 2026' }],
              [{ value: '' }, { value: '' }],
            ]}
          />
        </Row>
        <Row label="labeled items">
          <MetaStrip
            rows={[
              [{ label: 'STREAMS', value: '12' }, { label: 'CLIPS', value: '34' }],
            ]}
          />
        </Row>
      </Section>

      <Section title="SocialChip">
        <Row label="all kinds">
          <View style={styles.row}>
            <SocialChip kind="ig" handle="kai.dc" onPress={() => {}} />
            <SocialChip kind="tt" handle="kai.dc" onPress={() => {}} />
            <SocialChip kind="sc" handle="kai-dc" onPress={() => {}} />
            <SocialChip kind="x" handle="kai_dc" onPress={() => {}} />
          </View>
        </Row>
        <Row label="non-interactive">
          <View style={styles.row}>
            <SocialChip kind="ig" handle="benwy" />
          </View>
        </Row>
      </Section>

      <Section title="PassportCard">
        <Row label="full">
          <PassportCard
            bio="Filming the city block-by-block. Atlantic Ave today."
            region="Brooklyn, NY"
            pronouns="he/him"
            socials={[
              { kind: 'ig', handle: 'benwy', onPress: () => {} },
              { kind: 'tt', handle: 'benwy', onPress: () => {} },
            ]}
          />
        </Row>
        <Row label="bio only">
          <PassportCard bio="No metadata, just a bio." />
        </Row>
        <Row label="no bio, just region + socials">
          <PassportCard
            region="Reykjavík"
            socials={[{ kind: 'sc', handle: 'aurora-radio' }]}
          />
        </Row>
      </Section>

      <Section title="AvatarPicker">
        <Row label="default (no avatar)">
          <AvatarPicker
            displayName="Ben Wylie"
            onTake={() => {}}
            onPick={() => {}}
          />
        </Row>
        <Row label="with avatar">
          <AvatarPicker
            avatarUrl="https://i.pravatar.cc/100?u=benwy"
            displayName="Ben Wylie"
            onTake={() => {}}
            onPick={() => {}}
          />
        </Row>
        <Row label="uploading">
          <AvatarPicker
            avatarUrl="https://i.pravatar.cc/100?u=benwy"
            displayName="Ben Wylie"
            uploading
            onTake={() => {}}
            onPick={() => {}}
          />
        </Row>
      </Section>

      <Section title="ContextBanner">
        <Row label="accent (default)">
          <ContextBanner iconName="message-circle" label="SIGN UP TO CHAT IN @KAI.DC'S STREAM" />
        </Row>
        <Row label="warn (higher-stakes)">
          <ContextBanner variant="warn" iconName="alert-triangle" label="ACCOUNT DELETION · IRREVERSIBLE" />
        </Row>
        <Row label="no icon">
          <ContextBanner label="BECOME A CREATOR · 10 STEPS · ~3 MIN" />
        </Row>
      </Section>

      <Section title="ReassuranceCard">
        <Row label="default">
          <ReassuranceCard
            iconName="info"
            body="Your handle is changeable. Your account identity is permanent."
          />
        </Row>
        <Row label="lock icon">
          <ReassuranceCard
            iconName="lock"
            body="Only you can see this. We never share location with broadcasters."
          />
        </Row>
      </Section>

      <Section title="SuggestionChipRow">
        <Row label="default">
          <SuggestionChipRow
            suggestions={['benwy', 'ben.wylie', 'b_wylie', 'wyliebrooklyn', 'wylie.cam']}
            onPick={() => {}}
          />
        </Row>
      </Section>

      <Section title="RulesChecklist">
        <Row label="mixed states">
          <RulesChecklist
            rules={[
              { label: 'AT LEAST 8 CHARACTERS', status: 'met' },
              { label: 'ONE NUMBER OR SYMBOL', status: 'bad' },
              { label: 'NOT A COMMON PASSWORD', status: 'neutral' },
            ]}
          />
        </Row>
        <Row label="all met">
          <RulesChecklist
            rules={[
              { label: 'LOWERCASE A–Z, 0–9, DOT, UNDERSCORE', status: 'met' },
              { label: '3–24 CHARACTERS', status: 'met' },
              { label: 'NOT TAKEN', status: 'met' },
            ]}
          />
        </Row>
      </Section>

      <Section title="ConsentRow">
        <Row label="default">
          <ConsentRowDemo title="Analytics" description="Help us understand how Wrld is used" initial={false} />
        </Row>
        <Row label="default (on)">
          <ConsentRowDemo title="Personalization" description="Show me streams I might like" initial />
        </Row>
        <Row label="locked (Essential)">
          <ConsentRowDemo title="Essential" description="Required for the app to work" initial locked />
        </Row>
      </Section>

      <Section title="SocialAuthButton">
        <Row label="apple">
          <SocialAuthButton kind="apple" onPress={() => {}} />
        </Row>
        <Row label="google">
          <SocialAuthButton kind="google" onPress={() => {}} />
        </Row>
        <Row label="email">
          <SocialAuthButton kind="email" onPress={() => {}} />
        </Row>
        <Row label="loading">
          <SocialAuthButton kind="apple" loading onPress={() => {}} />
        </Row>
      </Section>

      <Section title="AuthChoiceList">
        <Row label="default (platform-ordered)">
          <AuthChoiceList onChoose={() => {}} />
        </Row>
        <Row label="loading apple">
          <AuthChoiceList onChoose={() => {}} loadingKind="apple" />
        </Row>
      </Section>

      <Section title="PasswordStrengthMeter">
        <Row label="empty (score 0)">
          <PasswordStrengthMeter score={0} />
        </Row>
        <Row label="weak (1)">
          <PasswordStrengthMeter score={1} />
        </Row>
        <Row label="ok (2)">
          <PasswordStrengthMeter score={2} />
        </Row>
        <Row label="strong (3)">
          <PasswordStrengthMeter score={3} />
        </Row>
        <Row label="custom helper">
          <PasswordStrengthMeter score={2} helper="ADD AN UPPERCASE LETTER" />
        </Row>
      </Section>

      <Section title="PursesCard">
        <Row label="dual (Wallet hero)">
          <PursesCard spaceBucks={2480} starDust={1715} />
        </Row>
        <Row label="single SB (Top Up strip)">
          <PursesCard variant="single-sb" spaceBucks={2480} />
        </Row>
        <Row label="single SD (Cash Out hero)">
          <PursesCard variant="single-sd" starDust={1715} />
        </Row>
      </Section>

      <Section title="TransactionRow">
        <Row label="tip sent">
          <TransactionRow
            kind="tip-sent"
            title="Tipped @kai.dc"
            sub="Brooklyn · Atlantic Ave"
            amount={100}
            currency="sb"
          />
        </Row>
        <Row label="tip received">
          <TransactionRow
            kind="tip-received"
            title="Tip from @mira"
            sub="That drone shot is wild"
            amount={70}
            currency="sd"
          />
        </Row>
        <Row label="pending topup">
          <TransactionRow
            kind="topup"
            title="Top Up · 1000 SB bundle"
            amount={1000}
            currency="sb"
            pending
          />
        </Row>
        <Row label="promo">
          <TransactionRow kind="promo" title="Welcome bonus" amount={50} currency="sb" />
        </Row>
        <Row label="pressed (subscription mock)">
          <TransactionRow
            kind="sub-paid"
            title="Subscription · @kai.dc"
            sub="Monthly"
            amount={500}
            currency="sb"
            onPress={() => {}}
          />
        </Row>
      </Section>

      <Section title="BundleCard">
        <Row label="default">
          <BundleCard qty={100} priceUsd={1.0} onPress={() => {}} />
        </Row>
        <Row label="selected with badge">
          <BundleCard
            qty={500}
            priceUsd={4.0}
            perUnitSavingsPct={20}
            badge="best-value"
            selected
            onPress={() => {}}
          />
        </Row>
        <Row label="VIP badge">
          <BundleCard
            qty={10000}
            priceUsd={75.0}
            perUnitSavingsPct={25}
            badge="vip"
            onPress={() => {}}
          />
        </Row>
        <Row label="disabled">
          <BundleCard qty={2500} priceUsd={20.0} disabled />
        </Row>
      </Section>

      <Section title="AmountInput">
        <Row label="tip">
          <AmountInputDemo variant="tip" initial={100} max={5000} />
        </Row>
        <Row label="cashout (with 30% fee)">
          <AmountInputDemo variant="cashout" initial={1000} max={10000} platformFeePct={30} />
        </Row>
        <Row label="invalid">
          <AmountInputDemo
            variant="tip"
            initial={5}
            max={500}
            invalidReason="MINIMUM 50 🚀"
          />
        </Row>
      </Section>

      <Section title="BankCard">
        <Row label="default">
          <BankCard bankName="Chase" last4="4242" onChange={() => {}} />
        </Row>
        <Row label="no Change link">
          <BankCard bankName="Bank of America" last4="1837" />
        </Row>
      </Section>

      <Section title="FeedThumb">
        <Row label="sensor model (md, active)">
          <View style={styles.row}>
            <FeedThumb kind="cam" />
            <FeedThumb kind="audio" />
            <FeedThumb kind="screen" />
            <FeedThumb kind="loc" />
            <FeedThumb kind="gyro" />
            <FeedThumb kind="compass" />
            <FeedThumb kind="profile" />
          </View>
        </Row>
        <Row label="v0.3+ earmarked (static glyph)">
          <View style={styles.row}>
            <FeedThumb kind="speed" />
            <FeedThumb kind="torch" />
            <FeedThumb kind="temp" />
            <FeedThumb kind="motion" />
          </View>
        </Row>
        <Row label="inactive (paused)">
          <View style={styles.row}>
            <FeedThumb kind="cam" active={false} />
            <FeedThumb kind="audio" active={false} />
            <FeedThumb kind="loc" active={false} />
          </View>
        </Row>
        <Row label="lg (preview hero)">
          <FeedThumb kind="audio" size="lg" />
        </Row>
      </Section>

      <Section title="FeedRow">
        <Row label="two-affordance (Air + Rec), gap-separated cards">
          <View style={styles.sourceStack}>
            <FeedRowDemo kind="cam" label="Camera" detail="Media · rear · 1080p" initialAir />
            <FeedRowDemo kind="audio" label="Audio" detail="Media · mic · 48 kHz" initialAir />
            <FeedRowDemo kind="speed" label="Speed" detail="Telemetry · derived from GPS · v0.3+" availability="disabled" />
          </View>
        </Row>
        <Row label="identity (trailing segment)">
          <View style={styles.sourceStack}>
            <IdentityRowDemo />
          </View>
        </Row>
        <Row label="leading icon + footer segment, no Air toggle (Location / Identity on the dashboard)">
          <View style={styles.sourceStack}>
            <StatePickerRowDemo />
          </View>
        </Row>
        <Row label="denied / disabled">
          <View style={styles.sourceStack}>
            <FeedRowDemo kind="screen" label="Screen" detail="Media · whole-screen · capture pending" availability="disabled" />
            <FeedRowDemo kind="compass" label="Compass" detail="Heading · true north" availability="denied" />
          </View>
        </Row>
      </Section>

      <Section title="ArmButton">
        <Row label="pair (idle / armed)">
          <View style={styles.row}>
            <ArmButton label="Go Live" iconName="radio" state="armed" stateLabel="Armed · 2 sources" onPress={() => {}} />
            <ArmButton label="Record" state="idle" stateLabel="Off" onPress={() => {}} />
          </View>
        </Row>
        <Row label="active">
          <View style={styles.row}>
            <ArmButton label="Go Live" iconName="radio" state="active" stateLabel="Live" onPress={() => {}} />
            <ArmButton label="Record" state="active" stateLabel="To disk" onPress={() => {}} />
          </View>
        </Row>
      </Section>

      <Section title="GoBar">
        <Row label="idle">
          <GoBar variant="idle" onPress={() => {}} />
        </Row>
        <Row label="armed">
          <GoBar variant="armed" onPress={() => {}} />
        </Row>
        <Row label="counting (3)">
          <GoBar variant="counting" countdownSec={3} />
        </Row>
        <Row label="live">
          <GoBar variant="live" onPress={() => {}} />
        </Row>
        <Row label="record-commit (label override)">
          <GoBar variant="armed" label="START RECORDING" knobLabel="REC" onPress={() => {}} />
        </Row>
        <Row label="disabled">
          <GoBar variant="disabled" />
        </Row>
      </Section>

      <Section title="GoLiveRecordBar">
        {/* Record button removed for now — single full-width two-state button. */}
        <Row label="not live (Go Live — accent tint)">
          <GoLiveRecordBar isLive={false} onLivePress={() => {}} />
        </Row>
        <Row label="live (End Stream — solid red)">
          <GoLiveRecordBar isLive onLivePress={() => {}} />
        </Row>
        <Row label="disabled (can't go live yet)">
          <GoLiveRecordBar isLive={false} liveDisabled onLivePress={() => {}} />
        </Row>
        <Row label="interactive">
          <GoLiveRecordBarDemo />
        </Row>
      </Section>

      <Section title="BufferWindowLabel">
        {/* Rolling buffer: how far back the live rewind currently reaches. */}
        <Row label="reach + max-quality floor">
          <BufferWindowLabel reachesBack={new Date(Date.now() - 23 * 3600_000)} floorHours={24} />
        </Row>
        <Row label="reach only">
          <BufferWindowLabel reachesBack={new Date(Date.now() - 2.5 * 3600_000)} />
        </Row>
      </Section>

      <Section title="SaveClipButton">
        {/* The durable capture verb — replaces the retired Record button. */}
        <Row label="default">
          <SaveClipButton onPress={() => {}} />
        </Row>
        <Row label="with reach hint">
          <SaveClipButton onPress={() => {}} hint="Pick any moment from the last 24h" />
        </Row>
        <Row label="disabled (nothing buffered yet)">
          <SaveClipButton onPress={() => {}} disabled />
        </Row>
      </Section>

      <Section title="RewindLadder">
        {/* Subscription ladder — rewind window + capture resolution per tier. */}
        <Row label="current = free">
          <RewindLadder currentTier="free" />
        </Row>
        <Row label="current = pro">
          <RewindLadder currentTier="pro" />
        </Row>
        <Row label="no current tier">
          <RewindLadder />
        </Row>
      </Section>

      <Section title="LaneToggle (dashboard go-live lane — U1)">
        <Row label="BUFFER (reaper clears it) ↔ SAVED (kept · uses storage) — flag row, like Identity/Chat">
          <View style={{ width: 320 }}>
            <LaneToggleDemo />
          </View>
        </Row>
      </Section>

      <Section title="RecordConsentSheet (parked — retired by rolling buffer)">
        {/* Capture ⊆ broadcast retired the record-consent step; kept parked. */}
        <Row label="opens a sheet (sensitive-source record consent)">
          <RecordConsentSheetDemo />
        </Row>
      </Section>

      <Section title="BroadcastStatusIndicator">
        <Row label="live + recording same set">
          <View style={styles.darkStage}>
            <BroadcastStatusIndicator
              sources={[
                { label: 'Camera', iconName: 'video', air: true, rec: true },
                { label: 'Audio', iconName: 'mic', air: true, rec: true },
                { label: 'Location · city', iconName: 'map-pin', air: true, rec: true },
              ]}
            />
          </View>
        </Row>
        <Row label="recording a larger set">
          <View style={styles.darkStage}>
            <BroadcastStatusIndicator
              sources={[
                { label: 'Audio', iconName: 'mic', air: true, rec: true },
                { label: 'Camera', iconName: 'video', air: false, rec: true },
                { label: 'Location · city', iconName: 'map-pin', air: true, rec: true },
              ]}
            />
          </View>
        </Row>
        <Row label="recording but not live">
          <View style={styles.darkStage}>
            <BroadcastStatusIndicator
              sources={[
                { label: 'Camera', iconName: 'video', air: false, rec: true },
                { label: 'Audio', iconName: 'mic', air: false, rec: true },
              ]}
            />
          </View>
        </Row>
      </Section>

      <Section title="ClipCard">
        <Row label="public (default)">
          <ClipCard
            thumbnailUrl="https://picsum.photos/seed/wrldclip1/320/220"
            title="Drumline forming up"
            venue="Brooklyn"
            date="May 24"
            durationSec={47}
            peakViewerCount={1400}
            onPress={() => {}}
          />
        </Row>
        <Row label="owner (with layers)">
          <ClipCard
            variant="owner"
            thumbnailUrl="https://picsum.photos/seed/wrldclip2/320/220"
            title="Atlantic Ave overlook"
            venue="Brooklyn"
            date="May 24"
            durationSec={92}
            peakViewerCount={620}
            layers={['cam', 'aud', 'loc']}
            onPress={() => {}}
          />
        </Row>
        <Row label="owner · anon (only visible to you)">
          <ClipCard
            variant="owner"
            thumbnailUrl="https://picsum.photos/seed/wrldclip3/320/220"
            title="Quiet alley test"
            durationSec={28}
            layers={['cam', 'aud']}
            anon
            onPress={() => {}}
          />
        </Row>
        <Row label="owner · draft">
          <ClipCard
            variant="owner"
            thumbnailUrl="https://picsum.photos/seed/wrldclip4/320/220"
            title="Aurora attempt — north-facing"
            venue="Reykjavík"
            durationSec={143}
            layers={['cam', 'aud', 'loc', 'gyr']}
            draft
            onPress={() => {}}
          />
        </Row>
        <Row label="no thumbnail">
          <ClipCard
            title="Audio-only · pirate radio"
            durationSec={62}
            peakViewerCount={250}
          />
        </Row>
      </Section>

      <Section title="ClipPreview">
        <Row label="camera (default)">
          <ClipPreview
            thumbnailUrl="https://picsum.photos/seed/wrldhero/640/440"
            progressPct={42}
            onTogglePlay={() => {}}
          />
        </Row>
        <Row label="audio-only fallback">
          <ClipPreview variant="audio-only" progressPct={20} onTogglePlay={() => {}} />
        </Row>
        <Row label="map-only fallback">
          <ClipPreview variant="map-only" progressPct={75} onTogglePlay={() => {}} playing />
        </Row>
      </Section>

      <Section title="LayerEditorRow">
        <Row label="on">
          <LayerEditorRowDemo iconName="video" name="Camera" status="1080P" description="Front camera · still life" initialState="on" />
        </Row>
        <Row label="off">
          <LayerEditorRowDemo iconName="mic" name="Audio" status="48 kHz" description="Mic was active — turn off to mute this clip" initialState="off" />
        </Row>
        <Row label="deleted (perm-cut)">
          <LayerEditorRowDemo iconName="map-pin" name="Location" description="Removed — restore to include this layer again" initialState="deleted" />
        </Row>
        <Row label="id-layer (anonymize)">
          <LayerEditorRowDemo
            variant="id-layer"
            iconName="user"
            name="Identity"
            status="PUBLIC"
            description="Toggle off to anonymize this clip retroactively"
            initialState="on"
          />
        </Row>
      </Section>

      <Section title="ContextStrip">
        <Row label="broadcast (live)">
          <ContextStrip
            kind="broadcast"
            thumbnailUrl="https://picsum.photos/seed/wrldrep1/200/200"
            title="Atlantic Ave · street fest"
            sub="@kai.dc · Brooklyn"
            isLive
          />
        </Row>
        <Row label="clip">
          <ContextStrip
            kind="clip"
            thumbnailUrl="https://picsum.photos/seed/wrldrep2/200/200"
            title="Drumline forming up"
            sub="@kai.dc · 47s · 1.4k peak"
          />
        </Row>
        <Row label="user (avatar)">
          <ContextStrip
            kind="user"
            thumbnailUrl="https://i.pravatar.cc/100?u=mira"
            displayName="Mira B"
            title="Mira B"
            sub="@mira.b · 1.2k followers"
          />
        </Row>
        <Row label="no thumbnail">
          <ContextStrip kind="broadcast" title="Audio-only · pirate radio" sub="@radio.weird" />
        </Row>
      </Section>

      <Section title="ReasonRow">
        <Row label="group with selection">
          <ReasonRowGroupDemo />
        </Row>
      </Section>

      <Section title="PermissionPrePromptCard">
        <Row label="location">
          <PermissionPrePromptCard kind="location" onAllow={() => {}} onSkip={() => {}} />
        </Row>
        <Row label="notifications">
          <PermissionPrePromptCard kind="notifications" onAllow={() => {}} onSkip={() => {}} />
        </Row>
        <Row label="camera">
          <PermissionPrePromptCard kind="camera" onAllow={() => {}} onSkip={() => {}} />
        </Row>
        <Row label="microphone (loading)">
          <PermissionPrePromptCard kind="microphone" loading onAllow={() => {}} onSkip={() => {}} />
        </Row>
      </Section>

      <Section title="AgeGateCard">
        <Row label="default refusal">
          <AgeGateCard onBack={() => {}} />
        </Row>
      </Section>

      <Section title="DOBWheel">
        <Row label="default (scroll each column)">
          <DOBWheelDemo />
        </Row>
      </Section>

      <Section title="LocationGranularityPicker">
        <Row label="default (city selected)">
          <LocationGranularityPickerDemo initial="city" />
        </Row>
        <Row label="bluedot selected (warn tone)">
          <LocationGranularityPickerDemo initial="bluedot" />
        </Row>
      </Section>

      <Section title="Timeline">
        <Row label="scrub only">
          <TimelineDemo trim={false} />
        </Row>
        <Row label="scrub + trim">
          <TimelineDemo trim />
        </Row>
      </Section>

      <Section title="BufferTimeline">
        <Row label="stacked source lanes · expand/collapse · tap-to-position · pan · pinch-zoom">
          <BufferTimelineDemo />
        </Row>
      </Section>

      <Section title="TimelineLaneFill">
        <Row label="per-source segment fills (camera = filmstrip, in BufferTimeline)">
          <TimelineLaneFillDemo />
        </Row>
      </Section>

      <Section title="TimelineScrollbar">
        <Row label="thumb length = zoom · drag to pan">
          <TimelineScrollbarDemo />
        </Row>
      </Section>

      <Section title="BufferScrubField">
        <Row label="camera">
          <BufferScrubFieldDemo variant="camera" />
        </Row>
        <Row label="audio-only">
          <BufferScrubFieldDemo variant="audio-only" />
        </Row>
      </Section>

      <Section title="BufferTransport">
        <Row label="head · ‹‹clip · ‹frame(hold=rev) · play · frame›(hold=play) · clip›› · tail">
          <BufferTransportDemo />
        </Row>
        <Row label="showBufferEdges=false — 1st/7th hidden (single-clip preview: snaps to clip head/tail)">
          <BufferTransport
            showBufferEdges={false}
            playing={false}
            onToStart={() => {}}
            onPrevClip={() => {}}
            onFrameBack={() => {}}
            onFrameBackHold={() => {}}
            onTogglePlay={() => {}}
            onFrameForward={() => {}}
            onFrameForwardHold={() => {}}
            onNextClip={() => {}}
            onToEnd={() => {}}
          />
        </Row>
      </Section>

      {/* ── Segment settings shelf (PB4 · per-segment manifest editing) ── */}
      <Section title="FilmStrip (shared clip-block fill)">
        <Row label="sprocket bands + constant-size frame cells — one renderer for every timeline (with / without poster)">
          <View style={{ gap: theme.spacing.sm }}>
            <View style={galleryStyles.filmBand}>
              <FilmStrip widthPx={280} posterUrl="https://picsum.photos/seed/wrldfilm/80/80" />
            </View>
            <View style={galleryStyles.filmBand}>
              <FilmStrip widthPx={280} />
            </View>
          </View>
        </Row>
      </Section>

      <Section title="SegmentPreview (the shelf's top)">
        <Row label="square viewer (letterbox) + title/date/time · thin clip timeline (scrub · pinch · inertia) · transport">
          <SegmentPreviewDemo />
        </Row>
      </Section>

      <Section title="SegmentSettingsSheet (double-tap a segment)">
        <Row label="all controls as ordered multistate toggles — lane · visibility · identity · location · sources · tags">
          <SegmentSettingsSheetDemo />
        </Row>
      </Section>

      <Section title="ClipBlock (clips grid)">
        <Row label="buffered · saved · compact">
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, height: 120 }}>
            <View style={{ width: 96 }}>
              <ClipBlock heightPx={120} label="14:03" sublabel="2:18" tone="buffered" />
            </View>
            <View style={{ width: 96 }}>
              <ClipBlock heightPx={120} label="13:40" sublabel="0:42" tone="saved" />
            </View>
            <View style={{ width: 96, justifyContent: 'flex-start' }}>
              <ClipBlock heightPx={26} label="9:12" tone="saved" />
            </View>
          </View>
        </Row>
      </Section>

      <Section title="ClipsTimeline (clips grid)">
        <Row label="horizontal two-lane timeline — reaper left → now right, collapsed gaps, pinch + scroll">
          <ClipsTimelineDemo />
        </Row>
      </Section>

      <Section title="ClipLane (clips grid — legacy / vertical)">
        <Row label="clips to scale on a vertical time axis (buffered / saved)">
          <ClipLaneDemo />
        </Row>
      </Section>

      <Section title="ClipViewer (clips grid)">
        <Row label="sticky 1:1 viewer — empty state (no clip selected)">
          <View style={{ width: 220 }}>
            <ClipViewer title="Morning ride" />
          </View>
        </Row>
      </Section>

      <Section title="TimeGapMarker (clips grid)">
        <Row label="a collapsed empty stretch between clips">
          <View style={{ width: 240 }}>
            <TimeGapMarker height={34} label="3h 12m" />
          </View>
        </Row>
      </Section>

      <Section title="ClipTimeRuler (clips grid)">
        <Row label="ghosted left-gutter time marks (host supplies y + label)">
          <View style={{ width: 240, height: 180 }}>
            <ClipTimeRuler
              width={52}
              ticks={[
                { y: 8, label: '14:02' },
                { y: 70, label: '14:48' },
                { y: 132, label: '15:10' },
                { y: 172, label: 'now', now: true },
              ]}
            />
          </View>
        </Row>
      </Section>

      <Section title="SourceRail + source views">
        <Row label="tap a source — field renders its view (mock data)">
          <BufferSourceViewerDemo />
        </Row>
      </Section>


      <Section title="GapMarker">
        <Row label="10px collapsed-gap break (no label)">
          <View style={galleryStyles.gapStrip}>
            <View style={galleryStyles.gapSeg} />
            <GapMarker />
            <View style={galleryStyles.gapSeg} />
            <GapMarker />
            <View style={galleryStyles.gapSeg} />
          </View>
        </Row>
      </Section>

      <Section title="SavedClipRegion">
        <Row label="read-only taken span">
          <View style={galleryStyles.trackMock}>
            <SavedClipRegion style={galleryStyles.savedMock} />
          </View>
        </Row>
      </Section>

      <Section title="ClipBracket">
        <Row label="active">
          <View style={galleryStyles.trackMock}>
            <ClipBracket leftPx={60} widthPx={150} />
          </View>
        </Row>
        <Row label="blocked (clamped at saved region)">
          <View style={galleryStyles.trackMock}>
            <ClipBracket leftPx={60} widthPx={150} blocked />
          </View>
        </Row>
      </Section>

      <Section title="ClipSourcesDrawer">
        <Row label="bottom drawer of recorded sources">
          <ClipSourcesDrawerDemo />
        </Row>
      </Section>

      <Section title="SavedClipRow">
        <Row label="draft (collapsed → tap to expand)">
          <SavedClipRowDemo />
        </Row>
        <Row label="public">
          <SavedClipRow
            name="Main hour"
            capturedAt="18:03 · APR 18"
            durationSec={74}
            sourcesLabel="Cam · Aud · Loc"
            visibility="public"
            onToggleExpand={() => {}}
          />
        </Row>
        <Row label="anon (audio-only)">
          <SavedClipRow
            name="Late set"
            capturedAt="02:14 · APR 19"
            durationSec={11}
            variant="audio-only"
            sourcesLabel="Aud"
            visibility="anon"
            onToggleExpand={() => {}}
          />
        </Row>
      </Section>

      <Section title="DiscoveryHandoffCard">
        <Row label="single">
          <DiscoveryHandoffCard
            stream={{
              id: 'a',
              title: 'Atlantic Ave · street fest',
              handle: 'kai.dc',
              displayName: 'Kai DC',
              avatarUrl: 'https://i.pravatar.cc/100?u=kai',
              viewerCount: 1400,
              isLive: true,
              onJoin: () => {},
            }}
            onDismiss={() => {}}
          />
        </Row>
        <Row label="single + layers (StreamStrip)">
          <DiscoveryHandoffCard
            stream={{
              id: 'b',
              title: 'Golden Gate overlook',
              handle: 'sf.angle',
              avatarUrl: 'https://i.pravatar.cc/100?u=sf',
              viewerCount: 9120,
              isLive: true,
              layers: [
                { id: 'cam', iconName: 'video', label: 'CAM', value: '1080P' },
                { id: 'aud', iconName: 'mic', label: 'AUD', value: '48 kHz' },
                { id: 'loc', iconName: 'map-pin', label: 'LOC', value: 'GPS' },
                { id: 'gyr', iconName: 'navigation', label: 'GYR', value: '120Hz' },
                { id: 'scrn', iconName: 'monitor', label: 'SCRN', value: 'OFF', active: false },
              ],
              onJoin: () => {},
            }}
            onDismiss={() => {}}
          />
        </Row>
        <Row label="cluster">
          <DiscoveryHandoffCard
            locationLabel="ATLANTIC AVE"
            streams={[
              {
                id: 'c1',
                title: 'Drumline forming up',
                handle: 'kai.dc',
                avatarUrl: 'https://i.pravatar.cc/100?u=kai',
                viewerCount: 1400,
                distance: '12m away',
                onJoin: () => {},
              },
              {
                id: 'c2',
                title: 'Food truck row across the street',
                handle: 'mira.b',
                avatarUrl: 'https://i.pravatar.cc/100?u=mira',
                viewerCount: 620,
                distance: '45m away',
                onJoin: () => {},
              },
              {
                id: 'c3',
                title: 'Rooftop view of the parade',
                handle: 'benwy',
                avatarUrl: 'https://i.pravatar.cc/100?u=benwy',
                viewerCount: 2100,
                distance: '80m away',
                onJoin: () => {},
              },
            ]}
            onDismiss={() => {}}
          />
        </Row>
      </Section>

      <Section title="LegalAcceptanceCard">
        <Row label="default (US/ROW)">
          <LegalAcceptanceCardDemo variant="default" />
        </Row>
        <Row label="EU GDPR">
          <LegalAcceptanceCardDemo variant="eu-gdpr" />
        </Row>
        <Row label="CA CCPA">
          <LegalAcceptanceCardDemo variant="ca-ccpa" />
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

      <Section title="PageTabs">
        {/* Hybrid-nav sibling-cluster control — swaps content in place. */}
        <Row label="3 tabs (Wallet)">
          <PageTabsDemo tabs={[
            { key: 'balance', label: 'Balance' },
            { key: 'topup', label: 'Top Up' },
            { key: 'cashout', label: 'Cash Out' },
          ]} />
        </Row>
        <Row label="2 tabs (Monetize)">
          <PageTabsDemo tabs={[
            { key: 'subs', label: 'Subscriptions' },
            { key: 'events', label: 'Events' },
          ]} />
        </Row>
      </Section>
    </ScreenScroll>
  )
}

function PageTabsDemo({ tabs }: { tabs: { key: string; label: string }[] }) {
  const [value, setValue] = useState(tabs[0]!.key)
  return <PageTabs tabs={tabs} value={value} onChange={setValue} />
}

// Drives AudioVisualizer with a synthetic speech-like envelope so the gallery
// shows real motion without a live consumer (stands in for useAudioLevel).
function AudioVisualizerDemo({ variant }: { variant: AudioVisualizerVariant }) {
  const [level, setLevel] = useState(0)
  const t = useRef(0)
  useEffect(() => {
    const id = setInterval(() => {
      t.current += 1
      const x = t.current
      // Slow gate × faster syllabic wobble + occasional spike → speech-ish.
      const gate = Math.sin(x * 0.06) * 0.5 + 0.5
      const wobble = Math.sin(x * 0.33) * 0.5 + 0.5
      const spike = Math.random() < 0.18 ? Math.random() * 0.5 : 0
      setLevel(Math.min(1, gate * wobble * 0.7 + spike))
    }, 80)
    return () => clearInterval(id)
  }, [])
  return <AudioVisualizer level={level} variant={variant} />
}

// Drives each sensor visualizer with synthetic telemetry so the gallery shows
// real motion without a live data channel (stands in for the telemetry seam).
function SensorVizDemo({ kind }: { kind: 'compass' | 'gyro' | 'motion' | 'accel' | 'speed' | 'temp' | 'torch' }) {
  const [t, setT] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setT((x) => x + 1), 90)
    return () => clearInterval(id)
  }, [])
  const s = (f: number, phase = 0) => Math.sin(t * f + phase) // -1..1
  switch (kind) {
    case 'compass':
      return <CompassVisualizer heading={(t * 2) % 360} />
    case 'gyro':
      return <GyroVisualizer pitch={s(0.05) * 25} roll={s(0.08, 1) * 35} />
    case 'motion':
      return <MotionVisualizer intensity={(s(0.07) * 0.5 + 0.5) * (s(0.31) * 0.4 + 0.6)} />
    case 'accel':
      // gravity baseline on z + per-axis wobble
      return <AccelerometerVisualizer x={s(0.23) * 6} y={s(0.17, 2) * 6} z={9.8 + s(0.4, 1) * 4} />
    case 'speed':
      return <SpeedVisualizer mps={(s(0.04) * 0.5 + 0.5) * 28} />
    case 'temp':
      return <TemperatureVisualizer celsius={18 + s(0.03) * 12} />
    case 'torch':
      return <TorchVisualizer on={Math.floor(t / 12) % 2 === 0} />
  }
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

const PLANET_DEMO = [
  { id: 'earth', name: 'Earth', glyph: 'globe' },
  { id: 'haven', name: 'Haven', glyph: 'shield' },
]

function PlanetSwitcherDemo() {
  const [active, setActive] = useState('earth')
  return (
    <PlanetSwitcher planets={PLANET_DEMO} activeId={active} onChange={setActive} />
  )
}

function TimeScrubberDemo() {
  const [offsetMs, setOffsetMs] = useState(0)
  // Dark stage stands in for the globe — the clock renders cream-over-content.
  return (
    <View style={styles.darkStage}>
      <TimeScrubber offsetMs={offsetMs} onOffsetChange={setOffsetMs} />
    </View>
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

function LegalAcceptanceCardDemo({
  variant,
}: {
  variant: 'default' | 'eu-gdpr' | 'ca-ccpa'
}) {
  const [c, setC] = useState<{
    essential: true
    analytics?: boolean
    personalization?: boolean
    doNotSell?: boolean
  }>({ essential: true })
  return (
    <LegalAcceptanceCard
      variant={variant}
      docs={[
        { id: 'tos', label: 'Terms of service', onPress: () => {} },
        { id: 'rules', label: 'Community rules', onPress: () => {} },
        { id: 'privacy', label: 'Privacy policy', onPress: () => {} },
      ]}
      consents={c}
      onConsentsChange={setC}
      onAgree={() => {}}
    />
  )
}

function TimelineDemo({ trim }: { trim: boolean }) {
  const duration = 60
  const [scrub, setScrub] = useState(12)
  const [range, setRange] = useState({ start: 5, end: 45 })
  return (
    <Timeline
      duration={duration}
      scrub={scrub}
      trimStart={trim ? range.start : undefined}
      trimEnd={trim ? range.end : undefined}
      onScrub={setScrub}
      onTrimChange={trim ? setRange : undefined}
    />
  )
}

// Three mock buffers of different footage extents — switch between them to watch the
// zoom toggle adapt its level count (2026-06-09): a short buffer collapses to All · Sec
// (or hides the toggle), and Min → Hours → Days appear as footage grows.
type BufExtent = 'days' | 'hours' | 'mins'
function buildBufModel(extent: BufExtent) {
  const now = Date.now()
  const H = 3_600_000
  const M = 60_000
  if (extent === 'days') {
    return {
      segments: [
        { id: 's1', startMs: now - 70 * H, endMs: now - 40 * H },
        { id: 's2', startMs: now - 30 * H, endMs: now - 6 * H },
        { id: 's3', startMs: now - 2 * H, endMs: now },
      ],
      savedRegions: [{ id: 'r1', startMs: now - 28 * H, endMs: now - 26 * H }],
      bracket0: { inMs: now - 24 * H, outMs: now - 22 * H },
      playhead0: now - 23 * H,
    }
  }
  if (extent === 'hours') {
    return {
      segments: [
        { id: 's1', startMs: now - 8 * H, endMs: now - 5 * H },
        { id: 's2', startMs: now - 4 * H, endMs: now - 0.5 * H },
        { id: 's3', startMs: now - 0.3 * H, endMs: now },
      ],
      savedRegions: [{ id: 'r1', startMs: now - 3 * H, endMs: now - 2.5 * H }],
      bracket0: { inMs: now - 2 * H, outMs: now - 1.7 * H },
      playhead0: now - 1.85 * H,
    }
  }
  // mins — a few minutes of footage: too short for Min/Hours/Days → just All · Sec.
  return {
    segments: [
      { id: 's1', startMs: now - 6 * M, endMs: now - 4 * M },
      { id: 's2', startMs: now - 3 * M, endMs: now },
    ],
    savedRegions: [{ id: 'r1', startMs: now - 5 * M, endMs: now - 4.5 * M }],
    bracket0: { inMs: now - 2 * M, outMs: now - 1.5 * M },
    playhead0: now - 1.7 * M,
  }
}

const BUF_EXTENT_OPTS: { value: BufExtent; label: string }[] = [
  { value: 'days', label: 'Days of footage' },
  { value: 'hours', label: 'Hours' },
  { value: 'mins', label: 'Minutes' },
]

// One stacked lane per source — all share the timeline's segment/gap geometry; only each
// segment's fill differs (camera → filmstrip; others → TimelineLaneFill mini-views).
const DEMO_LANES: TimelineLane[] = [
  { key: 'camera', kind: 'camera', label: 'Camera' },
  { key: 'audio', kind: 'audio', label: 'Audio' },
  { key: 'location', kind: 'location', label: 'Location' },
  { key: 'chat', kind: 'chat', label: 'Chat' },
  { key: 'compass', kind: 'compass', label: 'Compass' },
  { key: 'gyro', kind: 'gyro', label: 'Gyro' },
  { key: 'identity', kind: 'identity', label: 'Identity' },
]

function BufferTimelineDemo() {
  const [extent, setExtent] = useState<BufExtent>('hours')
  const model = useMemo(() => buildBufModel(extent), [extent])
  const [playhead, setPlayhead] = useState(model.playhead0)
  const [bracket, setBracket] = useState<{ inMs: number; outMs: number } | null>(model.bracket0)
  const [expanded, setExpanded] = useState(true)
  // Clip inclusion (gutter on/off toggles); camera starts excluded to show the dim. A
  // couple of pre-seeded removed ranges so the no-data blocks are visible.
  const [included, setIncluded] = useState<string[]>(['audio', 'location', 'chat', 'compass', 'gyro', 'identity'])
  const toggle = (k: string) => setIncluded((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]))
  const removedByLane = useMemo(() => {
    const t = model.playhead0
    return {
      audio: [{ startMs: t - 90_000, endMs: t - 30_000 }],
      location: [{ startMs: t + 60_000, endMs: t + 150_000 }],
    }
  }, [model])
  // Reset the interactive state when the mock extent changes.
  useEffect(() => {
    setPlayhead(model.playhead0)
    setBracket(model.bracket0)
  }, [model])
  // Tap to position the playhead · drag to pan · pinch to zoom · scrollbar to pan.
  // Expand/collapse stacks all source lanes vs the viewed one; tap a gutter icon to toggle
  // that lane in/out of the clip (accent = in, subtle = out; excluded lanes dim, removed
  // ranges read as no-data blocks).
  return (
    <View style={{ gap: theme.spacing.sm }}>
      <SegmentedToggle options={BUF_EXTENT_OPTS} value={extent} onChange={setExtent} />
      <Text variant="caption" color={theme.colors.text.muted}>
        One timeline per source, aligned. Gutter icons toggle clip inclusion; trims/deletes
        leave no-data blocks (audio + location are pre-edited here).
      </Text>
      <BufferTimeline
        segments={model.segments}
        savedRegions={model.savedRegions}
        playheadMs={playhead}
        bracket={bracket}
        onScrub={setPlayhead}
        onBracketChange={setBracket}
        lanes={DEMO_LANES}
        selectedKey="audio"
        expanded={expanded}
        onToggleExpand={() => setExpanded((v) => !v)}
        includedKeys={included}
        onToggleLane={toggle}
        removedByLane={removedByLane}
      />
    </View>
  )
}

// Each non-camera source's per-segment fill idiom, shown standalone in a film-cell-sized
// strip (the same height a lane uses inside BufferTimeline).
const LANE_FILL_KINDS: { kind: TimelineLaneKind; label: string }[] = [
  { kind: 'audio', label: 'audio · waveform' },
  { kind: 'compass', label: 'compass · trace' },
  { kind: 'gyro', label: 'gyro · trace' },
  { kind: 'location', label: 'location · trail' },
  { kind: 'chat', label: 'chat · ticks' },
  { kind: 'identity', label: 'identity · flat' },
]

function TimelineLaneFillDemo() {
  return (
    <View style={{ gap: theme.spacing.xs, width: 240 }}>
      {LANE_FILL_KINDS.map(({ kind, label }) => (
        <View key={kind} style={{ gap: 2 }}>
          <Text variant="monoCaption" color={theme.colors.text.subtle}>
            {label}
          </Text>
          <View
            style={{
              height: 34,
              backgroundColor: theme.colors.bg.panelHi,
              borderWidth: 1,
              borderColor: theme.colors.border.strong,
              overflow: 'hidden',
            }}
          >
            <TimelineLaneFill kind={kind} seedId={`gallery-${kind}`} widthPx={240} leftBorder />
          </View>
        </View>
      ))}
    </View>
  )
}

function TimelineScrollbarDemo() {
  // Mock geometry: content 3× the viewport → thumb ≈ 1/3 width, draggable.
  const viewport = 300
  const contentWidth = 900
  const [offset, setOffset] = useState(300)
  return (
    <View style={{ width: viewport }}>
      <TimelineScrollbar
        contentWidth={contentWidth}
        viewport={viewport}
        scrollOffset={offset}
        onScrollTo={setOffset}
      />
    </View>
  )
}

function BufferScrubFieldDemo({ variant }: { variant: 'camera' | 'audio-only' }) {
  return (
    <View style={{ width: 200 }}>
      <BufferScrubField variant={variant} reachLabel="Buffer · 72h" onScrub={() => {}} />
    </View>
  )
}

// The buffer viewer source switcher: a rail of captured sources overlaid on the scrub
// field; tapping one renders that source's view (camera → video placeholder, audio →
// waveform, location → map trail, compass → graph, identity → card). All mock data.
// The full dashboard suite in dashboard order; not-captured / no-view sources are greyed.
const SOURCE_VIEWER_ITEMS: SourceRailItem[] = [
  { key: 'identity', iconName: 'user', label: 'Identity' },
  { key: 'location', iconName: 'map-pin', label: 'Location' },
  { key: 'chat', iconName: 'message-circle', label: 'Chat' },
  { key: 'camera', iconName: 'video', label: 'Camera' },
  { key: 'audio', iconName: 'mic', label: 'Audio' },
  { key: 'screen', iconName: 'monitor', label: 'Screen', disabled: true },
  { key: 'compass', iconName: 'compass', label: 'Compass' },
  { key: 'gyro', iconName: 'navigation', label: 'Gyro', disabled: true },
  { key: 'motion', iconName: 'activity', label: 'Motion', disabled: true },
  { key: 'speed', iconName: 'fast-forward', label: 'Speed', disabled: true },
  { key: 'temp', iconName: 'thermometer', label: 'Temp', disabled: true },
  { key: 'torch', iconName: 'zap', label: 'Torch', disabled: true },
]
const MOCK_PEAKS = Array.from({ length: 56 }, (_, i) => 0.3 + 0.55 * Math.abs(Math.sin(i * 0.5)))
const MOCK_COMPASS = Array.from({ length: 56 }, (_, i) => 0.5 + 0.4 * Math.sin(i * 0.32))
const MOCK_TRAIL: [number, number][] = Array.from({ length: 22 }, (_, i) => [
  -0.1276 + i * 0.0009,
  51.5074 + 0.0006 * Math.sin(i * 0.5),
])
const VIEWER_PROGRESS = 0.6

function BufferSourceViewerDemo() {
  const [view, setView] = useState('camera')
  const here = MOCK_TRAIL[Math.round((MOCK_TRAIL.length - 1) * VIEWER_PROGRESS)]
  const frame =
    view === 'camera' ? undefined
    : view === 'audio' ? <SourceWaveform peaks={MOCK_PEAKS} progress={VIEWER_PROGRESS} />
    : view === 'chat' ? <SourceChatLog messages={[]} progress={VIEWER_PROGRESS} />
    : view === 'location' ? <SourceLocationTrail path={MOCK_TRAIL} position={here} />
    : view === 'compass' ? (
        <SourceTelemetryGraph
          values={MOCK_COMPASS}
          progress={VIEWER_PROGRESS}
          label="COMPASS"
          reading="182°"
          iconName="compass"
        />
      )
    : (
        <SourceIdentityCard
          displayName="Ada L."
          handle="ada"
          attributed
          meta={[
            { label: 'Resolution', value: '720p' },
            { label: 'Captured', value: 'Today 14:03' },
            { label: 'Sources', value: 'Cam · Audio · GPS' },
          ]}
        />
      )
  return (
    <View style={{ width: 300 }}>
      <BufferScrubField
        variant={view === 'camera' ? 'camera' : view === 'location' || view === 'chat' ? 'map-only' : 'audio-only'}
        reachLabel="Buffer · 72h"
        frameSlot={frame}
        showScrubHint={false}
        onScrub={() => {}}
      />
      <View style={{ position: 'absolute', right: 8, top: 0, bottom: 0, justifyContent: 'center' }}>
        <SourceRail sources={SOURCE_VIEWER_ITEMS} value={view} onChange={setView} />
      </View>
    </View>
  )
}

function ClipLaneDemo() {
  const now = useMemo(() => Date.now(), [])
  const viewportH = 220
  const p2 = (n: number) => String(n).padStart(2, '0')
  const mk = (minsAgo: number, durMin: number, id: string): LaneClip => {
    const startMs = now - minsAgo * 60_000
    const endMs = startMs + durMin * 60_000
    const d = new Date(startMs)
    return { id, startMs, endMs, label: `${p2(d.getHours())}:${p2(d.getMinutes())}`, sublabel: `${durMin}:00` }
  }
  const buffered: LaneClip[] = [mk(4, 3, 'b1'), mk(13, 4, 'b2'), mk(24, 2, 'b3')]
  const saved: LaneClip[] = [mk(8, 2, 's1'), mk(20, 3, 's2')]
  // The real screen owns the per-clip collapsed layout; this demo stacks by recency with a
  // duration-scaled (floored) height to show ClipLane positioning.
  const all = [...buffered, ...saved]
  const oldest = Math.min(...all.map((c) => c.startMs))
  const pos: Record<string, { top: number; height: number }> = {}
  for (const c of all) {
    pos[c.id] = { top: ((c.startMs - oldest) / 60_000) * 7, height: Math.max(34, ((c.endMs - c.startMs) / 60_000) * 18) }
  }
  const posOf = (id: string) => pos[id]
  return (
    <View style={{ width: 280, height: viewportH, flexDirection: 'row' }}>
      <ClipLane clips={buffered} tone="buffered" posOf={posOf} />
      <View style={{ width: theme.spacing.sm }} />
      <ClipLane clips={saved} tone="saved" posOf={posOf} />
    </View>
  )
}

function ClipsTimelineDemo() {
  const now = useMemo(() => Date.now(), [])
  const p2 = (n: number) => String(n).padStart(2, '0')
  const mk = (minsAgo: number, durMin: number, id: string): LaneClip => {
    const startMs = now - minsAgo * 60_000
    const endMs = startMs + durMin * 60_000
    const d = new Date(startMs)
    return { id, startMs, endMs, label: `${p2(d.getHours())}:${p2(d.getMinutes())}`, sublabel: `${durMin}:00` }
  }
  // Carve: buffer + saved never overlap in time.
  const buffered: LaneClip[] = [mk(40, 6, 'b1'), mk(28, 4, 'b2'), mk(10, 3, 'b3')]
  const saved: LaneClip[] = [mk(22, 5, 's1')]
  return (
    <View style={{ width: 320, height: 180 }}>
      <ClipsTimeline buffered={buffered} saved={saved} nowMs={now} selectedId="b3" onSelect={() => {}} onOpen={() => {}} onSave={() => {}} onUnsave={() => {}} />
    </View>
  )
}

function BufferTransportDemo() {
  const [playing, setPlaying] = useState(false)
  const [reaping, setReaping] = useState(false)
  return (
    <View style={{ width: 320, gap: 12 }}>
      <BufferTransport
        playing={playing}
        reaping={reaping}
        onToStart={() => {}}
        onPrevClip={() => {}}
        onFrameBack={() => {}}
        onFrameBackHold={() => {}}
        onTogglePlay={() => setPlaying((p) => !p)}
        onFrameForward={() => {}}
        onFrameForwardHold={() => {}}
        onNextClip={() => {}}
        onToEnd={() => {}}
      />
      {/* play · pause · reaping (slashed-pause = riding the reaper, can't pause) */}
      <Pressable variant="default" onPress={() => setReaping((r) => !r)} style={{ alignSelf: 'flex-start' }}>
        <Text variant="caption">{reaping ? 'reaping (slashed-pause) — tap for normal' : 'tap for reaping state'}</Text>
      </Pressable>
    </View>
  )
}

function SegmentPreviewDemo() {
  const [title, setTitle] = useState('Morning ride')
  const now = useMemo(() => Date.now(), [])
  return (
    <View style={{ width: 320 }}>
      {/* No manifest in the gallery → the viewer shows the poster (contain); the timeline + transport
          are still fully interactive (scrub / pinch / inertia) over the 30s span. */}
      <SegmentPreview
        manifestUrl={null}
        posterUrl="https://picsum.photos/seed/wrldseg/240/240"
        startMs={now - 30_000}
        endMs={now}
        titleValue={title}
        onTitleChangeText={setTitle}
        onTitleCommit={() => {}}
        dateLabel="Sat, Jun 14"
        rangeLabel="3:04–3:05 PM"
        onClose={() => {}}
      />
    </View>
  )
}

function SegmentSettingsSheetDemo() {
  const [open, setOpen] = useState(false)
  const [lane, setLane] = useState<'buffered' | 'saved'>('buffered')
  const now = useMemo(() => Date.now(), [])
  const [settings, setSettings] = useState<{
    visibility: Visibility
    precision: Precision
    identity: Identity
    sources: Record<string, boolean>
    title?: string
    tags?: string[]
  }>({
    visibility: 'public',
    precision: 'exact',
    identity: 'attributed',
    sources: { cam: true, audio: true, chat: true, compass: false, gyro: true },
    title: 'Morning ride',
    tags: ['ride', 'sunrise'],
  })
  const onChange = (patch: SegSettings) =>
    setSettings((s) => ({
      ...s,
      ...patch,
      sources: patch.sources ? { ...s.sources, ...patch.sources } : s.sources,
    }))
  return (
    <>
      <Pressable variant="default" onPress={() => setOpen(true)} style={galleryStyles.openBtn}>
        <Text variant="bodyEmphasized">Open segment shelf</Text>
      </Pressable>
      <SegmentSettingsSheet
        visible={open}
        onClose={() => setOpen(false)}
        rangeLabel="3:04–3:05 PM"
        dateLabel="Sat, Jun 14"
        lane={lane}
        onLaneChange={setLane}
        showLane
        manifestUrl={null}
        posterUrl="https://picsum.photos/seed/wrldseg2/240/240"
        startMs={now - 60_000}
        endMs={now}
        settings={settings}
        availableSources={['cam', 'audio', 'chat', 'compass', 'gyro'] as FeedKind[]}
        onChange={onChange}
        onDelete={() => Alert.alert('Delete clip (demo)')}
        onDeleteSource={(k) => Alert.alert(`Delete ${k} (demo)`)}
      />
    </>
  )
}

function ClipSourcesDrawerDemo() {
  const [open, setOpen] = useState(false)
  const [sources, setSources] = useState<ClipSource[]>([
    { key: 'cam', iconName: 'video', label: 'CAMERA', value: '1080P', active: true },
    { key: 'aud', iconName: 'mic', label: 'AUDIO', value: '48 KHZ', active: true },
    { key: 'loc', iconName: 'map-pin', label: 'LOCATION', value: 'GPS', active: true },
    { key: 'comp', iconName: 'compass', label: 'COMPASS', value: '192°', active: true },
    { key: 'gyro', iconName: 'navigation', label: 'GYRO', value: 'OFF', active: false },
  ])
  return (
    <>
      <Pressable variant="default" onPress={() => setOpen(true)} style={galleryStyles.openBtn}>
        <Text variant="bodyEmphasized">Open sources drawer</Text>
      </Pressable>
      <ClipSourcesDrawer
        visible={open}
        sources={sources}
        onToggleSource={(k) =>
          setSources((s) => s.map((x) => (x.key === k ? { ...x, active: !x.active } : x)))
        }
        onDismiss={() => setOpen(false)}
      />
    </>
  )
}

function SavedClipRowDemo() {
  const [expanded, setExpanded] = useState(false)
  return (
    <SavedClipRow
      name="Rooftop sunset"
      capturedAt="14:22 · APR 21"
      durationSec={18}
      sourcesLabel="Cam · Aud · Loc"
      visibility="draft"
      expanded={expanded}
      onToggleExpand={() => setExpanded((v) => !v)}
      onShare={() => {}}
      onPublish={() => {}}
      onDelete={() => {}}
    />
  )
}

const galleryStyles = StyleSheet.create({
  // FilmStrip bounding band (matches ClipBlock's topSpan / SegmentPreview's clipBlock).
  filmBand: {
    height: 40,
    width: 280,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border.strong,
    backgroundColor: theme.colors.bg.primary,
    overflow: 'hidden',
  },
  gapSeg: {
    flex: 1,
    backgroundColor: theme.colors.bg.panelHi,
  },
  gapStrip: {
    flexDirection: 'row',
    height: 54,
    alignItems: 'stretch',
    backgroundColor: theme.colors.bg.primary,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
  },
  trackMock: {
    position: 'relative',
    height: 54,
    backgroundColor: theme.colors.bg.panel,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.colors.border.strong,
    overflow: 'hidden',
  },
  savedMock: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 80,
    width: 120,
  },
  openBtn: {
    height: 46,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border.strong,
    backgroundColor: theme.colors.bg.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
})

function LocationGranularityPickerDemo({
  initial,
}: {
  initial: 'bluedot' | 'city' | 'country' | 'private'
}) {
  const [v, setV] = useState<'bluedot' | 'city' | 'country' | 'private'>(initial)
  return <LocationGranularityPicker value={v} onChange={setV} />
}

function DOBWheelDemo() {
  const [value, setValue] = useState(new Date(2000, 4, 15))
  return (
    <View style={{ gap: 8 }}>
      <DOBWheel value={value} onChange={setValue} />
      <Text variant="monoCaption" color={theme.colors.text.muted}>
        Selected: {value.toDateString()}
      </Text>
    </View>
  )
}

function ReasonRowGroupDemo() {
  const [selected, setSelected] = useState<string | null>(null)
  const reasons = [
    { id: 'spam', title: 'Spam or scam', description: 'Repetitive, deceptive, or misleading' },
    { id: 'hate', title: 'Hate or harassment', description: 'Targeted abuse or slurs' },
    { id: 'safety', title: 'Imminent harm', description: 'Threats, self-harm, or dangerous acts' },
    { id: 'other', title: 'Something else', description: "Doesn't fit above" },
  ]
  return (
    <View style={styles.stack}>
      {reasons.map((r) => (
        <ReasonRow
          key={r.id}
          title={r.title}
          description={r.description}
          selected={selected === r.id}
          onPress={() => setSelected(r.id)}
        />
      ))}
    </View>
  )
}

function LayerEditorRowDemo({
  variant,
  iconName,
  name,
  status,
  description,
  initialState,
}: {
  variant?: 'default' | 'id-layer'
  iconName: 'video' | 'mic' | 'map-pin' | 'user' | 'navigation' | 'compass'
  name: string
  status?: string
  description?: string
  initialState: 'on' | 'off' | 'deleted'
}) {
  const [state, setState] = useState<'on' | 'off' | 'deleted'>(initialState)
  return (
    <LayerEditorRow
      variant={variant}
      iconName={iconName}
      name={name}
      status={status}
      description={description}
      state={state}
      onToggle={(on) => setState(on ? 'on' : 'off')}
      onMenu={() => {}}
      onUndelete={() => setState('on')}
    />
  )
}

function FeedRowDemo({
  kind,
  label,
  detail,
  availability,
  initialAir,
  initialRec,
}: {
  kind: 'cam' | 'audio' | 'screen' | 'loc' | 'gyro' | 'compass' | 'profile' | 'speed' | 'torch' | 'temp' | 'motion'
  label: string
  detail?: string
  availability?: 'available' | 'denied' | 'disabled'
  initialAir?: boolean
  initialRec?: boolean
}) {
  const [air, setAir] = useState(!!initialAir)
  const [rec, setRec] = useState(!!initialRec)
  return (
    <FeedRow
      kind={kind}
      label={label}
      detail={detail}
      availability={availability}
      air={air}
      onAirChange={setAir}
      rec={rec}
      onRecChange={setRec}
    />
  )
}

// Tap to toggle Go Live ↔ End Stream (the two visual states).
function GoLiveRecordBarDemo() {
  const [isLive, setIsLive] = useState(false)
  return <GoLiveRecordBar isLive={isLive} onLivePress={() => setIsLive((v) => !v)} />
}

function IdentityRowDemo() {
  const [identity, setIdentity] = useState<'public' | 'anon'>('public')
  return (
    <FeedRow
      kind="profile"
      label="Identity"
      detail="Off = anonymous · a flag, not a track"
      trailing={
        <View style={{ width: 172 }}>
          <SegmentedToggle
            options={[
              { value: 'public', label: 'PUBLIC' },
              { value: 'anon', label: 'ANON' },
            ]}
            value={identity}
            onChange={setIdentity}
          />
        </View>
      }
    />
  )
}

// Location/Identity dashboard style: leading icon tile (updates with the
// chosen state) + footer SegmentedToggle, no Air toggle (showAir={false}).
function StatePickerRowDemo() {
  const [precision, setPrecision] = useState<'exact' | 'city' | 'country' | 'private'>('city')
  const meta: Record<typeof precision, { icon: ComponentProps<typeof Icon>['name']; detail: string; muted?: boolean }> = {
    exact: { icon: 'map-pin', detail: 'Your exact spot is shown on the globe' },
    city: { icon: 'map', detail: 'A fuzzy circle around your city' },
    country: { icon: 'globe', detail: 'Only the country you’re in' },
    private: { icon: 'eye-off', detail: 'Location hidden — not shared', muted: true },
  }
  const m = meta[precision]
  return (
    <FeedRow
      kind="loc"
      label="Location"
      detail={m.detail}
      showAir={false}
      showRec={false}
      leading={
        <View style={styles.stateIconTile}>
          <Icon name={m.icon} size="lg" color={m.muted ? theme.colors.text.muted : theme.colors.accent.default} />
        </View>
      }
      footer={
        <SegmentedToggle
          options={[
            { value: 'exact', label: 'EXACT' },
            { value: 'city', label: 'CITY' },
            { value: 'country', label: 'COUNTRY' },
            { value: 'private', label: 'PRIVATE' },
          ]}
          value={precision}
          onChange={setPrecision}
        />
      }
    />
  )
}

function LaneToggleDemo() {
  const [lane, setLane] = useState<CaptureLane>('buffer')
  return <LaneToggle value={lane} onChange={setLane} />
}

function RecordConsentSheetDemo() {
  const [visible, setVisible] = useState(false)
  return (
    <View>
      <Button label="Open consent sheet" onPress={() => setVisible(true)} variant="secondary" />
      <RecordConsentSheet
        visible={visible}
        onClose={() => setVisible(false)}
        sourceLabel="camera"
        onConfirm={() => setVisible(false)}
      />
    </View>
  )
}

function AmountInputDemo({
  variant,
  initial,
  max,
  platformFeePct,
  invalidReason,
}: {
  variant: 'tip' | 'cashout'
  initial: number
  max: number
  platformFeePct?: number
  invalidReason?: string
}) {
  const [v, setV] = useState(initial)
  return (
    <AmountInput
      variant={variant}
      value={v}
      onValueChange={setV}
      max={max}
      platformFeePct={platformFeePct}
      invalidReason={invalidReason}
    />
  )
}

function ConsentRowDemo({
  title,
  description,
  initial,
  locked,
}: {
  title: string
  description: string
  initial: boolean
  locked?: boolean
}) {
  const [on, setOn] = useState(initial)
  return (
    <ConsentRow
      title={title}
      description={description}
      on={on}
      onToggle={setOn}
      locked={locked}
    />
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
  audioVizFrame: { width: '100%', height: 180, borderRadius: theme.radius.md, overflow: 'hidden' },
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
  sourceStack: {
    alignSelf: 'stretch',
    gap: theme.spacing.sm,
  },
  stateIconTile: {
    width: 76,
    height: 60,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bg.panel,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  darkStage: {
    alignSelf: 'stretch',
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: '#1d1410',
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
