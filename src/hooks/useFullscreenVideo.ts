// src/hooks/useFullscreenVideo.ts
//
// Drives an immersive, optionally-landscape fullscreen mode for a video surface
// (the WebRTC live viewer, the external-cam HLS viewer). The app is portrait
// everywhere by default (locked at the root — see app/_layout.tsx); this hook is
// the only place that unlocks landscape, and it always re-locks portrait on exit
// / unmount so a screen can never leak a landscape lock back to the rest of the
// app.
//
//   enter(landscape)  — go fullscreen. landscape=true → lock LANDSCAPE (allows
//                       BOTH landscape-left and landscape-right; the OS keeps the
//                       picture upright either way). landscape=false → stay
//                       portrait (fullscreen just drops the chrome).
//   exit()            — leave fullscreen, re-lock PORTRAIT_UP, show the status bar.
//
// The status bar is hidden while fullscreen for a clean edge-to-edge frame.

import { useCallback, useEffect, useRef, useState } from 'react'
import { StatusBar } from 'react-native'
import * as ScreenOrientation from 'expo-screen-orientation'

export function useFullscreenVideo() {
  const [isFullscreen, setIsFullscreen] = useState(false)
  // Tracks the live value for the unmount cleanup (which can't read state).
  const activeRef = useRef(false)

  const enter = useCallback(async (landscape: boolean) => {
    activeRef.current = true
    setIsFullscreen(true)
    StatusBar.setHidden(true, 'fade')
    try {
      await ScreenOrientation.lockAsync(
        landscape
          ? ScreenOrientation.OrientationLock.LANDSCAPE
          : ScreenOrientation.OrientationLock.PORTRAIT_UP,
      )
    } catch {}
  }, [])

  const exit = useCallback(async () => {
    if (!activeRef.current) return
    activeRef.current = false
    setIsFullscreen(false)
    StatusBar.setHidden(false, 'fade')
    try {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP)
    } catch {}
  }, [])

  // Restore portrait + status bar if we're torn down while still fullscreen
  // (e.g. the stream ends and the screen unmounts mid-landscape).
  useEffect(() => {
    return () => {
      if (activeRef.current) {
        StatusBar.setHidden(false)
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {})
      }
    }
  }, [])

  return { isFullscreen, enter, exit }
}
