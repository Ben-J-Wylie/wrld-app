// src/components/features/onboarding/LegalAcceptanceCard.tsx
//
// Card containing the three legal-document links + a jurisdiction
// badge + jurisdiction-specific consent toggles + an "Agree &
// Continue" button. Three variants:
//
//   default  — US / ROW: no consent toggles
//   eu-gdpr  — adds Essential (locked-on) + Analytics + Personalization
//   ca-ccpa  — adds Essential (locked-on) + Do Not Sell
//
// Detection of jurisdiction is the consumer's job (locale + IP
// heuristic at runtime); the card just renders the right variant +
// emits the resolved consent settings on submit.

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Text } from '@/components/primitives/Text'
import { Button } from '@/components/primitives/Button'
import { LegalLinkList, type LegalDoc } from '@/components/sections/LegalLinkList'
import { ConsentRow } from './ConsentRow'
import { theme } from '@/tokens/theme'

export type LegalVariant = 'default' | 'eu-gdpr' | 'ca-ccpa'

export type LegalConsents = {
  essential: true
  analytics?: boolean
  personalization?: boolean
  doNotSell?: boolean
}

type Props = {
  variant?: LegalVariant
  docs: LegalDoc[]
  consents: LegalConsents
  onConsentsChange: (next: LegalConsents) => void
  onAgree: () => void
  loading?: boolean
  style?: StyleProp<ViewStyle>
}

const BADGE_LABEL: Record<LegalVariant, string> = {
  default: 'US / REST OF WORLD',
  'eu-gdpr': 'EU · GDPR',
  'ca-ccpa': 'CA · CCPA',
}

export function LegalAcceptanceCard({
  variant = 'default',
  docs,
  consents,
  onConsentsChange,
  onAgree,
  loading,
  style,
}: Props) {
  return (
    <View style={[styles.card, style]}>
      <View style={styles.badge}>
        <Text variant="monoLabel" color={theme.colors.accent.default}>
          {BADGE_LABEL[variant]}
        </Text>
      </View>
      <LegalLinkList docs={docs} />
      {variant === 'eu-gdpr' && (
        <View style={styles.consents}>
          <ConsentRow
            title="Essential"
            description="Required for the app to work"
            on
            onToggle={() => {}}
            locked
          />
          <ConsentRow
            title="Analytics"
            description="Help us understand how Wrld is used"
            on={!!consents.analytics}
            onToggle={(v) => onConsentsChange({ ...consents, analytics: v })}
          />
          <ConsentRow
            title="Personalization"
            description="Show me streams I might like"
            on={!!consents.personalization}
            onToggle={(v) => onConsentsChange({ ...consents, personalization: v })}
          />
        </View>
      )}
      {variant === 'ca-ccpa' && (
        <View style={styles.consents}>
          <ConsentRow
            title="Essential"
            description="Required for the app to work"
            on
            onToggle={() => {}}
            locked
          />
          <ConsentRow
            title="Do not sell my information"
            description="Opt out of CCPA-defined data sale"
            on={!!consents.doNotSell}
            onToggle={(v) => onConsentsChange({ ...consents, doNotSell: v })}
          />
        </View>
      )}
      <Button
        variant="primary"
        label="Agree & Continue"
        onPress={onAgree}
        loading={loading}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    padding: theme.spacing.lg,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    backgroundColor: theme.colors.bg.elevated,
    gap: theme.spacing.md,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accent.surface,
    borderWidth: 1,
    borderColor: theme.colors.accent.border,
  },
  consents: {
    gap: theme.spacing.xs,
  },
})
