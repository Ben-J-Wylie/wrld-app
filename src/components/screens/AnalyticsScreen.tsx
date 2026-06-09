// src/components/screens/AnalyticsScreen.tsx
//
// Pro-only creator analytics dashboard — the app port of wrld-web's
// AnalyticsPage.tsx. Data comes from the shared backend
// (GET /users/me/analytics), itself gated server-side on tier === 'pro'. This
// screen mirrors that gate client-side: signed-out → sign-in CTA; non-Pro →
// upsell to /subscription (the in-app plan screen — web upsells to /plan);
// Pro → the full dashboard.
//
// Design adaptation: the web dashboard is dark + multi-tint (cyan/violet/etc).
// This app's design system is a warm cream paper light theme with a single
// warm-crimson accent, so the port uses the app's tokens (Card/Text/theme),
// neutral icon tiles, and crimson + amber for data-viz where the web used a
// rainbow. Charts are Victory Native (Skia); the choropleth is RNMapbox.
//
// Caveats preserved from web (audience metrics split):
//   • watch time / unique / top-viewer / top-supporter = signed-in only.
//   • country / city / reach / heatmap = everyone (anon + signed-in).
//   • all audience-geo + activity data is forward-only (no backfill).

import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { useAuth } from '@clerk/clerk-expo'
import { CartesianChart, Area, Line, StackedBar } from 'victory-native'
import { useFont } from '@shopify/react-native-skia'
import { SafeAreaView } from 'react-native-safe-area-context'
import { theme } from '@/tokens/theme'
import { Text } from '@/components/primitives/Text'
import { Card } from '@/components/primitives/Card'
import { Button } from '@/components/primitives/Button'
import { Icon } from '@/components/primitives/Icon'
import { Avatar } from '@/components/primitives/Avatar'
import { Spinner } from '@/components/primitives/Spinner'
import { SegmentedToggle } from '@/components/primitives/SegmentedToggle'
import { ScreenHeader } from '@/components/sections/ScreenHeader'
import { CountryMap } from '@/components/features/analytics/CountryMap'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useAnalytics } from '@/hooks/useAnalytics'
import type { AnalyticsData, AnalyticsGeo, AnalyticsRange } from '@/api/analytics'
import type { ComponentProps } from 'react'

const AXIS_FONT = require('../../../assets/fonts/IBMPlexMono_500Medium.ttf')

type FeatherName = ComponentProps<typeof Icon>['name']

const RANGES: { value: AnalyticsRange; label: string }[] = [
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
  { value: 'all', label: 'All' },
]

// ─── Formatters (ported verbatim from web) ──────────────────────────────────

let regionNames: Intl.DisplayNames | null = null
try { regionNames = new Intl.DisplayNames(['en'], { type: 'region' }) } catch { regionNames = null }
function countryName(cc: string): string {
  try { return regionNames?.of(cc) ?? cc } catch { return cc }
}
function flagEmoji(cc: string): string {
  if (cc.length !== 2) return '🏳️'
  return cc.toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
}
const usd = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`
const compact = (n: number) => n.toLocaleString(undefined, { notation: 'compact', maximumFractionDigits: 1 })
const shortDate = (iso: string) => {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
const watchLabel = (sec: number) => {
  const h = Math.floor(sec / 3600)
  const m = Math.round((sec % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  return `${sec}s`
}
const GB = 1024 ** 3
function formatBytes(b: number): string {
  if (!b || b < 0) return '0 GB'
  if (b >= GB) { const gb = b / GB; return `${gb >= 100 ? Math.round(gb) : gb.toFixed(gb >= 10 ? 1 : 2)} GB` }
  if (b >= 1024 ** 2) return `${Math.round(b / 1024 ** 2)} MB`
  if (b >= 1024) return `${Math.round(b / 1024)} KB`
  return `${b} B`
}
const TIER_LABEL: Record<string, string> = { free: 'Free', plus: 'Plus', pro: 'Pro' }

export function AnalyticsScreen() {
  const { isSignedIn } = useAuth()
  const { data: user } = useCurrentUser()
  const [range, setRange] = useState<AnalyticsRange>('30d')
  const isPro = user?.tier === 'pro'
  const query = useAnalytics(range, !!isSignedIn && isPro)

  if (!isSignedIn) {
    return (
      <Gate>
        <Text variant="body" color={theme.colors.text.muted} style={styles.gateText}>
          Sign in to view your analytics.
        </Text>
        <Button label="Sign in" onPress={() => router.push('/(auth)/login')} style={styles.gateBtn} />
      </Gate>
    )
  }

  // Non-Pro upsell — the primary marketing surface for the Pro tier (same role
  // as on web). App upsells to the in-app plan screen, /subscription.
  if (!isPro) {
    return (
      <Gate>
        <View style={styles.upsellIcon}>
          <Icon name="award" size={30} color={theme.colors.accent.default} />
        </View>
        <Text variant="display" style={styles.upsellTitle}>Analytics is a Pro feature</Text>
        <Text variant="body" color={theme.colors.text.muted} style={styles.upsellBody}>
          Unlock the full creator dashboard — audience-by-country world map, viewer
          retention, revenue trends, and your top streams & clips. Upgrade to Pro to
          see who&apos;s watching, from where, and what&apos;s working.
        </Text>
        <Button
          label="Upgrade to Pro"
          icon="award"
          onPress={() => router.push('/(app)/subscription')}
          style={styles.gateBtn}
        />
      </Gate>
    )
  }

  const data = query.data

  return (
    <SafeAreaView style={styles.root}>
      <ScreenHeader title="Analytics" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Range selector + refresh */}
        <View style={styles.toolbar}>
          <Text variant="caption" color={theme.colors.text.subtle} style={styles.flex1}>
            {data ? `Since ${new Date(data.since).toLocaleDateString()}` : 'Your creator performance'}
          </Text>
          <View style={styles.rangeWrap}>
            <SegmentedToggle options={RANGES} value={range} onChange={setRange} />
          </View>
          <Button
            label=""
            icon="refresh-cw"
            variant="secondary"
            loading={query.isFetching}
            onPress={() => query.refetch()}
            style={styles.refreshBtn}
          />
        </View>

        {query.isLoading && (
          <View style={styles.loading}>
            <Spinner size="lg" />
          </View>
        )}
        {query.isError && (
          <Card variant="accent" style={styles.errorCard}>
            <Text variant="caption" color={theme.colors.accent.default}>
              Couldn&apos;t load analytics. {(query.error as Error)?.message}
            </Text>
          </Card>
        )}

        {data && (
          <Dashboard
            data={data}
            tier={user?.tier ?? 'pro'}
            storageUsed={user?.usedStorageBytes ?? 0}
            storageQuota={user?.storageQuotaBytes ?? 0}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function Dashboard({
  data, tier, storageUsed, storageQuota,
}: { data: AnalyticsData; tier: string; storageUsed: number; storageQuota: number }) {
  const s = data.summary
  const noActivity = s.streamCount === 0 && s.followers === 0 && s.totalRevenueUsd === 0
  const storagePct = storageQuota > 0 ? (storageUsed / storageQuota) * 100 : 0
  const planLabel = TIER_LABEL[tier] ?? 'Pro'

  return (
    <>
      {/* KPI cards */}
      <View style={styles.kpiGrid}>
        <Kpi icon="globe" label="Audience reach" value={compact(s.totalReach)} sub="all viewers (anon + signed-in)" />
        <Kpi icon="users" label="Unique viewers" value={compact(s.uniqueSignedInViewers)} sub={`${compact(s.repeatViewers)} returning`} />
        <Kpi icon="clock" label="Watch time" value={`${compact(s.totalWatchHours)}h`} sub={`${s.avgWatchMinutes}m avg / session`} />
        <Kpi icon="radio" label="Streams" value={compact(s.streamCount)} sub={`${s.hoursStreamed}h live · peak ${compact(s.peakConcurrentViewers)}`} />
        <Kpi icon="heart" label="Followers" value={compact(s.followers)} sub={`+${compact(s.followersGained)} this period`} />
        <Kpi icon="award" label="Subscribers" value={compact(s.activeSubscribers)} sub={`+${compact(s.newSubscribers)} new · ${usd(s.mrrUsd)}/mo`} />
        <Kpi icon="dollar-sign" label="Revenue" value={usd(s.totalRevenueUsd)} sub={`${usd(s.tipsUsd)} tips · ${usd(s.ppvUsd)} PPV`} />
        <Kpi icon="repeat" label="Viewer sessions" value={compact(s.viewerSessions)} sub="total room joins (signed-in)" />
      </View>

      {noActivity && (
        <Card variant="solid" style={styles.note}>
          <Text variant="caption" color={theme.colors.text.muted}>
            No activity in this window yet — go live and your numbers will start filling in here.
          </Text>
        </Card>
      )}

      {/* Plan & storage */}
      <Section title="Plan & storage" subtitle="Your current plan and saved-clip storage usage.">
        <Card variant="solid" style={styles.cardPad}>
          <Row label="CURRENT PLAN" icon="award" />
          <Text variant="display" style={styles.bigNum}>{planLabel}</Text>
          <Text variant="caption" color={theme.colors.text.subtle}>{formatBytes(storageQuota)} clip storage</Text>
        </Card>
        <Card variant="solid" style={styles.cardPad}>
          <Row label="CLIP STORAGE USED" icon="hard-drive" />
          <View style={styles.storageRow}>
            <Text variant="heading">
              {formatBytes(storageUsed)}{' '}
              <Text variant="caption" color={theme.colors.text.subtle}>of {formatBytes(storageQuota)}</Text>
            </Text>
            <Text variant="bodyEmphasized" color={theme.colors.accent.default}>
              {storagePct < 10 ? storagePct.toFixed(1) : Math.round(storagePct)}%
            </Text>
          </View>
          <Meter pct={storagePct} />
        </Card>
      </Section>

      {/* Space Bucks & earnings */}
      <Section title="Space Bucks & earnings" subtitle="Your token economy this period — Space Bucks 🚀 and Stardust ✨ are $0.01 each.">
        <View style={styles.tripleGrid}>
          <Kpi wide icon="zap" label="Space Bucks purchased" value={`🚀 ${compact(s.spaceBucksPurchased)}`} sub={`${usd(s.spaceBucksPurchasedUsd)} spent`} />
          <Kpi wide icon="gift" label="Tips received" value={`🚀 ${compact(s.tipsReceivedSpaceBucks)}`} sub={`${usd(s.tipsUsd)} gross`} />
          <Kpi wide icon="star" label="Stardust earned" value={`✨ ${compact(s.stardustEarned)}`} sub={`${usd(s.stardustEarnedUsd)} cash-outable`} />
        </View>
      </Section>

      {/* Gifts */}
      <Section title="Gifts" subtitle="Emoji gifts viewers sent you — collected, not cashed out (gifts spend Space Bucks 🚀; you keep the collection).">
        <View style={styles.tripleGrid}>
          <Kpi wide icon="gift" label="Gifts received" value={compact(s.giftsReceivedCount)} sub="across all gift types" />
          <Kpi wide icon="zap" label="Space Bucks gifted to you" value={`🚀 ${compact(s.giftsReceivedSpaceBucks)}`} sub="spent by viewers on gifts" />
        </View>
        <Card variant="solid" style={styles.cardPad}>
          <Text variant="monoLabel" color={theme.colors.text.subtle}>BY GIFT</Text>
          <View style={styles.giftRow}>
            {data.giftsBreakdown.map((g) => (
              <View key={g.giftType} style={styles.giftCell}>
                <Text variant="display">{g.emoji}</Text>
                <Text variant="bodyEmphasized">{compact(g.count)}</Text>
                <Text variant="monoCaption" color={theme.colors.text.subtle}>{g.label}</Text>
              </View>
            ))}
          </View>
        </Card>
      </Section>
      <Section title="Top gifters" subtitle="Your biggest gift senders by Space Bucks.">
        {data.topGifters.length === 0 ? (
          <Card variant="solid" style={styles.cardPad}>
            <Text variant="caption" color={theme.colors.text.subtle}>No gifts yet this period.</Text>
          </Card>
        ) : (
          <PeopleList
            rows={data.topGifters.map((v) => ({
              id: v.id, handle: v.handle, displayName: v.displayName, avatarUrl: v.avatarUrl,
              primary: v.displayName || `@${v.handle}`,
              sub: `@${v.handle} · ${v.giftCount} gift${v.giftCount === 1 ? '' : 's'}`,
              metric: `🚀 ${compact(v.spaceBucks)}`, metricLabel: 'gifted',
            }))}
          />
        )}
      </Section>

      {/* Country map + top countries */}
      <Section title="Where your audience is watching" subtitle="Every viewer (anonymous + signed-in), resolved to a country.">
        <Card variant="solid" style={styles.mapCard}>
          <View style={styles.mapBox}>
            <CountryMap geo={data.geo} />
            {data.geo.length === 0 && (
              <View style={styles.mapEmpty} pointerEvents="none">
                <Icon name="globe" size="lg" color={theme.colors.text.subtle} />
                <Text variant="caption" color={theme.colors.text.muted} style={styles.center}>
                  Audience geography appears here{'\n'}once viewers join your streams.
                </Text>
              </View>
            )}
          </View>
        </Card>
        <Card variant="solid" style={styles.cardPad}>
          <Text variant="monoLabel" color={theme.colors.text.subtle}>TOP COUNTRIES</Text>
          {data.geo.length === 0 ? (
            <Text variant="caption" color={theme.colors.text.subtle} style={styles.gapTop}>No data yet.</Text>
          ) : (
            <CountryBars geo={data.geo} />
          )}
        </Card>
      </Section>

      {/* Top cities */}
      <Section title="Top cities" subtitle="Where your viewers connect from (city resolves for most, but not all, viewers).">
        <Card variant="solid" style={styles.cardPad}>
          {data.topCities.length === 0 ? (
            <View style={styles.inlineRow}>
              <Icon name="map-pin" size="sm" color={theme.colors.text.subtle} />
              <Text variant="caption" color={theme.colors.text.subtle}>No city-level data yet.</Text>
            </View>
          ) : (
            data.topCities.map((c, i) => (
              <View key={`${c.countryCode}-${c.city}-${i}`} style={styles.cityRow}>
                <Text variant="caption" numberOfLines={1} style={styles.flex1}>
                  <Text variant="monoValue" color={theme.colors.text.subtle}>{i + 1}  </Text>
                  {flagEmoji(c.countryCode)} {c.city}, {countryName(c.countryCode)}
                </Text>
                <Text variant="monoValue" color={theme.colors.text.muted}>{c.viewers.toLocaleString()}</Text>
              </View>
            ))
          )}
        </Card>
      </Section>

      {/* Top viewers + top supporters */}
      <Section title="Top viewers" subtitle="Most engaged fans by watch time (signed-in only).">
        <PeopleList
          rows={data.topViewers.map((v) => ({
            id: v.id, handle: v.handle, displayName: v.displayName, avatarUrl: v.avatarUrl,
            primary: v.displayName || `@${v.handle}`,
            sub: `@${v.handle} · ${v.sessions} session${v.sessions === 1 ? '' : 's'}`,
            metric: watchLabel(v.watchSeconds), metricLabel: 'watched',
          }))}
        />
      </Section>
      <Section title="Top supporters" subtitle="Your biggest tippers by Space Bucks.">
        <PeopleList
          rows={data.topSupporters.map((v) => ({
            id: v.id, handle: v.handle, displayName: v.displayName, avatarUrl: v.avatarUrl,
            primary: v.displayName || `@${v.handle}`,
            sub: `@${v.handle} · ${v.tipCount} tip${v.tipCount === 1 ? '' : 's'}`,
            metric: `🚀 ${compact(v.spaceBucks)}`, metricLabel: 'tipped',
          }))}
        />
      </Section>

      {/* Audience over time */}
      <Section title="Audience over time" subtitle="Unique signed-in viewers and watch hours per day.">
        <AudienceChart data={data} />
      </Section>

      {/* When your audience is online */}
      <Section title="When your audience is online" subtitle="Viewer joins by day & hour, in your local time — find the best slots to go live.">
        <ActivityHeatmap cells={data.activity} />
      </Section>

      {/* Audience composition + subscriber health */}
      <Section title="Audience composition" subtitle="Signed-in vs anonymous reach.">
        <Card variant="solid" style={styles.cardPad}>
          <View style={styles.compRow}>
            <Text variant="display">{s.signedInRate}%</Text>
            <Text variant="caption" color={theme.colors.text.muted}>signed in</Text>
          </View>
          <View style={styles.splitBar}>
            <View style={[styles.splitFill, { width: `${Math.min(100, s.signedInRate)}%` }]} />
          </View>
          <View style={styles.splitLegend}>
            <Text variant="caption" color={theme.colors.text.muted}>● {compact(s.signedInReach)} signed in</Text>
            <Text variant="caption" color={theme.colors.text.subtle}>● {compact(s.anonymousReach)} anonymous</Text>
          </View>
        </Card>
      </Section>
      <Section title="Subscriber health" subtitle="Net change this period.">
        <Card variant="solid" style={styles.cardPad}>
          <View style={styles.healthRow}>
            <HealthStat label="New" value={`+${compact(s.newSubscribers)}`} tone="primary" />
            <HealthStat label="Cancelled" value={`−${compact(s.cancelledSubscribers)}`} tone="accent" />
            <HealthStat label="Net" value={`${s.netSubscribers >= 0 ? '+' : '−'}${compact(Math.abs(s.netSubscribers))}`} tone={s.netSubscribers >= 0 ? 'primary' : 'accent'} />
          </View>
          <Text variant="caption" color={theme.colors.text.subtle} style={styles.center}>
            {compact(s.activeSubscribers)} active · {usd(s.mrrUsd)}/mo recurring
          </Text>
        </Card>
      </Section>

      {/* PPV performance */}
      {data.ppvEvents.length > 0 && (
        <Section title="PPV performance" subtitle="Your pay-per-view events this period (net revenue after platform fee).">
          <Card variant="solid">
            {data.ppvEvents.map((e, i) => (
              <View key={e.id} style={[styles.listRow, i > 0 && styles.borderTop]}>
                <View style={styles.flex1}>
                  <Text variant="bodyEmphasized" numberOfLines={1}>{e.title}</Text>
                  <Text variant="caption" color={theme.colors.text.subtle}>
                    {new Date(e.scheduledAt).toLocaleDateString()} · {usd(e.priceUsd)} · {e.attendees} attendee{e.attendees === 1 ? '' : 's'}
                  </Text>
                </View>
                <StatusBadge status={e.status} />
                <View style={styles.netCol}>
                  <Text variant="bodyEmphasized" color={theme.colors.accent.default}>{usd(e.netRevenueUsd)}</Text>
                  <Text variant="monoLabel" color={theme.colors.text.subtle}>NET</Text>
                </View>
              </View>
            ))}
          </Card>
        </Section>
      )}

      {/* Follower growth + revenue */}
      <Section title="Follower growth" subtitle="Cumulative followers.">
        <FollowerChart data={data} />
      </Section>
      <Section title="Revenue" subtitle="Tips + PPV per day (USD).">
        <RevenueChart data={data} />
      </Section>

      {/* Top streams + clips */}
      <Section title="Top streams" subtitle="By peak viewers.">
        <Card variant="solid">
          {data.topStreams.length === 0 && <Empty />}
          {data.topStreams.map((t, i) => (
            <View key={t.id} style={[styles.listRow, i > 0 && styles.borderTop]}>
              <Text variant="monoValue" color={theme.colors.text.subtle} style={styles.rank}>{i + 1}</Text>
              <View style={styles.flex1}>
                <Text variant="bodyEmphasized" numberOfLines={1}>{t.title || 'Untitled stream'}</Text>
                <Text variant="caption" color={theme.colors.text.subtle}>
                  {new Date(t.startedAt).toLocaleDateString()} · {t.watchHours}h watched · {usd(t.tipsUsd)} tips
                </Text>
              </View>
              <View style={styles.netCol}>
                <Text variant="bodyEmphasized" color={theme.colors.accent.default}>{compact(t.peakViewers)}</Text>
                <Text variant="monoLabel" color={theme.colors.text.subtle}>PEAK</Text>
              </View>
            </View>
          ))}
        </Card>
      </Section>
      <Section title="Top clips" subtitle="By views.">
        <Card variant="solid">
          {data.topClips.length === 0 && <Empty />}
          {data.topClips.map((c, i) => (
            <View key={c.id} style={[styles.listRow, i > 0 && styles.borderTop]}>
              <Text variant="monoValue" color={theme.colors.text.subtle} style={styles.rank}>{i + 1}</Text>
              <View style={styles.flex1}>
                <Text variant="bodyEmphasized" numberOfLines={1}>{c.title || 'Untitled clip'}</Text>
                <Text variant="caption" color={theme.colors.text.subtle}>{new Date(c.createdAt).toLocaleDateString()}</Text>
              </View>
              <View style={styles.netCol}>
                <Text variant="bodyEmphasized" color={theme.colors.accent.default}>{compact(c.viewCount)}</Text>
                <Text variant="monoLabel" color={theme.colors.text.subtle}>VIEWS</Text>
              </View>
            </View>
          ))}
        </Card>
      </Section>
    </>
  )
}

// ─── Charts (Victory Native / Skia) ─────────────────────────────────────────

const ACCENT = theme.colors.accent.default
const AMBER = theme.colors.warn
const INK_MUTED = 'rgba(26,22,18,0.45)'
const GRID = 'rgba(26,22,18,0.10)'

// xKey is a numeric index so the linear scale spaces points evenly; the date
// label is looked up from the row for tick formatting.
type ChartRow = { i: number; date: string; uniqueViewers: number; watchHours: number; followers: number; tipsUsd: number; ppvUsd: number }
function toRows(data: AnalyticsData): ChartRow[] {
  return data.timeseries.map((p, i) => ({
    i, date: p.date,
    uniqueViewers: p.uniqueViewers, watchHours: p.watchHours, followers: p.followers,
    tipsUsd: p.tipsUsd, ppvUsd: p.ppvUsd,
  }))
}

function ChartEmpty() {
  return (
    <Card variant="solid" style={styles.cardPad}>
      <View style={styles.inlineRow}>
        <Icon name="bar-chart-2" size="sm" color={theme.colors.text.subtle} />
        <Text variant="caption" color={theme.colors.text.subtle}>No data for this range yet.</Text>
      </View>
    </Card>
  )
}

function AudienceChart({ data }: { data: AnalyticsData }) {
  const font = useFont(AXIS_FONT, 9)
  const rows = toRows(data)
  if (rows.length === 0) return <ChartEmpty />
  return (
    <Card variant="solid" style={styles.chartCard}>
      <View style={styles.chartBox}>
        <CartesianChart
          data={rows}
          xKey="i"
          yKeys={['uniqueViewers', 'watchHours']}
          domainPadding={{ top: 16, bottom: 4 }}
          axisOptions={{
            font, lineColor: GRID, labelColor: INK_MUTED, tickCount: { x: 4, y: 4 },
            formatXLabel: (v) => { const r = rows[Math.round(Number(v))]; return r ? shortDate(r.date) : '' },
          }}
        >
          {({ points, chartBounds }) => (
            <>
              <Area points={points.uniqueViewers} y0={chartBounds.bottom} color={withAlpha(ACCENT, 0.18)} curveType="natural" />
              <Line points={points.uniqueViewers} color={ACCENT} strokeWidth={2} curveType="natural" />
              <Line points={points.watchHours} color={INK_MUTED} strokeWidth={2} curveType="natural" />
            </>
          )}
        </CartesianChart>
      </View>
      <Legend items={[{ color: ACCENT, label: 'Unique viewers' }, { color: INK_MUTED, label: 'Watch hours' }]} />
    </Card>
  )
}

function FollowerChart({ data }: { data: AnalyticsData }) {
  const font = useFont(AXIS_FONT, 9)
  const rows = toRows(data)
  if (rows.length === 0) return <ChartEmpty />
  return (
    <Card variant="solid" style={styles.chartCard}>
      <View style={styles.chartBox}>
        <CartesianChart
          data={rows}
          xKey="i"
          yKeys={['followers']}
          domainPadding={{ top: 16, bottom: 4 }}
          axisOptions={{
            font, lineColor: GRID, labelColor: INK_MUTED, tickCount: { x: 4, y: 4 },
            formatXLabel: (v) => { const r = rows[Math.round(Number(v))]; return r ? shortDate(r.date) : '' },
          }}
        >
          {({ points }) => <Line points={points.followers} color={ACCENT} strokeWidth={2.5} curveType="natural" />}
        </CartesianChart>
      </View>
    </Card>
  )
}

function RevenueChart({ data }: { data: AnalyticsData }) {
  const font = useFont(AXIS_FONT, 9)
  const rows = toRows(data)
  if (rows.length === 0) return <ChartEmpty />
  return (
    <Card variant="solid" style={styles.chartCard}>
      <View style={styles.chartBox}>
        <CartesianChart
          data={rows}
          xKey="i"
          yKeys={['tipsUsd', 'ppvUsd']}
          domainPadding={{ left: 20, right: 20, top: 16 }}
          axisOptions={{
            font, lineColor: GRID, labelColor: INK_MUTED, tickCount: { x: 4, y: 4 },
            formatXLabel: (v) => { const r = rows[Math.round(Number(v))]; return r ? shortDate(r.date) : '' },
            formatYLabel: (v) => `$${compact(Number(v))}`,
          }}
        >
          {({ points, chartBounds }) => (
            <StackedBar
              points={[points.tipsUsd, points.ppvUsd]}
              chartBounds={chartBounds}
              colors={[ACCENT, AMBER]}
              innerPadding={0.35}
            />
          )}
        </CartesianChart>
      </View>
      <Legend items={[{ color: ACCENT, label: 'Tips' }, { color: AMBER, label: 'PPV' }]} />
    </Card>
  )
}

function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <View style={styles.legend}>
      {items.map((it) => (
        <View key={it.label} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: it.color }]} />
          <Text variant="caption" color={theme.colors.text.muted}>{it.label}</Text>
        </View>
      ))}
    </View>
  )
}

// ─── Activity heatmap (pure View grid — direct port of web logic) ───────────

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
function ActivityHeatmap({ cells }: { cells: { dow: number; hour: number; count: number }[] }) {
  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))
  let max = 0
  for (const c of cells) {
    const gridRow = grid[c.dow]
    if (gridRow && c.dow >= 0 && c.dow < 7 && c.hour >= 0 && c.hour < 24) {
      gridRow[c.hour] = c.count
      if (c.count > max) max = c.count
    }
  }
  if (max === 0) {
    return (
      <Card variant="solid" style={styles.cardPad}>
        <View style={styles.inlineRow}>
          <Icon name="clock" size="sm" color={theme.colors.text.subtle} />
          <Text variant="caption" color={theme.colors.text.subtle}>No activity yet — this fills in as viewers join your streams.</Text>
        </View>
      </Card>
    )
  }
  const fill = (v: number) => (v === 0 ? 'rgba(26,22,18,0.05)' : withAlpha(ACCENT, 0.14 + (v / max) * 0.86))
  return (
    <Card variant="solid" style={styles.cardPad}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={styles.hmHeader}>
            <View style={styles.hmDayLabel} />
            {Array.from({ length: 24 }).map((_, h) => (
              <Text key={h} variant="monoLabel" color={theme.colors.text.subtle} style={styles.hmHour}>
                {h % 3 === 0 ? String(h) : ''}
              </Text>
            ))}
          </View>
          {grid.map((row, d) => (
            <View key={d} style={styles.hmRow}>
              <Text variant="caption" color={theme.colors.text.subtle} style={styles.hmDayLabel}>{DAYS[d]}</Text>
              {row.map((v, h) => (
                <View key={h} style={[styles.hmCell, { backgroundColor: fill(v) }]} />
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </Card>
  )
}

// ─── Small presentational helpers ───────────────────────────────────────────

function Kpi({ icon, label, value, sub, wide }: { icon: FeatherName; label: string; value: string; sub?: string; wide?: boolean }) {
  return (
    <Card variant="solid" style={[styles.kpi, wide ? styles.kpiWide : styles.kpiHalf]}>
      <View style={styles.kpiHead}>
        <View style={styles.iconTile}><Icon name={icon} size="sm" color={theme.colors.text.primary} /></View>
        <Text variant="monoLabel" color={theme.colors.text.subtle} numberOfLines={1} style={styles.flex1}>{label}</Text>
      </View>
      <Text variant="heading" numberOfLines={1}>{value}</Text>
      {sub && <Text variant="caption" color={theme.colors.text.subtle} numberOfLines={1}>{sub}</Text>}
    </Card>
  )
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="bodyEmphasized">{title}</Text>
      {subtitle && <Text variant="caption" color={theme.colors.text.subtle} style={styles.sectionSub}>{subtitle}</Text>}
      <View style={styles.sectionBody}>{children}</View>
    </View>
  )
}

function Row({ label, icon }: { label: string; icon: FeatherName }) {
  return (
    <View style={styles.cardHeadRow}>
      <View style={styles.iconTile}><Icon name={icon} size="sm" color={theme.colors.text.primary} /></View>
      <Text variant="monoLabel" color={theme.colors.text.subtle}>{label}</Text>
    </View>
  )
}

function Meter({ pct }: { pct: number }) {
  return (
    <View style={styles.meterTrack}>
      <View style={[styles.meterFill, { width: `${Math.min(100, Math.max(pct > 0 ? 1.5 : 0, pct))}%` }]} />
    </View>
  )
}

function CountryBars({ geo }: { geo: AnalyticsGeo[] }) {
  const max = Math.max(1, ...geo.map((g) => g.viewers))
  return (
    <View style={styles.gapTop}>
      {geo.slice(0, 8).map((g) => (
        <View key={g.countryCode} style={styles.barBlock}>
          <View style={styles.barLabelRow}>
            <Text variant="caption" numberOfLines={1} style={styles.flex1}>{flagEmoji(g.countryCode)} {countryName(g.countryCode)}</Text>
            <Text variant="monoValue" color={theme.colors.text.muted}>{g.viewers.toLocaleString()}</Text>
          </View>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${(g.viewers / max) * 100}%` }]} />
          </View>
        </View>
      ))}
    </View>
  )
}

type PersonRow = { id: string; handle: string; displayName: string | null; avatarUrl: string | null; primary: string; sub: string; metric: string; metricLabel: string }
function PeopleList({ rows }: { rows: PersonRow[] }) {
  return (
    <Card variant="solid">
      {rows.length === 0 && <Empty />}
      {rows.map((r, i) => (
        <View key={r.id} style={[styles.listRow, i > 0 && styles.borderTop]}>
          <Text variant="monoValue" color={theme.colors.text.subtle} style={styles.rank}>{i + 1}</Text>
          <Avatar size="sm" displayName={r.displayName || r.handle} avatarUrl={r.avatarUrl} />
          <View style={styles.flex1}>
            <Text variant="bodyEmphasized" numberOfLines={1}>{r.primary}</Text>
            <Text variant="caption" color={theme.colors.text.subtle} numberOfLines={1}>{r.sub}</Text>
          </View>
          <View style={styles.netCol}>
            <Text variant="bodyEmphasized" color={theme.colors.accent.default}>{r.metric}</Text>
            <Text variant="monoLabel" color={theme.colors.text.subtle}>{r.metricLabel.toUpperCase()}</Text>
          </View>
        </View>
      ))}
    </Card>
  )
}

function HealthStat({ label, value, tone }: { label: string; value: string; tone: 'primary' | 'accent' }) {
  return (
    <View style={styles.healthStat}>
      <Text variant="heading" color={tone === 'accent' ? theme.colors.accent.default : theme.colors.text.primary}>{value}</Text>
      <Text variant="monoLabel" color={theme.colors.text.subtle}>{label.toUpperCase()}</Text>
    </View>
  )
}

function StatusBadge({ status }: { status: string }) {
  const isLive = status === 'live'
  return (
    <View style={[styles.badge, isLive && styles.badgeLive]}>
      <Text variant="monoLabel" color={isLive ? theme.colors.accent.default : theme.colors.text.muted}>{status.toUpperCase()}</Text>
    </View>
  )
}

function Empty() {
  return (
    <View style={styles.emptyRow}>
      <Text variant="caption" color={theme.colors.text.subtle}>Nothing here yet.</Text>
    </View>
  )
}

function Gate({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView style={styles.root}>
      <ScreenHeader title="Analytics" onBack={() => router.back()} />
      <View style={styles.gate}>{children}</View>
    </SafeAreaView>
  )
}

// rgb()/#hex → rgba with alpha
function withAlpha(color: string, alpha: number): string {
  if (color.startsWith('#')) {
    const n = parseInt(color.slice(1), 16)
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
  }
  const m = color.match(/\d+/g)
  if (m && m.length >= 3) return `rgba(${m[0]}, ${m[1]}, ${m[2]}, ${alpha})`
  return color
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg.primary },
  content: { padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: theme.spacing.xxxl },

  // Gates
  gate: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.xl, gap: theme.spacing.sm },
  gateText: { textAlign: 'center' },
  gateBtn: { marginTop: theme.spacing.md, minWidth: 180 },
  upsellIcon: {
    width: 64, height: 64, borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.colors.accent.surface, borderWidth: 1, borderColor: theme.colors.accent.border, marginBottom: theme.spacing.md,
  },
  upsellTitle: { textAlign: 'center' },
  upsellBody: { textAlign: 'center', marginTop: theme.spacing.sm },

  // Toolbar
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  flex1: { flex: 1, minWidth: 0 },
  rangeWrap: { width: 180 },
  refreshBtn: { width: 44, paddingHorizontal: 0 },
  loading: { paddingVertical: theme.spacing.xxl, alignItems: 'center' },
  errorCard: { padding: theme.spacing.md },

  // KPI grid
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  tripleGrid: { gap: theme.spacing.sm },
  kpi: { padding: theme.spacing.md, gap: theme.spacing.xs },
  kpiHalf: { flexBasis: '47%', flexGrow: 1 },
  kpiWide: { width: '100%' },
  kpiHead: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  iconTile: {
    width: 28, height: 28, borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.colors.bg.panel,
  },

  note: { padding: theme.spacing.md },

  // Sections
  section: { gap: theme.spacing.xs, marginTop: theme.spacing.sm },
  sectionSub: { marginBottom: theme.spacing.xs },
  sectionBody: { gap: theme.spacing.sm },

  cardPad: { padding: theme.spacing.md, gap: theme.spacing.xs },
  cardHeadRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.xs },
  bigNum: { marginTop: theme.spacing.xs },
  storageRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: theme.spacing.xs },

  // Meter / bars
  meterTrack: { height: 8, borderRadius: theme.radius.full, backgroundColor: 'rgba(26,22,18,0.06)', overflow: 'hidden', marginTop: theme.spacing.sm },
  meterFill: { height: '100%', borderRadius: theme.radius.full, backgroundColor: theme.colors.accent.default },
  barBlock: { marginBottom: theme.spacing.sm },
  barLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  barTrack: { height: 6, borderRadius: theme.radius.full, backgroundColor: 'rgba(26,22,18,0.06)', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: theme.radius.full, backgroundColor: theme.colors.accent.default },
  gapTop: { marginTop: theme.spacing.sm },

  // Map
  mapCard: { padding: theme.spacing.xs },
  mapBox: { height: 320, borderRadius: theme.radius.md, overflow: 'hidden', backgroundColor: theme.colors.bg.panel },
  mapEmpty: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm },
  center: { textAlign: 'center' },

  // Cities
  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  cityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4, gap: theme.spacing.sm },
  giftRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: theme.spacing.sm },
  giftCell: { alignItems: 'center', gap: 2, flex: 1 },

  // Charts
  chartCard: { padding: theme.spacing.sm, gap: theme.spacing.sm },
  chartBox: { height: 220 },
  legend: { flexDirection: 'row', gap: theme.spacing.lg, paddingLeft: theme.spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },

  // Heatmap
  hmHeader: { flexDirection: 'row', marginBottom: 4, alignItems: 'center' },
  hmRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  hmDayLabel: { width: 32 },
  hmHour: { width: 18, textAlign: 'center' },
  hmCell: { width: 15, height: 14, borderRadius: 2, marginRight: 3 },

  // Lists
  listRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm },
  borderTop: { borderTopWidth: 1, borderTopColor: theme.colors.border.subtle },
  rank: { width: 16 },
  netCol: { alignItems: 'flex-end', minWidth: 56 },
  emptyRow: { paddingVertical: theme.spacing.lg, alignItems: 'center' },

  // Composition / health
  compRow: { flexDirection: 'row', alignItems: 'baseline', gap: theme.spacing.sm },
  splitBar: { height: 10, borderRadius: theme.radius.full, backgroundColor: 'rgba(26,22,18,0.10)', overflow: 'hidden', marginTop: theme.spacing.sm },
  splitFill: { height: '100%', backgroundColor: theme.colors.accent.default },
  splitLegend: { flexDirection: 'row', justifyContent: 'space-between', marginTop: theme.spacing.sm },
  healthRow: { flexDirection: 'row', gap: theme.spacing.sm },
  healthStat: { flex: 1, alignItems: 'center', paddingVertical: theme.spacing.sm, gap: 4, backgroundColor: 'rgba(26,22,18,0.03)', borderRadius: theme.radius.md },

  // Badge
  badge: { paddingHorizontal: theme.spacing.sm, paddingVertical: 2, borderRadius: theme.radius.full, backgroundColor: 'rgba(26,22,18,0.06)' },
  badgeLive: { backgroundColor: theme.colors.accent.surface },
})
