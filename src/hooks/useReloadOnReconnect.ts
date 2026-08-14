import { useEffect, useRef } from 'react'
import type { ConnectivityMode } from '../lib/offline/types'

const RECONNECT_STABLE_MS = 3_000

/** Re-run callback when leaving or returning to online connectivity. */
export function useReloadOnConnectivityChange(mode: ConnectivityMode, callback: () => void) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback
  const prevModeRef = useRef(mode)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const prev = prevModeRef.current
    prevModeRef.current = mode
    if (prev === mode) return

    const leftOnline = prev === 'online' && mode !== 'online'
    const returnedOnline = prev !== 'online' && mode === 'online'

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }

    if (leftOnline) {
      callbackRef.current()
      return
    }

    if (returnedOnline) {
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null
        callbackRef.current()
      }, RECONNECT_STABLE_MS)
    }
  }, [mode])

  useEffect(() => {
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
    }
  }, [])
}

/** @deprecated Use useReloadOnConnectivityChange */
export const useReloadOnReconnect = useReloadOnConnectivityChange
