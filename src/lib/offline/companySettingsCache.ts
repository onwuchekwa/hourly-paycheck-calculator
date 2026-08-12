import type { CompanySettings } from '../types'

const CACHE_KEY = 'payroll:companySettings'

export function loadCachedCompanySettings(): CompanySettings | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CompanySettings
    if (!parsed || typeof parsed.companyName !== 'string') return null
    return parsed
  } catch {
    return null
  }
}

export function saveCachedCompanySettings(settings: CompanySettings): void {
  localStorage.setItem(CACHE_KEY, JSON.stringify(settings))
}

export function clearCachedCompanySettings(): void {
  localStorage.removeItem(CACHE_KEY)
}
