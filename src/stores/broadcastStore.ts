import { create } from 'zustand'
import type { SourceType } from '@/types'
import { serverNow } from '@/lib/serverClock'

// Global broadcast state shared across screens so the Go Live / Record
// controls look and read the same on the dashboard and the stream view
// (same pattern as the shared title in captureConfig).
//
// The broadcast itself lives in StreamScreen's signaling / media hooks
// (the stream tab never unmounts, so in-app navigation doesn't end it).
// This store mirrors `isLive` / `isRecording` / live `sources` for any
// screen to render, and carries a one-shot `command` so a control on the
// dashboard (where the hooks don't live) can ask the mounted StreamScreen
// to act on the running broadcast.
type Command = 'endStream' | 'startRecording' | 'stopRecording'

type BroadcastState = {
  isLive: boolean
  // Wall-clock (ms) when this broadcast went live. Lets the Clips screen show an OPTIMISTIC live clip
  // building from go-live immediately, before the backend has created the buffer session (~seconds).
  liveSince: number | null
  isRecording: boolean
  sources: SourceType[]
  // The broadcaster's LIVE local camera stream, published so the Clips page can show the actual live
  // feed (not the seconds-behind buffer VOD) when the playhead rides the now edge. `liveStreamUrl` is
  // the react-native-webrtc stream URL (localStream.toURL()); `liveMirror` matches the stream page's
  // front-camera mirroring. Null while not broadcasting with a camera. (StreamScreen owns the stream;
  // the tab never unmounts, so the feed stays alive while you're on the Clips tab.)
  liveStreamUrl: string | null
  liveMirror: boolean
  // One-shot command from a remote control surface (e.g. the dashboard);
  // StreamScreen executes it and calls consumeCommand(). The nonce makes
  // repeated identical commands re-fire.
  command: Command | null
  commandNonce: number
  setLive: (sources: SourceType[]) => void
  setRecording: (isRecording: boolean) => void
  setLiveStream: (url: string | null, mirror: boolean) => void
  clear: () => void
  sendCommand: (command: Command) => void
  consumeCommand: () => void
}

export const useBroadcastStore = create<BroadcastState>((set) => ({
  isLive: false,
  liveSince: null,
  isRecording: false,
  sources: [],
  liveStreamUrl: null,
  liveMirror: false,
  command: null,
  commandNonce: 0,
  // Stamp liveSince only on the transition into live (preserve it across source changes). Reads the
  // UNIVERSAL wall clock (serverNow), not raw Date.now() — the Clips timeline positions the optimistic
  // live clip by serverNow(), so a device↔server skew would otherwise misplace its start (CONTENT.md §6).
  setLive: (sources) => set((s) => ({ isLive: true, sources, liveSince: s.isLive ? s.liveSince : serverNow() })),
  setRecording: (isRecording) => set({ isRecording }),
  setLiveStream: (liveStreamUrl, liveMirror) => set({ liveStreamUrl, liveMirror }),
  clear: () => set({ isLive: false, isRecording: false, sources: [], liveSince: null, liveStreamUrl: null, liveMirror: false }),
  sendCommand: (command) => set((s) => ({ command, commandNonce: s.commandNonce + 1 })),
  consumeCommand: () => set({ command: null }),
}))
