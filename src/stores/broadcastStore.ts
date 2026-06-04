import { create } from 'zustand'

// Tracks whether the current user has an active outgoing broadcast, so a
// persistent "return to your live stream" affordance can live in the tab
// bar regardless of which screen is focused.
//
// The broadcast itself lives in StreamScreen's signaling / media hooks,
// which stay mounted (the stream tab never unmounts), so navigating to a
// different page in-app does NOT end it. Backgrounding / closing / the
// explicit Leave still end it as usual; this flag just mirrors the
// in-room state so the rest of the app can offer a way back.
type BroadcastState = {
  isLive: boolean
  setLive: (isLive: boolean) => void
}

export const useBroadcastStore = create<BroadcastState>((set) => ({
  isLive: false,
  setLive: (isLive) => set({ isLive }),
}))
