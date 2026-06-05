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

import { useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { ScreenScroll } from '@/components/sections/ScreenScroll'
import { ScreenHeader } from '@/components/sections/ScreenHeader'
import { Pill } from '@/components/primitives/Pill'
import { TrendingRail } from '@/components/sections/TrendingRail'
import { CategoryChipRow } from '@/components/sections/CategoryChipRow'
import { StreamStrip } from '@/components/sections/StreamStrip'
import { DayGroup } from '@/components/sections/DayGroup'
import { ActionTilesRow } from '@/components/sections/ActionTilesRow'
import { PresetGrid } from '@/components/sections/PresetGrid'
import { SettingsGroup } from '@/components/sections/SettingsGroup'
import { InfoList } from '@/components/sections/InfoList'
import { LegalLinkList } from '@/components/sections/LegalLinkList'
import { ActionSheet } from '@/components/sections/ActionSheet'
import { FilterCard } from '@/components/sections/FilterCard'
import { Button } from '@/components/primitives/Button'
import { SettingsRow } from '@/components/features/settings/SettingsRow'
import { TransactionRow } from '@/components/features/wallet/TransactionRow'
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
      </Section>

      <Section title="ScreenHeader">
        <Text variant="caption" color={theme.colors.text.muted}>
          Shared top header: logo + WRLD left, right slot right. Globe passes a
          LIVE pill; every other page passes a `title` (page name). Fixed height
          so the field below lands at the same Y on every screen.
        </Text>
        <ScreenHeader title="Dashboard" />
        <ScreenHeader title="Settings" />
        <ScreenHeader right={<Pill size="sm" variant="accent" label="12 LIVE" />} />
      </Section>

      <Section title="TrendingRail">
        <TrendingRail
          streams={[
            { id: 'a', thumbnailUrl: 'https://picsum.photos/seed/wrldsec1/200/120', title: 'Atlantic Ave · street fest', viewerCount: 1400, city: 'BROOKLYN', channel: 'CH 12', onPress: () => {} },
            { id: 'b', thumbnailUrl: 'https://picsum.photos/seed/wrldsec2/200/120', title: 'Golden Gate overlook', viewerCount: 9120, city: 'SF', channel: 'CH 08', onPress: () => {} },
            { id: 'c', thumbnailUrl: 'https://picsum.photos/seed/wrldsec3/200/120', title: 'Aurora north-facing', viewerCount: 6400, city: 'REYKJAVÍK', channel: 'CH 41', onPress: () => {} },
          ]}
          onTapAll={() => {}}
        />
        <Sub label="empty">
          <TrendingRail streams={[]} onTapAll={() => {}} />
        </Sub>
      </Section>

      <Section title="CategoryChipRow">
        <CategoryChipRowDemo />
      </Section>

      <Section title="StreamStrip">
        <StreamStrip
          layers={[
            { id: 'cam', iconName: 'video', label: 'CAM', value: '1080P' },
            { id: 'aud', iconName: 'mic', label: 'AUD', value: '48 kHz' },
            { id: 'loc', iconName: 'map-pin', label: 'LOC', value: 'GPS' },
            { id: 'gyr', iconName: 'navigation', label: 'GYR', value: '120Hz' },
            { id: 'scrn', iconName: 'monitor', label: 'SCRN', value: 'OFF', active: false },
            { id: 'cmp', iconName: 'compass', label: 'HDG', value: '192°' },
          ]}
        />
      </Section>

      <Section title="DayGroup">
        <DayGroup
          label="TODAY"
          summary="+ 170 SB · - 100 SB"
          showBorderTop={false}
        >
          <TransactionRow kind="tip-received" title="Tip from @mira" amount={70} currency="sd" />
          <TransactionRow kind="tip-sent" title="Tipped @kai.dc" amount={100} currency="sb" />
        </DayGroup>
        <DayGroup label="YESTERDAY" summary="+ 50 SB">
          <TransactionRow kind="promo" title="Welcome bonus" amount={50} currency="sb" />
        </DayGroup>
      </Section>

      <Section title="ActionTilesRow">
        <ActionTilesRow
          tiles={[
            { id: 'topup', iconName: 'plus-circle', title: 'Top up', descriptor: 'Add Space Bucks', onPress: () => {}, primary: true },
            { id: 'cashout', iconName: 'arrow-down-circle', title: 'Cash out', descriptor: 'Withdraw Star Dust', onPress: () => {} },
            { id: 'send', iconName: 'send', title: 'Send', descriptor: 'Tip a friend', onPress: () => {} },
          ]}
        />
        <Sub label="4-up">
          <ActionTilesRow
            cols={4}
            tiles={[
              { id: '1', iconName: 'plus-circle', title: 'Top up', onPress: () => {}, primary: true },
              { id: '2', iconName: 'arrow-down-circle', title: 'Cash', onPress: () => {} },
              { id: '3', iconName: 'send', title: 'Send', onPress: () => {} },
              { id: '4', iconName: 'gift', title: 'Promo', onPress: () => {} },
            ]}
          />
        </Sub>
      </Section>

      <Section title="PresetGrid">
        <PresetGridDemo />
      </Section>

      <Section title="SettingsGroup">
        <SettingsGroup title="ACCOUNT">
          <SettingsRow iconName="credit-card" title="Plan" value="Free · View all plans" arrow showBorderTop={false} onPress={() => {}} />
          <SettingsRow iconName="bell" title="Notifications" value="Followed live, nearby live" arrow onPress={() => {}} />
        </SettingsGroup>
        <SettingsGroup title="DEVELOPMENT">
          <SettingsRow title="Primitive gallery" arrow showBorderTop={false} onPress={() => {}} />
          <SettingsRow title="Feature gallery" arrow onPress={() => {}} />
          <SettingsRow title="Section gallery" arrow onPress={() => {}} />
        </SettingsGroup>
      </Section>

      <Section title="InfoList">
        <InfoList
          rows={[
            { tone: 'keep', iconName: 'check', title: 'Your followers stay with you', body: 'No one needs to refollow.' },
            { tone: 'change', iconName: 'edit-3', title: 'Your @-mentions update everywhere', body: 'Old links to your handle now point to @benwy.' },
            { tone: 'hold', iconName: 'clock', title: 'Your old handle is held for 30 days', body: 'Nobody else can claim @user_8j2k1 in that window.' },
          ]}
        />
      </Section>

      <Section title="ActionSheet">
        <ActionSheetDemo />
      </Section>

      <Section title="FilterCard">
        <FilterCardDemo />
      </Section>

      <Section title="WizardShell">
        <Text variant="body" color={theme.colors.text.muted}>
          Full-screen scaffold — same reason ScreenScroll has no inline preview. Used by
          all v0.2 wizards (Viewer + Creator Onboarding, Handle, Change Handle) once 12.6
          migrates them.
        </Text>
      </Section>

      <Section title="LegalLinkList">
        <LegalLinkList
          docs={[
            { id: 'tos', label: 'Terms of service', onPress: () => {} },
            { id: 'rules', label: 'Community rules', onPress: () => {} },
            { id: 'privacy', label: 'Privacy policy', onPress: () => {} },
          ]}
        />
      </Section>
    </ScreenScroll>
  )
}

function ActionSheetDemo() {
  const [open, setOpen] = useState(false)
  return (
    <View>
      <Button label="Open kebab" onPress={() => setOpen(true)} />
      <ActionSheet
        visible={open}
        onClose={() => setOpen(false)}
        header="@KAI.DC"
        actions={[
          { id: 'view', iconName: 'user', label: 'View profile', onPress: () => {} },
          { id: 'follow', iconName: 'user-plus', label: 'Follow', onPress: () => {} },
          { id: 'share', iconName: 'share', label: 'Share stream', onPress: () => {} },
          { id: 'report', iconName: 'flag', label: 'Report', tone: 'warn', onPress: () => {} },
        ]}
      />
    </View>
  )
}

function FilterCardDemo() {
  const [vis, setVis] = useState('all')
  const [layers, setLayers] = useState<string[]>(['cam'])
  const [date, setDate] = useState<string | null>('30d')
  const hasFilters = vis !== 'all' || layers.length !== 0 || date !== null
  return (
    <FilterCard
      title="Filters"
      resultsSummary={hasFilters ? '12 OF 47 results' : undefined}
      onClear={
        hasFilters
          ? () => {
              setVis('all')
              setLayers([])
              setDate(null)
            }
          : undefined
      }
      rows={[
        {
          kind: 'segmented',
          id: 'vis',
          label: 'VISIBILITY',
          value: vis,
          onChange: setVis,
          options: [
            { id: 'all', label: 'All' },
            { id: 'public', label: 'Public' },
            { id: 'anon', label: 'Anon' },
          ],
        },
        {
          kind: 'chip-multi',
          id: 'layers',
          label: 'LAYERS',
          value: layers,
          onChange: setLayers,
          options: [
            { id: 'cam', label: 'Cam' },
            { id: 'aud', label: 'Audio' },
            { id: 'loc', label: 'Location' },
            { id: 'gyr', label: 'Gyro' },
          ],
        },
        {
          kind: 'chip-single',
          id: 'date',
          label: 'DATE',
          value: date,
          onChange: setDate,
          options: [
            { id: '7d', label: '7d' },
            { id: '30d', label: '30d' },
            { id: '90d', label: '90d' },
            { id: 'all', label: 'All time' },
          ],
        },
      ]}
    />
  )
}

function CategoryChipRowDemo() {
  const [v, setV] = useState<string | null>(null)
  return (
    <CategoryChipRow
      categories={[
        { id: 'all', label: 'All' },
        { id: 'cities', label: 'Cities' },
      ]}
      value={v}
      onChange={setV}
    />
  )
}

function PresetGridDemo() {
  const [v, setV] = useState<number | null>(100)
  return (
    <PresetGrid
      presets={[50, 100, 500, 1000]}
      value={v}
      onChange={setV}
      format={(n) => `${n} 🚀`}
    />
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

function Sub({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.sub}>
      <Text variant="monoCaption" color={theme.colors.text.subtle}>{label}</Text>
      <View>{children}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  scroll: { padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: theme.spacing.xxxl },
  section: { gap: theme.spacing.sm, marginTop: theme.spacing.xl },
  sectionBody: {
    gap: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.subtle,
  },
  sub: {
    gap: theme.spacing.xs,
  },
})
