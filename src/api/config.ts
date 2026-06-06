import { apiClient } from './client'

// Client-facing config values from the backend (allowlisted RemoteConfig keys,
// served by GET /config — public, no auth). Tier prices are USD in cents.
export type PublicConfig = Record<string, number | boolean | string>

export const configApi = {
  getPublic: async (): Promise<PublicConfig> => {
    const res = await apiClient.get<{ config: PublicConfig }>('/config')
    return res.data.config
  },
}
