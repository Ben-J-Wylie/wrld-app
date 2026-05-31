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
import { ClipCard } from '@/components/features/clip/ClipCard'
import { ClipPreview } from '@/components/features/clip/ClipPreview'
import { LayerEditorRow } from '@/components/features/clip/LayerEditorRow'
import { ContextStrip } from '@/components/features/report/ContextStrip'
import { ReasonRow } from '@/components/features/report/ReasonRow'
import { PermissionPrePromptCard } from '@/components/features/permissions/PermissionPrePromptCard'
import { AgeGateCard } from '@/components/features/onboarding/AgeGateCard'
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
        <Row label="all kinds (md, active)">
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
        <Row label="armed">
          <FeedRowDemo kind="cam" label="Camera" detail="1080p · BACK" initialOn initialState="armed" />
        </Row>
        <Row label="broadcasting">
          <FeedRowDemo kind="audio" label="Audio" detail="48 kHz · DEFAULT MIC" initialOn initialState="broadcasting" />
        </Row>
        <Row label="off">
          <FeedRowDemo kind="loc" label="Location" detail="GPS · SHARE GRANULAR" initialState="off" />
        </Row>
        <Row label="denied">
          <FeedRowDemo kind="screen" label="Screen" detail="System screen capture" initialState="denied" />
        </Row>
        <Row label="disabled">
          <FeedRowDemo kind="gyro" label="Gyroscope" detail="Not available on this device" initialState="disabled" />
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
        <Row label="disabled">
          <GoBar variant="disabled" />
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
  initialOn,
  initialState,
}: {
  kind: 'cam' | 'audio' | 'screen' | 'loc' | 'gyro' | 'compass' | 'profile'
  label: string
  detail?: string
  initialOn?: boolean
  initialState: 'off' | 'armed' | 'broadcasting' | 'denied' | 'disabled'
}) {
  const [on, setOn] = useState(!!initialOn)
  return (
    <FeedRow
      kind={kind}
      label={label}
      detail={detail}
      state={initialState}
      on={on}
      onToggle={setOn}
    />
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
