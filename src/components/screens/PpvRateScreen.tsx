import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { theme } from '@/tokens/theme'
import { ScreenScroll } from '@/components/sections/ScreenScroll'
import { ScreenHeader } from '@/components/sections/ScreenHeader'
import { Button } from '@/components/primitives/Button'
import { Text } from '@/components/primitives/Text'
import { ppvApi } from '@/api/ppvEvents'

// Post-event delivery problem-report — shown to a ticket-holder right after the PPV
// stream they watched ends (StreamScreen routes here). Only needs the event id, so it
// works after the event has ended. "Was there a problem?" framing, NOT a satisfaction
// rating — the backend gates the report to paying holders.

const REASONS = [
  { value: 'never_started', label: 'It never started' },
  { value: 'ended_early', label: 'It ended early' },
  { value: 'technical', label: 'Technical / quality problem' },
  { value: 'not_as_described', label: 'Not as described' },
]

export function PpvRateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  async function submit(reason: string) {
    setBusy(true)
    try { await ppvApi.reportProblem(id, reason) } catch { /* report is best-effort */ }
    setDone(true)
    setBusy(false)
  }

  return (
    <ScreenScroll
      header={<ScreenHeader title="Event feedback" onBack={() => router.navigate('/(app)/globe')} />}
      contentContainerStyle={styles.content}
    >
      {done ? (
        <View style={styles.block}>
          <Text variant="heading">Thanks for the feedback</Text>
          <Text variant="body" color={theme.colors.text.muted}>It helps us keep paid events honest.</Text>
          <Button label="Back to globe" onPress={() => router.navigate('/(app)/globe')} />
        </View>
      ) : (
        <View style={styles.block}>
          <Text variant="heading">How was the event?</Text>
          <Text variant="body" color={theme.colors.text.muted}>
            Only flag a real delivery problem — not whether you liked the outcome.
          </Text>
          <Button label="No problem — it was fine" onPress={() => setDone(true)} disabled={busy} />
          {REASONS.map((r) => (
            <Button key={r.value} label={r.label} variant="secondary" onPress={() => submit(r.value)} disabled={busy} />
          ))}
        </View>
      )}
    </ScreenScroll>
  )
}

const styles = StyleSheet.create({
  content: { padding: theme.spacing.lg, gap: theme.spacing.md, alignItems: 'stretch' },
  block: { gap: theme.spacing.md, alignItems: 'stretch' },
})
