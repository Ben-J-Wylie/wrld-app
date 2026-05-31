// src/components/features/user/PassportCard.tsx
//
// Identity panel composing bio + region row + optional pronouns row +
// social chips. Missing fields don't render — a user without socials
// just doesn't get that block, and so on. Consumer passes a flat
// passport shape; the feature stays domain-blind (no `User` import).

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { SocialChip } from './SocialChip'
import { theme } from '@/tokens/theme'

export type PassportSocial = {
  kind: 'ig' | 'tt' | 'sc' | 'x'
  handle: string
  onPress?: () => void
}

type Props = {
  bio?: string
  region?: string
  pronouns?: string
  socials?: PassportSocial[]
  style?: StyleProp<ViewStyle>
}

export function PassportCard({ bio, region, pronouns, socials, style }: Props) {
  const hasSocials = socials !== undefined && socials.length > 0

  return (
    <View style={[styles.card, style]}>
      {bio && (
        <Text variant="body" color={theme.colors.text.primary}>
          {bio}
        </Text>
      )}
      {region && (
        <View style={styles.row}>
          <Icon name="map-pin" size="sm" color={theme.colors.text.muted} />
          <Text variant="monoLabel" color={theme.colors.text.subtle}>
            FROM
          </Text>
          <Text variant="bodyEmphasized" color={theme.colors.text.primary}>
            {region}
          </Text>
        </View>
      )}
      {pronouns && (
        <View style={styles.row}>
          <Icon name="user" size="sm" color={theme.colors.text.muted} />
          <Text variant="bodyEmphasized" color={theme.colors.text.primary}>
            {pronouns}
          </Text>
        </View>
      )}
      {hasSocials && (
        <View style={styles.socials}>
          {socials!.map((s) => (
            <SocialChip
              key={`${s.kind}:${s.handle}`}
              kind={s.kind}
              handle={s.handle}
              onPress={s.onPress}
            />
          ))}
        </View>
      )}
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  socials: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
})
