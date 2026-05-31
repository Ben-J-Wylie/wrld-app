// src/components/screens/SearchScreen.tsx
//
// 12.6 migration target. Replaces the bespoke search input + user row
// with the design-system equivalents:
//
//   • SearchBar (feature) replaces the bespoke Input + ActivityIndicator
//     row at the top. clear-X appears automatically once there is a
//     query.
//   • BroadcasterRow (default) replaces the bespoke UserRow. Renders
//     Avatar + displayName + @handle · NK followers; tap routes into
//     the profile screen. Follow button stays hidden — matches the
//     existing behavior of "tap row to open profile, follow there".
//   • Icon + Text replace the emoji + plain text empty states.

import { useState } from 'react'
import { FlatList, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { theme } from '@/tokens/theme'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { SearchBar } from '@/components/features/discovery/SearchBar'
import { BroadcasterRow } from '@/components/features/user/BroadcasterRow'
import { useUserSearch } from '@/hooks/useUserSearch'
import type { PublicUser } from '@/types'

export function SearchScreen() {
  const [q, setQ] = useState('')
  const { data: users, isFetching } = useUserSearch(q)

  function goToProfile(handle: string) {
    router.push({
      pathname: '/(app)/profile/[handle]',
      params: { handle },
    })
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.searchBarWrap}>
        <SearchBar
          value={q}
          onChangeText={setQ}
          onClear={() => setQ('')}
          placeholder="Search by handle or name…"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {!q.trim() && (
        <View style={styles.empty}>
          <Icon name="search" size="lg" color={theme.colors.text.subtle} />
          <Text variant="body" color={theme.colors.text.muted}>
            Search for people on WRLD
          </Text>
        </View>
      )}

      {q.trim().length > 0 && !isFetching && users?.length === 0 && (
        <View style={styles.empty}>
          <Icon name="user-x" size="lg" color={theme.colors.text.subtle} />
          <Text variant="body" color={theme.colors.text.muted}>
            No users found for "{q}"
          </Text>
        </View>
      )}

      <FlatList
        data={users}
        keyExtractor={(u: PublicUser) => u.id}
        renderItem={({ item }) => (
          <BroadcasterRow
            avatarUrl={item.avatarUrl}
            displayName={item.displayName}
            handle={item.handle}
            followerCount={item.followerCount}
            showFollowButton={false}
            onPress={() => goToProfile(item.handle)}
            style={styles.row}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg.primary },
  searchBarWrap: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
  },
  list: { paddingHorizontal: theme.spacing.lg },
  row: {
    paddingVertical: theme.spacing.sm,
  },
  separator: {
    height: 1,
    backgroundColor: theme.colors.border.subtle,
  },
})
