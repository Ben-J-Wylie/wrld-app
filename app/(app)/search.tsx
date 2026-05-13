import { useState } from 'react'
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { theme } from '@/lib/theme'
import { Input } from '@/components/ui/Input'
import { Avatar } from '@/components/feature/user/Avatar'
import { useUserSearch } from '@/hooks/useUserSearch'
import type { PublicUser } from '@/types'

export default function Search() {
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
      <View style={styles.searchBar}>
        <Input
          placeholder="Search by handle or name…"
          value={q}
          onChangeText={setQ}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />
        {isFetching && <ActivityIndicator color={theme.colors.accent} style={styles.spinner} />}
      </View>

      {!q.trim() && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Search for people on WRLD</Text>
        </View>
      )}

      {q.trim().length > 0 && !isFetching && users?.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No users found for "{q}"</Text>
        </View>
      )}

      <FlatList
        data={users}
        keyExtractor={(u) => u.id}
        renderItem={({ item }) => <UserRow user={item} onPress={() => goToProfile(item.handle)} />}
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  )
}

function UserRow({ user, onPress }: { user: PublicUser; onPress: () => void }) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Avatar avatarUrl={user.avatarUrl} displayName={user.displayName} size={44} />
      <View style={styles.rowText}>
        <Text style={styles.displayName}>{user.displayName}</Text>
        <Text style={styles.handle}>@{user.handle}</Text>
      </View>
      <View style={styles.counts}>
        <Text style={styles.countText}>{user.followerCount} followers</Text>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: theme.spacing.sm,
  },
  input: { flex: 1 },
  spinner: { width: 20 },
  list: { paddingHorizontal: theme.spacing.lg },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { ...theme.typography.body, color: theme.colors.textMuted },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  rowText: { flex: 1, gap: 2 },
  displayName: { ...theme.typography.body, color: theme.colors.text, fontWeight: '600' },
  handle: { ...theme.typography.caption, color: theme.colors.textMuted },
  counts: {},
  countText: { ...theme.typography.caption, color: theme.colors.textMuted },
})
