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

  // RevenueCat public SDK keys — platform-specific. These are *public* app keys
  // (safe to ship in the client bundle, like the Clerk publishable + Mapbox
  // public token). Get them from RevenueCat → Project settings → API keys:
  //   • iOS  → key beginning `appl_`
  //   • Android → key beginning `goog_`
  // NEVER put a RevenueCat *secret* key (`sk_…`) in the client — that lives in
  // wrld-backend for the webhook only.
  revenueCatAppleKey: optional(process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY),
  revenueCatGoogleKey: optional(process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY),
}

export { required }
