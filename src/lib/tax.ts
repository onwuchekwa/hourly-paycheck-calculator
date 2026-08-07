import type { TaxBreakdown, TaxRate } from './types'

export function resolveTaxYear(payPeriodEnd: string): number {
  return Number.parseInt(payPeriodEnd.slice(0, 4), 10)
}

export function dayBefore(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() - 1)
  const year = dt.getFullYear()
  const month = String(dt.getMonth() + 1).padStart(2, '0')
  const day = String(dt.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getTaxRateForDate(rates: TaxRate[], date: string): TaxRate | null {
  const applicable = rates
    .filter(
      (r) =>
        r.effectiveFrom <= date &&
        (r.effectiveTo == null || r.effectiveTo === '' || r.effectiveTo >= date),
    )
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))
  return applicable[0] ?? null
}

export function getActiveTaxRate(rates: TaxRate[]): TaxRate | null {
  return rates.find((r) => r.effectiveTo == null || r.effectiveTo === '') ?? null
}

export function calculateTaxes(
  grossPay: number,
  rate: TaxRate | null,
  payPeriodEnd: string,
  allRates: TaxRate[] = [],
): TaxBreakdown {
  const resolved = rate ?? getActiveTaxRate(allRates)
  const taxRate = resolved?.rate ?? 0
  const tax = Math.round(grossPay * (taxRate / 100) * 100) / 100
  const netPay = Math.round((grossPay - tax) * 100) / 100
  return {
    taxYear: resolveTaxYear(payPeriodEnd),
    taxRate,
    taxRateId: resolved?.id,
    tax,
    netPay,
  }
}

export interface PrepareAddTaxRateResult {
  endPreviousId: string | null
  effectiveTo: string | null
}

export function prepareAddTaxRate(
  effectiveFrom: string,
  existingRates: TaxRate[],
): PrepareAddTaxRateResult {
  const active = getActiveTaxRate(existingRates)
  if (!active || active.effectiveFrom >= effectiveFrom) {
    return { endPreviousId: null, effectiveTo: null }
  }
  return {
    endPreviousId: active.id,
    effectiveTo: dayBefore(effectiveFrom),
  }
}

export function formatTaxRateLabel(rate: number): string {
  const formatted = Number.isInteger(rate) ? rate.toFixed(0) : rate.toFixed(2).replace(/\.?0+$/, '')
  return `${formatted}%`
}
