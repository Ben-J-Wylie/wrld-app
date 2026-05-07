/**
 * Type-safe environment variable access.
 * Expo exposes `EXPO_PUBLIC_*` vars on `process.env` at build time.
 *
 * If a required var is missing, fail loudly at startup rather than
 * sending undefined to APIs and getting cryptic errors later.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required env var: ${name}. Check your .env file.`)
  }
  return value
}

function optional(value: string | undefined, fallback = ''): string {
  return value ?? fallback
}

export const env = {
  apiBaseUrl: optional(process.env.EXPO_PUBLIC_API_BASE_URL, 'http://localhost:3000'),
  clerkPublishableKey: required(
    'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY',
    process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
  ),
  mediasoupWssUrl: optional(process.env.EXPO_PUBLIC_MEDIASOUP_WSS_URL, 'wss://media.wrld.cam'),
  enableDevTools: process.env.EXPO_PUBLIC_ENABLE_DEV_TOOLS === 'true',
}

export { required }
