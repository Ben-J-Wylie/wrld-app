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

  // Filled in Phase 2 — keep optional until then
  cognito: {
    userPoolId: optional(process.env.EXPO_PUBLIC_COGNITO_USER_POOL_ID),
    clientId: optional(process.env.EXPO_PUBLIC_COGNITO_CLIENT_ID),
    region: optional(process.env.EXPO_PUBLIC_COGNITO_REGION, 'us-west-2'),
  },

  // Filled in Phase 7
  mediasoupUrl: optional(process.env.EXPO_PUBLIC_MEDIASOUP_URL),

  enableDevTools: process.env.EXPO_PUBLIC_ENABLE_DEV_TOOLS === 'true',
}

// Use `required()` once the relevant phase is wired up:
// e.g. in Phase 3:  cognito: { userPoolId: required('COGNITO_USER_POOL_ID', process.env.EXPO_PUBLIC_COGNITO_USER_POOL_ID), ... }
export { required }
