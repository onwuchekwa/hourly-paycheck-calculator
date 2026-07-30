import { describe, expect, it } from 'vitest'
import {
  calculateTaxes,
  dayBefore,
  getActiveTaxRate,
  getTaxRateForDate,
  prepareAddTaxRate,
  resolveTaxYear,
} from '../src/lib/tax'
import type { TaxRate } from '../src/lib/types'

const rates: TaxRate[] = [
  { id: 'r1', rate: 15, effectiveFrom: '2025-01-01', effectiveTo: '2026-12-31' },
  { id: 'r2', rate: 16.65, effectiveFrom: '2027-01-01' },
]

describe('resolveTaxYear', () => {
  it('returns calendar year from pay period end date', () => {
    expect(resolveTaxYear('2026-06-15')).toBe(2026)
  })
})

describe('dayBefore', () => {
  it('returns previous day within month', () => {
    expect(dayBefore('2027-01-01')).toBe('2026-12-31')
  })

  it('handles month boundaries', () => {
    expect(dayBefore('2026-03-01')).toBe('2026-02-28')
  })
})

describe('getTaxRateForDate', () => {
  it('returns rate active on date', () => {
    expect(getTaxRateForDate(rates, '2026-06-15')?.id).toBe('r1')
    expect(getTaxRateForDate(rates, '2027-02-28')?.id).toBe('r2')
  })

  it('returns null when no rate covers date', () => {
    expect(getTaxRateForDate(rates, '2024-12-31')).toBeNull()
  })
})

describe('getActiveTaxRate', () => {
  it('returns rate without effectiveTo', () => {
    expect(getActiveTaxRate(rates)?.id).toBe('r2')
  })
})

describe('prepareAddTaxRate', () => {
  it('auto-ends previous active rate', () => {
    const result = prepareAddTaxRate('2027-01-01', [
      { id: 'old', rate: 15, effectiveFrom: '2025-01-01' },
    ])
    expect(result.endPreviousId).toBe('old')
    expect(result.effectiveTo).toBe('2026-12-31')
  })

  it('does not end when new date is not after active effectiveFrom', () => {
    const result = prepareAddTaxRate('2025-01-01', [
      { id: 'old', rate: 15, effectiveFrom: '2025-06-01' },
    ])
    expect(result.endPreviousId).toBeNull()
  })
})

describe('calculateTaxes', () => {
  it('computes tax and net pay', () => {
    const breakdown = calculateTaxes(1000, rates[0], '2026-06-15')
    expect(breakdown.tax).toBe(150)
    expect(breakdown.netPay).toBe(850)
    expect(breakdown.taxYear).toBe(2026)
    expect(breakdown.taxRate).toBe(15)
    expect(breakdown.taxRateId).toBe('r1')
  })

  it('uses fallback rate when no rate provided', () => {
    const breakdown = calculateTaxes(1000, null, '2024-12-31', 16.65)
    expect(breakdown.tax).toBe(166.5)
    expect(breakdown.netPay).toBe(833.5)
  })

  it('rounds to cents', () => {
    const breakdown = calculateTaxes(123.45, { id: 'x', rate: 16.65, effectiveFrom: '2025-01-01' }, '2026-01-15')
    expect(breakdown.tax).toBe(20.55)
    expect(breakdown.netPay).toBe(102.9)
  })
})
