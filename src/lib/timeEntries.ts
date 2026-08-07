import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from './firebase'
import type { TimeEntry, TimePunch } from './types'
import { calcDurationMinutes, formatDuration, formatDurationMinutes, todayString } from './utils'

export interface OpenPunchLocation {
  entryId: string
  entry: TimeEntry
  punchIndex: number
  punch: TimePunch
}

export interface EditPunchRow {
  clockIn: string
  clockOut: string
}

function toTimestamp(value: unknown): Timestamp | null {
  if (!value) return null
  if (value instanceof Timestamp) return value
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    const v = value as { seconds: number; nanoseconds?: number }
    return new Timestamp(v.seconds, v.nanoseconds ?? 0)
  }
  return null
}


export function endOfWorkDate(workDate: string): Date {
  const [y, m, d] = workDate.split('-').map(Number)
  return new Date(y, m - 1, d, 23, 59, 59, 999)
}

export function alignTimestampToWorkDate(ts: Timestamp, workDate: string): Timestamp {
  const [y, m, d] = workDate.split('-').map(Number)
  const src = ts.toDate()
  return Timestamp.fromDate(
    new Date(y, m - 1, d, src.getHours(), src.getMinutes(), src.getSeconds(), src.getMilliseconds()),
  )
}

export function timestampOnWorkDate(workDate: string, when: Date = new Date()): Timestamp {
  return alignTimestampToWorkDate(Timestamp.fromDate(when), workDate)
}

/** Clock-in timestamp using the selected work date and the local time when the button is clicked. */
export function createClockInTimestamp(workDate: string): Timestamp {
  return timestampOnWorkDate(workDate, new Date())
}

/** Clock-out timestamp using the entry work date and the local time when the button is clicked. */
export function createClockOutTimestamp(workDate: string): Timestamp {
  return timestampOnWorkDate(workDate, new Date())
}

export function punchesToFirestoreForWorkDate(workDate: string, punches: TimePunch[]): TimePunch[] {
  return punches.map((p) => {
    const aligned = alignPunchToWorkDate(
      {
        clockIn: toTimestamp(p.clockIn) ?? p.clockIn,
        clockOut: toTimestamp(p.clockOut),
      },
      workDate,
    )
    return {
      clockIn: aligned.clockIn,
      clockOut: aligned.clockOut ?? null,
    }
  })
}

function alignPunchToWorkDate(punch: TimePunch, workDate: string): TimePunch {
  const clockIn = toTimestamp(punch.clockIn)
  if (!clockIn) return punch
  const clockOut = toTimestamp(punch.clockOut)
  return {
    clockIn: alignTimestampToWorkDate(clockIn, workDate),
    clockOut: clockOut ? alignTimestampToWorkDate(clockOut, workDate) : null,
  }
}

export function normalizeEntry(entry: TimeEntry): TimeEntry {
  if (entry.punches && entry.punches.length > 0) {
    return {
      ...entry,
      punches: entry.punches
        .map((p) => alignPunchToWorkDate(
          {
            clockIn: toTimestamp(p.clockIn) ?? p.clockIn,
            clockOut: toTimestamp(p.clockOut),
          },
          entry.workDate,
        )),
    }
  }

  const clockIn = toTimestamp(entry.clockIn)
  const clockOut = toTimestamp(entry.clockOut)
  if (clockIn) {
    return {
      ...entry,
      punches: [alignPunchToWorkDate({ clockIn, clockOut }, entry.workDate)],
    }
  }

  return { ...entry, punches: [] }
}

export function getPunches(entry: TimeEntry | null | undefined): TimePunch[] {
  if (!entry) return []
  return normalizeEntry(entry).punches ?? []
}

export function getOpenPunchIndex(entry: TimeEntry): number {
  const punches = getPunches(entry)
  return punches.findIndex((p) => p.clockIn && !p.clockOut)
}

export function getOpenPunch(entry: TimeEntry): { punch: TimePunch; index: number } | null {
  const index = getOpenPunchIndex(entry)
  if (index < 0) return null
  const punches = getPunches(entry)
  return { punch: punches[index], index }
}

export function findGlobalOpenPunch(entries: TimeEntry[]): OpenPunchLocation | null {
  for (const raw of entries) {
    const entry = normalizeEntry(raw)
    const open = getOpenPunch(entry)
    if (open) {
      return {
        entryId: entry.id,
        entry,
        punchIndex: open.index,
        punch: open.punch,
      }
    }
  }
  return null
}

export function hasCompletedPunch(entry: TimeEntry): boolean {
  return getPunches(entry).some((p) => p.clockIn && p.clockOut)
}

export function calcEntryHours(entry: TimeEntry): number {
  const totalMinutes = getPunches(entry).reduce((sum, p) => {
    if (!p.clockIn || !p.clockOut) return sum
    return sum + calcDurationMinutes(p.clockIn.toDate(), p.clockOut.toDate())
  }, 0)
  return Math.round((totalMinutes / 60) * 100) / 100
}

export function formatEntryDuration(entry: TimeEntry): string {
  const punches = getPunches(entry)
  if (punches.length === 0) return '—'

  let totalMinutes = 0
  for (const p of punches) {
    if (!p.clockIn || !p.clockOut) continue
    totalMinutes += calcDurationMinutes(p.clockIn.toDate(), p.clockOut.toDate())
  }

  if (totalMinutes <= 0) {
    const open = punches.find((p) => p.clockIn && !p.clockOut)
    if (open) return '—'
    return '00:00'
  }

  return formatDurationMinutes(totalMinutes)
}

export function formatPunchDuration(punch: TimePunch): string {
  return formatDuration(punch.clockIn, punch.clockOut)
}

export function punchesToFirestore(punches: TimePunch[]): TimePunch[] {
  return punches.map((p) => ({
    clockIn: p.clockIn,
    clockOut: p.clockOut ?? null,
  }))
}

export function punchesToEditRows(entry: TimeEntry): EditPunchRow[] {
  const punches = getPunches(entry)
  if (punches.length === 0) return [{ clockIn: '', clockOut: '' }]
  return punches.map((p) => ({
    clockIn: p.clockIn ? timestampToInputValue(p.clockIn) : '',
    clockOut: p.clockOut ? timestampToInputValue(p.clockOut) : '',
  }))
}

export function timestampToInputValue(ts: Timestamp | null | undefined): string {
  if (!ts) return ''
  const d = ts.toDate()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function parseEditRows(rows: EditPunchRow[]): { ok: true; punches: TimePunch[] } | { ok: false; error: string } {
  const punches: TimePunch[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (!row.clockIn.trim() && !row.clockOut.trim()) continue

    if (!row.clockIn.trim() || !row.clockOut.trim()) {
      return { ok: false, error: `Session ${i + 1} needs both clock in and clock out.` }
    }

    const inDate = new Date(row.clockIn)
    const outDate = new Date(row.clockOut)
    if (Number.isNaN(inDate.getTime()) || Number.isNaN(outDate.getTime())) {
      return { ok: false, error: `Session ${i + 1} has invalid times.` }
    }
    if (outDate <= inDate) {
      return { ok: false, error: `Session ${i + 1} clock out must be after clock in.` }
    }

    punches.push({
      clockIn: Timestamp.fromDate(inDate),
      clockOut: Timestamp.fromDate(outDate),
    })
  }

  if (punches.length === 0) {
    return { ok: false, error: 'At least one complete session is required.' }
  }

  const sorted = [...punches].sort((a, b) => a.clockIn.toMillis() - b.clockIn.toMillis())
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].clockIn.toMillis() < sorted[i - 1].clockOut!.toMillis()) {
      return { ok: false, error: 'Sessions cannot overlap.' }
    }
  }

  return { ok: true, punches: sorted }
}

export function serializePunchesForHistory(punches: TimePunch[]): string {
  return JSON.stringify(
    punches.map((p) => ({
      clockIn: timestampToInputValue(p.clockIn),
      clockOut: p.clockOut ? timestampToInputValue(p.clockOut) : null,
    })),
  )
}

export async function fetchEmployeeEntries(employeeId: string): Promise<TimeEntry[]> {
  const q = query(
    collection(db, 'timeEntries'),
    where('employeeId', '==', employeeId),
    where('status', 'in', ['draft', 'submitted']),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => normalizeEntry({ id: d.id, ...d.data() } as TimeEntry))
}

export async function autoCloseStalePunches(employeeId: string): Promise<void> {
  const today = todayString()
  const entries = await fetchEmployeeEntries(employeeId)

  for (const entry of entries) {
    if (entry.workDate >= today) continue
    const open = getOpenPunch(entry)
    if (!open) continue

    const punches = [...getPunches(entry)]
    punches[open.index] = {
      ...punches[open.index],
      clockOut: Timestamp.fromDate(endOfWorkDate(entry.workDate)),
    }

    await updateDoc(doc(db, 'timeEntries', entry.id), {
      punches: punchesToFirestore(punches),
      clockIn: null,
      clockOut: null,
      punchSource: 'auto_eod',
      updatedAt: serverTimestamp(),
    })
  }
}

export async function findGlobalOpenPunchForEmployee(
  employeeId: string,
): Promise<OpenPunchLocation | null> {
  const entries = await fetchEmployeeEntries(employeeId)
  return findGlobalOpenPunch(entries)
}

export function canSubmitEntry(entry: TimeEntry): boolean {
  const punches = getPunches(entry)
  if (punches.length === 0) return false
  if (getOpenPunchIndex(entry) >= 0) return false
  return hasCompletedPunch(entry)
}

function isEmployeeEditableStatus(status: string): boolean {
  return status === 'draft' || status === 'submitted' || status === 'rejected'
}

export function canDeleteEntry(entry: TimeEntry): boolean {
  return isEmployeeEditableStatus(entry.status)
}

export function canEditEntry(entry: TimeEntry): boolean {
  return isEmployeeEditableStatus(entry.status)
}

export function canSubmitForReview(entry: TimeEntry): boolean {
  return (entry.status === 'draft' || entry.status === 'rejected') && canSubmitEntry(entry)
}

export function punchToEditRow(punch: TimePunch, workDate: string): EditPunchRow {
  const aligned = alignPunchToWorkDate(
    {
      clockIn: toTimestamp(punch.clockIn) ?? punch.clockIn,
      clockOut: toTimestamp(punch.clockOut),
    },
    workDate,
  )
  return {
    clockIn: timestampToInputValue(aligned.clockIn),
    clockOut: aligned.clockOut ? timestampToInputValue(aligned.clockOut) : '',
  }
}

export function parseSinglePunchEdit(
  row: EditPunchRow,
  allowOpenOut: boolean,
): { ok: true; punch: TimePunch } | { ok: false; error: string } {
  if (!row.clockIn.trim()) {
    return { ok: false, error: 'Clock in is required.' }
  }
  const inDate = new Date(row.clockIn)
  if (Number.isNaN(inDate.getTime())) {
    return { ok: false, error: 'Invalid clock in time.' }
  }

  if (!row.clockOut.trim()) {
    if (!allowOpenOut) {
      return { ok: false, error: 'Clock out is required.' }
    }
    return { ok: true, punch: { clockIn: Timestamp.fromDate(inDate), clockOut: null } }
  }

  const outDate = new Date(row.clockOut)
  if (Number.isNaN(outDate.getTime())) {
    return { ok: false, error: 'Invalid clock out time.' }
  }
  if (outDate <= inDate) {
    return { ok: false, error: 'Clock out must be after clock in.' }
  }

  return {
    ok: true,
    punch: {
      clockIn: Timestamp.fromDate(inDate),
      clockOut: Timestamp.fromDate(outDate),
    },
  }
}

export function replacePunchAtIndex(
  entry: TimeEntry,
  index: number,
  punch: TimePunch,
): { ok: true; punches: TimePunch[] } | { ok: false; error: string } {
  const punches = [...getPunches(entry)]
  if (index < 0 || index >= punches.length) {
    return { ok: false, error: 'Session not found.' }
  }

  punches[index] = punch

  const completed = punches.filter((p) => p.clockIn && p.clockOut)
  const sorted = [...completed].sort((a, b) => a.clockIn.toMillis() - b.clockIn.toMillis())
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].clockIn.toMillis() < sorted[i - 1].clockOut!.toMillis()) {
      return { ok: false, error: 'Sessions cannot overlap.' }
    }
  }

  return { ok: true, punches }
}

export function removePunchAtIndex(entry: TimeEntry, index: number): TimePunch[] {
  const punches = [...getPunches(entry)]
  if (index < 0 || index >= punches.length) return punches
  punches.splice(index, 1)
  return punches
}
