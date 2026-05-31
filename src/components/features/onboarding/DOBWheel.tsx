// src/components/features/onboarding/DOBWheel.tsx
//
// iOS-style 3-column scroll-wheel picker for date of birth. Each
// column is a snap-paged FlatList of equal-height rows. Center row
// is the "selected" value; neighbors dim by distance. A line-2
// horizontal border above + below the center band frames the
// selection; top + bottom fade gradient is approximated with a soft
// overlay on the column edges.
//
// This is deliberately NOT the native iOS DatePicker — the design
// wants this specific aesthetic. PanResponder-driven scroll is
// replaced with FlatList snap, which works for the wheel pattern
// without bespoke gesture handling.

import { useEffect, useMemo, useRef } from 'react'
import {
  FlatList,
  StyleSheet,
  View,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { Text } from '@/components/primitives/Text'
import { theme } from '@/tokens/theme'

type Props = {
  value: Date
  onChange: (next: Date) => void
  minYear?: number
  maxYear?: number
  style?: StyleProp<ViewStyle>
}

const ROW_HEIGHT = 36
const VISIBLE_ROWS = 5 // center + 2 above + 2 below
const COL_HEIGHT = ROW_HEIGHT * VISIBLE_ROWS
const PAD_ROWS = (VISIBLE_ROWS - 1) / 2

const MONTH_LABELS = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
]

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate()
}

export function DOBWheel({
  value,
  onChange,
  minYear,
  maxYear,
  style,
}: Props) {
  const today = useMemo(() => new Date(), [])
  const min = minYear ?? today.getFullYear() - 100
  const max = maxYear ?? today.getFullYear()

  const months = MONTH_LABELS
  const years = useMemo(
    () => Array.from({ length: max - min + 1 }, (_, i) => min + i),
    [min, max],
  )
  const year = value.getFullYear()
  const monthIndex = value.getMonth()
  const day = value.getDate()
  const dayCount = daysInMonth(year, monthIndex)
  const days = useMemo(
    () => Array.from({ length: dayCount }, (_, i) => i + 1),
    [dayCount],
  )

  return (
    <View style={[styles.wrap, style]}>
      <View style={[styles.band]} pointerEvents="none" />
      <View style={styles.row}>
        <Column
          values={months}
          selectedIndex={monthIndex}
          renderLabel={(v) => v}
          onSelect={(i) => {
            const nextMax = daysInMonth(year, i)
            const nextDay = Math.min(day, nextMax)
            onChange(new Date(year, i, nextDay))
          }}
        />
        <Column
          values={days}
          selectedIndex={day - 1}
          renderLabel={(v) => String(v).padStart(2, '0')}
          onSelect={(i) => onChange(new Date(year, monthIndex, i + 1))}
        />
        <Column
          values={years}
          selectedIndex={year - min}
          renderLabel={(v) => String(v)}
          onSelect={(i) => {
            const nextYear = years[i] ?? year
            const nextMax = daysInMonth(nextYear, monthIndex)
            const nextDay = Math.min(day, nextMax)
            onChange(new Date(nextYear, monthIndex, nextDay))
          }}
        />
      </View>
      <View style={styles.fadeTop} pointerEvents="none" />
      <View style={styles.fadeBottom} pointerEvents="none" />
    </View>
  )
}

function Column<T extends string | number>({
  values,
  selectedIndex,
  renderLabel,
  onSelect,
}: {
  values: T[]
  selectedIndex: number
  renderLabel: (v: T) => string
  onSelect: (i: number) => void
}) {
  const ref = useRef<FlatList<T>>(null)

  useEffect(() => {
    ref.current?.scrollToOffset({
      offset: selectedIndex * ROW_HEIGHT,
      animated: false,
    })
  }, [selectedIndex])

  function onMomentumScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const offsetY = e.nativeEvent.contentOffset.y
    const i = Math.round(offsetY / ROW_HEIGHT)
    const clamped = Math.max(0, Math.min(values.length - 1, i))
    if (clamped !== selectedIndex) onSelect(clamped)
  }

  function renderItem({ item, index }: ListRenderItemInfo<T>) {
    const distance = Math.abs(index - selectedIndex)
    const opacity = distance === 0 ? 1 : distance === 1 ? 0.55 : 0.3
    return (
      <View style={styles.cell}>
        <Text
          variant={distance === 0 ? 'bodyEmphasized' : 'body'}
          color={theme.colors.text.primary}
          style={{ opacity }}
        >
          {renderLabel(item)}
        </Text>
      </View>
    )
  }

  return (
    <FlatList<T>
      ref={ref}
      data={values}
      keyExtractor={(item, i) => `${i}:${String(item)}`}
      renderItem={renderItem}
      style={styles.column}
      showsVerticalScrollIndicator={false}
      snapToInterval={ROW_HEIGHT}
      decelerationRate="fast"
      onMomentumScrollEnd={onMomentumScrollEnd}
      contentContainerStyle={styles.columnInner}
      getItemLayout={(_, i) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * i, index: i })}
    />
  )
}

const PAD = ROW_HEIGHT * PAD_ROWS

const styles = StyleSheet.create({
  wrap: {
    height: COL_HEIGHT,
    position: 'relative',
  },
  row: {
    flexDirection: 'row',
    flex: 1,
  },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: PAD,
    height: ROW_HEIGHT,
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: theme.colors.border.strong,
  },
  column: {
    flex: 1,
  },
  columnInner: {
    paddingVertical: PAD,
  },
  cell: {
    height: ROW_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fadeTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: ROW_HEIGHT,
    backgroundColor: theme.colors.bg.primary,
    opacity: 0.5,
  },
  fadeBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: ROW_HEIGHT,
    backgroundColor: theme.colors.bg.primary,
    opacity: 0.5,
  },
})
