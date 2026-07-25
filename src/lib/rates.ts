import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
} from 'firebase/firestore'
import { db } from './firebase'
import type { EmployeeRate } from './types'

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
