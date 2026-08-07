import { Timestamp } from 'firebase/firestore'
import { describe, expect, it } from 'vitest'
import {
  calcDurationMinutes,
  calcHours,
  formatDecimalHours,
  formatDuration,
  formatDurationMinutes,
} from '../src/lib/utils'

function atTime(hours: number, minutes: number, seconds = 0, dayOffset = 0): Date {
  const date = new Date(2026, 0, 5 + dayOffset, hours, minutes, seconds)
  return date
}

function ts(date: Date): Timestamp {
  return Timestamp.fromDate(date)
}

describe('calcDurationMinutes', () => {
  it('ignores seconds when calculating same-day duration', () => {
    const clockIn = atTime(8, 15, 22)
    const clockOut = atTime(15, 25, 14)
    expect(calcDurationMinutes(clockIn, clockOut)).toBe(430)
  })

  it('returns zero when in and out share the same hour and minute', () => {
    const clockIn = atTime(9, 0, 5)
    const clockOut = atTime(9, 0, 55)
    expect(calcDurationMinutes(clockIn, clockOut)).toBe(0)
  })

  it('adds a full day when clock out minute is before clock in on next calendar day', () => {
    const clockIn = atTime(22, 0, 30)
    const clockOut = atTime(6, 0, 45, 1)
    expect(calcDurationMinutes(clockIn, clockOut)).toBe(8 * 60)
  })
})

describe('calcHours', () => {
  it('returns decimal hours rounded to two places', () => {
    expect(calcHours(ts(atTime(8, 15, 22)), ts(atTime(15, 25, 14)))).toBe(7.17)
  })
})

describe('formatDuration', () => {
  it('formats punch duration as hh:mm', () => {
    expect(formatDuration(ts(atTime(8, 15, 22)), ts(atTime(15, 25, 14)))).toBe('07:10')
  })

  it('returns 00:00 for zero-length minute duration', () => {
    expect(formatDuration(ts(atTime(9, 0, 1)), ts(atTime(9, 0, 59)))).toBe('00:00')
  })
})

describe('formatDurationMinutes', () => {
  it('formats total minutes as hh:mm', () => {
    expect(formatDurationMinutes(430)).toBe('07:10')
  })
})

describe('formatDecimalHours', () => {
  it('formats decimal hours as hh:mm using minute precision', () => {
    expect(formatDecimalHours(7.166666)).toBe('07:10')
  })
})
