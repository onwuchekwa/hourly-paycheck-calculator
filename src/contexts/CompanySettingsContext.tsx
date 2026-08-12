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
import { DEFAULT_COMPANY_NAME } from '../lib/companyBranding'
import {
  loadCachedCompanySettings,
  saveCachedCompanySettings,
} from '../lib/offline/companySettingsCache'

const DEFAULT_SETTINGS: CompanySettings = {
  companyName: DEFAULT_COMPANY_NAME,
  address: '',
  phone: '',
  email: '',
}

function mergeSettings(data: Partial<CompanySettings> | undefined): CompanySettings {
  return { ...DEFAULT_SETTINGS, ...data }
}

interface CompanySettingsContextValue {
  settings: CompanySettings
  loading: boolean
  appTitle: string
  logoDataUrl: string | undefined
  showLogo: boolean
  refreshSettings: () => Promise<void>
}

const CompanySettingsContext = createContext<CompanySettingsContextValue | null>(null)

export function CompanySettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<CompanySettings>(() => {
    return mergeSettings(loadCachedCompanySettings() ?? undefined)
  })
  const [loading, setLoading] = useState(true)

  const refreshSettings = useCallback(async () => {
    try {
      const snap = await getDoc(doc(db, 'settings', 'company'))
      const merged = snap.exists()
        ? mergeSettings(snap.data() as CompanySettings)
        : mergeSettings(undefined)
      setSettings(merged)
      saveCachedCompanySettings(merged)
    } catch {
      const cached = loadCachedCompanySettings()
      if (cached) {
        setSettings(mergeSettings(cached))
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshSettings()
  }, [refreshSettings])

  const appTitle = settings.companyName.trim() || DEFAULT_SETTINGS.companyName
  const logoDataUrl = settings.logoDataUrl?.trim() || undefined
  const showLogo = settings.showLogo ?? Boolean(logoDataUrl)

  const value = useMemo(
    () => ({
      settings,
      loading,
      appTitle,
      logoDataUrl,
      showLogo,
      refreshSettings,
    }),
    [settings, loading, appTitle, logoDataUrl, showLogo, refreshSettings],
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
