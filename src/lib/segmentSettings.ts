// src/lib/segmentSettings.ts
//
// PB4(a) — the per-segment settings data model (generalises `privacyRanges.ts` from a single
// boolean axis to the full multi-axis settings object). A session's manifest is a
// piecewise-constant function over the wall clock: a NON-OVERLAPPING, coalesced list of
// override ranges, each carrying a PARTIAL settings object; a gap = inherit the go-live value.
// All axes are first-class + equal (a compass toggle is the same kind of edit as private/public).
//
// Pure + dependency-free → unit-testable (H3). The DISPLAY segmentation is this lib's settings
// boundaries UNIONED with the user's snips (a separate, explicit boundary source the screen
// owns) — so a no-op snip still shows even though it changes no settings. This lib is snip-free.

export type Visibility = 'public' | 'private'
export type Precision = 'exact' | 'city' | 'country' | 'off'
export type Identity = 'attributed' | 'anon'

// A PARTIAL override — an absent field inherits the go-live/capture value. `sources` is per-kind
// on/off (which captured sources a time-machine viewer may see over this span).
export type SegSettings = {
  visibility?: Visibility
  precision?: Precision
  identity?: Identity
  sources?: Record<string, boolean>
  title?: string
  tags?: string[]
}

// One non-overlapping override span on a session (wall-clock ms).
export type SettingsRange = { sessionId: string; startMs: number; endMs: number; settings: SegSettings }

function sourcesEqual(a?: Record<string, boolean>, b?: Record<string, boolean>): boolean {
  const ak = a ? Object.keys(a) : []
  const bk = b ? Object.keys(b) : []
  if (ak.length !== bk.length) return false
  return ak.every((k) => a![k] === b?.[k])
}

function tagsEqual(a?: string[], b?: string[]): boolean {
  const aa = a ?? []
  const bb = b ?? []
  return aa.length === bb.length && aa.every((t, i) => t === bb[i])
}

export function settingsEqual(a: SegSettings, b: SegSettings): boolean {
  return (
    a.visibility === b.visibility &&
    a.precision === b.precision &&
    a.identity === b.identity &&
    sourcesEqual(a.sources, b.sources) &&
    (a.title ?? '') === (b.title ?? '') &&
    tagsEqual(a.tags, b.tags)
  )
}

export function isEmptySettings(s: SegSettings): boolean {
  return (
    s.visibility === undefined &&
    s.precision === undefined &&
    s.identity === undefined &&
    (s.sources === undefined || Object.keys(s.sources).length === 0) &&
    (s.title === undefined || s.title === '') &&
    (s.tags === undefined || s.tags.length === 0)
  )
}

// Merge `patch` over `base` per field. A field explicitly set to `undefined` in `patch` CLEARS it
// (back to inherit); `sources` merges per-kind. Returns a fresh object with no undefined keys.
export function mergeSettings(base: SegSettings, patch: SegSettings): SegSettings {
  const out: SegSettings = { ...base }
  if ('visibility' in patch) { if (patch.visibility === undefined) delete out.visibility; else out.visibility = patch.visibility }
  if ('precision' in patch) { if (patch.precision === undefined) delete out.precision; else out.precision = patch.precision }
  if ('identity' in patch) { if (patch.identity === undefined) delete out.identity; else out.identity = patch.identity }
  if ('sources' in patch) {
    const merged = { ...(base.sources ?? {}), ...(patch.sources ?? {}) }
    out.sources = Object.keys(merged).length ? merged : undefined
    if (out.sources === undefined) delete out.sources
  }
  if ('title' in patch) { if (!patch.title) delete out.title; else out.title = patch.title }
  if ('tags' in patch) { if (!patch.tags || !patch.tags.length) delete out.tags; else out.tags = patch.tags }
  return out
}

// The resolved override at an instant (the covering range's settings, or {} = inherit).
export function settingsAt(ranges: SettingsRange[], sessionId: string, atMs: number): SegSettings {
  const r = ranges.find((x) => x.sessionId === sessionId && atMs >= x.startMs && atMs < x.endMs)
  return r ? r.settings : {}
}

// Sorted unique settings-boundary instants within a session (every override edge). The screen
// unions these with snips to get the display segmentation.
export function settingsBoundaries(ranges: SettingsRange[], sessionId: string): number[] {
  const set = new Set<number>()
  for (const r of ranges) if (r.sessionId === sessionId) { set.add(r.startMs); set.add(r.endMs) }
  return [...set].sort((a, b) => a - b)
}

// Coalesce adjacent same-session ranges with equal settings; drop empty (= inherit) ranges.
export function coalesce(ranges: SettingsRange[]): SettingsRange[] {
  const bySession = new Map<string, SettingsRange[]>()
  for (const r of ranges) {
    if (r.endMs <= r.startMs || isEmptySettings(r.settings)) continue
    const arr = bySession.get(r.sessionId) ?? []
    arr.push(r)
    bySession.set(r.sessionId, arr)
  }
  const out: SettingsRange[] = []
  for (const [sessionId, arr] of bySession) {
    arr.sort((a, b) => a.startMs - b.startMs)
    let cur: SettingsRange = { ...arr[0]!, settings: { ...arr[0]!.settings } }
    for (let i = 1; i < arr.length; i++) {
      const r = arr[i]!
      if (r.startMs <= cur.endMs && settingsEqual(r.settings, cur.settings)) {
        cur.endMs = Math.max(cur.endMs, r.endMs)
      } else {
        out.push(cur)
        cur = { ...r, settings: { ...r.settings }, sessionId }
      }
    }
    out.push(cur)
  }
  return out
}

// Apply a settings `patch` over a span: split existing ranges at the span edges, merge the patch
// into the covered pieces (a field=undefined clears it), keep the non-covered remainders, drop
// any piece that becomes empty (full inherit), and coalesce equal neighbours. Non-overlapping
// invariant preserved. This subsumes privacyRanges add (visibility:'private') / subtract
// (visibility:undefined).
export function applySetting(
  ranges: SettingsRange[],
  span: { sessionId: string; startMs: number; endMs: number },
  patch: SegSettings,
): SettingsRange[] {
  if (span.endMs <= span.startMs) return coalesce(ranges)
  const out: SettingsRange[] = []
  let covered = false
  for (const r of ranges) {
    if (r.sessionId !== span.sessionId || r.endMs <= span.startMs || r.startMs >= span.endMs) {
      out.push(r) // untouched
      continue
    }
    // overlap → keep the outside remainders unchanged
    if (r.startMs < span.startMs) out.push({ sessionId: r.sessionId, startMs: r.startMs, endMs: span.startMs, settings: { ...r.settings } })
    if (r.endMs > span.endMs) out.push({ sessionId: r.sessionId, startMs: span.endMs, endMs: r.endMs, settings: { ...r.settings } })
    // the inside slice takes base+patch
    const lo = Math.max(r.startMs, span.startMs)
    const hi = Math.min(r.endMs, span.endMs)
    out.push({ sessionId: r.sessionId, startMs: lo, endMs: hi, settings: mergeSettings(r.settings, patch) })
    covered = true
  }
  // any part of the span not previously covered → a fresh patch-only range (over base = {})
  if (!covered) {
    out.push({ sessionId: span.sessionId, startMs: span.startMs, endMs: span.endMs, settings: mergeSettings({}, patch) })
  } else {
    // fill gaps within the span that had no prior range, so the whole span gets the patch
    const inSpan = out
      .filter((r) => r.sessionId === span.sessionId && r.startMs >= span.startMs && r.endMs <= span.endMs)
      .sort((a, b) => a.startMs - b.startMs)
    let cursor = span.startMs
    for (const r of inSpan) {
      if (r.startMs > cursor) out.push({ sessionId: span.sessionId, startMs: cursor, endMs: r.startMs, settings: mergeSettings({}, patch) })
      cursor = Math.max(cursor, r.endMs)
    }
    if (cursor < span.endMs) out.push({ sessionId: span.sessionId, startMs: cursor, endMs: span.endMs, settings: mergeSettings({}, patch) })
  }
  return coalesce(out)
}
