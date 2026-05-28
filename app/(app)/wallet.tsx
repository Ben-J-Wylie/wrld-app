import { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useAuth } from '@clerk/clerk-expo'
import { theme } from '@/lib/theme'
import { useWallet } from '@/hooks/useWallet'
import { Button } from '@/components/ui/Button'
import type { WalletTransaction } from '@/types'

const SPACE_BUCKS_PER_DOLLAR = 100

type FilterKey = 'all' | 'spaceBucksSpent' | 'stardustEarned'

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'spaceBucksSpent', label: 'Space Bucks spent' },
  { key: 'stardustEarned', label: 'Stardust earned' },
]

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function TransactionRow({ item }: { item: WalletTransaction }) {
  const isSpent = item.type === 'spaceBucksSpent'
  const dollars = `$${(item.amount / SPACE_BUCKS_PER_DOLLAR).toFixed(2)}`

  return (
    <View style={styles.txRow}>
      <View style={[styles.txIcon, isSpent ? styles.txIconSpent : styles.txIconEarned]}>
        <Text style={styles.txIconEmoji}>{isSpent ? '🚀' : '✨'}</Text>
      </View>
      <View style={styles.txMiddle}>
        <Text style={styles.txTitle} numberOfLines={1}>
          {isSpent ? `Tip to @${item.counterpartHandle}` : `Tip from @${item.counterpartHandle}`}
        </Text>
        <Text style={styles.txSub} numberOfLines={1}>{item.streamTitle}</Text>
        <Text style={styles.txDate}>{formatDate(item.createdAt)}</Text>
      </View>
      <View style={styles.txRight}>
        <Text style={[styles.txAmount, isSpent ? styles.txAmountSpent : styles.txAmountEarned]}>
          {isSpent ? `−${item.amount} 🚀` : `+${item.amount} ✨`}
        </Text>
        <Text style={styles.txDollars}>{dollars}</Text>
      </View>
    </View>
  )
}

export default function Wallet() {
  const { isSignedIn } = useAuth()
  const { data, isLoading } = useWallet()
  const [filter, setFilter] = useState<FilterKey>('all')

  if (!isSignedIn) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.muted}>Sign in to view your wallet</Text>
          <Button label="Sign in" onPress={() => router.push('/(auth)/login')} style={styles.btn} />
        </View>
      </SafeAreaView>
    )
  }

  if (isLoading || !data) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      </SafeAreaView>
    )
  }

  const transactions = data.transactions.filter(
    (t) => filter === 'all' || t.type === filter,
  )

  const counts: Record<FilterKey, number> = {
    all: data.transactions.length,
    spaceBucksSpent: data.transactions.filter((t) => t.type === 'spaceBucksSpent').length,
    stardustEarned: data.transactions.filter((t) => t.type === 'stardustEarned').length,
  }

  const header = (
    <>
      {/* Balance cards */}
      <View style={styles.cardsRow}>
        {/* Space Bucks */}
        <View style={[styles.card, styles.cardBlue]}>
          <Text style={styles.cardLabel}>SPACE BUCKS</Text>
          <Text style={styles.cardAmount}>{data.spaceBucks.toLocaleString()} 🚀</Text>
          <Text style={styles.cardSub}>${(data.spaceBucks / SPACE_BUCKS_PER_DOLLAR).toFixed(2)}</Text>
          <Text style={styles.cardNote}>spend-only</Text>
        </View>

        {/* Stardust */}
        <View style={[styles.card, styles.cardGold]}>
          <Text style={styles.cardLabel}>STARDUST</Text>
          <Text style={styles.cardAmount}>{data.stardust.toLocaleString()} ✨</Text>
          <Text style={styles.cardSub}>${(data.stardust / SPACE_BUCKS_PER_DOLLAR).toFixed(2)}</Text>
          <Text style={styles.cardNote}>redeemable</Text>
        </View>
      </View>

      {/* Action buttons */}
      <View style={styles.actionsRow}>
        <Pressable
          style={[styles.actionBtn, styles.actionBtnBlue]}
          onPress={() => Alert.alert('Coming soon', 'Space Bucks top-ups will be available in a future update.')}
        >
          <Text style={styles.actionBtnIcon}>＋</Text>
          <Text style={styles.actionBtnLabel}>Top up</Text>
          <Text style={styles.actionBtnSub}>BUY SPACE BUCKS</Text>
        </Pressable>

        <Pressable
          style={[styles.actionBtn, styles.actionBtnGold]}
          onPress={() => Alert.alert('Coming soon', 'Stardust cash-out will be available in a future update.')}
        >
          <Text style={styles.actionBtnIcon}>💸</Text>
          <Text style={styles.actionBtnLabel}>Cash out</Text>
          <Text style={styles.actionBtnSub}>STARDUST → CASH</Text>
        </Pressable>
      </View>

      {/* Filter tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {FILTERS.map((f) => (
          <Pressable
            key={f.key}
            style={[styles.filterTab, filter === f.key && styles.filterTabActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterTabText, filter === f.key && styles.filterTabTextActive]}>
              {f.label}{counts[f.key] > 0 ? ` ${counts[f.key]}` : ''}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.divider} />
    </>
  )

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>Wallet</Text>
        </View>
      </View>

      <FlatList
        data={transactions}
        keyExtractor={(t) => t.id}
        renderItem={({ item }) => <TransactionRow item={item} />}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No transactions yet</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  )
}

const GOLD = '#F59E0B'
const GOLD_BG = '#2A1F00'

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.md },
  muted: { ...theme.typography.body, color: theme.colors.textMuted },
  btn: { width: 160 },

  pageHeader: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
  },
  pageTitle: { ...theme.typography.title, color: theme.colors.text },

  listContent: { paddingBottom: theme.spacing.xl },

  // Balance cards
  cardsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  card: {
    flex: 1,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    gap: 2,
  },
  cardBlue: { backgroundColor: '#0D1830', borderWidth: 1, borderColor: `${theme.colors.accent}55` },
  cardGold: { backgroundColor: GOLD_BG, borderWidth: 1, borderColor: `${GOLD}55` },
  cardLabel: { ...theme.typography.caption, color: theme.colors.textMuted, fontWeight: '700', letterSpacing: 1 },
  cardAmount: { ...theme.typography.heading, color: theme.colors.text, marginTop: 4 },
  cardSub: { ...theme.typography.caption, color: theme.colors.textMuted },
  cardNote: { ...theme.typography.caption, color: theme.colors.textMuted, marginTop: 4, fontStyle: 'italic' },

  // Action buttons
  actionsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  actionBtn: {
    flex: 1,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    alignItems: 'center',
    gap: 2,
  },
  actionBtnBlue: { backgroundColor: theme.colors.accent },
  actionBtnGold: { backgroundColor: GOLD },
  actionBtnIcon: { fontSize: 22 },
  actionBtnLabel: { ...theme.typography.body, color: '#fff', fontWeight: '700' },
  actionBtnSub: { ...theme.typography.caption, color: 'rgba(255,255,255,0.7)', fontWeight: '600', letterSpacing: 0.5 },

  // Filter tabs
  filterRow: { paddingHorizontal: theme.spacing.lg, gap: theme.spacing.sm, paddingBottom: theme.spacing.md },
  filterTab: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterTabActive: { borderColor: theme.colors.accent, backgroundColor: `${theme.colors.accent}22` },
  filterTabText: { ...theme.typography.caption, color: theme.colors.textMuted, fontWeight: '600' },
  filterTabTextActive: { color: theme.colors.accent },

  divider: { height: 1, backgroundColor: theme.colors.border, marginBottom: theme.spacing.sm },

  // Transaction rows
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.md,
  },
  txIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txIconSpent: { backgroundColor: `${theme.colors.accent}22` },
  txIconEarned: { backgroundColor: `${GOLD}22` },
  txIconEmoji: { fontSize: 20 },
  txMiddle: { flex: 1, gap: 2 },
  txTitle: { ...theme.typography.body, color: theme.colors.text, fontWeight: '600' },
  txSub: { ...theme.typography.caption, color: theme.colors.textMuted },
  txDate: { ...theme.typography.caption, color: theme.colors.textMuted },
  txRight: { alignItems: 'flex-end', gap: 2 },
  txAmount: { ...theme.typography.body, fontWeight: '700' },
  txAmountSpent: { color: theme.colors.textMuted },
  txAmountEarned: { color: GOLD },
  txDollars: { ...theme.typography.caption, color: theme.colors.textMuted },

  separator: { height: 1, backgroundColor: theme.colors.border, marginLeft: 76 },

  empty: { paddingVertical: theme.spacing.xl, alignItems: 'center' },
  emptyText: { ...theme.typography.body, color: theme.colors.textMuted },
})
