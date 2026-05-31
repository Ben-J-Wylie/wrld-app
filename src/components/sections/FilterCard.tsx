// src/components/sections/FilterCard.tsx
//
// Generic filter container hosting any number of filter rows. Each
// row is one of:
//   • segmented (SegmentedToggle) — single-select
//   • chip-single                — Chip row, single-select
//   • chip-multi                 — Chip row, multi-select
// Above the rows: a title + "X OF Y results" + Clear link when
// any row is non-default.

import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Pressable } from '@/components/primitives/Pressable'
import { Text } from '@/components/primitives/Text'
import { Chip } from '@/components/primitives/Chip'
import { SegmentedToggle } from '@/components/primitives/SegmentedToggle'
import { theme } from '@/tokens/theme'

type Option = { id: string; label: string }

export type FilterRow =
  | {
      kind: 'segmented'
      id: string
      label?: string
      options: Option[]
      value: string
      onChange: (id: string) => void
    }
  | {
      kind: 'chip-single'
      id: string
      label?: string
      options: Option[]
      value: string | null
      onChange: (id: string | null) => void
    }
  | {
      kind: 'chip-multi'
      id: string
      label?: string
      options: Option[]
      value: string[]
      onChange: (ids: string[]) => void
    }

type Props = {
  title?: string
  rows: FilterRow[]
  resultsSummary?: string
  onClear?: () => void
  style?: StyleProp<ViewStyle>
}

export function FilterCard({ title, rows, resultsSummary, onClear, style }: Props) {
  return (
    <View style={[styles.card, style]}>
      {(title || resultsSummary || onClear) && (
        <View style={styles.header}>
          {title && <Text variant="bodyEmphasized">{title}</Text>}
          <View style={styles.headerRight}>
            {resultsSummary && (
              <Text variant="monoCaption" color={theme.colors.text.muted}>
                {resultsSummary}
              </Text>
            )}
            {onClear && (
              <Pressable
                variant="default"
                onPress={onClear}
                accessibilityRole="button"
                accessibilityLabel="Clear filters"
                hitSlop={8}
              >
                <Text variant="bodyEmphasized" color={theme.colors.accent.default}>
                  Clear
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      )}
      <View style={styles.rows}>
        {rows.map((r) => (
          <FilterRowRenderer key={r.id} row={r} />
        ))}
      </View>
    </View>
  )
}

function FilterRowRenderer({ row }: { row: FilterRow }) {
  return (
    <View style={styles.row}>
      {row.label && (
        <Text variant="monoLabel" color={theme.colors.text.subtle}>
          {row.label}
        </Text>
      )}
      {row.kind === 'segmented' && (
        <SegmentedToggle
          options={row.options.map((o) => ({ value: o.id, label: o.label }))}
          value={row.value}
          onChange={row.onChange}
        />
      )}
      {row.kind === 'chip-single' && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {row.options.map((o) => (
            <Chip
              key={o.id}
              label={o.label}
              selected={row.value === o.id}
              onPress={() => row.onChange(row.value === o.id ? null : o.id)}
            />
          ))}
        </ScrollView>
      )}
      {row.kind === 'chip-multi' && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {row.options.map((o) => {
            const isOn = row.value.includes(o.id)
            return (
              <Chip
                key={o.id}
                label={o.label}
                selected={isOn}
                onPress={() => {
                  if (isOn) row.onChange(row.value.filter((v) => v !== o.id))
                  else row.onChange([...row.value, o.id])
                }}
              />
            )
          })}
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    backgroundColor: theme.colors.bg.elevated,
    gap: theme.spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  rows: {
    gap: theme.spacing.md,
  },
  row: {
    gap: theme.spacing.xs,
  },
  chipRow: {
    gap: theme.spacing.xs,
  },
})
