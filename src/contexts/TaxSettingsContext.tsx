import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { TaxRate } from '../lib/types'
import { getActiveTaxRate, getTaxRateForDate } from '../lib/tax'

interface TaxSettingsContextValue {
  rates: TaxRate[]
  loading: boolean
  activeRate: TaxRate | null
  getRateForDate: (date: string) => TaxRate | null
  refreshRates: () => Promise<void>
}

const TaxSettingsContext = createContext<TaxSettingsContextValue | null>(null)

export function TaxSettingsProvider({ children }: { children: ReactNode }) {
  const [rates, setRates] = useState<TaxRate[]>([])
  const [loading, setLoading] = useState(true)

  const refreshRates = useCallback(async () => {
    try {
      const snap = await getDocs(query(collection(db, 'taxRates'), orderBy('effectiveFrom', 'desc')))
      setRates(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TaxRate))
    } catch {
      setRates([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshRates()
  }, [refreshRates])

  const getRateForDateFn = useCallback((date: string) => getTaxRateForDate(rates, date), [rates])
  const activeRate = useMemo(() => getActiveTaxRate(rates), [rates])

  const value = useMemo(
    () => ({
      rates,
      loading,
      activeRate,
      getRateForDate: getRateForDateFn,
      refreshRates,
    }),
    [rates, loading, activeRate, getRateForDateFn, refreshRates],
  )

  return <TaxSettingsContext.Provider value={value}>{children}</TaxSettingsContext.Provider>
}

export function useTaxSettings(): TaxSettingsContextValue {
  const ctx = useContext(TaxSettingsContext)
  if (!ctx) {
    throw new Error('useTaxSettings must be used within TaxSettingsProvider')
  }
  return ctx
}
