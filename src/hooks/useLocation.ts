import { useState, useEffect } from 'react'
import * as Location from 'expo-location'

type Coords = { latitude: number; longitude: number }

type LocationState = {
  coords: Coords | null
  error: string | null
  loading: boolean
}

export function useLocation() {
  const [state, setState] = useState<LocationState>({ coords: null, error: null, loading: true })

  useEffect(() => {
    let cancelled = false

    async function fetch() {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (cancelled) return

      if (status !== 'granted') {
        setState({ coords: null, error: 'Location permission denied', loading: false })
        return
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      })
      if (cancelled) return

      setState({
        coords: { latitude: loc.coords.latitude, longitude: loc.coords.longitude },
        error: null,
        loading: false,
      })
    }

    fetch().catch((err) => {
      if (!cancelled) {
        setState({ coords: null, error: err instanceof Error ? err.message : 'Location failed', loading: false })
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  return state
}
