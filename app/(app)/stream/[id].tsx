import { useLocalSearchParams } from 'expo-router'
import { StreamScreen } from '@/components/screens/StreamScreen'
import { ExternalStreamScreen } from '@/components/screens/ExternalStreamScreen'

// External cams (ext-<slug>) have no mediasoup room — they're watched as a live
// HLS pull, not over WebRTC. The globe passes `isExternal=true` + `liveUrl` when
// it routes to one; branch to the HLS viewer so the WebRTC StreamScreen never
// mounts for them. Everything else (broadcaster `new`, normal viewers) is
// unchanged.
export default function StreamRoute() {
  const { isExternal } = useLocalSearchParams<{ isExternal?: string }>()
  if (isExternal === 'true') return <ExternalStreamScreen />
  return <StreamScreen />
}
