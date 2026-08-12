import { describe, expect, it } from 'vitest'
import { Timestamp } from 'firebase/firestore'
import { timeEntryFromJson, timeEntryToJson } from '../src/lib/offline/serialization'
import type { TimeEntry } from '../src/lib/types'

describe('offline serialization', () => {
  it('round-trips a time entry with punches', () => {
    const entry: TimeEntry = {
      id: 'user1_2026-08-12',
      employeeId: 'user1',
      employeeName: 'Test User',
      workDate: '2026-08-12',
      status: 'draft',
      punches: [
        {
          clockIn: Timestamp.fromDate(new Date('2026-08-12T09:00:00')),
          clockOut: Timestamp.fromDate(new Date('2026-08-12T17:00:00')),
        },
      ],
    }

    const json = timeEntryToJson(entry)
    const restored = timeEntryFromJson(json)

    expect(restored.id).toBe(entry.id)
    expect(restored.punches?.[0].clockIn.toMillis()).toBe(entry.punches![0].clockIn.toMillis())
    expect(restored.punches?.[0].clockOut?.toMillis()).toBe(entry.punches![0].clockOut?.toMillis())
  })
})
