import { create } from 'zustand'
import type { SourceType } from '@/types'

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
  // One-shot command from a remote control surface (e.g. the dashboard);
  // StreamScreen executes it and calls consumeCommand(). The nonce makes
  // repeated identical commands re-fire.
  command: Command | null
  commandNonce: number
  setLive: (sources: SourceType[]) => void
  setRecording: (isRecording: boolean) => void
  clear: () => void
  sendCommand: (command: Command) => void
  consumeCommand: () => void
}

export const useBroadcastStore = create<BroadcastState>((set) => ({
  isLive: false,
  liveSince: null,
  isRecording: false,
  sources: [],
  command: null,
  commandNonce: 0,
  // Stamp liveSince only on the transition into live (preserve it across source changes).
  setLive: (sources) => set((s) => ({ isLive: true, sources, liveSince: s.isLive ? s.liveSince : Date.now() })),
  setRecording: (isRecording) => set({ isRecording }),
  clear: () => set({ isLive: false, isRecording: false, sources: [], liveSince: null }),
  sendCommand: (command) => set((s) => ({ command, commandNonce: s.commandNonce + 1 })),
  consumeCommand: () => set({ command: null }),
}))
