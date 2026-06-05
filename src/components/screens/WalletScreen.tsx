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

import { useState } from 'react'
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
import { ActionTilesRow } from '@/components/sections/ActionTilesRow'
import { CategoryChipRow } from '@/components/sections/CategoryChipRow'
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
  paid: 'Paid',
  rejected: 'Rejected',
}

function mapWalletTx(
  item: WalletTransaction,
): {
  kind: TransactionKind
  title: string
  sub?: string
  amount: number
  currency: 'sb' | 'sd'
  pending?: boolean
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
    const status = STATUS_LABEL[item.status ?? 'pending']
    return {
      kind: 'cashout',
      title: 'Payout',
      sub: `${status} · ${date}`,
      amount: item.amount,
      currency: 'sd',
      pending: item.status === 'pending',
    }
  }
  if (item.type === 'spaceBucksSpent') {
    return {
      kind: 'tip-sent',
      title: `Tip to @${item.counterpartHandle ?? 'unknown'}`,
      sub: [item.streamTitle, date].filter(Boolean).join(' · '),
      amount: item.amount,
      currency: 'sb',
    }
  }
  return {
    kind: 'tip-received',
    title: `Tip from @${item.counterpartHandle ?? 'unknown'}`,
    sub: [item.streamTitle, date].filter(Boolean).join(' · '),
    amount: item.amount,
    currency: 'sd',
  }
}

export function WalletScreen() {
  const { isSignedIn } = useAuth()
  const { data, isLoading, isError, refetch } = useWallet()
  const [filter, setFilter] = useState<string | null>(null)

  if (!isSignedIn) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Wallet" style={styles.walletHeaderPad} />
        <View style={styles.center}>
          <Text variant="body" color={theme.colors.text.muted}>
            Sign in to view your wallet
          </Text>
          <Button label="Sign in" onPress={() => router.push('/(auth)/login')} />
        </View>
      </SafeAreaView>
    )
  }

  if (isError) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Wallet" style={styles.walletHeaderPad} />
        <View style={styles.center}>
          <Text variant="body" color={theme.colors.text.primary}>No connection</Text>
          <Text variant="caption" color={theme.colors.text.muted} style={styles.centerText}>
            Check your internet connection and try again.
          </Text>
          <Pressable onPress={() => refetch()} style={styles.retryBtn}>
            <Text variant="monoLabel" color={theme.colors.accent.default}>Try again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  if (isLoading || !data) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Wallet" style={styles.walletHeaderPad} />
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.accent.default} />
        </View>
      </SafeAreaView>
    )
  }

  const transactions = data.transactions.filter(
    (t) => filter === null || t.type === (filter as FilterKey),
  )

  const header = (
    <View style={styles.headerStack}>
      <PursesCard spaceBucks={data.spaceBucks} starDust={data.stardust} />

      <ActionTilesRow
        cols={2}
        tiles={[
          {
            id: 'topup',
            iconName: 'plus-circle',
            title: 'Top up',
            descriptor: 'Buy Space Bucks',
            onPress: () => router.push('/(app)/topup'),
            primary: true,
          },
          {
            id: 'cashout',
            iconName: 'arrow-down-circle',
            title: 'Cash out',
            descriptor: 'Stardust → cash',
            onPress: () => router.push('/(app)/cashout'),
          },
        ]}
      />

      <CategoryChipRow
        categories={FILTER_CATEGORIES}
        value={filter}
        onChange={setFilter}
      />
    </View>
  )

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Wallet" style={styles.walletHeaderPad} />
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
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg.primary },
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
