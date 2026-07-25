import { useEffect } from 'react'
import { useCompanySettings } from '../contexts/CompanySettingsContext'

export function DocumentTitle() {
  const { appTitle, loading } = useCompanySettings()

  useEffect(() => {
    if (loading) return
    document.title = `${appTitle} — Payroll`
  }, [appTitle, loading])

  return null
}
