import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
} from 'firebase/firestore'
import { db } from './firebase'
import type { EmployeeRate, PayPeriod } from './types'

export async function getEmployeeRates(employeeId: string): Promise<EmployeeRate[]> {
  const q = query(
    collection(db, 'employeeRates'),
    where('employeeId', '==', employeeId),
    orderBy('effectiveFrom', 'desc'),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as EmployeeRate)
}

export function getRateForDate(
  rates: EmployeeRate[],
  workDate: string,
  fallbackRate = 0,
): number {
  const applicable = rates
    .filter((r) => r.effectiveFrom <= workDate)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))
  return applicable[0]?.hourlyRate ?? fallbackRate
}

/** @alias getRateForDate */
export const getEffectiveHourlyRate = getRateForDate

export function findPayPeriodForDate(periods: PayPeriod[], workDate: string): PayPeriod | undefined {
  return periods.find((period) => period.startDate <= workDate && period.endDate >= workDate)
}

/** Hourly rate for mock pay estimates: work-date history, then period, then profile fallback. */
export function getMockPaycheckRate(
  rates: EmployeeRate[],
  workDate: string,
  periods: PayPeriod[],
  fallbackRate: number,
): number {
  const rateOnWorkDate = getRateForDate(rates, workDate, 0)
  if (rateOnWorkDate > 0) return rateOnWorkDate

  const period = findPayPeriodForDate(periods, workDate)
  if (period) {
    const rateAtPeriodEnd = getRateForDate(rates, period.endDate, 0)
    if (rateAtPeriodEnd > 0) return rateAtPeriodEnd
  }

  return fallbackRate
}
