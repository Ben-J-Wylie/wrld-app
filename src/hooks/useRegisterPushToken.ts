import { useEffect } from 'react'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { usersApi } from '@/api/users'

export function useRegisterPushToken(isSignedIn: boolean) {
  useEffect(() => {
    if (!isSignedIn) return

    async function register() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existing = await Notifications.getPermissionsAsync() as any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = existing.granted ? existing : await Notifications.requestPermissionsAsync() as any
      if (!result.granted) return

      // Android: set up a default notification channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'WRLD',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#5B8CFF',
        })
      }

      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: '35ab0828-46ac-477f-8ace-453105f6601e',
      })

      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

      await usersApi.registerPushToken({
        token: tokenData.data,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        timezone,
      })
    }

    register().catch((err) => console.warn('Push token registration failed:', err))
  }, [isSignedIn])
}
