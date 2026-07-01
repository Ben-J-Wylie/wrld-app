// src/api/eras.ts
//
// The unified-manifest client — the clean-cut backend surface (wrld-backend 4ddac43, src/routes/eras.ts).
// One rules object (`Era`) over a `Recording`; every edit is a PATCH of era values; snip/mend/delete are
// the structural ops; "save" = PATCH { keep: 'kept' }. Supersedes bufferApi / clipsApi.

import { apiClient } from './client'
import type { DiscoverResult, EraDetail, EraPatch, MyRecording } from '@/types/era'

export const erasApi = {
  // The one globe feed (live + time machine). Low zoom → { count, pins: [] }; high zoom → resolved pins.
  discover: async (planet: string, t: number, z: number, x: number, y: number): Promise<DiscoverResult> =>
    (await apiClient.get<DiscoverResult>('/discover', { params: { planet, t, z, x, y } })).data,

  // The viewer: an era + its recording + per-source footage URLs. Access-gated (403 if not entitled).
  get: async (id: string): Promise<EraDetail> => (await apiClient.get<EraDetail>(`/eras/${id}`)).data,

  // The owner timeline: recordings + their eras + survivingRegions.
  myRecordings: async (): Promise<MyRecording[]> =>
    (await apiClient.get<{ recordings: MyRecording[] }>('/me/recordings')).data.recordings,

  // Edit any per-era value (incl. save = { keep: 'kept' }). Returns { ok, era: { id, keep } }.
  patch: async (id: string, patch: EraPatch): Promise<void> => {
    await apiClient.patch(`/eras/${id}`, patch)
  },

  // Structural ops. snip → the covering era splits at atMs into two (right inherits the values).
  snip: async (recordingId: string, atMs: number): Promise<{ eras: [string, string] }> =>
    (await apiClient.post<{ ok: boolean; eras: [string, string] }>(`/recordings/${recordingId}/snip`, { atMs })).data,
  // mend → drop the boundary at atMs (merge the two adjacent eras into one).
  mend: async (recordingId: string, atMs: number): Promise<void> => {
    await apiClient.post(`/recordings/${recordingId}/mend`, { atMs })
  },
  // delete → permanent removal of the era (row + footage). The only destructive op.
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/eras/${id}`)
  },
}
