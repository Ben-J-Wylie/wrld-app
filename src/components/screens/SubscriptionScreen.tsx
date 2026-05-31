// src/components/screens/SubscriptionScreen.tsx
//
// 12.6 migration target. The pre-migration screen used a cool/dark
// palette with a blue accent (#3ea7ff) hardcoded throughout — flagged
// in CLAUDE.md as the canonical token-shape migration target.
//
// Composes:
//   • ScreenScroll for the scroll viewport (replaces SafeAreaView +
//     ScrollView).
//   • SegmentedToggle for Monthly / Annual billing (replaces the
//     bespoke animated pill).
//   • Card primitive for the three tier cards; `accent` variant covers
//     the Plus highlight + the current-tier highlight.
//   • Pill for the MOST POPULAR badge.
//   • Button for the CTAs (with the existing "coming soon" alert).
//   • Text / HelpText / Icon for every other label.
//
// All colors flow through the warm crimson accent + cream palette
// tokens; no hex literals.

import { useState } from 'react'
import { Alert, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { theme } from '@/tokens/theme'
import { ScreenScroll } from '@/components/sections/ScreenScroll'
import { Card } from '@/components/primitives/Card'
import { Button } from '@/components/primitives/Button'
import { Pill } from '@/components/primitives/Pill'
import { Text } from '@/components/primitives/Text'
import { HelpText } from '@/components/primitives/HelpText'
import { Icon } from '@/components/primitives/Icon'
import { IconButton } from '@/components/primitives/IconButton'
import { SegmentedToggle } from '@/components/primitives/SegmentedToggle'
import { useAuthStore } from '@/stores/authStore'

type BillingCycle = 'monthly' | 'annual'
type Tier = 'free' | 'plus' | 'pro'

const PRICING = {
  plus: { mo: 5, yr: 48 },
  pro: { mo: 20, yr: 192 },
}

const PERKS: Record<Tier, string[]> = {
  free: [
    'Go live & collect tips',
    'Discover local live music',
    'A handful of saved streams',
  ],
  plus: [
    'Everything in Free, ad-free',
    'More saved streams & better analytics',
    'Limited multi-camera',
    'Better discovery & moderation',
  ],
  pro: [
    'Everything in Plus',
    'Pay-per-view & channel subscriptions',
    'Full multi-camera',
    'AI moderation & pro analytics',
  ],
}

const TAGLINE: Record<Tier, string> = {
  free: 'START HERE',
  plus: 'FOR REGULARS',
  pro: 'FOR CREATORS',
}

const TIER_LABEL: Record<Tier, string> = {
  free: 'Free',
  plus: 'Plus',
  pro: 'Pro',
}

type MatrixValue = boolean | string

const MATRIX: { f: string; free: MatrixValue; plus: MatrixValue; pro: MatrixValue }[] = [
  { f: 'Ads', free: true, plus: false, pro: false },
  { f: 'Go Live', free: true, plus: true, pro: true },
  { f: 'Receive Tips', free: true, plus: true, pro: true },
  { f: 'Send Tips', free: true, plus: true, pro: true },
  { f: 'Saved Streams', free: '1 GB', plus: '50 GB', pro: '500 GB' },
  { f: 'Archive Retention', free: '30 Days', plus: 'Permanent', pro: 'Permanent' },
  { f: 'Analytics', free: 'Basic', plus: 'Enhanced', pro: 'Advanced' },
  { f: 'Stream Scheduling', free: false, plus: true, pro: true },
  { f: 'Custom Profile URL', free: false, plus: true, pro: true },
  { f: 'Multi-Camera Streaming', free: false, plus: 'Limited (2 cameras)', pro: 'Full' },
  { f: 'Discovery Tools', free: 'Basic', plus: 'Enhanced', pro: 'Priority' },
  { f: 'Moderation Tools', free: 'Basic', plus: 'Advanced', pro: 'AI-Assisted' },
  { f: 'Add Moderators', free: false, plus: true, pro: true },
  { f: 'Slow Mode / Chat Controls', free: false, plus: true, pro: true },
  { f: 'Creator Badges', free: false, plus: true, pro: 'Premium' },
  { f: 'Lower Platform Fee on Tips', free: false, plus: true, pro: 'Best Rate' },
  { f: 'Channel Subscriptions', free: false, plus: false, pro: true },
  { f: 'PPV Events', free: false, plus: false, pro: true },
  { f: 'Subscriber-Only Streams', free: false, plus: false, pro: true },
  { f: 'Subscriber-Only Chat', free: false, plus: false, pro: true },
  { f: 'Audience Demographics', free: false, plus: false, pro: true },
  { f: 'Revenue Analytics', free: false, plus: false, pro: true },
  { f: 'Priority Creator Support', free: false, plus: false, pro: true },
]

export function SubscriptionScreen() {
  const wrldUser = useAuthStore((s) => s.wrldUser)
  const currentTier: Tier = (wrldUser?.tier as Tier) ?? 'free'
  const [billing, setBilling] = useState<BillingCycle>('monthly')
  const [compareOpen, setCompareOpen] = useState(false)
  const annual = billing === 'annual'

  function price(tier: 'plus' | 'pro') {
    const p = PRICING[tier]
    if (annual)
      return {
        amt: `$${p.yr}`,
        per: '/year',
        eq: `$${(p.yr / 12).toFixed(0)}/mo billed yearly`,
      }
    return { amt: `$${p.mo}`, per: '/month', eq: '' }
  }

  function handlePaidTierPress(tier: 'plus' | 'pro') {
    if (currentTier === tier) return
    Alert.alert(
      `${TIER_LABEL[tier]} coming soon`,
      'Paid plans will be available shortly. Your account will be upgraded automatically when billing launches.',
      [{ text: 'Got it' }],
    )
  }

  const plus = price('plus')
  const pro = price('pro')

  return (
    <ScreenScroll contentContainerStyle={styles.scroll}>
      <View style={styles.headerRow}>
        <View style={styles.headerCol}>
          <HelpText tone="ok">WELCOME TO WRLD</HelpText>
          <Text variant="display">Choose your WRLD</Text>
        </View>
        <IconButton
          name="arrow-left"
          variant="ghost"
          onPress={() => router.back()}
          accessibilityLabel="Back"
        />
      </View>
      <Text variant="body" color={theme.colors.text.muted}>
        Start free and upgrade whenever you want more reach, more cameras, and more ways to earn.
      </Text>

      <View style={styles.billingBlock}>
        <SegmentedToggle<BillingCycle>
          options={[
            { value: 'monthly', label: 'Monthly' },
            { value: 'annual', label: 'Annual · SAVE 20%' },
          ]}
          value={billing}
          onChange={setBilling}
        />
        {annual && (
          <HelpText tone="ok" style={styles.billingNote}>
            TWO MONTHS FREE WHEN YOU PAY YEARLY
          </HelpText>
        )}
      </View>

      <TierCard
        tier="free"
        amount="Free"
        per="forever"
        equivalence={null}
        currentTier={currentTier}
        onPress={undefined}
      />

      <View style={styles.plusWrap}>
        <Pill size="sm" variant="accent" label="★ MOST POPULAR" />
        <TierCard
          tier="plus"
          amount={plus.amt}
          per={plus.per}
          equivalence={plus.eq || null}
          currentTier={currentTier}
          onPress={() => handlePaidTierPress('plus')}
          accent
        />
      </View>

      <TierCard
        tier="pro"
        amount={pro.amt}
        per={pro.per}
        equivalence={pro.eq || null}
        currentTier={currentTier}
        onPress={() => handlePaidTierPress('pro')}
      />

      <Button
        variant="secondary"
        label={compareOpen ? 'Hide comparison' : 'Compare all features'}
        icon={compareOpen ? 'chevron-up' : 'chevron-down'}
        onPress={() => setCompareOpen((o) => !o)}
      />

      {compareOpen && <ComparisonMatrix plusPrice={plus.amt} proPrice={pro.amt} />}

      <HelpText style={styles.legal}>
        PLANS RENEW AUTOMATICALLY UNTIL CANCELLED · CANCEL ANYTIME IN YOUR STORE ACCOUNT
      </HelpText>
    </ScreenScroll>
  )
}

// ─── Tier card ───────────────────────────────────────────────────────────────

function TierCard({
  tier,
  amount,
  per,
  equivalence,
  currentTier,
  onPress,
  accent,
}: {
  tier: Tier
  amount: string
  per: string
  equivalence: string | null
  currentTier: Tier
  onPress: (() => void) | undefined
  accent?: boolean
}) {
  const isCurrent = currentTier === tier
  const isFree = tier === 'free'
  const ctaLabel = isCurrent
    ? 'Your current plan'
    : isFree
      ? 'Continue with Free'
      : `Choose ${TIER_LABEL[tier]}`

  return (
    <Card variant={accent || isCurrent ? 'accent' : 'panel'} style={cardStyles.card}>
      <View style={cardStyles.top}>
        <View style={cardStyles.col}>
          <Text variant="heading">{TIER_LABEL[tier]}</Text>
          <HelpText>{TAGLINE[tier]}</HelpText>
        </View>
        <View style={cardStyles.priceBlock}>
          <Text variant="heading">{amount}</Text>
          <HelpText>{per.toUpperCase()}</HelpText>
          {equivalence && (
            <HelpText style={cardStyles.equivalence}>{equivalence.toUpperCase()}</HelpText>
          )}
        </View>
      </View>
      <View style={cardStyles.perks}>
        {PERKS[tier].map((p, i) => (
          <View key={i} style={cardStyles.perkRow}>
            <View style={cardStyles.checkCircle}>
              <Icon name="check" size={10} color={theme.colors.accent.default} />
            </View>
            <Text variant="body" color={theme.colors.text.primary} style={cardStyles.perkText}>
              {p}
            </Text>
          </View>
        ))}
      </View>
      {onPress ? (
        <Button
          variant={isCurrent ? 'secondary' : 'primary'}
          label={ctaLabel}
          onPress={onPress}
          disabled={isCurrent}
        />
      ) : (
        <Button
          variant="secondary"
          label={ctaLabel}
          onPress={() => {}}
          disabled
        />
      )}
    </Card>
  )
}

// ─── Comparison matrix ───────────────────────────────────────────────────────

function ComparisonMatrix({ plusPrice, proPrice }: { plusPrice: string; proPrice: string }) {
  return (
    <Card variant="solid" style={matrixStyles.matrix}>
      <View style={[matrixStyles.row, matrixStyles.headerRow]}>
        <View style={matrixStyles.featCell}>
          <HelpText>FEATURE</HelpText>
        </View>
        <View style={matrixStyles.cell}>
          <Text variant="bodyEmphasized">Free</Text>
        </View>
        <View style={matrixStyles.cell}>
          <Text variant="bodyEmphasized" color={theme.colors.accent.default}>
            Plus
          </Text>
          <HelpText>{plusPrice}</HelpText>
        </View>
        <View style={matrixStyles.cell}>
          <Text variant="bodyEmphasized">Pro</Text>
          <HelpText>{proPrice}</HelpText>
        </View>
      </View>
      {MATRIX.map((row, i) => (
        <View key={i} style={[matrixStyles.row, matrixStyles.borderTop]}>
          <View style={matrixStyles.featCell}>
            <Text variant="body" color={theme.colors.text.primary}>
              {row.f}
            </Text>
          </View>
          <MatrixCell v={row.free} />
          <MatrixCell v={row.plus} isPlus />
          <MatrixCell v={row.pro} />
        </View>
      ))}
    </Card>
  )
}

function MatrixCell({ v, isPlus }: { v: MatrixValue; isPlus?: boolean }) {
  if (v === true)
    return (
      <View style={matrixStyles.cell}>
        <View style={matrixStyles.check}>
          <Icon name="check" size="sm" color={theme.colors.accent.default} />
        </View>
      </View>
    )
  if (v === false)
    return (
      <View style={matrixStyles.cell}>
        <Text variant="body" color={theme.colors.text.subtle}>
          —
        </Text>
      </View>
    )
  return (
    <View style={matrixStyles.cell}>
      <Text
        variant="monoCaption"
        color={isPlus ? theme.colors.accent.default : theme.colors.text.muted}
      >
        {v}
      </Text>
    </View>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: {
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
    paddingBottom: theme.spacing.xxxl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  headerCol: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  billingBlock: {
    gap: theme.spacing.sm,
  },
  billingNote: {
    textAlign: 'center',
  },
  plusWrap: {
    gap: theme.spacing.xs,
  },
  legal: {
    textAlign: 'center',
    marginTop: theme.spacing.md,
  },
})

const cardStyles = StyleSheet.create({
  card: {
    gap: theme.spacing.md,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
  },
  col: {
    flex: 1,
    gap: 2,
  },
  priceBlock: {
    alignItems: 'flex-end',
    gap: 2,
  },
  equivalence: {
    marginTop: 2,
  },
  perks: {
    gap: theme.spacing.sm,
  },
  perkRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    alignItems: 'flex-start',
  },
  checkCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: theme.colors.accent.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  perkText: {
    flex: 1,
  },
})

const matrixStyles = StyleSheet.create({
  matrix: {
    padding: 0,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  headerRow: {
    paddingVertical: theme.spacing.md,
  },
  borderTop: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.subtle,
  },
  featCell: {
    flex: 1.4,
  },
  cell: {
    flex: 0.85,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  check: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.colors.accent.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
