// src/components/primitives/BottomSheet.tsx
//
// Universal slide-up sheet container. Provides:
//   - scrim (tap-to-close)
//   - sheet body with top-rounded corners + hairline border + shadow
//   - grabber (48 × 5, swipe-down to dismiss)
//   - slide-up enter / slide-down exit (spring on enter, linear on exit)
//
// Content is the consumer's responsibility — pass any children. The
// primitive only handles the wrapping container + gesture + animation.
//
// Variants pick the sheet height:
//   peek      ~280 (or `peekHeight` prop) — mini sheet, e.g. quality
//             picker, action sheet, NearbyStreamsDrawer mini state
//   expanded  almost-full (top safe-area inset + 40px gap remaining)
//   full      full minus top safe-area (rare — confirm modals, etc.)
//
// Existing one-offs (AuthModal, TipSheet, NearbyStreamsDrawer) refactor
// to content-only callers in 12.6.

import { useEffect, useRef } from 'react'
import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import type { ReactNode } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { theme } from '@/tokens/theme'

type Variant = 'peek' | 'expanded' | 'full'

const SCREEN_H = Dimensions.get('window').height
const DEFAULT_PEEK = 280

type Props = {
  visible: boolean
  onClose: () => void
  variant?: Variant
  peekHeight?: number
  showGrabber?: boolean
  showScrim?: boolean
  // When set, a downward drag ANYWHERE on the sheet dismisses (not just the grabber). Use for
  // sheets with no internal vertical scroll (e.g. a settings shelf), so the body is draggable too.
  dragToDismiss?: boolean
  children: ReactNode
  contentStyle?: StyleProp<ViewStyle>
}

export function BottomSheet({
  visible,
  onClose,
  variant = 'peek',
  peekHeight = DEFAULT_PEEK,
  showGrabber = true,
  showScrim = true,
  dragToDismiss = false,
  children,
  contentStyle,
}: Props) {
  const insets = useSafeAreaInsets()
  const translateY = useRef(new Animated.Value(SCREEN_H)).current
  const scrimOpacity = useRef(new Animated.Value(0)).current
  const dragY = useRef(new Animated.Value(0)).current

  const sheetHeight = resolveHeight(variant, peekHeight, insets.top)

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          stiffness: 220,
          damping: 24,
        }),
        Animated.timing(scrimOpacity, {
          toValue: 1,
          ...theme.motion.patterns.overlay,
          useNativeDriver: true,
        }),
      ]).start()
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: SCREEN_H,
          ...theme.motion.patterns.overlay,
          useNativeDriver: true,
        }),
        Animated.timing(scrimOpacity, {
          toValue: 0,
          ...theme.motion.patterns.overlay,
          useNativeDriver: true,
        }),
      ]).start()
    }
  }, [visible, translateY, scrimOpacity])

  const panResponder = useRef(
    PanResponder.create({
      // Capture-phase: claim a downward drag even when a child (toggle/row) wants the touch.
      // (>10px so a tap on a control isn't swallowed.) onMove alone wasn't firing on device.
      onMoveShouldSetPanResponderCapture: (_, g) => {
        const want = g.dy > 10 && g.dy > Math.abs(g.dx)
        if (__DEV__ && want) console.log('[sheet] pan capture (dy=', Math.round(g.dy), ')')
        return want
      },
      onMoveShouldSetPanResponder: (_, g) => g.dy > 4,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) dragY.setValue(g.dy)
      },
      onPanResponderGrant: () => {
        if (__DEV__) console.log('[sheet] pan grant')
      },
      onPanResponderRelease: (_, g) => {
        if (__DEV__) console.log('[sheet] pan release dy=', Math.round(g.dy), 'vy=', g.vy.toFixed(2))
        if (g.dy > 80 || g.vy > 0.5) {
          dragY.setValue(0)
          if (__DEV__) console.log('[sheet] pan → onClose()')
          onClose()
        } else {
          Animated.spring(dragY, {
            toValue: 0,
            useNativeDriver: true,
          }).start()
        }
      },
    }),
  ).current

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.root}>
        {showScrim && (
          <Animated.View
            style={[styles.scrim, { opacity: scrimOpacity }]}
            pointerEvents={visible ? 'auto' : 'none'}
            // Raw responder on the scrim itself — most fundamental touch path (a child Pressable
            // wasn't receiving the tap in a high-churn screen). Tap-anywhere-outside → dismiss.
            onStartShouldSetResponder={() => true}
            onResponderRelease={() => {
              if (__DEV__) console.log('[sheet] scrim responder release → onClose()')
              onClose()
            }}
          />
        )}
        <Animated.View
          style={[
            styles.sheet,
            { height: sheetHeight, transform: [{ translateY: Animated.add(translateY, dragY) }] },
            contentStyle,
          ]}
          {...(dragToDismiss ? panResponder.panHandlers : {})}
        >
          {showGrabber && (
            <View {...(dragToDismiss ? {} : panResponder.panHandlers)} style={styles.grabberHit}>
              <View style={styles.grabber} />
            </View>
          )}
          <View style={styles.body}>{children}</View>
        </Animated.View>
      </View>
    </Modal>
  )
}

function resolveHeight(variant: Variant, peekHeight: number, topInset: number): number {
  switch (variant) {
    case 'peek':
      return peekHeight
    case 'expanded':
      return SCREEN_H - topInset - 40
    case 'full':
      return SCREEN_H - topInset
  }
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.bg.overlay,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.bg.elevated,
    borderTopLeftRadius: theme.radius.md,
    borderTopRightRadius: theme.radius.md,
    borderTopWidth: 1,
    borderColor: theme.colors.border.subtle,
    ...theme.elevation.sheet,
  },
  grabberHit: {
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grabber: {
    width: 48,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: theme.colors.border.strong,
  },
  body: { flex: 1 },
})
