import { useEffect, useRef } from 'react'
import type { ConnectivityMode } from '../lib/offline/types'

/** Re-run callback when leaving or returning to online connectivity. */
export function useReloadOnConnectivityChange(mode: ConnectivityMode, callback: () => void) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback
  const prevModeRef = useRef(mode)

  useEffect(() => {
    const prev = prevModeRef.current
    prevModeRef.current = mode
    if (prev === mode) return
    const leftOnline = prev === 'online' && mode !== 'online'
    const returnedOnline = prev !== 'online' && mode === 'online'
    if (leftOnline || returnedOnline) {
      callbackRef.current()
    }
  }, [mode])
}

/** @deprecated Use useReloadOnConnectivityChange */
export const useReloadOnReconnect = useReloadOnConnectivityChange
