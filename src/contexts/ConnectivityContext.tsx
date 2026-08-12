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
import { auth, db } from '../lib/firebase'
import {
  getConnectivityMode,
  reportConnectivityFailure,
  reportConnectivitySuccess,
  setConnectivityMode,
  subscribeConnectivity,
} from '../lib/offline/connectivityState'
import { flushSync, isSyncInProgress, type SyncResult } from '../lib/offline/syncManager'
import { isVaultUnlocked } from '../lib/offline/encryptedVault'
import type { ConnectivityMode } from '../lib/offline/types'

interface ConnectivityContextValue {
  mode: ConnectivityMode
  isOnline: boolean
  isOfflineCapable: boolean
  syncing: boolean
  lastSyncResult: SyncResult | null
  reportFailure: () => void
  triggerSync: (employeeId: string) => Promise<SyncResult>
}

const ConnectivityContext = createContext<ConnectivityContextValue | null>(null)

const HEARTBEAT_MS = 30_000
const ONLINE_DEBOUNCE_MS = 2_000

async function probeConnectivity(): Promise<boolean> {
  if (!navigator.onLine) return false
  try {
    if (auth.currentUser) {
      await Promise.race([
        auth.currentUser.getIdToken(false),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
      ])
      return true
    }
    await Promise.race([
      getDoc(doc(db, 'settings', 'company')),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
    ])
    return true
  } catch {
    return false
  }
}

export function ConnectivityProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ConnectivityMode>(getConnectivityMode())
  const [syncing, setSyncing] = useState(false)
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null)
  const onlineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return subscribeConnectivity(setMode)
  }, [])

  const runProbe = useCallback(async () => {
    if (document.visibilityState === 'hidden') return
    const ok = await probeConnectivity()
    if (ok) {
      reportConnectivitySuccess()
    } else {
      reportConnectivityFailure()
    }
  }, [])

  useEffect(() => {
    const onOnline = () => {
      if (onlineTimerRef.current) clearTimeout(onlineTimerRef.current)
      onlineTimerRef.current = setTimeout(() => void runProbe(), ONLINE_DEBOUNCE_MS)
    }
    const onOffline = () => setConnectivityMode('offline')

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    void runProbe()

    const interval = setInterval(() => void runProbe(), HEARTBEAT_MS)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      clearInterval(interval)
      if (onlineTimerRef.current) clearTimeout(onlineTimerRef.current)
    }
  }, [runProbe])

  const triggerSync = useCallback(async (employeeId: string) => {
    if (getConnectivityMode() !== 'online' || !employeeId) {
      return { synced: 0, conflicts: [], tampered: [], errors: ['Not online'] }
    }
    setSyncing(true)
    try {
      const result = await flushSync(employeeId)
      setLastSyncResult(result)
      return result
    } finally {
      setSyncing(false)
    }
  }, [])

  useEffect(() => {
    if (mode !== 'online') return
    const employeeId = auth.currentUser?.uid
    if (!employeeId || !isVaultUnlocked()) return
    void triggerSync(employeeId)
  }, [mode, triggerSync])

  const value = useMemo(
    () => ({
      mode,
      isOnline: mode === 'online',
      isOfflineCapable: mode !== 'online' && isVaultUnlocked(),
      syncing: syncing || isSyncInProgress(),
      lastSyncResult,
      reportFailure: reportConnectivityFailure,
      triggerSync,
    }),
    [mode, syncing, lastSyncResult, triggerSync],
  )

  return <ConnectivityContext.Provider value={value}>{children}</ConnectivityContext.Provider>
}

export function useConnectivity() {
  const ctx = useContext(ConnectivityContext)
  if (!ctx) throw new Error('useConnectivity must be used within ConnectivityProvider')
  return ctx
}
