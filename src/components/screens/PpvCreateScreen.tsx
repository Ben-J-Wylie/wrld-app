import { Alert, Pressable, StyleSheet, View } from 'react-native'
import { useEffect, useState } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { theme } from '@/tokens/theme'
import { ScreenScroll } from '@/components/sections/ScreenScroll'
import { Button } from '@/components/primitives/Button'
import { Text } from '@/components/primitives/Text'
import { Input } from '@/components/primitives/Input'
import { Toggle } from '@/components/primitives/Toggle'
import { HelpText } from '@/components/primitives/HelpText'
import { ppvApi } from '@/api/ppvEvents'
import type { UpdatePpvEventData } from '@/api/ppvEvents'

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
  const [priceDollars, setPriceDollars] = useState(
    existing?.priceUsd ? String((existing.priceUsd / 100).toFixed(2)) : '',
  )
  const [subscribersFree, setSubscribersFree] = useState(existing?.subscribersFreeAccess ?? false)
  const [replayAccess, setReplayAccess] = useState(existing?.replayAccess ?? true)
  const [saving, setSaving] = useState(false)

  // Sync form when editing an existing event loads
  useEffect(() => {
    if (!existing) return
    setTitle(existing.title)
    setDescription(existing.description ?? '')
    setDuration(existing.durationMinutes ? String(existing.durationMinutes) : '')
    setPriceDollars(String((existing.priceUsd / 100).toFixed(2)))
    setSubscribersFree(existing.subscribersFreeAccess)
    setReplayAccess(existing.replayAccess)
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

  const parsedDate = parseDateInputs(dateStr, timeStr, isPM)
  const dateValid = parsedDate !== null && parsedDate > new Date()

  const priceCents = priceDollars ? Math.round(parseFloat(priceDollars) * 100) : 0
  const priceValid = priceCents >= 100
  const titleValid = title.trim().length > 0
  const canSave = titleValid && priceValid && dateValid && !isEdit
  const canUpdate = isEdit && titleValid && !saving

  const hasPurchases = (existing?.purchaseCount ?? 0) > 0

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

  async function handleSave() {
    if (!parsedDate) return
    setSaving(true)
    try {
      const event = await ppvApi.createEvent({
        title: title.trim(),
        description: description.trim() || undefined,
        scheduledAt: parsedDate.toISOString(),
        timezone: tz,
        durationMinutes: duration ? parseInt(duration) : undefined,
        priceUsd: priceCents,
        subscribersFreeAccess: subscribersFree,
        replayAccess,
      })
      qc.invalidateQueries({ queryKey: ['my-ppv-events'] })
      router.replace({ pathname: '/(app)/ppv/[id]/manage', params: { id: event.id } })
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not create event')
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdate() {
    if (!eventId) return
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

      if ((existing?.purchaseCount ?? 0) === 0) {
        if (parsedDate) {
          const newMs = parsedDate.getTime()
          const existingMs = existing?.scheduledAt ? new Date(existing.scheduledAt).getTime() : 0
          if (Math.abs(newMs - existingMs) > 60_000) updates.scheduledAt = parsedDate.toISOString()
        }
        if (subscribersFree !== existing?.subscribersFreeAccess) {
          updates.subscribersFreeAccess = subscribersFree
        }
      }

      await ppvApi.updateEvent(eventId, updates)
      qc.invalidateQueries({ queryKey: ['ppv-event-manage', eventId] })
      qc.invalidateQueries({ queryKey: ['my-ppv-events'] })
      router.back()
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not update event')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ScreenScroll contentContainerStyle={styles.content}>
      <Text variant="heading">{isEdit ? 'Edit event' : 'Schedule PPV event'}</Text>

      <View style={styles.field}>
        <Text variant="monoLabel">Title</Text>
        <Input
          value={title}
          onChangeText={setTitle}
          placeholder="What's the stream about?"
          maxLength={200}
        />
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
        ) : (!dateValid && (dateStr.length > 3 || timeStr.length > 1)) ? (
          <HelpText>Enter a valid future date and time</HelpText>
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
      </View>

      <View style={styles.field}>
        <Text variant="monoLabel">Price (USD)</Text>
        <Input
          value={priceDollars}
          onChangeText={setPriceDollars}
          placeholder="e.g. 4.99"
          keyboardType="decimal-pad"
          editable={!isEdit}
        />
        {isEdit && (
          <HelpText>Price cannot be changed after event creation</HelpText>
        )}
        {priceDollars.length > 0 && !priceValid && (
          <HelpText>Minimum price is $1.00</HelpText>
        )}
      </View>

      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text variant="monoLabel">Subscribers get free access</Text>
          <HelpText>Monthly subscribers to your channel watch for free</HelpText>
        </View>
        <Toggle
          value={subscribersFree}
          onValueChange={hasPurchases ? () => {} : setSubscribersFree}
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

      <Button
        label={saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create event'}
        onPress={isEdit ? handleUpdate : handleSave}
        disabled={isEdit ? !canUpdate : !canSave}
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
