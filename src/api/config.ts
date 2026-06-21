import { apiClient } from './client'

// Client-facing config values from the backend (allowlisted RemoteConfig keys,
// served by GET /config — public, no auth). Tier prices are USD in cents.
// Values are mostly scalars but some keys are JSON (e.g. TOPUP_BUNDLES), so the
// value type is `unknown` — read via the typed helpers in usePublicConfig.
export type PublicConfig = Record<string, unknown>

export const configApi = {
  getPublic: async (): Promise<PublicConfig> => {
    const res = await apiClient.get<{ config: PublicConfig }>('/config')
    return res.data.config
  },
}
