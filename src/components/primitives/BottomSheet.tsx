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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import type { ReactNode } from 'react'
import { GestureDetector, GestureHandlerRootView, Gesture } from 'react-native-gesture-handler'
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
  // SHORT sheets with no internal vertical scroll, so the body is draggable too. With `scrollable`
  // the drag is restricted to the grabber handle (so the body can scroll).
  dragToDismiss?: boolean
  // When set, the body scrolls (for content taller than the sheet). The drag-to-dismiss handle is
  // then the grabber only (whole-sheet drag would fight the scroll).
  scrollable?: boolean
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
  scrollable = false,
  children,
  contentStyle,
}: Props) {
  const insets = useSafeAreaInsets()
  // ONE value drives open / close / drag (0 = open, SCREEN_H = closed). Sharing it means a drag
  // flows straight into the exit animation with no snap-back.
  const translateY = useRef(new Animated.Value(SCREEN_H)).current
  const scrimOpacity = useRef(new Animated.Value(0)).current
  // Mounted is decoupled from `visible` so the EXIT animation plays BEFORE the Modal hides — a
  // Modal with visible=false vanishes instantly, so the internal animation would never show.
  const [mounted, setMounted] = useState(visible)
  // Set when a drag-release starts the exit animation itself, so the visible→false effect doesn't
  // RE-fire it (the re-fire after the React round-trip is the "brief pause" mid-fling).
  const closingFromDrag = useRef(false)

  const sheetHeight = resolveHeight(variant, peekHeight, insets.top)

  // Run the exit animation (from the current position) then unmount the Modal. Idempotent enough:
  // the gesture starts it immediately on release; the effect skips it when the gesture already did.
  const animateOut = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: SCREEN_H, ...theme.motion.patterns.overlay, useNativeDriver: true }),
      Animated.timing(scrimOpacity, { toValue: 0, ...theme.motion.patterns.overlay, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) setMounted(false)
    })
  }, [translateY, scrimOpacity])

  useEffect(() => {
    if (visible) {
      closingFromDrag.current = false
      setMounted(true)
      translateY.setValue(SCREEN_H) // start offscreen → spring up
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, stiffness: 220, damping: 24 }),
        Animated.timing(scrimOpacity, { toValue: 1, ...theme.motion.patterns.overlay, useNativeDriver: true }),
      ]).start()
    } else if (closingFromDrag.current) {
      closingFromDrag.current = false // the drag already started the exit — don't restart (no pause)
    } else {
      animateOut()
    }
  }, [visible, translateY, scrimOpacity, animateOut])

  // Grabber drag (non-dragToDismiss sheets) — drives the same translateY.
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 4,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy)
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80 || g.vy > 0.5) {
          closingFromDrag.current = true
          animateOut() // start immediately (continue the motion) — no React round-trip pause
          onClose()
        } else Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start()
      },
    }),
  ).current

  // RNGH drag-to-dismiss (dragToDismiss sheets). RN PanResponder doesn't receive moves here —
  // the sheet's child controls are RNGH, which consume the gesture natively and starve RN's
  // responder. So drag with RNGH too (it composes with the child handlers via activeOffsetY).
  // runOnJS so the callbacks drive the RN Animated.Value directly. On dismiss we just call
  // onClose() — the visible→false exit animation continues translateY from the drag position.
  const dragGesture = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .activeOffsetY(12) // engage on a clear vertical drag; taps still reach the controls
        .failOffsetX([-24, 24]) // bail if it's mostly horizontal
        .onUpdate((e) => {
          if (e.translationY > 0) translateY.setValue(e.translationY)
        })
        .onEnd((e) => {
          if (e.translationY > 80 || e.velocityY > 600) {
            closingFromDrag.current = true
            animateOut() // start immediately (continue the fling) — no React round-trip pause
            onClose()
          } else Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start()
        }),
    [onClose, translateY, animateOut],
  )

  // The grabber handle. On a scrollable + dragToDismiss sheet IT is the drag target (a whole-sheet
  // drag would fight the body scroll); on a short dragToDismiss sheet the whole sheet drags.
  const grabber = showGrabber ? (
    <View
      {...(!dragToDismiss && !scrollable ? panResponder.panHandlers : {})}
      style={styles.grabberHit}
    >
      <View style={styles.grabber} />
    </View>
  ) : null
  const handle = dragToDismiss && scrollable && grabber ? <GestureDetector gesture={dragGesture}>{grabber}</GestureDetector> : grabber

  const sheet = (
    <Animated.View
      style={[styles.sheet, { height: sheetHeight, transform: [{ translateY }] }, contentStyle]}
    >
      {handle}
      {scrollable ? (
        <ScrollView
          style={styles.body}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + theme.spacing.md }]}
          showsVerticalScrollIndicator
        >
          {children}
        </ScrollView>
      ) : (
        <View style={styles.body}>{children}</View>
      )}
    </Animated.View>
  )

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.root}>
        {showScrim && (
          <Animated.View
            style={[styles.scrim, { opacity: scrimOpacity }]}
            pointerEvents={visible ? 'auto' : 'none'}
            // Raw responder on the scrim itself — most fundamental touch path (a child Pressable
            // wasn't receiving the tap in a high-churn screen). Tap-anywhere-outside → dismiss.
            onStartShouldSetResponder={() => true}
            onResponderRelease={onClose}
          />
        )}
        {/* Whole-sheet drag only for short (non-scrollable) sheets — else the grabber handles it. */}
        {dragToDismiss && !scrollable ? <GestureDetector gesture={dragGesture}>{sheet}</GestureDetector> : sheet}
      </GestureHandlerRootView>
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
  scrollContent: { flexGrow: 1 },
})
