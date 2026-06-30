import { apiClient } from './client'

// Legal documents (Terms of Service, Community Rules, Creator Guidelines,
// Privacy Policy) — served by the public GET /legal route. The bodies are
// admin-editable RemoteConfig (Markdown), so the wording updates live with no
// app build; the app just fetches and renders. Public, no auth.

export type LegalSlug = 'terms' | 'community' | 'creator' | 'privacy'

export type LegalDocument = {
  slug: LegalSlug
  title: string
  markdown: string
  version: string
  updatedAt: string | null
}

export const legalApi = {
  getAll: async (): Promise<LegalDocument[]> => {
    const res = await apiClient.get<{ documents: LegalDocument[] }>('/legal')
    return res.data.documents
  },
  // GET /legal/:slug returns the document object directly.
  get: async (slug: string): Promise<LegalDocument> => {
    const res = await apiClient.get<LegalDocument>(`/legal/${slug}`)
    return res.data
  },
}
