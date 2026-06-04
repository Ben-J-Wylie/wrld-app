import { Alert, StyleSheet, View } from 'react-native'
import { useState } from 'react'
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

// Format a JS Date as a local datetime string for display/input
function toLocalISOString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Parse a local datetime input string to a UTC ISO string
function localInputToUtcISO(input: string, tz: string): string {
  // We store the local string + timezone for display purposes.
  // For storage, we convert using the device's interpretation of the tz offset.
  // Simplified: treat the input as local device time → UTC.
  const d = new Date(input)
  return d.toISOString()
}

export function PpvCreateScreen() {
  const { eventId } = useLocalSearchParams<{ eventId?: string }>()
  const isEdit = !!eventId
  const qc = useQueryClient()

  // Editing: load existing event
  const { data: existing } = useQuery({
    queryKey: ['ppv-event-manage', eventId],
    queryFn: () => ppvApi.getMyEvent(eventId!),
    enabled: isEdit,
  })

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone

  // Default: 7 days from now, on the hour
  const defaultDate = new Date()
  defaultDate.setDate(defaultDate.getDate() + 7)
  defaultDate.setMinutes(0, 0, 0)

  const [title, setTitle] = useState(existing?.title ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [dateInput, setDateInput] = useState(
    existing?.scheduledAt
      ? toLocalISOString(new Date(existing.scheduledAt))
      : toLocalISOString(defaultDate),
  )
  const [duration, setDuration] = useState(
    existing?.durationMinutes ? String(existing.durationMinutes) : '',
  )
  const [priceDollars, setPriceDollars] = useState(
    existing?.priceUsd ? String((existing.priceUsd / 100).toFixed(2)) : '',
  )
  const [subscribersFree, setSubscribersFree] = useState(existing?.subscribersFreeAccess ?? false)
  const [replayAccess, setReplayAccess] = useState(existing?.replayAccess ?? true)
  const [saving, setSaving] = useState(false)

  const priceCents = priceDollars ? Math.round(parseFloat(priceDollars) * 100) : 0
  const priceValid = priceCents >= 100
  const titleValid = title.trim().length > 0
  const dateValid = (() => {
    const d = new Date(dateInput)
    return !isNaN(d.getTime()) && d > new Date()
  })()
  const canSave = titleValid && priceValid && dateValid && !isEdit
  const canUpdate = isEdit && titleValid && !saving

  async function handleSave() {
    setSaving(true)
    try {
      const scheduledAt = localInputToUtcISO(dateInput, tz)
      const event = await ppvApi.createEvent({
        title: title.trim(),
        description: description.trim() || undefined,
        scheduledAt,
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

      // Only allow scheduledAt and subscribersFree changes before first purchase
      if ((existing?.purchaseCount ?? 0) === 0) {
        const newUtc = localInputToUtcISO(dateInput, tz)
        if (newUtc !== existing?.scheduledAt) updates.scheduledAt = newUtc
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

  const hasPurchases = (existing?.purchaseCount ?? 0) > 0

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

      <View style={styles.field}>
        <Text variant="monoLabel">Date & time ({tz})</Text>
        <Input
          value={dateInput}
          onChangeText={setDateInput}
          placeholder="YYYY-MM-DDTHH:MM"
          editable={!hasPurchases}
        />
        {hasPurchases && (
          <HelpText>Date is locked after the first purchase</HelpText>
        )}
        {!dateValid && dateInput.length > 0 && (
          <HelpText>Must be a valid future date</HelpText>
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
    gap: theme.spacing.xs,
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
