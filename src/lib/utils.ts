import type { Timestamp } from 'firebase/firestore'

export function formatDate(date: Date | string): string {
  if (typeof date === 'string') return date
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function todayString(): string {
  return formatDate(new Date())
}

export function formatDisplayDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatTime(ts: Timestamp | null | undefined): string {
  if (!ts) return '—'
  return ts.toDate().toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

export function calcHours(
  clockIn: Timestamp | null | undefined,
  clockOut: Timestamp | null | undefined,
): number {
  if (!clockIn || !clockOut) return 0
  const ms = clockOut.toMillis() - clockIn.toMillis()
  if (ms <= 0) return 0
  return Math.round((ms / 3_600_000) * 100) / 100
}

export function timeEntryDocId(employeeId: string, workDate: string): string {
  return `${employeeId}_${workDate}`
}

export function classNames(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function timestampToInputValue(ts: Timestamp | null | undefined): string {
  if (!ts) return ''
  const d = ts.toDate()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function inputValueToDate(value: string): Date | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}
