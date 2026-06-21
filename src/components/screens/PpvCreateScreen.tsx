import { Alert, Image, Pressable, StyleSheet, View } from 'react-native'
import { useEffect, useRef, useState } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as ImagePicker from 'expo-image-picker'
import { theme } from '@/tokens/theme'
import { ScreenScroll } from '@/components/sections/ScreenScroll'
import { ScreenHeader } from '@/components/sections/ScreenHeader'
import { Button } from '@/components/primitives/Button'
import { Text } from '@/components/primitives/Text'
import { Input } from '@/components/primitives/Input'
import { Toggle } from '@/components/primitives/Toggle'
import { HelpText } from '@/components/primitives/HelpText'
import { Icon } from '@/components/primitives/Icon'
import { ppvApi } from '@/api/ppvEvents'
import type { UpdatePpvEventData, EventOverlapError } from '@/api/ppvEvents'
import { usePublicConfig, configNumber } from '@/hooks/usePublicConfig'

const pad = (n: number) => String(n).padStart(2, '0')

function dateToInputs(d: Date) {
  const m = d.getMonth() + 1
  const day = d.getDate()
  const year = d.getFullYear()
  const hours = d.getHours()
  const minutes = d.getMinutes()
  const hour12 = hours % 12 === 0 ? 12 : hours % 12
  return {
    dateStr: `${pad(m)}/${pad(day)}/${year}`,
    timeStr: `${hour12}:${pad(minutes)}`,
    isPM: hours >= 12,
  }
}

function parseDateInputs(dateStr: string, timeStr: string, isPM: boolean): Date | null {
  const dp = dateStr.split('/')
  if (dp.length !== 3 || !dp[0] || !dp[1] || !dp[2]) return null
  const m = parseInt(dp[0], 10)
  const d = parseInt(dp[1], 10)
  const y = parseInt(dp[2], 10)

  const tp = timeStr.split(':')
  if (tp.length !== 2 || !tp[0] || !tp[1]) return null
  let h = parseInt(tp[0], 10)
  const min = parseInt(tp[1], 10)

  if ([m, d, y, h, min].some(isNaN)) return null
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2020) return null
  if (h < 1 || h > 12 || min < 0 || min > 59) return null

  if (isPM && h !== 12) h += 12
  if (!isPM && h === 12) h = 0

  const result = new Date(y, m - 1, d, h, min, 0, 0)
  return isNaN(result.getTime()) ? null : result
}

const DATE_PRESETS = [
  { label: 'Tonight', hours: 0 },
  { label: 'Tomorrow', hours: 24 },
  { label: '+1 week', hours: 168 },
  { label: '+2 weeks', hours: 336 },
]

export function PpvCreateScreen() {
  const { eventId } = useLocalSearchParams<{ eventId?: string }>()
  const isEdit = !!eventId
  const qc = useQueryClient()

  const { data: existing } = useQuery({
    queryKey: ['ppv-event-manage', eventId],
    queryFn: () => ppvApi.getMyEvent(eventId!),
    enabled: isEdit,
  })

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone

  const makeDefault = () => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    d.setHours(20, 0, 0, 0)
    return d
  }

  const { dateStr: defDate, timeStr: defTime, isPM: defPM } = dateToInputs(makeDefault())

  const [title, setTitle] = useState(existing?.title ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [dateStr, setDateStr] = useState(defDate)
  const [timeStr, setTimeStr] = useState(defTime)
  const [isPM, setIsPM] = useState(defPM)
  const [duration, setDuration] = useState(
    existing?.durationMinutes ? String(existing.durationMinutes) : '',
  )
  // PPV price is a whole number of Space Bucks (1 🚀 = 1¢). Older events may have a
  // null priceSb → fall back to priceUsd (numerically equal).
  const [priceSbStr, setPriceSbStr] = useState(
    existing ? String(existing.priceSb ?? existing.priceUsd ?? '') : '',
  )
  const [capacity, setCapacity] = useState(
    existing?.maxCapacity ? String(existing.maxCapacity) : '',
  )
  const [subscribersFree, setSubscribersFree] = useState(existing?.subscribersFreeAccess ?? false)
  const [subscribersOnly, setSubscribersOnly] = useState(existing?.subscribersOnly ?? false)
  const [replayAccess, setReplayAccess] = useState(existing?.replayAccess ?? true)
  const [coverUrl, setCoverUrl] = useState<string | null>(existing?.thumbnailUrl ?? null)
  const [coverUploading, setCoverUploading] = useState(false)
  const coverMimeRef = useRef<string | null>(null)
  const [saving, setSaving] = useState(false)
  // Flipped true on the first submit attempt so required-but-empty fields also
  // surface their error (a touched field already shows its error live).
  const [submitted, setSubmitted] = useState(false)

  // PPV price bounds (whole Space Bucks) from public config.
  const { config } = usePublicConfig()
  const minSb = configNumber(config, 'PPV_MINIMUM_PRICE_SB', 100)
  const maxSb = configNumber(config, 'PPV_MAX_PRICE_SB', 2000)

  // Sync form when editing an existing event loads
  useEffect(() => {
    if (!existing) return
    setTitle(existing.title)
    setDescription(existing.description ?? '')
    setDuration(existing.durationMinutes ? String(existing.durationMinutes) : '')
    setCapacity(existing.maxCapacity ? String(existing.maxCapacity) : '')
    setPriceSbStr(String(existing.priceSb ?? existing.priceUsd ?? ''))
    setSubscribersFree(existing.subscribersFreeAccess)
    setSubscribersOnly(existing.subscribersOnly ?? false)
    setReplayAccess(existing.replayAccess)
    setCoverUrl(existing.thumbnailUrl ?? null)
    const { dateStr: ds, timeStr: ts, isPM: pm } = dateToInputs(new Date(existing.scheduledAt))
    setDateStr(ds)
    setTimeStr(ts)
    setIsPM(pm)
  }, [existing?.id])

  function applyPreset(hours: number) {
    const d = new Date()
    if (hours === 0) {
      // Tonight: next 8 PM, or +2h if already past 8 PM
      d.setHours(20, 0, 0, 0)
      if (d <= new Date()) d.setDate(d.getDate() + 1)
    } else {
      d.setTime(d.getTime() + hours * 3_600_000)
      d.setMinutes(0, 0, 0)
    }
    const { dateStr: ds, timeStr: ts, isPM: pm } = dateToInputs(d)
    setDateStr(ds)
    setTimeStr(ts)
    setIsPM(pm)
  }

  async function pickCover() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('Photo library access required', 'Enable in Settings to add cover art.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    })
    if (result.canceled || !result.assets[0]) return
    const asset = result.assets[0]
    const mime = asset.mimeType ?? 'image/jpeg'
    coverMimeRef.current = mime
    // Editing an existing event → upload immediately (the event already exists).
    // Creating → stash the local uri; it uploads after the event is created.
    if (isEdit && eventId) {
      setCoverUploading(true)
      try {
        const { thumbnailUrl } = await ppvApi.uploadThumbnail(eventId, asset.uri, mime)
        setCoverUrl(thumbnailUrl)
        qc.invalidateQueries({ queryKey: ['ppv-event-manage', eventId] })
        qc.invalidateQueries({ queryKey: ['my-ppv-events'] })
      } catch {
        Alert.alert('Error', 'Could not upload cover art.')
      } finally {
        setCoverUploading(false)
      }
    } else {
      setCoverUrl(asset.uri)
    }
  }

  const parsedDate = parseDateInputs(dateStr, timeStr, isPM)
  const dateValid = parsedDate !== null && parsedDate > new Date()

  // PPV price is a whole number of Space Bucks (1 🚀 = 1¢).
  const priceSbValue = priceSbStr ? Math.round(parseFloat(priceSbStr)) : 0
  const priceValid = priceSbValue >= minSb && priceSbValue <= maxSb
  const titleValid = title.trim().length > 0
  // Numeric optionals: blank is fine; otherwise must be a positive whole number,
  // so "asdf" in duration/capacity is a called-out error rather than a silent NaN.
  const durationValid = duration.trim() === '' || /^\d+$/.test(duration.trim())
  const capacityValid = capacity.trim() === '' || /^\d+$/.test(capacity.trim())
  const canSave = titleValid && priceValid && dateValid && durationValid && capacityValid && !isEdit
  // True when the user has moved the scheduled time (>60s from the saved value);
  // that's the only case the edit sends scheduledAt, so only then must it be future.
  const dateChanged = !!parsedDate && (
    existing?.scheduledAt
      ? Math.abs(parsedDate.getTime() - new Date(existing.scheduledAt).getTime()) > 60_000
      : true
  )
  const canUpdate = isEdit && titleValid && durationValid && capacityValid && !saving && (!dateChanged || dateValid)

  const hasPurchases = (existing?.purchaseCount ?? 0) > 0

  // Per-field error text (null = valid). Rendered under each field so the form
  // says exactly what needs fixing.
  const fieldErrors = {
    title: !titleValid ? 'Add a title for your event.' : null,
    date: (isEdit ? dateChanged && !dateValid : !dateValid)
      ? (parsedDate === null
          ? 'Enter the date as MM/DD/YYYY and the time as H:MM.'
          : 'Pick a date and time in the future.')
      : null,
    price: !isEdit && !priceValid
      ? `Price must be between ${minSb.toLocaleString()} and ${maxSb.toLocaleString()} 🚀.`
      : null,
    duration: !durationValid ? 'Duration must be a whole number of minutes.' : null,
    capacity: !capacityValid ? 'Capacity must be a whole number of tickets.' : null,
  }
  const hasFieldError = Object.values(fieldErrors).some(Boolean)

  const datePreview = parsedDate
    ? parsedDate.toLocaleString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null

  async function doSave() {
    if (!parsedDate) return
    setSaving(true)
    try {
      const result = await ppvApi.createEvent({
        title: title.trim(),
        description: description.trim() || undefined,
        scheduledAt: parsedDate.toISOString(),
        timezone: tz,
        durationMinutes: duration ? parseInt(duration) : undefined,
        priceSb: priceSbValue,
        subscribersFreeAccess: subscribersFree,
        subscribersOnly,
        maxCapacity: capacity ? parseInt(capacity) : undefined,
        replayAccess,
      })
      // Upload the chosen cover (if any) now the event exists. Non-fatal.
      if (coverUrl && coverUrl.startsWith('file:')) {
        try {
          await ppvApi.uploadThumbnail(result.event.id, coverUrl, coverMimeRef.current ?? 'image/jpeg')
        } catch {
          // cover upload is best-effort — the event is already created
        }
      }
      qc.invalidateQueries({ queryKey: ['my-ppv-events'] })
      if (result.warning === 'duration_unknown_overlap') {
        Alert.alert(
          'Possible overlap',
          'This event may overlap with another scheduled event. Both events have unknown duration — you can proceed, but consider adding durations to avoid confusion.',
        )
      }
      router.replace({ pathname: '/(app)/ppv/[id]/manage', params: { id: result.event.id } })
    } catch (e: unknown) {
      const data = (e as any)?.response?.data as EventOverlapError | undefined
      if (data?.error === 'event_overlap') {
        Alert.alert(
          'Schedule conflict',
          `This event overlaps with "${data.conflictingEventTitle}". Please choose a different date or time.`,
        )
        return
      }
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not create event')
    } finally {
      setSaving(false)
    }
  }

  async function handleSave() {
    setSubmitted(true)
    // Invalid → the field-level callouts + summary are now visible; don't submit.
    if (!canSave || !parsedDate) return
    doSave()
  }

  async function handleUpdate() {
    if (!eventId) return
    setSubmitted(true)
    if (!canUpdate) return
    setSaving(true)
    try {
      const updates: UpdatePpvEventData = {}
      if (title.trim() !== existing?.title) updates.title = title.trim()
      if (description.trim() !== (existing?.description ?? '')) {
        updates.description = description.trim() || null
      }
      if (duration && parseInt(duration) !== existing?.durationMinutes) {
        updates.durationMinutes = parseInt(duration)
      }
      if (replayAccess !== existing?.replayAccess) updates.replayAccess = replayAccess

      // Capacity is always editable (backend validates >= purchaseCount)
      const newCapacity = capacity ? parseInt(capacity) : null
      if (newCapacity !== (existing?.maxCapacity ?? null)) {
        updates.maxCapacity = newCapacity
      }

      if ((existing?.purchaseCount ?? 0) === 0) {
        if (parsedDate) {
          const newMs = parsedDate.getTime()
          const existingMs = existing?.scheduledAt ? new Date(existing.scheduledAt).getTime() : 0
          if (Math.abs(newMs - existingMs) > 60_000) updates.scheduledAt = parsedDate.toISOString()
        }
        if (subscribersFree !== existing?.subscribersFreeAccess) {
          updates.subscribersFreeAccess = subscribersFree
        }
        if (subscribersOnly !== (existing?.subscribersOnly ?? false)) {
          updates.subscribersOnly = subscribersOnly
        }
      }

      const result = await ppvApi.updateEvent(eventId, updates)
      qc.invalidateQueries({ queryKey: ['ppv-event-manage', eventId] })
      qc.invalidateQueries({ queryKey: ['my-ppv-events'] })
      if (result.warning === 'duration_unknown_overlap') {
        Alert.alert(
          'Possible overlap',
          'This event may overlap with another scheduled event. Both events have unknown duration — consider adding durations to avoid confusion.',
        )
      }
      router.back()
    } catch (e: unknown) {
      const data = (e as any)?.response?.data as EventOverlapError | undefined
      if (data?.error === 'event_overlap') {
        Alert.alert(
          'Schedule conflict',
          `This event overlaps with "${data.conflictingEventTitle}". Please choose a different date or time.`,
        )
        return
      }
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not update event')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ScreenScroll
      header={
        <ScreenHeader
          title={isEdit ? 'Edit event' : 'Schedule event'}
          onBack={() => router.back()}
        />
      }
      contentContainerStyle={styles.content}
    >

      <View style={styles.field}>
        <Text variant="monoLabel">Title</Text>
        <Input
          value={title}
          onChangeText={setTitle}
          placeholder="What's the stream about?"
          maxLength={200}
        />
        {submitted && fieldErrors.title && <HelpText tone="err">{fieldErrors.title}</HelpText>}
      </View>

      <View style={styles.field}>
        <Text variant="monoLabel">Description (optional)</Text>
        <Input
          value={description}
          onChangeText={setDescription}
          placeholder="Tell viewers what to expect"
          multiline
          numberOfLines={3}
          maxLength={1000}
        />
      </View>

      {/* ── Cover art ──────────────────────────────────── */}
      <View style={styles.field}>
        <Text variant="monoLabel">Cover art (optional)</Text>
        <Pressable onPress={pickCover} disabled={coverUploading}>
          {coverUrl ? (
            <Image source={{ uri: coverUrl }} style={styles.cover} resizeMode="cover" />
          ) : (
            <View style={[styles.cover, styles.coverEmpty]}>
              <Icon name="image" size="lg" color={theme.colors.text.muted} />
              <Text variant="caption" color={theme.colors.text.muted}>
                {coverUploading ? 'Uploading…' : 'Add a cover image'}
              </Text>
            </View>
          )}
        </Pressable>
        {coverUrl && (
          <Pressable onPress={pickCover} disabled={coverUploading}>
            <Text variant="caption" color={theme.colors.accent.default}>
              {coverUploading ? 'Uploading…' : 'Change cover'}
            </Text>
          </Pressable>
        )}
      </View>

      {/* ── Date & time ─────────────────────────────────── */}
      <View style={styles.field}>
        <Text variant="monoLabel">Date & time ({tz})</Text>

        {!hasPurchases && (
          <View style={styles.presetRow}>
            {DATE_PRESETS.map(p => (
              <Pressable key={p.hours} style={styles.preset} onPress={() => applyPreset(p.hours)}>
                <Text variant="caption" color={theme.colors.text.muted}>{p.label}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <Input
          value={dateStr}
          onChangeText={setDateStr}
          placeholder="MM/DD/YYYY"
          keyboardType="numbers-and-punctuation"
          maxLength={10}
          editable={!hasPurchases}
        />

        <View style={styles.timeRow}>
          <View style={styles.timeInputWrap}>
            <Input
              value={timeStr}
              onChangeText={setTimeStr}
              placeholder="H:MM"
              keyboardType="numbers-and-punctuation"
              maxLength={5}
              editable={!hasPurchases}
            />
          </View>
          <Pressable
            style={[styles.ampmBtn, !isPM && styles.ampmActive]}
            onPress={() => !hasPurchases && setIsPM(false)}
          >
            <Text
              variant="monoLabel"
              color={!isPM ? theme.colors.accent.default : theme.colors.text.muted}
            >
              AM
            </Text>
          </Pressable>
          <Pressable
            style={[styles.ampmBtn, isPM && styles.ampmActive]}
            onPress={() => !hasPurchases && setIsPM(true)}
          >
            <Text
              variant="monoLabel"
              color={isPM ? theme.colors.accent.default : theme.colors.text.muted}
            >
              PM
            </Text>
          </Pressable>
        </View>

        {dateValid && datePreview ? (
          <Text variant="caption" color={theme.colors.text.muted}>{datePreview}</Text>
        ) : (fieldErrors.date && (submitted || dateStr.trim().length > 3 || timeStr.trim().length > 1)) ? (
          <HelpText tone="err">{fieldErrors.date}</HelpText>
        ) : null}

        {hasPurchases && (
          <HelpText>Date is locked after the first purchase</HelpText>
        )}
      </View>

      <View style={styles.field}>
        <Text variant="monoLabel">Expected duration (optional)</Text>
        <Input
          value={duration}
          onChangeText={setDuration}
          placeholder="Minutes, e.g. 90"
          keyboardType="number-pad"
        />
        {(submitted || duration.length > 0) && fieldErrors.duration && (
          <HelpText tone="err">{fieldErrors.duration}</HelpText>
        )}
      </View>

      <View style={styles.field}>
        <Text variant="monoLabel">Capacity (optional)</Text>
        <Input
          value={capacity}
          onChangeText={setCapacity}
          placeholder="Leave empty for unlimited"
          keyboardType="number-pad"
        />
        {(submitted || capacity.length > 0) && fieldErrors.capacity ? (
          <HelpText tone="err">{fieldErrors.capacity}</HelpText>
        ) : hasPurchases && capacity && parseInt(capacity) < (existing?.purchaseCount ?? 0) ? (
          <HelpText>Cannot be less than {existing?.purchaseCount} (current purchasers)</HelpText>
        ) : hasPurchases ? (
          <HelpText>Currently {existing?.purchaseCount} ticket{existing?.purchaseCount === 1 ? '' : 's'} sold</HelpText>
        ) : (
          <HelpText>Max number of tickets available</HelpText>
        )}
      </View>

      <View style={styles.field}>
        <Text variant="monoLabel">Price (Space Bucks)</Text>
        <Input
          value={priceSbStr}
          onChangeText={setPriceSbStr}
          placeholder="e.g. 500"
          keyboardType="number-pad"
          editable={!isEdit}
        />
        {isEdit && (
          <HelpText>Price cannot be changed after event creation</HelpText>
        )}
        {(submitted || priceSbStr.length > 0) && fieldErrors.price && (
          <HelpText tone="err">{fieldErrors.price}</HelpText>
        )}
        {!isEdit && priceSbStr.length === 0 && (
          <HelpText>{minSb.toLocaleString()}–{maxSb.toLocaleString()} 🚀 · 1 🚀 = $0.01</HelpText>
        )}
      </View>

      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text variant="monoLabel">Subscribers get free access</Text>
          <HelpText>Monthly subscribers to your channel watch for free</HelpText>
        </View>
        <Toggle
          value={subscribersFree}
          onValueChange={hasPurchases ? () => {} : (v) => { setSubscribersFree(v); if (v) setSubscribersOnly(false) }}
          disabled={hasPurchases}
        />
      </View>

      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text variant="monoLabel">Subscribers also required</Text>
          <HelpText>Viewers must be subscribed AND hold a ticket. Buyers are warned before purchase.</HelpText>
        </View>
        <Toggle
          value={subscribersOnly}
          onValueChange={hasPurchases ? () => {} : (v) => { setSubscribersOnly(v); if (v) setSubscribersFree(false) }}
          disabled={hasPurchases}
        />
      </View>

      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text variant="monoLabel">Replay access after stream</Text>
          <HelpText>Purchasers can watch the recording</HelpText>
        </View>
        <Toggle value={replayAccess} onValueChange={setReplayAccess} />
      </View>

      {submitted && hasFieldError && (
        <HelpText tone="err">Please fix the highlighted fields above before continuing.</HelpText>
      )}

      <Button
        label={saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create event'}
        onPress={isEdit ? handleUpdate : handleSave}
        disabled={saving}
      />

      {isEdit && (
        <Button label="Cancel" onPress={() => router.back()} variant="secondary" />
      )}
    </ScreenScroll>
  )
}

const styles = StyleSheet.create({
  content: {
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
    paddingBottom: theme.spacing.xxxl,
  },
  field: {
    gap: theme.spacing.sm,
  },
  cover: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bg.elevated,
  },
  coverEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
  },
  presetRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    flexWrap: 'wrap',
  },
  preset: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    backgroundColor: theme.colors.bg.elevated,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  timeInputWrap: {
    flex: 1,
  },
  ampmBtn: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    backgroundColor: theme.colors.bg.elevated,
  },
  ampmActive: {
    borderColor: theme.colors.accent.border,
    backgroundColor: theme.colors.accent.surface,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  rowText: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
})
