// src/components/features/stream/CoordHUD.tsx
//
// Telemetry grid — label / value pairs in mono. Used wherever a stream
// surface needs to surface coords + uptime + speed-style data: the
// Viewer Sheet's meta strip (4-column inline) and the Broadcast Live
// HUD's right-justified panel.
//
// Variants:
//   viewer-sheet   — flat 4-column inline grid (LAT / LON / ELEV /
//                    UPTIME). Labels above values. Centered columns.
//   broadcast-live — vertical right-justified panel. Each row is
//                    label (left, dim) + value (right, brighter,
//                    tabular). Sits inside a translucent backdrop in
//                    the broadcaster HUD.
//
// Items are consumer-flat so the feature stays domain-blind:
// `{ label, value, pending? }[]`. `pending=true` dims the value so
// in-flight reads (e.g. GPS still acquiring) read as awaiting.

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Text } from '@/components/primitives/Text'
import { theme } from '@/tokens/theme'

type Variant = 'viewer-sheet' | 'broadcast-live'

export type CoordHUDItem = {
  label: string
  value: string
  pending?: boolean
}

type Props = {
  variant?: Variant
  items: CoordHUDItem[]
  style?: StyleProp<ViewStyle>
}

export function CoordHUD({ variant = 'viewer-sheet', items, style }: Props) {
  return variant === 'broadcast-live' ? (
    <BroadcastLive items={items} style={style} />
  ) : (
    <ViewerSheet items={items} style={style} />
  )
}

// ─── Viewer-sheet (inline grid) ──────────────────────────────────────────────

function ViewerSheet({ items, style }: { items: CoordHUDItem[]; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[viewerStyles.row, style]}>
      {items.map((it) => (
        <View key={it.label} style={viewerStyles.cell}>
          <Text variant="monoCaption" color={theme.colors.text.subtle}>
            {it.label}
          </Text>
          <Text
            variant="monoValue"
            color={it.pending ? theme.colors.text.subtle : theme.colors.text.primary}
            numberOfLines={1}
          >
            {it.value}
          </Text>
        </View>
      ))}
    </View>
  )
}

const viewerStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
  },
  cell: {
    flex: 1,
    gap: 2,
    alignItems: 'flex-start',
  },
})

// ─── Broadcast-live (right-justified panel) ──────────────────────────────────

function BroadcastLive({ items, style }: { items: CoordHUDItem[]; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[broadcastStyles.panel, style]}>
      {items.map((it) => (
        <View key={it.label} style={broadcastStyles.row}>
          <Text variant="monoCaption" color={theme.colors.text.subtle}>
            {it.label}
          </Text>
          <Text
            variant="monoValue"
            color={it.pending ? theme.colors.text.subtle : theme.colors.text.inverse}
            numberOfLines={1}
          >
            {it.value}
          </Text>
        </View>
      ))}
    </View>
  )
}

const broadcastStyles = StyleSheet.create({
  panel: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.md,
    backgroundColor: 'rgba(0,0,0,0.45)',
    gap: 2,
    alignSelf: 'flex-end',
    minWidth: 130,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
})
