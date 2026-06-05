// src/components/features/broadcast/BufferWindowLabel.tsx
//
// Rolling Buffer (Always-On Rewind) initiative — June 2026. While live, the
// stream is continuously recorded into a self-overwriting buffer; this label
// tells the broadcaster how far back the buffer can currently rewind, shown
// as a concrete reachable TIMESTAMP ("reaches back to ~Tue 3:00 PM"), never a
// bare duration they'd have to subtract. Optionally a quiet max-quality floor
// for reassurance ("at least ~24h even at max quality").
//
// Per the model: time is the user-facing contract, bytes the enforced
// backstop — so the displayed timestamp is whatever the backend says the
// buffer can honour (its earliest-available instant from `GET /auth/me`),
// not a fixed window. Presentational only; the host passes `reachesBack`.
// Cream-palette (renders in the clip editor / profile, not over live video).
//
// See the Rolling Buffer initiative in CLAUDE.md + DESIGN.md decision log.

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { theme } from '@/tokens/theme'

type Props = {
  // Earliest instant the buffer can currently rewind to (Date or epoch ms).
  reachesBack: Date | number
  // Optional reassurance floor — the window guaranteed even at the tier's
  // worst-case (all-sources-max-quality) ceiling. Hours.
  floorHours?: number
  // Reference "now" — defaults to the current time. Injectable for stubs/tests.
  now?: Date | number
  style?: StyleProp<ViewStyle>
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

// "Tue 3:00 PM" — or "today 3:00 PM" / "yesterday 9:45 AM" when close.
function formatReach(target: Date, now: Date): string {
  const hours = target.getHours()
  const mins = target.getMinutes()
  const ampm = hours < 12 ? 'AM' : 'PM'
  const h12 = hours % 12 === 0 ? 12 : hours % 12
  const time = `${h12}:${String(mins).padStart(2, '0')} ${ampm}`

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)

  let day: string
  if (sameDay(target, now)) day = 'today'
  else if (sameDay(target, yesterday)) day = 'yesterday'
  else day = WEEKDAYS[target.getDay()] ?? ''

  return `${day} ${time}`
}

export function BufferWindowLabel({ reachesBack, floorHours, now, style }: Props) {
  const target = reachesBack instanceof Date ? reachesBack : new Date(reachesBack)
  const ref = now == null ? new Date() : now instanceof Date ? now : new Date(now)

  return (
    <View style={[styles.card, style]}>
      <View style={styles.iconTile}>
        <Icon name="rotate-ccw" size="sm" color={theme.colors.accent.default} />
      </View>
      <View style={styles.body}>
        <Text variant="monoLabel" color={theme.colors.text.subtle}>
          Rewind available
        </Text>
        <Text variant="bodyEmphasized" color={theme.colors.text.primary}>
          Reaches back to ~{formatReach(target, ref)}
        </Text>
        {floorHours != null && (
          <Text variant="caption" color={theme.colors.text.muted}>
            At least ~{floorHours}h even at max quality
          </Text>
        )}
      </View>
    </View>
  )
}

const TILE = 32

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.bg.elevated,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  iconTile: {
    width: TILE,
    height: TILE,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accent.surface,
    borderWidth: 1,
    borderColor: theme.colors.accent.border,
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
})
