// Minimal in-memory AsyncStorage for the node test env (H3). Aliased in vitest.config.ts
// so lib modules that import '@react-native-async-storage/async-storage' (captureConfig,
// tierCaps) load cleanly under vitest. Stateful + a `clear()` for per-test isolation.
const store = new Map<string, string>()

const AsyncStorage = {
  getItem: async (k: string): Promise<string | null> => (store.has(k) ? store.get(k)! : null),
  setItem: async (k: string, v: string): Promise<void> => {
    store.set(k, v)
  },
  removeItem: async (k: string): Promise<void> => {
    store.delete(k)
  },
  clear: async (): Promise<void> => {
    store.clear()
  },
}

export default AsyncStorage
