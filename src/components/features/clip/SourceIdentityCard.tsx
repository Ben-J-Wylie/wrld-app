// src/components/features/clip/SourceIdentityCard.tsx
//
// Identity source view for the buffer viewer — a comp of the broadcaster's identity as
// it was captured: avatar, name, @handle, the Attributed/Anon flag, and capture meta
// (resolution, when, sources). Fills the scrub field when the IDENTITY source is
// selected. Light (paper) surface — identity is metadata, not media.
// See DESIGN.md Section 3 (Buffer-trim clip editor).

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Avatar } from '@/components/primitives/Avatar'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { theme } from '@/tokens/theme'

type Props = {
  displayName: string
  handle: string
  avatarUrl?: string | null
  attributed: boolean // false → captured anonymously
  meta?: { label: string; value: string }[]
  style?: StyleProp<ViewStyle>
}

export function SourceIdentityCard({ displayName, handle, avatarUrl, attributed, meta = [], style }: Props) {
  return (
    <View style={[styles.wrap, style]}>
      <Avatar displayName={displayName} avatarUrl={avatarUrl} size={72} />
      <View style={styles.names}>
        <Text variant="heading" numberOfLines={1}>
          {displayName}
        </Text>
        <Text variant="body" color={theme.colors.text.muted} numberOfLines={1}>
          @{handle}
        </Text>
      </View>

      <View style={[styles.flag, attributed ? styles.flagAttributed : styles.flagAnon]}>
        <Icon
          name={attributed ? 'user-check' : 'eye-off'}
          size="sm"
          color={attributed ? theme.colors.accent.default : theme.colors.text.muted}
        />
        <Text
          variant="monoLabel"
          color={attributed ? theme.colors.accent.default : theme.colors.text.muted}
        >
          {attributed ? 'ATTRIBUTED' : 'ANONYMOUS'}
        </Text>
      </View>

      {meta.length > 0 && (
        <View style={styles.meta}>
          {meta.map((m) => (
            <View key={m.label} style={styles.metaRow}>
              <Text variant="caption" color={theme.colors.text.subtle}>
                {m.label}
              </Text>
              <Text variant="caption" color={theme.colors.text.primary}>
                {m.value}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: theme.colors.bg.panelHi,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  names: {
    alignItems: 'center',
    gap: 2,
  },
  flag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.full,
    borderWidth: 1,
  },
  flagAttributed: {
    borderColor: theme.colors.accent.border,
    backgroundColor: theme.colors.accent.surface,
  },
  flagAnon: {
    borderColor: theme.colors.border.strong,
    backgroundColor: theme.colors.bg.panel,
  },
  meta: {
    alignSelf: 'stretch',
    marginTop: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
})
