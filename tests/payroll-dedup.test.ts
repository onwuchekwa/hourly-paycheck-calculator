import { Timestamp } from 'firebase/firestore'
import { describe, expect, it } from 'vitest'
import {
  findPaidPeriodsOverlappingRange,
  getEmployeeIdsWithUnpaidApprovedHours,
  isLastFinalizedRunForPeriod,
  isUnpaidApprovedPayrollEntry,
  periodHasFinalizedRuns,
  periodHasPayrollRuns,
  periodsDateRangesOverlap,
} from '../src/lib/payroll'
import type { PayPeriod, PayrollRun, TimeEntry } from '../src/lib/types'

function completedEntry(
  id: string,
  employeeId: string,
  status: TimeEntry['status'] = 'approved',
): TimeEntry {
  const clockIn = Timestamp.fromDate(new Date('2026-01-05T09:00:00'))
  const clockOut = Timestamp.fromDate(new Date('2026-01-05T17:00:00'))
  return {
    id,
    employeeId,
    employeeName: 'Test',
    workDate: '2026-01-05',
    status,
    punches: [{ clockIn, clockOut }],
  }
}

function openPunchEntry(id: string, employeeId: string): TimeEntry {
  const clockIn = Timestamp.fromDate(new Date('2026-01-05T09:00:00'))
  return {
    id,
    employeeId,
    employeeName: 'Test',
    workDate: '2026-01-05',
    status: 'approved',
    punches: [{ clockIn, clockOut: null }],
  }
}

const periods: PayPeriod[] = [
  { id: 'p1', startDate: '2026-01-01', endDate: '2026-01-15', status: 'closed' },
  { id: 'p2', startDate: '2026-01-16', endDate: '2026-01-31', status: 'closed' },
  { id: 'p3', startDate: '2026-02-01', endDate: '2026-02-15', status: 'open' },
]

const runs: PayrollRun[] = [
  {
    id: 'r1',
    payPeriodId: 'p1',
    payPeriodStart: '2026-01-01',
    payPeriodEnd: '2026-01-15',
    status: 'finalized',
    entries: [],
    totalGross: 1000,
    totalHours: 40,
  },
  {
    id: 'r2',
    payPeriodId: 'p1',
    payPeriodStart: '2026-01-01',
    payPeriodEnd: '2026-01-15',
    status: 'finalized',
    runType: 'supplemental',
    entries: [],
    totalGross: 200,
    totalHours: 8,
  },
  {
    id: 'r3',
    payPeriodId: 'p3',
    payPeriodStart: '2026-02-01',
    payPeriodEnd: '2026-02-15',
    status: 'preview',
    entries: [],
    totalGross: 0,
    totalHours: 0,
  },
]

describe('periodsDateRangesOverlap', () => {
  it('detects overlapping ranges', () => {
    expect(periodsDateRangesOverlap('2026-01-10', '2026-01-20', '2026-01-01', '2026-01-15')).toBe(true)
  })

  it('allows adjacent non-overlapping ranges', () => {
    expect(periodsDateRangesOverlap('2026-01-16', '2026-01-31', '2026-01-01', '2026-01-15')).toBe(false)
  })
})

describe('periodHasFinalizedRuns', () => {
  it('returns true when finalized runs exist for period', () => {
    expect(periodHasFinalizedRuns(runs, 'p1')).toBe(true)
  })

  it('returns false for period with only preview runs', () => {
    expect(periodHasFinalizedRuns(runs, 'p3')).toBe(false)
  })
})

describe('periodHasPayrollRuns', () => {
  it('returns true when any payroll run exists for period', () => {
    expect(periodHasPayrollRuns(runs, 'p1')).toBe(true)
    expect(periodHasPayrollRuns(runs, 'p3')).toBe(true)
  })

  it('returns false when no runs exist for period', () => {
    expect(periodHasPayrollRuns(runs, 'p2')).toBe(false)
  })
})

describe('isLastFinalizedRunForPeriod', () => {
  it('returns false when multiple finalized runs exist', () => {
    expect(isLastFinalizedRunForPeriod(runs, 'r1', 'p1')).toBe(false)
  })

  it('returns true for sole finalized run', () => {
    const single = runs.filter((r) => r.id !== 'r2')
    expect(isLastFinalizedRunForPeriod(single, 'r1', 'p1')).toBe(true)
  })
})

describe('findPaidPeriodsOverlappingRange', () => {
  it('finds paid periods overlapping candidate range', () => {
    const found = findPaidPeriodsOverlappingRange('2026-01-10', '2026-01-20', periods, runs)
    expect(found.map((p) => p.id)).toEqual(['p1'])
  })

  it('returns empty when range does not overlap paid periods', () => {
    const found = findPaidPeriodsOverlappingRange('2026-03-01', '2026-03-15', periods, runs)
    expect(found).toEqual([])
  })

  it('excludes the specified period from overlap results', () => {
    const found = findPaidPeriodsOverlappingRange('2026-01-01', '2026-01-15', periods, runs, 'p1')
    expect(found).toEqual([])
  })
})

describe('isUnpaidApprovedPayrollEntry', () => {
  it('includes approved completed entry not in paid set', () => {
    const entry = completedEntry('e1', 'emp1')
    expect(isUnpaidApprovedPayrollEntry(entry, new Set())).toBe(true)
    expect(isUnpaidApprovedPayrollEntry(entry, new Set(['e2']))).toBe(true)
  })

  it('excludes entry already paid', () => {
    const entry = completedEntry('e1', 'emp1')
    expect(isUnpaidApprovedPayrollEntry(entry, new Set(['e1']))).toBe(false)
  })

  it('excludes incomplete punches and non-approved entries', () => {
    expect(isUnpaidApprovedPayrollEntry(openPunchEntry('e1', 'emp1'), new Set())).toBe(false)
    expect(isUnpaidApprovedPayrollEntry(completedEntry('e1', 'emp1', 'submitted'), new Set())).toBe(false)
  })
})

describe('getEmployeeIdsWithUnpaidApprovedHours', () => {
  it('includes employee with unpaid approved hours', () => {
    const entries = [completedEntry('e1', 'emp1')]
    expect(getEmployeeIdsWithUnpaidApprovedHours(entries, new Set())).toEqual(new Set(['emp1']))
  })

  it('excludes employee when all entries are paid', () => {
    const entries = [completedEntry('e1', 'emp1')]
    expect(getEmployeeIdsWithUnpaidApprovedHours(entries, new Set(['e1']))).toEqual(new Set())
  })

  it('includes employee with mix of paid and unpaid entries', () => {
    const entries = [
      completedEntry('e1', 'emp1'),
      completedEntry('e2', 'emp1'),
      completedEntry('e3', 'emp2'),
    ]
    const eligible = getEmployeeIdsWithUnpaidApprovedHours(entries, new Set(['e1']))
    expect(eligible).toEqual(new Set(['emp1', 'emp2']))
  })
})
