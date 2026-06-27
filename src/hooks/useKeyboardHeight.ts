// src/hooks/useKeyboardHeight.ts
//
// Raw on-screen keyboard height via RN's Keyboard events — the app's proven
// Android keyboard-avoidance primitive (the same listener StreamScreen's chat
// composer uses to lift above the keyboard). react-native-keyboard-controller's
// KeyboardAvoidingView is unreliable INSIDE a Modal on Android (the Modal is a
// separate native window the controller can't observe), so absolute-positioned
// Modal sheets pad themselves by this height instead.
//
// iOS uses the `will` events (smooth, pre-animation); Android only fires the
// `did` events. Returns 0 when the keyboard is hidden.
import { useEffect, useState } from 'react'
import { Keyboard, Platform } from 'react-native'

export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0)
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'
    const showSub = Keyboard.addListener(showEvent, (e) => setHeight(e.endCoordinates.height))
    const hideSub = Keyboard.addListener(hideEvent, () => setHeight(0))
    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [])
  return height
}
