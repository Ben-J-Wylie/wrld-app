// src/components/features/user/AvatarPicker.tsx
//
// Avatar lg + column of two action buttons ("Take a photo" / "Choose
// from photos"). Used by Onboarding wizards + Settings change-avatar.
//
// Domain-blind: the feature does NOT call `expo-image-picker` — it
// emits `onTake` / `onPick` callbacks and shows an uploading spinner
// over the avatar while `uploading` is true. The consumer wires up the
// real picker + upload logic (which already lives in Phase 8's
// OnboardingScreen and survives the 12.6 migration).

import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Avatar } from '@/components/primitives/Avatar'
import { Button } from '@/components/primitives/Button'
import { theme } from '@/tokens/theme'

type Props = {
  avatarUrl?: string | null
  displayName?: string
  uploading?: boolean
  onTake: () => void
  onPick: () => void
  style?: StyleProp<ViewStyle>
}

export function AvatarPicker({
  avatarUrl,
  displayName,
  uploading = false,
  onTake,
  onPick,
  style,
}: Props) {
  return (
    <View style={[styles.row, style]}>
      <View style={styles.avatarWrap}>
        <Avatar avatarUrl={avatarUrl} displayName={displayName ?? '?'} size="lg" />
        {uploading && (
          <View style={styles.spinnerOverlay}>
            <ActivityIndicator color={theme.colors.text.inverse} />
          </View>
        )}
      </View>
      <View style={styles.col}>
        <Button
          label="Take a photo"
          icon="camera"
          variant="secondary"
          onPress={onTake}
          disabled={uploading}
        />
        <Button
          label="Choose from photos"
          icon="image"
          variant="secondary"
          onPress={onPick}
          disabled={uploading}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.lg,
  },
  avatarWrap: {
    position: 'relative',
  },
  spinnerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  col: {
    flex: 1,
    gap: theme.spacing.sm,
  },
})
