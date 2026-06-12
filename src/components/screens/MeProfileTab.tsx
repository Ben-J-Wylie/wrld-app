// src/components/screens/MeProfileTab.tsx
//
// The "Public Profile" tab of the Me page — a read-only mirror of what
// other users see when they open this profile. Two regions:
//
//   • Passport header — an official-looking identity card: avatar +
//     name + @handle, permanent account ID, member-since date, plan
//     (tier) badge, and follower / gifts stats. Editing lives in the
//     Settings tab (ProfileEditCard), never here.
//   • Feed — a timeline of the clips in the user's saved lane
//     (recordings), newest first.

import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { theme } from '@/tokens/theme'
import { Avatar } from '@/components/primitives/Avatar'
import { Text } from '@/components/primitives/Text'
import { Pill } from '@/components/primitives/Pill'
import { Divider } from '@/components/primitives/Divider'
import { AccountIDPill } from '@/components/features/user/AccountIDPill'
import { SavedClipRow } from '@/components/features/clip/SavedClipRow'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useRecordings } from '@/hooks/useRecordings'
import type { Recording, User } from '@/types'

function formatCount(n: number): string {
  if (n >= 10_000) return `${Math.floor(n / 1000)}k`
  if (n >= 1_000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function formatMemberSince(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', { month: 'long', year: 'numeric' })
  } catch {
    return '—'
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function formatDuration(sec: number | null): string {
  if (sec === null) return '—'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const TIER_LABEL: Record<User['tier'], string> = {
  free: 'FREE',
  plus: 'PLUS',
  pro: 'PRO',
}

// One saved-lane clip as a feed row. Read-only here (no delete / kebab) —
// the Library tab owns clip management.
function FeedRow({ recording }: { recording: Recording }) {
  const isReady = recording.status === 'ready'
  const meta = [
    formatTime(recording.startedAt),
    isReady && recording.durationSec !== null ? formatDuration(recording.durationSec) : null,
    isReady && recording.sizeBytes > 0 ? formatSize(recording.sizeBytes) : null,
  ]
    .filter(Boolean)
    .join('  ·  ')

  return (
    <SavedClipRow
      name={formatDate(recording.startedAt)}
      capturedAt={meta}
      durationSec={recording.durationSec ?? 0}
      thumbnailUrl={recording.thumbnailUrl}
      showPlayGlyph={false}
    />
  )
}

export function MeProfileTab() {
  const { data: user } = useCurrentUser()
  // Follower / following / gifts live on the public profile endpoint, not
  // /auth/me — fetch our own profile to surface them.
  const { data: profile } = useUserProfile(user?.handle ?? null)
  const { data: recordings, isLoading: clipsLoading } = useRecordings(!!user)

  if (!user) return null

  const gifts = profile?.giftsReceived ?? []
  const totalGifts = gifts.reduce((sum, g) => sum + g.count, 0)
  // Saved-lane feed: only finished clips, newest first.
  const feed = (recordings ?? [])
    .filter((r) => r.status === 'ready')
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())

  return (
    <View style={styles.root}>
      {/* PASSPORT */}
      <View style={styles.passport}>
        <View style={styles.passportTop}>
          <Text variant="monoLabel" color={theme.colors.text.subtle}>
            WRLD · MEMBER PASSPORT
          </Text>
          <Pill label={TIER_LABEL[user.tier]} variant={user.tier === 'free' ? 'default' : 'accent'} size="sm" />
        </View>

        <View style={styles.identity}>
          <Avatar avatarUrl={user.avatarUrl} displayName={user.displayName} size="xl" />
          <View style={styles.identityText}>
            <Text variant="display" numberOfLines={1}>
              {user.displayName}
            </Text>
            <Text variant="body" color={theme.colors.text.muted}>
              @{user.handle}
            </Text>
            <AccountIDPill accountId={user.id} style={styles.acctPill} />
          </View>
        </View>

        <Divider />

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text variant="monoLabel" color={theme.colors.text.subtle}>
              MEMBER SINCE
            </Text>
            <Text variant="bodyEmphasized">{formatMemberSince(user.createdAt)}</Text>
          </View>
          <View style={styles.stat}>
            <Text variant="monoLabel" color={theme.colors.text.subtle}>
              FOLLOWERS
            </Text>
            <Text variant="bodyEmphasized">{formatCount(profile?.followerCount ?? 0)}</Text>
          </View>
          <View style={styles.stat}>
            <Text variant="monoLabel" color={theme.colors.text.subtle}>
              FOLLOWING
            </Text>
            <Text variant="bodyEmphasized">{formatCount(profile?.followingCount ?? 0)}</Text>
          </View>
        </View>

        {gifts.length > 0 && (
          <>
            <Divider />
            <View style={styles.giftsHeader}>
              <Text variant="monoLabel" color={theme.colors.text.subtle}>
                GIFTS RECEIVED
              </Text>
              <Text variant="monoLabel" color={theme.colors.text.subtle}>
                {formatCount(totalGifts)} 🚀
              </Text>
            </View>
            <View style={styles.giftsRow}>
              {gifts.map((g) => (
                <View key={g.giftType} style={styles.giftCell}>
                  <Text variant="heading">{g.emoji}</Text>
                  <Text variant="bodyEmphasized">{formatCount(g.count)}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </View>

      {/* FEED */}
      <View style={styles.feed}>
        <Text variant="monoLabel" color={theme.colors.text.subtle}>
          SAVED CLIPS
        </Text>
        {clipsLoading ? (
          <ActivityIndicator color={theme.colors.accent.default} style={styles.feedLoading} />
        ) : feed.length === 0 ? (
          <View style={styles.feedEmpty}>
            <Text variant="body" color={theme.colors.text.muted} style={styles.center}>
              No saved clips yet. Clips you save while streaming show up here.
            </Text>
          </View>
        ) : (
          <View style={styles.feedList}>
            {feed.map((r) => (
              <FeedRow key={r.id} recording={r} />
            ))}
          </View>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
    paddingBottom: theme.spacing.xxxl,
  },
  passport: {
    borderWidth: 1,
    borderColor: theme.colors.border.strong,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bg.elevated,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  passportTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.lg,
  },
  identityText: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  acctPill: {
    marginTop: theme.spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stat: {
    gap: 2,
  },
  giftsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  giftsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.lg,
  },
  giftCell: {
    alignItems: 'center',
    gap: 2,
  },
  feed: {
    gap: theme.spacing.sm,
  },
  feedList: {
    gap: theme.spacing.sm,
  },
  feedLoading: {
    paddingVertical: theme.spacing.xl,
  },
  feedEmpty: {
    paddingVertical: theme.spacing.xl,
    alignItems: 'center',
  },
  center: {
    textAlign: 'center',
  },
})
