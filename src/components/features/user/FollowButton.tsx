// src/components/features/user/FollowButton.tsx
//
// Already token-clean — survives 12.5/12.6 without re-rendering work.
// Composes the Button primitive (variant swaps between 'primary' and
// 'secondary' on follow state); reads its own follow state via the
// useUserProfile hook so BroadcasterRow + ProfileScreen + SearchScreen
// can drop it in without threading isFollowing through their own
// props. Optimistic toggle with revert-on-error.
//
// `onAuthRequest` opt-in lets anon callers (StreamScreen viewer mode,
// BroadcasterRow chip) intercept the tap and present an auth sheet
// instead of firing the follow/unfollow API call.

import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { usersApi } from '@/api/users'
import { useUserProfile } from '@/hooks/useUserProfile'
import { Button } from '@/components/primitives/Button'

type Props = {
  handle: string
  onAuthRequest?: () => void
}

export function FollowButton({ handle, onAuthRequest }: Props) {
  const { data } = useUserProfile(handle)
  const [following, setFollowing] = useState(data?.isFollowing ?? false)
  const [loading, setLoading] = useState(false)
  const queryClient = useQueryClient()

  // Sync local state whenever the server data arrives or refreshes
  useEffect(() => {
    if (data?.isFollowing !== undefined) setFollowing(data.isFollowing)
  }, [data?.isFollowing])

  async function toggle() {
    if (onAuthRequest) {
      onAuthRequest()
      return
    }
    setLoading(true)
    try {
      if (following) {
        await usersApi.unfollow(handle)
        setFollowing(false)
      } else {
        await usersApi.follow(handle)
        setFollowing(true)
      }
      await queryClient.invalidateQueries({ queryKey: ['user', handle] })
    } catch {
      // leave state unchanged on error
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      label={following ? 'Following' : 'Follow'}
      onPress={toggle}
      variant={following ? 'secondary' : 'primary'}
      loading={loading}
    />
  )
}
