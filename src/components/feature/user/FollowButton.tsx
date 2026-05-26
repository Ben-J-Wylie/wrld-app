import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { usersApi } from '@/api/users'
import { Button } from '@/components/ui/Button'

type Props = {
  handle: string
  initialFollowing?: boolean
}

export function FollowButton({ handle, initialFollowing = false }: Props) {
  const [following, setFollowing] = useState(initialFollowing)
  const [loading, setLoading] = useState(false)
  const queryClient = useQueryClient()

  async function toggle() {
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
