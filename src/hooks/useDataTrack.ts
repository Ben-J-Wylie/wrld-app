import { useEffect, useState } from 'react'

// One parsed sample of a data track (location {ts,lat,lng} · compass {ts,heading} ·
// gyro {ts,pitch,roll} · chat {ts,handle,text} · …). `ts` is wall-clock ms.
export type DataSample = { ts: number; [field: string]: unknown }

// Fetch + parse a data track's NDJSON (`.jsonl`) into ts-sorted samples. `url` is the
// tokenized buffer data-track URL (`session.dataUrls[kind]`) or a saved clip's
// `track.dataUrl`. The clip editor replays these through the design renderers (C6).
// Re-fetches when the url changes (switching source / session under the playhead);
// returns [] while loading / on error so the renderer shows its idle/placeholder.
export function useDataTrack(url: string | undefined | null): DataSample[] {
  const [samples, setSamples] = useState<DataSample[]>([])
  useEffect(() => {
    if (!url) {
      setSamples([])
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(url)
        if (!res.ok) {
          if (!cancelled) setSamples([])
          return
        }
        const text = await res.text()
        const out: DataSample[] = []
        for (const line of text.split('\n')) {
          const trimmed = line.trim()
          if (!trimmed) continue
          try {
            const o = JSON.parse(trimmed) as Record<string, unknown>
            const ts = typeof o.ts === 'number' ? o.ts : typeof o.t === 'number' ? o.t : null
            if (ts != null) out.push({ ...o, ts })
          } catch {
            /* skip a malformed line */
          }
        }
        if (!cancelled) setSamples(out)
      } catch {
        if (!cancelled) setSamples([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [url])
  return samples
}
