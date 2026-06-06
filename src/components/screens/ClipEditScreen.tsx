// src/components/screens/ClipEditScreen.tsx
//
// Buffer-trim clip editor — the two-screen flow from the 2026-06-06 brief, behind a
// PageTabs pager: "Editor" (scrub the buffer + set a clip's in/out + name + save) and
// "Saved clips" (the Library list of SavedClipRows). Composes the C2 components:
// BufferScrubField + BufferTimeline (+ ClipBracket / SavedClipRegion / GapMarker /
// TimelineScrollbar) + ClipSourcesDrawer + SaveClipButton + SavedClipRow.
//
// Buffer substrate wired to the real rolling buffer (R5): `useBuffer()` → the
// owner's sessions (GET /buffer/me, owner-gated tokenized HLS + poster thumbs).
// Sessions drive the timeline segments + collapsed gaps, the field's poster
// thumbnail, and the recorded-source list. Saved-clip PERSISTENCE is still R3
// (promote-on-publish) — saving stays in-session (local) until that backend
// route lands; the Saved tab + saved-regions reflect this session's saves only.

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
  type BufferSegment,
  type BufferSavedRegion,
  type BufferBracket,
} from '@/components/features/clip/BufferTimeline'
import { ClipSourcesDrawer, type ClipSource } from '@/components/features/clip/ClipSourcesDrawer'
import { SavedClipRow } from '@/components/features/clip/SavedClipRow'
import { useAuth } from '@clerk/clerk-expo'
import { useVideoPlayer, VideoView } from 'expo-video'
import { useBuffer } from '@/hooks/useBuffer'
import type { BufferSession, BufferTrackKind } from '@/api/buffer'
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
// Coarse image-swipe scrub sensitivity (ms per px) — the field is the fast pass;
// the timeline (tap / pan / pinch) is where precise positioning happens.
const FIELD_MS_PER_PX = 60_000

// Recorded-source kind → ClipSource row metadata (icon/label/value). Only the
// kinds the buffer actually captured are shown; unknown kinds are skipped.
const KIND_META: Record<string, { key: string; iconName: ClipSource['iconName']; label: string; value: string }> = {
  camera: { key: 'cam', iconName: 'video', label: 'CAMERA', value: 'VIDEO' },
  audio: { key: 'aud', iconName: 'mic', label: 'AUDIO', value: '48 KHZ' },
  location: { key: 'loc', iconName: 'map-pin', label: 'LOCATION', value: 'GPS' },
  compass: { key: 'comp', iconName: 'compass', label: 'COMPASS', value: 'DEG' },
  gyro: { key: 'gyro', iconName: 'navigation', label: 'GYRO', value: 'AXIS' },
}
const KIND_ORDER: BufferTrackKind[] = ['camera', 'audio', 'location', 'compass', 'gyro']
const SOURCE_DEFAULT_ON = new Set<BufferTrackKind>(['camera', 'audio', 'location'])
const EMPTY_SESSIONS: BufferSession[] = []

const sessionStartMs = (s: BufferSession) => Date.parse(s.startedAt)
const sessionEndMs = (s: BufferSession) => (s.endedAt ? Date.parse(s.endedAt) : Date.now())

export const ClipEditScreen = () => {
  const { isSignedIn } = useAuth()
  const { data: buffer } = useBuffer(!!isSignedIn)
  const sessions = buffer?.sessions ?? EMPTY_SESSIONS

  // Sessions → timeline segments; live session's end tracks the live head (the
  // 1s tick below re-renders so it stays fresh).
  const segments: BufferSegment[] = sessions.map((s) => ({
    id: s.id,
    startMs: sessionStartMs(s),
    endMs: sessionEndMs(s),
  }))
  const bufferStartMs = sessions.length ? sessionStartMs(sessions[0]!) : Date.now()
  const bufferEndMs = Date.now()

  const [page, setPage] = useState<Page>('editor')
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
  // While the TimeScrubber clock is expanded, lock the screen scroll so vertical
  // wheel drags aren't stolen by the ScrollView. Touching anything that isn't the
  // clock bumps collapseSignal → the clock collapses → scroll restores.
  const [clockExpanded, setClockExpanded] = useState(false)
  const [collapseSignal, setCollapseSignal] = useState(0)
  const collapseClock = () => {
    if (clockExpanded) setCollapseSignal((s) => s + 1)
  }
  const [bracket, setBracket] = useState<BufferBracket | null>(null)
  const [name, setName] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Saved-clip persistence is R3 — these stay in-session (local) until the
  // promote-on-publish backend route lands.
  const [savedRegions, setSavedRegions] = useState<BufferSavedRegion[]>([])
  const [savedClips, setSavedClips] = useState<SavedClip[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Recorded-source list seeded from the kinds the buffer actually captured.
  // Seeded once when sessions first arrive; user toggles are preserved after.
  const [sources, setSources] = useState<ClipSource[]>([])
  useEffect(() => {
    if (!sessions.length) return
    setSources((prev) => {
      if (prev.length) return prev
      const captured = new Set<string>()
      sessions.forEach((s) => s.kinds.forEach((k) => captured.add(k)))
      return KIND_ORDER.filter((k) => captured.has(k)).map((k) => ({
        ...KIND_META[k]!,
        active: SOURCE_DEFAULT_ON.has(k),
      }))
    })
  }, [sessions])
  const activeCount = sources.filter((s) => s.active).length

  // Field poster + variant follow the session under the playhead.
  const sessionAtPlayhead =
    sessions.find((s) => playheadMs >= sessionStartMs(s) && playheadMs <= sessionEndMs(s)) ?? null
  const fieldThumb = sessionAtPlayhead?.thumbnailUrl ?? null
  const fieldVariant: 'camera' | 'audio-only' | 'map-only' = sessionAtPlayhead?.kinds.includes('camera')
    ? 'camera'
    : sessionAtPlayhead?.kinds.includes('audio')
      ? 'audio-only'
      : 'map-only'

  // Live video frame layer for the scrub field — the camera session under the
  // playhead, played paused and seeked to the scrub position (the tokenized HLS
  // authorizes itself; no Clerk header needed). Audio-only/map-only → no video,
  // the field shows its fallback.
  const camSession = sessionAtPlayhead?.kinds.includes('camera') ? sessionAtPlayhead : null
  const camManifestUrl = camSession?.manifestUrl ?? null
  const player = useVideoPlayer(null, (p) => {
    p.muted = true
    p.pause()
  })
  useEffect(() => {
    if (!camManifestUrl) return
    player.replace({ uri: camManifestUrl, contentType: 'hls' })
    player.pause()
  }, [camManifestUrl, player])
  useEffect(() => {
    if (!camSession) return
    const offsetSec = Math.max(0, (playheadMs - sessionStartMs(camSession)) / 1000)
    const id = setTimeout(() => {
      try {
        player.currentTime = offsetSec
      } catch {}
    }, 40)
    return () => clearTimeout(id)
  }, [playheadMs, camSession, player])

  function handleFieldScrub(deltaPx: number) {
    // Drag right (dx>0) → earlier → larger offset. Functional update so the
    // incremental per-move deltas accumulate within a single gesture.
    const max = Math.max(0, Date.now() - bufferStartMs)
    setOffsetMs((o) => clamp(o + deltaPx * FIELD_MS_PER_PX, 0, max))
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
      scrollEnabled={!clockExpanded}
    >
      <PageTabs
        tabs={[
          { key: 'editor', label: 'Editor' },
          { key: 'saved', label: `Saved clips${savedClips.length ? ` · ${savedClips.length}` : ''}` },
        ]}
        value={page}
        onChange={(p) => {
          setClockExpanded(false) // leaving the editor unmounts the clock — restore scroll
          setPage(p)
        }}
        style={styles.pager}
      />

      {page === 'editor' ? (
        <View style={styles.editor}>
          {/* Field (image swipe-to-scrub) with the time-machine clock overlaid at
              its bottom — expand it to spin-scrub the buffer. Both drive offsetMs.
              While the clock is expanded the screen scroll is locked; touching the
              image (wrapped here) or anything below collapses it and restores scroll.
              The clock is a sibling of the field-touch wrapper (not a child), so
              touching the clock itself doesn't trigger collapse. */}
          <View style={[styles.fieldWrap, styles.fullBleed]}>
            <View onTouchStart={collapseClock}>
              <BufferScrubField
                variant={fieldVariant}
                thumbnailUrl={fieldThumb}
                frameSlot={
                  camManifestUrl ? (
                    <VideoView
                      player={player}
                      style={StyleSheet.absoluteFill}
                      nativeControls={false}
                      contentFit="cover"
                    />
                  ) : undefined
                }
                reachLabel={`Buffer · ${buffer?.windowHours ?? 72}h`}
                onScrub={handleFieldScrub}
              />
            </View>
            <TimeScrubber
              offsetMs={offsetMs}
              onOffsetChange={(v) => setOffsetMs(clampOffset(v))}
              onExpandedChange={setClockExpanded}
              collapseSignal={collapseSignal}
              style={styles.clockOverlay}
            />
          </View>

          <View style={styles.belowField} onTouchStart={collapseClock}>
            <BufferTimeline
              segments={segments}
              savedRegions={savedRegions}
              playheadMs={playheadMs}
              bracket={bracket}
              onScrub={(ms) => setOffsetMs(clampOffset(Date.now() - ms))}
              onBracketChange={setBracket}
              style={styles.fullBleed}
            />

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
  belowField: {
    gap: theme.spacing.md,
  },
  clockOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
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
