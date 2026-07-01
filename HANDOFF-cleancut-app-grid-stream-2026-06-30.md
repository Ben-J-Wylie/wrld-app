# HANDOFF — clean-cut app: the last two consumers (Clips grid + StreamScreen) + delete-old

> Continuation of the clean-cut `Recording`+`Era` app rewrite
> (`HANDOFF-cleancut-recording-era-2026-06-30.md`). **6 of 8 consumers are done + pushed to `design`**;
> this doc is the exact, executable spec for the **remaining two** (they're the large, coupled ones)
> plus the final delete pass. Everything here was traced against the **deployed** backend
> (`origin/main` `fa630f2`, route `src/routes/eras.ts`) — the contract is authoritative, not guessed.

## Done + pushed to `design` (all tsc 0-errors)
- **Foundation** — `src/types/era.ts`, `src/api/eras.ts` (+ `erasApi.report`).
- **Hooks** — `src/hooks/useDiscover.ts` (the one `/discover` cell feed), `src/hooks/useMyRecordings.ts`
  (owner timeline; **injects `recordingId` into each era** — the `/me/recordings` payload nests eras
  without it, and snip/mend need it).
- **Viewer** — `ClipViewerScreen` → `erasApi.get`/`EraDetail`.
- **Editor** — `src/components/features/clip/EraSettingsSheet.tsx` (the ONE drawer; `erasApi.patch`/
  `delete` + invalidate `['me','recordings']`/`['era',id]`/`['discover-cell']`). **Dormant** until the
  grid + Me adopt it — Me already does.
- **Me** — `MeProfileTab` saved feed = kept eras (`keep==='kept'`) across recordings → `EraSettingsSheet`.
- **Globe** — `GlobeScreenMapbox` time-machine → `useDiscover`/`DiscoverPin` (live Earth / Haven /
  drawer paths UNCHANGED — those `Stream` routes survived the clean-cut).

## Key contract findings (from the deployed `eras.ts`)
1. **`GET /me/recordings`** → `{ recordings: MyRecording[] }`. Each recording has `survivingRegions`
   (contiguous on-disk spans) + `eras[]`. **Eras carry NO manifest URL** (only `thumbnailUrl`) and
   **no `recordingId`** (it's the parent — `useMyRecordings` injects it). `endAtMs: null` = the open/live era.
2. **Playback is per-era.** To play an era you `GET /eras/:id` → `EraDetail.sources[]` where the camera
   entry's `manifestUrl` = `/eras/:id/camera/index.m3u8?t=…` (a VOD stitched to the era window; **an
   ended era ends with `#EXT-X-ENDLIST`, an open era keeps polling**). Within that manifest,
   **`currentTime 0 ≈ era.startAtMs`** (PDT-tagged), so `seekSec = (playhead − era.startAtMs)/1000`.
   This *replaces* the old `session.manifestUrl` + `mediaStartOffsetMs` model.
3. **`windowHours` / `serverNowMs` are GONE** from `/me/recordings`. The reaper-window *prediction*
   (leading "footage clears in X" countdown, the window-floor divider, `reaperEdgeMs`/`windowMs`) has
   no inputs → **degrade**: pass `reaperEdgeMs={null}` / `windowMs={0}` to `ClipsTimeline` (it already
   treats null/0 as "no windowing"). **Actual eviction still shows** via `recording.survivingRegions`
   (interior holes → gaps). Follow-up for Aaron: re-expose `windowHours`+`serverNowMs` on
   `/me/recordings` if we want the prediction UX back.
4. **Snip/mend are server-side era ops** (not local split points): `POST /recordings/:id/snip {atMs}`
   splits the covering era in two (right inherits values); `POST /recordings/:id/mend {atMs}` merges.
   So the whole local `splitPoints`/`applySplits`/`settingsRanges`/directive machinery **deletes**.
5. **"Record" = the lane axis, not a separate endpoint.** The clean-cut deleted `/recordings`
   (start/stop). Go live with `lane:'saved'` (already on `captureConfig.lane` + `createRoom`) → the
   era is `keep:'kept'` from go-live; the Record button toggles it. `recordingsApi` is dead.

---

## Task A — `ClipsScreen` (the grid) → `Recording`/`Era`

**Preserve** (they're presentational / clock machinery and stay): `ClipsTimeline` (+ its handle:
`setNowUi`/`scrollToTime`/`getCenter`/`stampPlayAnchor`/`clearPlayDrive`/`snapToReaper`), `ClipViewer`,
`BufferTransport`, `SourceRail`, `SourceStage`, `TimeScrubber`, the playhead/`nowUi` RAF feed, the
follow/seek/recovery loops, `serverClock`, and the entire JSX/return.

**Collapse to nothing** (delete): `carveBuffer`/`carveLiveBlock`/`subtractRange`/`Claim`/`claims`/
`reapedClaims`/`carveClaims`, `pendingSaves`/`pendingUnsave`/`matchesReal`, `drafts`/`savedLaneAll`/
`savedLaneSessions`/`savedLaneReal`, `splitPoints`/`settingBoundaries`/`effectiveSplits`/`applySplits`/
`splitPiece`, `settingsRanges`/`seededPrivateRef`/`seededSnipsRef`/`settingsForSeg`/
`patchSessionDirectives`/`applySegSetting`/`persistSnips`, `bufEntry`/`sessionTitleAt`/`mediaStartMs`/
`sessionStartMs`/`sessionEndMs`, and the `useBuffer`/`useSavedClips`/`useDrafts` + `bufferApi`/
`clipDirectives`/`segmentSettings` imports.

**New data layer** (≈150 lines replacing ≈1000):
```ts
const { data: recordings } = useMyRecordings(!!isSignedIn, isLive)
// nowMs: no serverNowMs on /me/recordings → serverClock's serverNow() (fed elsewhere; falls back to Date.now)
// One LaneClip per era; lane = keep. endMs = era.endAtMs ?? nowMs (open era → live edge).
const eraToLane = (e: Era, r: MyRecording): LaneClip => ({
  id: e.id,
  startMs: e.startAtMs,
  endMs: e.endAtMs ?? nowMs,
  label: e.title?.trim() || fmtTime(e.startAtMs),
  sublabel: fmtDur(((e.endAtMs ?? nowMs) - e.startAtMs) / 1000),
  posterUrl: e.thumbnailUrl,
  manifestUrl: null,           // fetched per-era on selection (see player)
  sourceSessionId: r.id,       // = recordingId (snip/mend target)
})
const allEras = (recordings ?? []).flatMap((r) => r.eras.map((e) => ({ e, r })))
const bufferedLane = allEras.filter(x => x.e.keep === 'reapable').map(x => eraToLane(x.e, x.r))
const savedLane    = allEras.filter(x => x.e.keep === 'kept').map(x => eraToLane(x.e, x.r))
const liveSessionId = allEras.find(x => x.e.endAtMs == null)?.r.id ?? null   // open era's recording
```
- **Interior eviction holes**: for each recording with ≥2 `survivingRegions`, split any era that
  straddles a hole into per-region `LaneClip`s (id `${eraId}~${regionStart}`) with the hole as a gap —
  port the old `reapedClaims` logic but drive it off `recording.survivingRegions` per era window
  (intersect region set with `[era.start, era.end]`). Keep it simple: if it's fiddly, ship interior
  holes as a follow-up (the era still renders as one block; eviction of a whole era just drops it).
- **Windowing**: `reaperEdgeMs={null}`, `windowMs={0}` (degrade, see finding #3).

**Player (per-era manifest)** — the one real new mechanism. When the viewer's era changes
(`viewerClip.id`), `useQuery(['era', id], () => erasApi.get(id))` → the camera `manifestUrl`; feed it
to the existing load/seek effect. Seek offset within the era = `playhead − era.startAtMs`. The existing
recovery (refetch token + `replaceAsync` + poster fallback) still applies — on error, invalidate
`['era', id]` to re-mint the token. Cache by eraId (TanStack does this). The recorded-source rail +
`useDataTrack` already key off per-source `dataUrl`s from `erasApi.get` (same as `ClipViewerScreen`).

**Handlers** → `erasApi`:
- `onSave(clip)` → `erasApi.patch(clip.id, { keep: 'kept' })` + invalidate `['me','recordings']`.
- `onUnsave(clip)` → `erasApi.patch(clip.id, { keep: 'reapable' })`.
- `handleScissor` (cut) → `erasApi.snip(clip.sourceSessionId!, Math.round(centerTimeMs))`; (heal /
  bandaid over a boundary) → `erasApi.mend(recordingId, atMs)`. Drop the local split-point + differ-
  guard machinery — mend's value-conflict is handled server-side (right inherits on snip; mend merges).
- Double-tap `onOpen(clip)` → open **`EraSettingsSheet`** with the covering `Era` (find it in
  `recordings`), `availableSources` = `recording.kinds.map(KIND_TO_FEEDKIND)`, `manifestUrl`/`posterUrl`
  from the era, `showLane` unless reaper-past. The sheet is self-contained (patch/delete/invalidate) —
  the screen no longer needs `onSheetChange`/`onDeleteClip`/`onDeleteSource`/`sheetData`.
- Delete → the sheet's own delete (`erasApi.delete`).

**Net**: the screen shrinks a lot; the risk is the player + the clock feed. Do it as ONE rewrite (not
30 in-place edits) and keep `tsc` green. Device-test the timeline scroll/scrub, per-era playback +
boundary swaps, snip/mend, save/un-save, and the settings sheet.

## Task B — `StreamScreen` recording path → era model
- Drop `useBuffer` + `bufferApi` (the U2 live-snip `bufferApi.snipSession` → `erasApi.snip(recordingId,
  atMs)`; get the open recording id from `useMyRecordings` (open era) instead of `useBuffer`).
- Drop `recordingsApi` (start/stop). "Record" is the lane axis: Go Live already carries
  `captureConfig.lane`; the Record button toggles the OPEN era's `keep` via `erasApi.patch` (needs the
  open era id from `useMyRecordings`), or flips `captureConfig.lane` for the next go-live. Reconcile with
  `broadcastStore`'s `startRecording`/`stopRecording` commands + `GoLiveRecordBar`.
- Keep everything else (mediasoup signaling, `createRoom` with `lane`, the source rail, telemetry).

## Task C — delete the old (only after A + B compile on eras)
Delete: `src/api/buffer.ts`, `src/api/clips.ts`, `src/api/recordings.ts`, `src/types/clip.ts`,
`src/lib/clipDirectives.ts`, `src/lib/segmentSettings.ts`, `src/hooks/useBuffer.ts`,
`src/hooks/useSavedClips.ts`, `src/hooks/useDrafts.ts`, `src/hooks/useHistoricalClips.ts`,
`src/hooks/useHistoricalCells.ts`, `src/hooks/useHistoricalAvailability.ts`,
`src/components/features/clip/SegmentSettingsSheet.tsx`,
`src/components/features/clip/SavedClipSettingsSheet.tsx`, and `src/__tests__/segmentSettings.test.ts`.
Then fix the remaining importers: `broadcastStore` (check what it pulls from the deleted modules),
`_dev/FeatureGallery.tsx` (drop the retired sheet demos). Final gate: `npx tsc --noEmit` → 0 errors
(the `stream/[id]` route-template errors are pre-existing/expected).

## Sequencing note
A + B keep the app tsc-green while the old modules still exist (they compile against them). C is the
last step and is what actually removes the old modules — do it only once A + B no longer import them.
