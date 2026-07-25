import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { CompanySettings } from '../lib/types'

const DEFAULT_SETTINGS: CompanySettings = {
  companyName: 'Company',
  address: '',
  phone: '',
  email: '',
}

interface CompanySettingsContextValue {
  settings: CompanySettings
  loading: boolean
  appTitle: string
  refreshSettings: () => Promise<void>
}

const CompanySettingsContext = createContext<CompanySettingsContextValue | null>(null)

export function CompanySettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<CompanySettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)

  const refreshSettings = useCallback(async () => {
    try {
      const snap = await getDoc(doc(db, 'settings', 'company'))
      if (snap.exists()) {
        setSettings({ ...DEFAULT_SETTINGS, ...snap.data() } as CompanySettings)
      } else {
        setSettings(DEFAULT_SETTINGS)
      }
    } catch {
      setSettings(DEFAULT_SETTINGS)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshSettings()
  }, [refreshSettings])

  const appTitle = settings.companyName.trim() || DEFAULT_SETTINGS.companyName

  const value = useMemo(
    () => ({ settings, loading, appTitle, refreshSettings }),
    [settings, loading, appTitle, refreshSettings],
  )

  return (
    <CompanySettingsContext.Provider value={value}>
      {children}
    </CompanySettingsContext.Provider>
  )
}

export function useCompanySettings(): CompanySettingsContextValue {
  const ctx = useContext(CompanySettingsContext)
  if (!ctx) {
    throw new Error('useCompanySettings must be used within CompanySettingsProvider')
  }
  return ctx
}
