// src/components/features/clip/ClipSourcesDrawer.tsx
//
// Buffer-trim clip editor (clips initiative · C2). The bottom drawer that picks which
// recorded layers the clip keeps — the same slide-up sheet pattern as the globe's
// NearbyStreamsDrawer. One StreamTile per source that was recorded in this buffer
// span; tapping toggles it active/inactive for the clip (StreamTile's own active vs
// inactive states). Selection is reversible-only — permanent track deletion is NOT
// here (out of scope for this editor). Replaces the inline LayerPanel/LayerEditorRow.
//
// Thin assembly — BottomSheet + a wrapped grid of StreamTiles + a header count and a
// Done dismiss. No new primitive.
//
// See DESIGN.md Section 3 (Buffer-trim clip editor) + the 2026-06-06 decision log.

import type { ComponentProps } from 'react'
import { StyleSheet, View } from 'react-native'
import { BottomSheet } from '@/components/primitives/BottomSheet'
import { Pressable } from '@/components/primitives/Pressable'
import { Text } from '@/components/primitives/Text'
import { StreamTile } from '@/components/features/stream/StreamTile'
import { theme } from '@/tokens/theme'

type IconName = ComponentProps<typeof StreamTile>['iconName']

export type ClipSource = {
  key: string
  iconName: IconName
  label: string
  value: string
  active: boolean
}

type Props = {
  visible: boolean
  sources: ClipSource[]
  onToggleSource: (key: string) => void
  onDismiss: () => void
  title?: string
}

export function ClipSourcesDrawer({
  visible,
  sources,
  onToggleSource,
  onDismiss,
  title = 'Sources in this clip',
}: Props) {
  const activeCount = sources.filter((s) => s.active).length
  return (
    <BottomSheet visible={visible} onClose={onDismiss} variant="peek" peekHeight={320}>
      <View style={styles.header}>
        <Text variant="heading">{title}</Text>
        <Text variant="monoLabel" color={theme.colors.text.muted}>
          {`${activeCount} of ${sources.length} active`}
        </Text>
      </View>
      <View style={styles.grid}>
        {sources.map((s) => (
          <StreamTile
            key={s.key}
            iconName={s.iconName}
            label={s.label}
            value={s.value}
            active={s.active}
            onPress={() => onToggleSource(s.key)}
          />
        ))}
      </View>
      <Pressable
        variant="default"
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Done"
        style={styles.done}
      >
        <Text variant="bodyEmphasized">Done</Text>
      </Pressable>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
  },
  done: {
    marginTop: theme.spacing.lg,
    marginHorizontal: theme.spacing.lg,
    height: 46,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border.strong,
    backgroundColor: theme.colors.bg.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
