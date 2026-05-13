import { useState } from 'react'
import { usersApi } from '@/api/users'
import { Button } from '@/components/ui/Button'

type Props = {
  handle: string
  initialFollowing?: boolean
}

export function FollowButton({ handle, initialFollowing = false }: Props) {
  const [following, setFollowing] = useState(initialFollowing)
  const [loading, setLoading] = useState(false)

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
