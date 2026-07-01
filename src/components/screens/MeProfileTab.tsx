// src/components/screens/MeProfileTab.tsx
//
// The "Public Profile" tab of the Me page — a read-only mirror of what
// other users see when they open this profile. Two regions:
//
//   • Passport header — an official-looking identity card: avatar +
//     name + @handle, permanent account ID, member-since date, plan
//     (tier) badge, and follower / gifts stats. Editing lives in the
//     Settings tab (ProfileEditCard), never here.
//   • Feed — a timeline of the clips in the user's saved lane (the durable
//     Clip rows from useSavedClips), newest first; tap a row to open the clip.

import { useState } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { theme } from '@/tokens/theme'
import { Avatar } from '@/components/primitives/Avatar'
import { Text } from '@/components/primitives/Text'
import { Pill } from '@/components/primitives/Pill'
import { Pressable } from '@/components/primitives/Pressable'
import { Divider } from '@/components/primitives/Divider'
import { AccountIDPill } from '@/components/features/user/AccountIDPill'
import { SavedClipRow } from '@/components/features/clip/SavedClipRow'
import { EraSettingsSheet } from '@/components/features/clip/EraSettingsSheet'
import { KIND_TO_FEEDKIND } from '@/components/features/stream/sourceMeta'
import type { FeedKind } from '@/components/features/broadcast/FeedThumb'
import { usersApi } from '@/api/users'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useMyRecordings } from '@/hooks/useMyRecordings'
import { serverNow } from '@/lib/serverClock'
import type { Era } from '@/types/era'
import type { User } from '@/types'

// A kept era + its recording's captured kinds (for the settings drawer's per-source rows).
type FeedItem = { era: Era; kinds: string[] }

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

function formatDate(v: number | string): string {
  return new Date(v).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatTime(v: number | string): string {
  return new Date(v).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function formatDuration(sec: number | null): string {
  if (sec === null) return '—'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

// Active broadcast time as "Xh Ym" (floored to the minute; "0m" when none yet).
function formatLiveTime(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

const TIER_LABEL: Record<User['tier'], string> = {
  free: 'FREE',
  plus: 'PLUS',
  pro: 'PRO',
}

// One saved-lane clip (a durable Clip) as a feed row. Tapping opens the per-clip settings drawer
// in place (edit this clip's preferences — title / location / identity / sources / delete); it does
// NOT navigate away.
function FeedRow({ item, onOpen }: { item: FeedItem; onOpen: (item: FeedItem) => void }) {
  const { era } = item
  const end = era.endAtMs ?? era.startAtMs
  const durSec = Math.max(0, Math.round((end - era.startAtMs) / 1000))
  const meta = [formatDate(era.startAtMs), formatTime(era.startAtMs), formatDuration(durSec)]
    .filter(Boolean)
    .join('  ·  ')

  return (
    <SavedClipRow
      name={era.title?.trim() || formatDate(era.startAtMs)}
      capturedAt={meta}
      durationSec={durSec}
      thumbnailUrl={era.thumbnailUrl}
      showPlayGlyph
      onToggleExpand={() => onOpen(item)}
    />
  )
}

export function MeProfileTab() {
  const { data: user } = useCurrentUser()
  // Follower / following / gifts live on the public profile endpoint, not
  // /auth/me — fetch our own profile to surface them.
  const { data: profile } = useUserProfile(user?.handle ?? null)
  const { data: recordings, isLoading: clipsLoading } = useMyRecordings(!!user)
  // Who's subscribed to me — creators only (non-creators always get []).
  const { data: subscribers = [] } = useQuery({
    queryKey: ['my-subscribers'],
    queryFn: usersApi.getSubscribers,
    enabled: !!user && user.subscriptionEnabled === true,
    staleTime: 60_000,
  })

  // The settings drawer for a tapped saved clip (opened in place; `sheetVisible` drives the
  // open/close animation independently of mount so the close animates like the open).
  const [sheetItem, setSheetItem] = useState<FeedItem | null>(null)
  const [sheetVisible, setSheetVisible] = useState(false)
  const openSheet = (item: FeedItem) => {
    setSheetItem(item)
    setSheetVisible(true)
  }
  const closeSheet = () => {
    setSheetVisible(false)
    setTimeout(() => setSheetItem(null), 270)
  }

  if (!user) return null

  const gifts = profile?.giftsReceived ?? []
  const totalGifts = gifts.reduce((sum, g) => sum + g.count, 0)
  // Saved-lane feed: every KEPT era across the user's recordings, newest first. A clip is an era
  // whose keep === 'kept'; carry the recording's kinds for the settings drawer's per-source rows.
  const feed: FeedItem[] = [...(recordings ?? [])]
    .flatMap((r) => r.eras.filter((e) => e.keep === 'kept').map((era) => ({ era, kinds: r.kinds })))
    .sort((a, b) => b.era.startAtMs - a.era.startAtMs)
  // Divider: kept eras still inside the rolling-buffer window vs those the reaper has moved past
  // (kept only because they were saved). The clean-cut /me/recordings doesn't expose windowHours
  // yet, so the divider is off until it does (graceful: one list). TODO(aaron): add windowHours.
  const windowFloorMs: number | null = null
  const _serverNow = serverNow() // reserved for the divider once windowHours lands
  void _serverNow
  const inWindow = windowFloorMs == null ? feed : feed.filter((c) => c.era.startAtMs >= windowFloorMs)
  const postReaper = windowFloorMs == null ? [] : feed.filter((c) => c.era.startAtMs < windowFloorMs)

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
          <View style={styles.stat}>
            <Text variant="monoLabel" color={theme.colors.text.subtle}>
              LIVE TIME
            </Text>
            <Text variant="bodyEmphasized">{formatLiveTime(profile?.broadcastSeconds ?? 0)}</Text>
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

      {/* SUBSCRIBERS (creators only) */}
      {user.subscriptionEnabled && (
        <View style={styles.section}>
          <Text variant="monoLabel" color={theme.colors.text.subtle}>
            SUBSCRIBERS · {formatCount(subscribers.length)}
          </Text>
          {subscribers.length === 0 ? (
            <Text variant="body" color={theme.colors.text.muted} style={styles.center}>
              No subscribers yet
            </Text>
          ) : (
            <View style={styles.subsRow}>
              {subscribers.map((s) => (
                <Pressable
                  key={s.id}
                  variant="subtle"
                  onPress={() => router.navigate({ pathname: '/(app)/profile/[handle]', params: { handle: s.handle } })}
                  style={styles.subCell}
                >
                  <Avatar avatarUrl={s.avatarUrl} displayName={s.displayName} size="md" />
                  <Text variant="monoCaption" color={theme.colors.text.muted} numberOfLines={1} style={styles.subHandle}>
                    @{s.handle}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}

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
            {/* Newest first. Above the divider: still inside the rolling-buffer window. Below:
                saved clips the reaper has moved past (kept only because they were saved). */}
            {inWindow.map((c) => (
              <FeedRow key={c.era.id} item={c} onOpen={openSheet} />
            ))}
            {postReaper.length > 0 && (
              <View style={styles.reaperDivider}>
                <Divider />
                <Text variant="monoCaption" color={theme.colors.text.subtle} style={styles.reaperLabel}>
                  SAVED · PAST THE BUFFER WINDOW
                </Text>
              </View>
            )}
            {postReaper.map((c) => (
              <FeedRow key={c.era.id} item={c} onOpen={openSheet} />
            ))}
          </View>
        )}
      </View>

      {sheetItem && (
        <EraSettingsSheet
          visible={sheetVisible}
          onClose={closeSheet}
          era={sheetItem.era}
          rangeLabel={`${formatTime(sheetItem.era.startAtMs)}–${formatTime(sheetItem.era.endAtMs ?? sheetItem.era.startAtMs)}`}
          dateLabel={formatDate(sheetItem.era.startAtMs)}
          manifestUrl={null}
          posterUrl={sheetItem.era.thumbnailUrl}
          availableSources={
            sheetItem.kinds.map((k) => KIND_TO_FEEDKIND[k]).filter(Boolean) as FeedKind[]
          }
          showLane
          onDeleted={closeSheet}
        />
      )}
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
  section: {
    gap: theme.spacing.sm,
  },
  subsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  subCell: {
    width: 56,
    alignItems: 'center',
    gap: 4,
  },
  subHandle: {
    maxWidth: 56,
    textAlign: 'center',
  },
  feed: {
    gap: theme.spacing.sm,
  },
  feedList: {
    gap: theme.spacing.sm,
  },
  reaperDivider: {
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm,
  },
  reaperLabel: {
    marginTop: theme.spacing.xs,
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
