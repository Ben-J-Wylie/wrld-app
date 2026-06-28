import { defineConfig } from 'vitest/config'
import path from 'node:path'

// H3 — pure-helper unit tests (no React/RN runtime). The app's `@/…` alias (metro.config.js
// resolves it at runtime) is mirrored here so the lib modules import the same way under test.
// `@react-native-async-storage/async-storage` is a native module → aliased to an in-memory stub
// so persistence-backed pure helpers (captureConfig, tierCaps) import cleanly under node.
export default defineConfig({
  resolve: {
    alias: {
      '@react-native-async-storage/async-storage': path.resolve(__dirname, 'src/__tests__/_stubs/asyncStorage.ts'),
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
