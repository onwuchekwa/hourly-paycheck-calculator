import { useEffect, useRef } from 'react'
import type { ConnectivityMode } from '../lib/offline/types'

/** Re-run callback only when connectivity transitions back to online. */
export function useReloadOnReconnect(mode: ConnectivityMode, callback: () => void) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback
  const prevModeRef = useRef(mode)

  useEffect(() => {
    const prev = prevModeRef.current
    prevModeRef.current = mode
    if (prev !== 'online' && mode === 'online') {
      callbackRef.current()
    }
  }, [mode])
}
