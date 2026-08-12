import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../lib/firebase'
import {
  clearSessionKey,
  isSessionExpired,
  touchLastActiveAt,
} from '../lib/offline/encryptedVault'
import { INACTIVITY_MS } from '../lib/offline/types'

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'click'] as const
const THROTTLE_MS = 60_000

export function useInactivityTimeout(enabled: boolean, onExpire?: () => void) {
  const navigate = useNavigate()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTouchRef = useRef(0)

  useEffect(() => {
    if (!enabled) return

    if (isSessionExpired()) {
      void (async () => {
        clearSessionKey()
        sessionStorage.clear()
        await signOut(auth).catch(() => {})
        onExpire?.()
        navigate('/login', { replace: true })
      })()
      return
    }

    const resetTimer = () => {
      const now = Date.now()
      if (now - lastTouchRef.current < THROTTLE_MS) return
      lastTouchRef.current = now
      touchLastActiveAt()

      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        void (async () => {
          clearSessionKey()
          sessionStorage.clear()
          await signOut(auth).catch(() => {})
          onExpire?.()
          navigate('/login', { replace: true })
        })()
      }, INACTIVITY_MS)
    }

    resetTimer()
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, resetTimer, { passive: true })
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, resetTimer)
      }
    }
  }, [enabled, navigate, onExpire])
}
