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

function timeOfDayFraction(date: Date): number {
  return (
    date.getHours() * 3_600 +
    date.getMinutes() * 60 +
    date.getSeconds()
  ) / 86_400
}

export function calcHours(
  clockIn: Timestamp | null | undefined,
  clockOut: Timestamp | null | undefined,
): number {
  if (!clockIn || !clockOut) return 0
  const inDate = clockIn.toDate()
  const outDate = clockOut.toDate()
  const ms = clockOut.toMillis() - clockIn.toMillis()
  if (ms <= 0) return 0

  let dayDiff = timeOfDayFraction(outDate) - timeOfDayFraction(inDate)
  if (dayDiff <= 0) {
    dayDiff += Math.max(1, Math.round(ms / 86_400_000))
  }

  const hours = dayDiff * 24
  return Math.round(hours * 100) / 100
}

export function formatDuration(
  clockIn: Timestamp | null | undefined,
  clockOut: Timestamp | null | undefined,
): string {
  if (!clockIn || !clockOut) return '—'
  const ms = clockOut.toMillis() - clockIn.toMillis()
  if (ms <= 0) return '0:00'
  const totalMinutes = Math.floor(ms / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours}:${String(minutes).padStart(2, '0')}`
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
