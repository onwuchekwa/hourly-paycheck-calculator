import type {
  MockPaycheckDayLine,
  MockPaycheckPreview,
  PaySlipDayLine,
  PayrollLineItem,
  PayrollRun,
  PayPeriod,
  TimeEntry,
  EmployeeRate,
} from './types'
import { calcEntryHours, hasCompletedPunch, normalizeEntry } from './timeEntries'
import { formatDate } from './utils'
import { getMockPaycheckRate, getRateForDate } from './rates'

export function buildPayrollForEmployee(
  employeeId: string,
  employeeName: string,
  entries: TimeEntry[],
  rates: EmployeeRate[],
): PayrollLineItem | null {
  const approved = entries.filter(
    (e) => e.employeeId === employeeId && e.status === 'approved' && hasCompletedPunch(normalizeEntry(e)),
  )
  if (approved.length === 0) return null

  const dayBreakdown: PaySlipDayLine[] = approved.map((e) => {
    const normalized = normalizeEntry(e)
    const hours = calcEntryHours(normalized)
    const rate = getRateForDate(rates, e.workDate)
    return {
      workDate: e.workDate,
      hours,
      rate,
      amount: Math.round(hours * rate * 100) / 100,
    }
  })

  const totalHours = dayBreakdown.reduce((s, d) => s + d.hours, 0)
  const grossPay = dayBreakdown.reduce((s, d) => s + d.amount, 0)
  const avgRate = totalHours > 0 ? grossPay / totalHours : getRateForDate(rates, formatDate(new Date()))

  return {
    employeeId,
    employeeName,
    totalHours: Math.round(totalHours * 100) / 100,
    grossPay: Math.round(grossPay * 100) / 100,
    hourlyRate: Math.round(avgRate * 100) / 100,
    timeEntryIds: approved.map((e) => e.id),
    dayBreakdown,
  }
}

export function buildPayrollSnapshot(
  employees: { uid: string; displayName: string }[],
  entries: TimeEntry[],
  ratesByEmployee: Map<string, EmployeeRate[]>,
): PayrollLineItem[] {
  const lines: PayrollLineItem[] = []
  for (const emp of employees) {
    const rates = ratesByEmployee.get(emp.uid) ?? []
    const line = buildPayrollForEmployee(emp.uid, emp.displayName, entries, rates)
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

  return {
    payPeriodId: '',
    payPeriodStart: rangeStart,
    payPeriodEnd: rangeEnd,
    employeeId,
    employeeName,
    totalHours: Math.round(totalHours * 100) / 100,
    grossPay: Math.round(grossPay * 100) / 100,
    hourlyRate: Math.round(avgRate * 100) / 100,
    dayBreakdown: dayBreakdown.sort((a, b) => a.workDate.localeCompare(b.workDate)),
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

export function formatPayrollRunLabel(run: PayrollRun): string {
  const parts = [`${run.payPeriodStart} – ${run.payPeriodEnd}`]
  if (run.runType === 'supplemental') parts.push('Supplemental')
  if (run.scope === 'selected' && run.employeeIds?.length) {
    parts.push(run.employeeIds.length === 1 ? '1 employee' : `${run.employeeIds.length} employees`)
  }
  return parts.join(' · ')
}

export function exportPayrollCsv(
  run: { payPeriodStart: string; payPeriodEnd: string; entries: PayrollLineItem[] },
  companyName: string,
): string {
  const header = ['Company', 'Pay Period Start', 'Pay Period End', 'Employee', 'Hours', 'Rate', 'Gross Pay']
  const rows = run.entries.map((e) => [
    companyName,
    run.payPeriodStart,
    run.payPeriodEnd,
    e.employeeName,
    e.totalHours.toFixed(2),
    e.hourlyRate.toFixed(2),
    e.grossPay.toFixed(2),
  ])
  return [header, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
}
