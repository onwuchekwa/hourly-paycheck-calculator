import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { onIdTokenChanged } from 'firebase/auth'
import { auth, db } from '../lib/firebase'
import {
  getConnectivityMode,
  reportConnectivityFailure,
  reportConnectivitySuccess,
  setConnectivityMode,
  setSuppressConnectivityFailures,
  subscribeConnectivity,
  subscribeConnectivityFailures,
} from '../lib/offline/connectivityState'
import { flushSync, isSyncInProgress, type SyncResult } from '../lib/offline/syncManager'
import { isVaultUnlocked } from '../lib/offline/encryptedVault'
import type { ConnectivityMode } from '../lib/offline/types'

interface ConnectivityContextValue {
  mode: ConnectivityMode
  ready: boolean
  isOnline: boolean
  isOfflineCapable: boolean
  syncing: boolean
  lastSyncResult: SyncResult | null
  reportFailure: () => void
  triggerSync: (employeeId: string) => Promise<SyncResult>
}

const ConnectivityContext = createContext<ConnectivityContextValue | null>(null)

const HEARTBEAT_MS = 10_000
const OFFLINE_HEARTBEAT_MS = 30_000
const ONLINE_DEBOUNCE_MS = 2_000
const FAILURE_PROBE_DEBOUNCE_MS = 1_000
const PROBE_TIMEOUT_MS = 5_000
const SYNC_STABLE_MS = 3_000

async function probeConnectivity(): Promise<boolean> {
  if (!navigator.onLine) return false
  try {
    await Promise.race([
      getDoc(doc(db, 'settings', 'company')),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connectivity probe timeout')), PROBE_TIMEOUT_MS),
      ),
    ])
    return true
  } catch {
    return false
  }
}

export function ConnectivityProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ConnectivityMode>(getConnectivityMode())
  const [ready, setReady] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null)
  const onlineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const failureProbeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const readyRef = useRef(false)

  useEffect(() => {
    return subscribeConnectivity(setMode)
  }, [])

  const markReady = useCallback(() => {
    if (readyRef.current) return
    readyRef.current = true
    setReady(true)
  }, [])

  const runProbe = useCallback(async () => {
    if (document.visibilityState === 'hidden') return
    if (!navigator.onLine) {
      reportConnectivityFailure()
      markReady()
      return
    }
    const ok = await probeConnectivity()
    if (ok) {
      reportConnectivitySuccess()
    } else {
      reportConnectivityFailure()
    }
    markReady()
  }, [markReady])

  useEffect(() => {
    const scheduleFailureProbe = () => {
      if (failureProbeTimerRef.current) clearTimeout(failureProbeTimerRef.current)
      failureProbeTimerRef.current = setTimeout(() => void runProbe(), FAILURE_PROBE_DEBOUNCE_MS)
    }

    const onOnline = () => {
      if (onlineTimerRef.current) clearTimeout(onlineTimerRef.current)
      onlineTimerRef.current = setTimeout(() => void runProbe(), ONLINE_DEBOUNCE_MS)
    }
    const onOffline = () => setConnectivityMode('offline')

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    const unsubFailures = subscribeConnectivityFailures(scheduleFailureProbe)
    void runProbe()

    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      unsubFailures()
      if (onlineTimerRef.current) clearTimeout(onlineTimerRef.current)
      if (failureProbeTimerRef.current) clearTimeout(failureProbeTimerRef.current)
    }
  }, [runProbe])

  useEffect(() => {
    const heartbeatMs = mode === 'online' ? HEARTBEAT_MS : OFFLINE_HEARTBEAT_MS
    const interval = setInterval(() => void runProbe(), heartbeatMs)
    return () => clearInterval(interval)
  }, [mode, runProbe])

  const triggerSync = useCallback(async (employeeId: string) => {
    if (getConnectivityMode() !== 'online' || !employeeId) {
      return { synced: 0, conflicts: [], tampered: [], errors: ['Not online'] }
    }
    setSyncing(true)
    setSuppressConnectivityFailures(true)
    try {
      const result = await flushSync(employeeId)
      setLastSyncResult(result)
      return result
    } finally {
      setSuppressConnectivityFailures(false)
      setSyncing(false)
    }
  }, [])

  useEffect(() => {
    if (mode !== 'online') return
    const employeeId = auth.currentUser?.uid
    if (!employeeId || !isVaultUnlocked()) return
    const timer = setTimeout(() => {
      if (getConnectivityMode() === 'online') void triggerSync(employeeId)
    }, SYNC_STABLE_MS)
    return () => clearTimeout(timer)
  }, [mode, triggerSync])

  useEffect(() => {
    const unsub = onIdTokenChanged(auth, (user) => {
      if (!user || getConnectivityMode() !== 'online' || !isVaultUnlocked()) return
      if (isSyncInProgress()) return
      const hadAuthError = lastSyncResult?.errors.some(
        (error) =>
          error.includes('Authentication expired') || error.includes('Sign in online to sync'),
      )
      if (!hadAuthError) return
      void triggerSync(user.uid)
    })
    return unsub
  }, [triggerSync, lastSyncResult])

  const value = useMemo(
    () => ({
      mode,
      ready,
      isOnline: mode === 'online',
      isOfflineCapable: mode !== 'online' && isVaultUnlocked(),
      syncing: syncing || isSyncInProgress(),
      lastSyncResult,
      reportFailure: reportConnectivityFailure,
      triggerSync,
    }),
    [mode, ready, syncing, lastSyncResult, triggerSync],
  )

  return <ConnectivityContext.Provider value={value}>{children}</ConnectivityContext.Provider>
}

export function useConnectivity() {
  const ctx = useContext(ConnectivityContext)
  if (!ctx) throw new Error('useConnectivity must be used within ConnectivityProvider')
  return ctx
}
