import type {
  MockPaycheckDayLine,
  MockPaycheckPreview,
  PaySlip,
  PaySlipDayLine,
  PayrollLineItem,
  PayrollRun,
  PayPeriod,
  TimeEntry,
  EmployeeRate,
  TaxRate,
} from './types'
import { calcEntryHours, hasCompletedPunch, normalizeEntry } from './timeEntries'
import { formatDate } from './utils'
import { getMockPaycheckRate } from './rates'
import { calculateTaxes, getTaxRateForDate } from './tax'

function applyTaxToLineItem(
  line: Omit<PayrollLineItem, 'taxYear' | 'taxRate' | 'taxRateId' | 'tax' | 'netPay'>,
  taxRates: TaxRate[],
  payPeriodEnd: string,
): PayrollLineItem {
  const taxRate = getTaxRateForDate(taxRates, payPeriodEnd)
  const breakdown = calculateTaxes(line.grossPay, taxRate, payPeriodEnd)
  return {
    ...line,
    taxYear: breakdown.taxYear,
    taxRate: breakdown.taxRate,
    taxRateId: breakdown.taxRateId,
    tax: breakdown.tax,
    netPay: breakdown.netPay,
  }
}

function applyTaxToPreview(
  preview: Omit<MockPaycheckPreview, 'taxYear' | 'taxRate' | 'taxRateId' | 'tax' | 'netPay'>,
  taxRates: TaxRate[],
): MockPaycheckPreview {
  const taxRate = getTaxRateForDate(taxRates, preview.payPeriodEnd)
  const breakdown = calculateTaxes(preview.grossPay, taxRate, preview.payPeriodEnd)
  return {
    ...preview,
    taxYear: breakdown.taxYear,
    taxRate: breakdown.taxRate,
    taxRateId: breakdown.taxRateId,
    tax: breakdown.tax,
    netPay: breakdown.netPay,
  }
}

export function buildPayrollForEmployee(
  employeeId: string,
  employeeName: string,
  entries: TimeEntry[],
  rates: EmployeeRate[],
  periods: PayPeriod[],
  fallbackRate = 0,
  taxRates: TaxRate[] = [],
): PayrollLineItem | null {
  const approved = entries.filter(
    (e) => e.employeeId === employeeId && e.status === 'approved' && hasCompletedPunch(normalizeEntry(e)),
  )
  if (approved.length === 0) return null

  const dayBreakdown: PaySlipDayLine[] = approved.map((e) => {
    const normalized = normalizeEntry(e)
    const hours = calcEntryHours(normalized)
    const rate = getMockPaycheckRate(rates, e.workDate, periods, fallbackRate)
    return {
      workDate: e.workDate,
      hours,
      rate,
      amount: Math.round(hours * rate * 100) / 100,
    }
  })

  const totalHours = dayBreakdown.reduce((s, d) => s + d.hours, 0)
  const grossPay = dayBreakdown.reduce((s, d) => s + d.amount, 0)
  const periodEnd = periods[0]?.endDate ?? formatDate(new Date())
  const avgRate =
    totalHours > 0
      ? grossPay / totalHours
      : getMockPaycheckRate(rates, periodEnd, periods, fallbackRate)

  return applyTaxToLineItem(
    {
      employeeId,
      employeeName,
      totalHours: Math.round(totalHours * 100) / 100,
      grossPay: Math.round(grossPay * 100) / 100,
      hourlyRate: Math.round(avgRate * 100) / 100,
      timeEntryIds: approved.map((e) => e.id),
      dayBreakdown,
    },
    taxRates,
    periodEnd,
  )
}

export function buildPayrollSnapshot(
  employees: { uid: string; displayName: string }[],
  entries: TimeEntry[],
  ratesByEmployee: Map<string, EmployeeRate[]>,
  periods: PayPeriod[],
  fallbackRatesByEmployee: Map<string, number>,
  taxRates: TaxRate[] = [],
): PayrollLineItem[] {
  const lines: PayrollLineItem[] = []
  for (const emp of employees) {
    const rates = ratesByEmployee.get(emp.uid) ?? []
    const line = buildPayrollForEmployee(
      emp.uid,
      emp.displayName,
      entries,
      rates,
      periods,
      fallbackRatesByEmployee.get(emp.uid) ?? 0,
      taxRates,
    )
    if (line) lines.push(line)
  }
  return lines.sort((a, b) => a.employeeName.localeCompare(b.employeeName))
}

export function buildMockPaycheckForEmployee(
  employeeId: string,
  employeeName: string,
  rangeStart: string,
  rangeEnd: string,
  entries: TimeEntry[],
  rates: EmployeeRate[],
  periods: PayPeriod[],
  fallbackRate = 0,
  taxRates: TaxRate[] = [],
): MockPaycheckPreview | null {
  const completed = entries.filter(
    (e) =>
      e.employeeId === employeeId &&
      e.workDate >= rangeStart &&
      e.workDate <= rangeEnd &&
      hasCompletedPunch(normalizeEntry(e)),
  )
  if (completed.length === 0) return null

  const dayBreakdown: MockPaycheckDayLine[] = completed.map((e) => {
    const normalized = normalizeEntry(e)
    const hours = calcEntryHours(normalized)
    const rate = getMockPaycheckRate(rates, e.workDate, periods, fallbackRate)
    return {
      workDate: e.workDate,
      hours,
      rate,
      amount: Math.round(hours * rate * 100) / 100,
      status: e.status,
    }
  })

  const totalHours = dayBreakdown.reduce((s, d) => s + d.hours, 0)
  const grossPay = dayBreakdown.reduce((s, d) => s + d.amount, 0)
  const avgRate =
    totalHours > 0
      ? grossPay / totalHours
      : getMockPaycheckRate(rates, rangeEnd, periods, fallbackRate)

  return applyTaxToPreview(
    {
      payPeriodId: '',
      payPeriodStart: rangeStart,
      payPeriodEnd: rangeEnd,
      employeeId,
      employeeName,
      totalHours: Math.round(totalHours * 100) / 100,
      grossPay: Math.round(grossPay * 100) / 100,
      hourlyRate: Math.round(avgRate * 100) / 100,
      dayBreakdown: dayBreakdown.sort((a, b) => a.workDate.localeCompare(b.workDate)),
    },
    taxRates,
  )
}

export function paySlipMatchesPeriod(slip: PaySlip, period: PayPeriod): boolean {
  if (slip.payPeriodId === period.id) return true
  return slip.payPeriodStart === period.startDate && slip.payPeriodEnd === period.endDate
}

export function dateRangeOverlapsPeriod(
  rangeStart: string,
  rangeEnd: string,
  period: PayPeriod,
): boolean {
  return periodsDateRangesOverlap(rangeStart, rangeEnd, period.startDate, period.endDate)
}

export function periodsDateRangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return bStart <= aEnd && bEnd >= aStart
}

export function periodHasFinalizedRuns(runs: PayrollRun[], payPeriodId: string): boolean {
  return runs.some((run) => run.status === 'finalized' && run.payPeriodId === payPeriodId)
}

export function isLastFinalizedRunForPeriod(
  runs: PayrollRun[],
  runId: string,
  payPeriodId: string,
): boolean {
  const finalizedForPeriod = runs.filter(
    (run) => run.status === 'finalized' && run.payPeriodId === payPeriodId,
  )
  return finalizedForPeriod.length === 1 && finalizedForPeriod[0]?.id === runId
}

export function findPaidPeriodsOverlappingRange(
  rangeStart: string,
  rangeEnd: string,
  periods: PayPeriod[],
  runs: PayrollRun[],
): PayPeriod[] {
  const paidPeriodIds = new Set(
    runs.filter((run) => run.status === 'finalized').map((run) => run.payPeriodId),
  )
  return periods
    .filter((period) => paidPeriodIds.has(period.id))
    .filter((period) => periodsDateRangesOverlap(rangeStart, rangeEnd, period.startDate, period.endDate))
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
}

export function findIncludedPaidPeriods(
  rangeStart: string,
  rangeEnd: string,
  periods: PayPeriod[],
  paySlips: PaySlip[],
): PayPeriod[] {
  return periods
    .filter((period) => dateRangeOverlapsPeriod(rangeStart, rangeEnd, period))
    .filter((period) => paySlips.some((slip) => paySlipMatchesPeriod(slip, period)))
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
}

export function isDateInPaidPeriod(
  workDate: string,
  paidPeriods: Array<{ startDate: string; endDate: string }>,
): boolean {
  return paidPeriods.some(
    (period) => workDate >= period.startDate && workDate <= period.endDate,
  )
}

export function mergeEmployeePaySlips(slips: PaySlip[]): PaySlip | null {
  if (slips.length === 0) return null

  const sorted = [...slips].sort((a, b) => a.paySlipNumber.localeCompare(b.paySlipNumber))
  const base = sorted[sorted.length - 1]
  const lineItems = sorted
    .flatMap((slip) => slip.lineItems)
    .sort((a, b) => a.workDate.localeCompare(b.workDate))
  const totalHours = Math.round(lineItems.reduce((sum, line) => sum + line.hours, 0) * 100) / 100
  const grossPay = Math.round(lineItems.reduce((sum, line) => sum + line.amount, 0) * 100) / 100
  const totalTax = sorted.some((slip) => slip.tax != null)
    ? Math.round(sorted.reduce((sum, slip) => sum + (slip.tax ?? 0), 0) * 100) / 100
    : undefined
  const netPay = sorted.some((slip) => slip.netPay != null)
    ? Math.round(sorted.reduce((sum, slip) => sum + (slip.netPay ?? slip.grossPay), 0) * 100) / 100
    : undefined
  const hourlyRate =
    totalHours > 0
      ? Math.round((grossPay / totalHours) * 100) / 100
      : base.hourlyRate

  return {
    ...base,
    lineItems,
    totalHours,
    grossPay,
    hourlyRate,
    tax: totalTax,
    netPay,
  }
}

export function collectPaidTimeEntryIdsForPeriod(
  runs: PayrollRun[],
  payPeriodId: string,
): Set<string> {
  const paid = new Set<string>()
  for (const run of runs) {
    if (run.status !== 'finalized' || run.payPeriodId !== payPeriodId) continue
    for (const line of run.entries) {
      for (const entryId of line.timeEntryIds ?? []) paid.add(entryId)
    }
  }
  return paid
}

export function excludePaidTimeEntries(entries: TimeEntry[], paidIds: Set<string>): TimeEntry[] {
  if (paidIds.size === 0) return entries
  return entries.filter((entry) => !paidIds.has(entry.id))
}

export function isUnpaidApprovedPayrollEntry(entry: TimeEntry, paidEntryIds: Set<string>): boolean {
  return (
    entry.status === 'approved' &&
    hasCompletedPunch(normalizeEntry(entry)) &&
    !paidEntryIds.has(entry.id)
  )
}

export function getEmployeeIdsWithUnpaidApprovedHours(
  entries: TimeEntry[],
  paidEntryIds: Set<string>,
): Set<string> {
  const ids = new Set<string>()
  for (const entry of entries) {
    if (isUnpaidApprovedPayrollEntry(entry, paidEntryIds)) ids.add(entry.employeeId)
  }
  return ids
}

export function formatPayrollRunLabel(run: PayrollRun): string {
  const parts = [`${run.payPeriodStart} – ${run.payPeriodEnd}`]
  if (run.runType === 'supplemental') parts.push('Supplemental')
  if (run.scope === 'selected' && run.employeeIds?.length) {
    parts.push(run.employeeIds.length === 1 ? '1 employee' : `${run.employeeIds.length} employees`)
  }
  return parts.join(' · ')
}

export function exportPayrollCsv(
  run: {
    payPeriodStart: string
    payPeriodEnd: string
    taxYear?: number
    taxRate?: number
    entries: PayrollLineItem[]
  },
  companyName: string,
): string {
  const header = [
    'Company',
    'Pay Period Start',
    'Pay Period End',
    'Tax Year',
    'Tax Rate',
    'Employee',
    'Hours',
    'Rate',
    'Gross Pay',
    'Tax',
    'Net Pay',
  ]
  const rows = run.entries.map((e) => [
    companyName,
    run.payPeriodStart,
    run.payPeriodEnd,
    String(e.taxYear ?? run.taxYear ?? ''),
    e.taxRate != null ? `${e.taxRate}%` : run.taxRate != null ? `${run.taxRate}%` : '',
    e.employeeName,
    e.totalHours.toFixed(2),
    e.hourlyRate.toFixed(2),
    e.grossPay.toFixed(2),
    e.tax != null ? e.tax.toFixed(2) : '',
    e.netPay != null ? e.netPay.toFixed(2) : '',
  ])
  return [header, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
}
