import AsyncStorage from '@react-native-async-storage/async-storage'

// AsyncStorage-based token cache for Expo Go compatibility.
// Swap for expo-secure-store in Phase 7 when we move to a custom dev client.
export const tokenCache = {
  async getToken(key: string) {
    return AsyncStorage.getItem(key)
  },
  async saveToken(key: string, token: string) {
    await AsyncStorage.setItem(key, token)
  },
  async clearToken(key: string) {
    await AsyncStorage.removeItem(key)
  },
}
