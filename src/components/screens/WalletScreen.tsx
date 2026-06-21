// src/components/screens/WalletScreen.tsx
//
// 12.6 migration target. Wallet hero + quick-actions + filter +
// transaction list compose entirely from design-system features:
//
//   • PursesCard (variant=dual) replaces the two bespoke balance
//     cards. Both currencies render in the accent treatment per the
//     single-accent rule; 🚀 / ✨ glyphs distinguish them. Removes
//     the bespoke gold (#F59E0B) treatment for Stardust.
//   • ActionTilesRow (cols=2) replaces the bespoke Top-Up + Cash-Out
//     buttons. Top up carries the `primary` flag so it picks up the
//     accent emphasis.
//   • CategoryChipRow replaces the bespoke horizontal filter tabs.
//   • TransactionRow (feature) replaces the bespoke txRow rendering;
//     mapWalletTx maps the v0.2 WalletTransaction shape into the
//     feature's consumer-flat shape.
//   • Empty state composes Card-style surface + Icon + Text + Button.

import { useState, type ReactNode } from 'react'
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ScreenHeader } from '@/components/sections/ScreenHeader'
import { router } from 'expo-router'
import { useAuth } from '@clerk/clerk-expo'
import { theme } from '@/tokens/theme'
import { useWallet } from '@/hooks/useWallet'
import { Text } from '@/components/primitives/Text'
import { Button } from '@/components/primitives/Button'
import { Icon } from '@/components/primitives/Icon'
import { PursesCard } from '@/components/features/wallet/PursesCard'
import {
  TransactionRow,
  type TransactionKind,
} from '@/components/features/wallet/TransactionRow'
import { CategoryChipRow } from '@/components/sections/CategoryChipRow'
import { PageTabs } from '@/components/features/navigation/PageTabs'
import { TopUpPanel } from '@/components/sections/TopUpPanel'
import { CashOutPanel } from '@/components/sections/CashOutPanel'
import type { WalletTransaction } from '@/types'

type FilterKey = WalletTransaction['type']

const FILTER_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'spaceBucksSpent', label: 'Tips sent' },
  { id: 'stardustEarned', label: 'Tips received' },
  { id: 'topup', label: 'Top ups' },
  { id: 'cashout', label: 'Payouts' },
]

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  paying: 'Processing',
  paid: 'Paid',
  rejected: 'Rejected',
  failed: 'Failed',
}
// Pill tone per status: 'wait' (amber, in progress), 'bad' (accent, refunded), or
// none for the completed 'paid'. Unknown statuses fall back to 'wait' so a future
// backend status never renders blank/"undefined".
const STATUS_TONE: Record<string, 'wait' | 'bad' | undefined> = {
  pending: 'wait',
  paying: 'wait',
  paid: undefined,
  rejected: 'bad',
  failed: 'bad',
}

function mapWalletTx(
  item: WalletTransaction,
): {
  kind: TransactionKind
  title: string
  sub?: string
  message?: string | null
  amount: number
  currency: 'sb' | 'sd'
  pending?: boolean
  statusLabel?: string
  statusTone?: 'wait' | 'bad'
} {
  const date = formatDate(item.createdAt)
  if (item.type === 'topup') {
    const price =
      item.priceCents != null ? `$${(item.priceCents / 100).toFixed(2)}` : undefined
    return {
      kind: 'topup',
      title: 'Top up',
      sub: [price && `${price} · test mode`, date].filter(Boolean).join(' · '),
      amount: item.amount,
      currency: 'sb',
    }
  }
  if (item.type === 'cashout') {
    const s = item.status ?? 'pending'
    const label = STATUS_LABEL[s] ?? 'Pending'
    const tone = s in STATUS_TONE ? STATUS_TONE[s] : 'wait'
    return {
      kind: 'cashout',
      title: 'Payout',
      sub: `${label} · ${date}`,
      amount: item.amount,
      currency: 'sd',
      statusLabel: tone ? label : undefined,
      statusTone: tone,
    }
  }
  if (item.type === 'spaceBucksSpent') {
    return {
      kind: 'tip-sent',
      title: `Tip to @${item.counterpartHandle ?? 'unknown'}`,
      sub: [item.streamTitle, date].filter(Boolean).join(' · '),
      message: item.message,
      amount: item.amount,
      currency: 'sb',
    }
  }
  return {
    kind: 'tip-received',
    title: `Tip from @${item.counterpartHandle ?? 'unknown'}`,
    sub: [item.streamTitle, date].filter(Boolean).join(' · '),
    message: item.message,
    amount: item.amount,
    currency: 'sd',
  }
}

// When embedded (e.g. as the Wallet tab of the Me page) the host owns the
// safe-area frame + top header, so we drop our own SafeAreaView + ScreenHeader
// to avoid doubling the chrome.
function WalletFrame({ embedded, children }: { embedded: boolean; children: ReactNode }) {
  if (embedded) return <View style={styles.embeddedRoot}>{children}</View>
  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Wallet" style={styles.walletHeaderPad} />
      {children}
    </SafeAreaView>
  )
}

export function WalletScreen({ embedded = false }: { embedded?: boolean } = {}) {
  const { isSignedIn } = useAuth()
  const { data, isLoading, isError, refetch } = useWallet()
  const [filter, setFilter] = useState<string | null>(null)
  // Hybrid-nav prototype: Balance / Top Up / Cash Out as in-place page-tabs
  // instead of separate routes with back arrows.
  const [tab, setTab] = useState<'balance' | 'topup' | 'cashout'>('balance')

  if (!isSignedIn) {
    return (
      <WalletFrame embedded={embedded}>
        <View style={styles.center}>
          <Text variant="body" color={theme.colors.text.muted}>
            Sign in to view your wallet
          </Text>
          <Button label="Sign in" onPress={() => router.push('/(auth)/login')} />
        </View>
      </WalletFrame>
    )
  }

  if (isError) {
    return (
      <WalletFrame embedded={embedded}>
        <View style={styles.center}>
          <Text variant="body" color={theme.colors.text.primary}>No connection</Text>
          <Text variant="caption" color={theme.colors.text.muted} style={styles.centerText}>
            Check your internet connection and try again.
          </Text>
          <Pressable onPress={() => refetch()} style={styles.retryBtn}>
            <Text variant="monoLabel" color={theme.colors.accent.default}>Try again</Text>
          </Pressable>
        </View>
      </WalletFrame>
    )
  }

  if (isLoading || !data) {
    return (
      <WalletFrame embedded={embedded}>
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.accent.default} />
        </View>
      </WalletFrame>
    )
  }

  const transactions = data.transactions.filter(
    (t) => filter === null || t.type === (filter as FilterKey),
  )

  const header = (
    <View style={styles.headerStack}>
      <PursesCard spaceBucks={data.spaceBucks} starDust={data.stardust} />

      <CategoryChipRow
        categories={FILTER_CATEGORIES}
        value={filter}
        onChange={setFilter}
      />
    </View>
  )

  return (
    <WalletFrame embedded={embedded}>
      <PageTabs
        tabs={[
          { key: 'balance', label: 'Balance' },
          { key: 'topup', label: 'Top Up' },
          { key: 'cashout', label: 'Cash Out' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'balance' && (
        <FlatList
          data={transactions}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => {
            const props = mapWalletTx(item)
            return <TransactionRow {...props} />
          }}
          ListHeaderComponent={header}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIconFrame}>
                <Icon name="credit-card" size="lg" color={theme.colors.accent.default} />
              </View>
              <Text variant="heading" style={styles.center}>
                No transactions yet
              </Text>
              <Text
                variant="body"
                color={theme.colors.text.muted}
                style={styles.center}
              >
                Top up or tip a streamer to get started
              </Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      {tab === 'topup' && <TopUpPanel onDone={() => setTab('balance')} />}
      {tab === 'cashout' && <CashOutPanel onDone={() => setTab('balance')} />}
    </WalletFrame>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg.primary },
  embeddedRoot: { flex: 1, backgroundColor: theme.colors.bg.primary },
  // Fixed brand header offset — matches the globe / dashboard (safe-area-top + sm).
  walletHeaderPad: { paddingTop: theme.spacing.sm },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    textAlign: 'center',
    padding: theme.spacing.xl,
  },
  centerText: {
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.accent.default,
  },
  listContent: {
    paddingBottom: theme.spacing.xxxl,
    paddingHorizontal: theme.spacing.lg,
  },
  headerStack: {
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
    gap: theme.spacing.lg,
  },
  separator: {
    height: 1,
    backgroundColor: theme.colors.border.subtle,
  },
  empty: {
    paddingVertical: theme.spacing.xxl,
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  emptyIconFrame: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.accent.surface,
    borderWidth: 2,
    borderColor: theme.colors.accent.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.xs,
  },
})
