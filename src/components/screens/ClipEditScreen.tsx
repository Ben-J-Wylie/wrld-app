// src/components/screens/ClipEditScreen.tsx
//
// Buffer-trim clip editor — the two-screen flow from the 2026-06-06 brief, behind a
// PageTabs pager: "Editor" (scrub the buffer + set a clip's in/out + name + save) and
// "Saved clips" (the Library list of SavedClipRows). Composes the C2 components:
// BufferScrubField + BufferTimeline (+ ClipBracket / SavedClipRegion / GapMarker /
// TimelineZoomControl) + ClipSourcesDrawer + SaveClipButton + SavedClipRow.
//
// ⚠️ MOCK DATA. The buffer substrate (per-source rolling-buffer record-to-disk +
// the segments / saved-regions / recorded-layers contract) is Aaron's C1 lane and
// isn't built yet. Everything below the MOCK SEAM is local stub state; saving a clip
// just appends to in-memory lists. When the substrate lands, swap the seam for the
// real hooks (e.g. useBufferSegments / useSavedClips) — the component props are
// already shaped for it. This screen exists now so the gesture surfaces (scrub,
// bracket drag, zoom, no-overlap clamp) are testable on a real page, not just the
// gallery.

import { useEffect, useState } from 'react'
import { router } from 'expo-router'
import { StyleSheet, View } from 'react-native'
import { ScreenScroll } from '@/components/sections/ScreenScroll'
import { ScreenHeader } from '@/components/sections/ScreenHeader'
import { PageTabs } from '@/components/features/navigation/PageTabs'
import { TimeScrubber } from '@/components/features/discovery/TimeScrubber'
import { Text } from '@/components/primitives/Text'
import { Input } from '@/components/primitives/Input'
import { Pressable } from '@/components/primitives/Pressable'
import { Icon } from '@/components/primitives/Icon'
import { SaveClipButton } from '@/components/features/broadcast/SaveClipButton'
import { BufferScrubField } from '@/components/features/clip/BufferScrubField'
import {
  BufferTimeline,
  type BufferSavedRegion,
  type BufferBracket,
} from '@/components/features/clip/BufferTimeline'
import { TimelineZoomControl, type TimelineZoom } from '@/components/primitives/TimelineZoomControl'
import { ClipSourcesDrawer, type ClipSource } from '@/components/features/clip/ClipSourcesDrawer'
import { SavedClipRow } from '@/components/features/clip/SavedClipRow'
import { theme } from '@/tokens/theme'

type Page = 'editor' | 'saved'

type SavedClip = {
  id: string
  name: string
  capturedAt: string
  durationSec: number
  variant: 'camera' | 'audio-only' | 'map-only'
  sourcesLabel: string
  visibility: 'draft' | 'anon' | 'public'
}

const H = 3_600_000
const DEFAULT_CLIP_MS = 120_000 // 2 min default bracket on "New clip"
const MIN_BRACKET_MS = 500
// Coarse field-swipe sensitivity (ms moved per px) per zoom — the timeline track
// gives precise scrub; the field is the fast pass.
const FIELD_MS_PER_PX: Record<TimelineZoom, number> = {
  all: 120_000,
  hours: 60_000,
  min: 5_000,
  sec: 500,
}

// ─────────────────────────── MOCK SEAM (Aaron C1/C4) ───────────────────────────
// Replace this block with the real buffer substrate. Shapes match the component
// props so the swap is local to this screen.
function useMockBuffer() {
  const [now] = useState(() => Date.now())
  const segments = [
    { id: 's1', startMs: now - 8 * H, endMs: now - 5 * H },
    { id: 's2', startMs: now - 4 * H, endMs: now - 0.5 * H },
    { id: 's3', startMs: now - 0.3 * H, endMs: now },
  ]
  return { now, segments, bufferStartMs: segments[0]!.startMs, bufferEndMs: now }
}
// ────────────────────────────────────────────────────────────────────────────────

export const ClipEditScreen = () => {
  const { now, segments, bufferStartMs, bufferEndMs } = useMockBuffer()

  const [page, setPage] = useState<Page>('editor')
  const [zoom, setZoom] = useState<TimelineZoom>('all')
  // The buffer playhead is an offset behind the live head (0 = now) — the same model
  // the time-machine TimeScrubber uses, so the clock, the timeline, and the image
  // swipe all drive one value. A 1s tick keeps the live head fresh (and keeps the
  // timeline playhead in lockstep with the clock during playback).
  const [offsetMs, setOffsetMs] = useState(2 * H)
  const [, setClockTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setClockTick((t) => (t + 1) % 60), 1000)
    return () => clearInterval(id)
  }, [])
  const playheadMs = Date.now() - offsetMs
  const clampOffset = (v: number) => clamp(v, 0, Math.max(0, Date.now() - bufferStartMs))
  const [bracket, setBracket] = useState<BufferBracket | null>(null)
  const [name, setName] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)

  const [savedRegions, setSavedRegions] = useState<BufferSavedRegion[]>([
    { id: 'r1', startMs: now - 3 * H, endMs: now - 2.5 * H, label: 'SAVED' },
  ])
  const [savedClips, setSavedClips] = useState<SavedClip[]>([
    {
      id: 'r1',
      name: 'Soundcheck',
      capturedAt: fmtClipStamp(now - 3 * H),
      durationSec: 1800,
      variant: 'camera',
      sourcesLabel: 'Cam · Aud',
      visibility: 'public',
    },
  ])
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [sources, setSources] = useState<ClipSource[]>([
    { key: 'cam', iconName: 'video', label: 'CAMERA', value: '1080P', active: true },
    { key: 'aud', iconName: 'mic', label: 'AUDIO', value: '48 KHZ', active: true },
    { key: 'loc', iconName: 'map-pin', label: 'LOCATION', value: 'GPS', active: true },
    { key: 'comp', iconName: 'compass', label: 'COMPASS', value: '192°', active: false },
    { key: 'gyro', iconName: 'navigation', label: 'GYRO', value: 'OFF', active: false },
  ])
  const activeCount = sources.filter((s) => s.active).length

  function handleFieldScrub(deltaPx: number) {
    // Drag right (dx>0) → earlier → larger offset. Functional update so the
    // incremental per-move deltas accumulate within a single gesture.
    const max = Math.max(0, Date.now() - bufferStartMs)
    setOffsetMs((o) => clamp(o + deltaPx * FIELD_MS_PER_PX[zoom], 0, max))
  }

  function newClip() {
    const half = DEFAULT_CLIP_MS / 2
    const inMs = clamp(playheadMs - half, bufferStartMs, bufferEndMs - DEFAULT_CLIP_MS)
    setBracket({ inMs, outMs: inMs + DEFAULT_CLIP_MS })
  }

  function saveClip() {
    if (!bracket) return
    const id = `c${savedClips.length + 1}-${bracket.inMs}`
    const durationSec = Math.max(1, Math.round((bracket.outMs - bracket.inMs) / 1000))
    const activeSources = sources.filter((s) => s.active)
    const sourcesLabel = activeSources.map((s) => titleCase(s.label)).join(' · ')
    const hasCam = activeSources.some((s) => s.key === 'cam')
    const hasAud = activeSources.some((s) => s.key === 'aud')
    setSavedClips((prev) => [
      {
        id,
        name: name.trim() || 'Untitled clip',
        capturedAt: fmtClipStamp(bracket.inMs),
        durationSec,
        variant: hasCam ? 'camera' : hasAud ? 'audio-only' : 'map-only',
        sourcesLabel,
        visibility: 'draft',
      },
      ...prev,
    ])
    setSavedRegions((prev) => [...prev, { id, startMs: bracket.inMs, endMs: bracket.outMs, label: 'SAVED' }])
    setBracket(null)
    setName('')
    setExpandedId(id)
    setPage('saved')
  }

  function deleteClip(id: string) {
    setSavedClips((prev) => prev.filter((c) => c.id !== id))
    setSavedRegions((prev) => prev.filter((r) => r.id !== id))
  }

  const canSave = bracket != null && bracket.outMs - bracket.inMs >= MIN_BRACKET_MS

  return (
    <ScreenScroll
      header={<ScreenHeader title="Clip editor" onBack={() => router.back()} />}
      contentContainerStyle={styles.content}
    >
      <PageTabs
        tabs={[
          { key: 'editor', label: 'Editor' },
          { key: 'saved', label: `Saved clips${savedClips.length ? ` · ${savedClips.length}` : ''}` },
        ]}
        value={page}
        onChange={setPage}
        style={styles.pager}
      />

      {page === 'editor' ? (
        <View style={styles.editor}>
          {/* Field (image swipe-to-scrub) with the time-machine clock overlaid at
              its bottom — expand it to spin-scrub the buffer. Both drive offsetMs. */}
          <View style={[styles.fieldWrap, styles.fullBleed]}>
            <BufferScrubField
              variant={sources.find((s) => s.key === 'cam')?.active ? 'camera' : 'audio-only'}
              reachLabel="Buffer · 72h"
              onScrub={handleFieldScrub}
            />
            <TimeScrubber
              offsetMs={offsetMs}
              onOffsetChange={(v) => setOffsetMs(clampOffset(v))}
              style={styles.clockOverlay}
            />
          </View>

          <View style={styles.tlBlock}>
            <TimelineZoomControl value={zoom} onChange={setZoom} />
            <BufferTimeline
              segments={segments}
              savedRegions={savedRegions}
              playheadMs={playheadMs}
              zoom={zoom}
              bracket={bracket}
              onScrub={(ms) => setOffsetMs(clampOffset(Date.now() - ms))}
              onBracketChange={setBracket}
              style={styles.fullBleed}
            />
          </View>

          <View style={styles.btnRow}>
            {bracket ? (
              <TbBtn icon="rotate-ccw" label="Reset" onPress={() => setBracket(null)} muted />
            ) : (
              <TbBtn icon="plus" label="New clip" onPress={newClip} accent />
            )}
            <TbBtn
              icon="grid"
              label="Sources"
              trailing={`${activeCount}/${sources.length}`}
              onPress={() => setDrawerOpen(true)}
              muted
            />
          </View>

          <Input value={name} onChangeText={setName} placeholder="Name this clip" />

          <SaveClipButton
            label={canSave ? `Save clip · ${fmtDur((bracket!.outMs - bracket!.inMs) / 1000)}` : 'Save clip'}
            hint={canSave ? 'Saves as a private draft' : 'Drop a clip to enable save'}
            disabled={!canSave}
            onPress={saveClip}
          />
        </View>
      ) : (
        <View style={styles.saved}>
          {savedClips.length === 0 ? (
            <View style={styles.empty}>
              <Icon name="scissors" size="lg" color={theme.colors.text.subtle} />
              <Text variant="bodyEmphasized">No clips yet</Text>
              <Text variant="caption" color={theme.colors.text.muted} style={styles.emptyText}>
                Clips you cut from your buffer land here as private drafts.
              </Text>
              <Pressable variant="default" onPress={() => setPage('editor')} style={styles.emptyCta}>
                <Icon name="plus" size="sm" color={theme.colors.accent.default} />
                <Text variant="bodyEmphasized" color={theme.colors.accent.default}>
                  New clip
                </Text>
              </Pressable>
            </View>
          ) : (
            savedClips.map((c) => (
              <SavedClipRow
                key={c.id}
                name={c.name}
                capturedAt={c.capturedAt}
                durationSec={c.durationSec}
                variant={c.variant}
                sourcesLabel={c.sourcesLabel}
                visibility={c.visibility}
                expanded={expandedId === c.id}
                onToggleExpand={() => setExpandedId((id) => (id === c.id ? null : c.id))}
                onShare={() => {}}
                onPublish={() =>
                  setSavedClips((prev) =>
                    prev.map((x) => (x.id === c.id ? { ...x, visibility: 'public' } : x)),
                  )
                }
                onDelete={() => deleteClip(c.id)}
              />
            ))
          )}
        </View>
      )}

      <ClipSourcesDrawer
        visible={drawerOpen}
        sources={sources}
        onToggleSource={(k) =>
          setSources((s) => s.map((x) => (x.key === k ? { ...x, active: !x.active } : x)))
        }
        onDismiss={() => setDrawerOpen(false)}
      />
    </ScreenScroll>
  )
}

function TbBtn({
  icon,
  label,
  trailing,
  onPress,
  accent,
  muted,
}: {
  icon: Parameters<typeof Icon>[0]['name']
  label: string
  trailing?: string
  onPress: () => void
  accent?: boolean
  muted?: boolean
}) {
  const tint = accent ? theme.colors.accent.default : theme.colors.text.primary
  return (
    <Pressable
      variant="default"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.tbBtn, accent && styles.tbBtnAccent, muted && styles.tbBtnMuted]}
    >
      <Icon name={icon} size="sm" color={accent ? theme.colors.accent.default : theme.colors.text.muted} />
      <Text variant="bodyEmphasized" color={tint}>
        {label}
      </Text>
      {trailing != null && (
        <Text variant="monoLabel" color={theme.colors.text.muted}>
          {trailing}
        </Text>
      )}
    </Pressable>
  )
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
function pad(n: number): string {
  return String(n).padStart(2, '0')
}
function fmtClipStamp(ms: number): string {
  const d = new Date(ms)
  return `${pad(d.getHours())}:${pad(d.getMinutes())} · ${MON[d.getMonth()]} ${d.getDate()}`
}
function fmtDur(sec: number): string {
  const total = Math.max(0, Math.round(sec))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${pad(s)}`
}
function titleCase(s: string): string {
  return s.charAt(0) + s.slice(1).toLowerCase()
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: theme.spacing.xxxl,
  },
  pager: {
    marginTop: theme.spacing.sm,
  },
  editor: {
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  // Field + clock and the timeline go edge-to-edge (cancel the editor's lg
  // padding) — the field is the hero, and the full width gives the time-machine
  // clock room to lay out its six wheels + status without overflowing.
  fullBleed: {
    marginHorizontal: -theme.spacing.lg,
  },
  fieldWrap: {
    position: 'relative',
  },
  clockOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  tlBlock: {
    gap: theme.spacing.sm,
  },
  btnRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  tbBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    height: 42,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border.strong,
    backgroundColor: theme.colors.bg.elevated,
  },
  tbBtnAccent: {
    borderColor: theme.colors.accent.border,
    backgroundColor: theme.colors.accent.surface,
  },
  tbBtnMuted: {},
  saved: {
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.xxxl,
  },
  emptyText: {
    textAlign: 'center',
    maxWidth: 240,
  },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    height: 44,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.accent.border,
    backgroundColor: theme.colors.accent.surface,
  },
})
