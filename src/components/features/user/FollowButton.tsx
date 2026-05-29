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
