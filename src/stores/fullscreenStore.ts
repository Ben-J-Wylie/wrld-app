import { create } from 'zustand'

// Whether a video surface (the WebRTC live viewer or the external-cam HLS viewer)
// is currently in fullscreen. Set by `useFullscreenVideo` on enter/exit; read by
// the bottom tab bar (app/(app)/_layout.tsx) so it can hide itself and let the
// video frame go truly edge-to-edge. A singleton — only one video is fullscreen
// at a time, and the hook resets it on exit/unmount.
type FullscreenState = {
  isFullscreen: boolean
  setFullscreen: (v: boolean) => void
}

export const useFullscreenStore = create<FullscreenState>((set) => ({
  isFullscreen: false,
  setFullscreen: (v) => set({ isFullscreen: v }),
}))
