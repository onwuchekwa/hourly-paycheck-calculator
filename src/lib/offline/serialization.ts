import { Timestamp } from 'firebase/firestore'
import type { TimeEntry, TimePunch } from '../types'
import type { JsonTimeEntry, StoredTimeEntry, TimestampJson } from './types'

export function timestampToJson(ts: Timestamp): TimestampJson {
  return { seconds: ts.seconds, nanoseconds: ts.nanoseconds }
}

export function jsonToTimestamp(json: TimestampJson): Timestamp {
  return new Timestamp(json.seconds, json.nanoseconds)
}

function punchToJson(punch: TimePunch) {
  return {
    clockIn: timestampToJson(punch.clockIn),
    clockOut: punch.clockOut ? timestampToJson(punch.clockOut) : null,
  }
}

function punchFromJson(punch: { clockIn: TimestampJson; clockOut?: TimestampJson | null }): TimePunch {
  return {
    clockIn: jsonToTimestamp(punch.clockIn),
    clockOut: punch.clockOut ? jsonToTimestamp(punch.clockOut) : null,
  }
}

export function timeEntryToJson(entry: TimeEntry): JsonTimeEntry {
  const { punches, clockIn, clockOut, submittedAt, approvedAt, rejectedAt, updatedAt, editHistory, ...rest } =
    entry
  return {
    ...rest,
    punches: punches?.map(punchToJson),
    clockIn: clockIn ? timestampToJson(clockIn) : clockIn ?? null,
    clockOut: clockOut ? timestampToJson(clockOut) : clockOut ?? null,
    submittedAt: submittedAt ? timestampToJson(submittedAt) : undefined,
    approvedAt: approvedAt ? timestampToJson(approvedAt) : undefined,
    rejectedAt: rejectedAt ? timestampToJson(rejectedAt) : undefined,
    updatedAt: updatedAt ? timestampToJson(updatedAt) : undefined,
    editHistory: editHistory?.map((h) => ({
      ...h,
      editedAt: timestampToJson(h.editedAt),
    })),
  }
}

export function timeEntryFromJson(json: JsonTimeEntry): TimeEntry {
  const { punches, clockIn, clockOut, submittedAt, approvedAt, rejectedAt, updatedAt, editHistory, ...rest } =
    json
  return {
    ...rest,
    punches: punches?.map(punchFromJson),
    clockIn: clockIn ? jsonToTimestamp(clockIn) : clockIn ?? null,
    clockOut: clockOut ? jsonToTimestamp(clockOut) : clockOut ?? null,
    submittedAt: submittedAt ? jsonToTimestamp(submittedAt) : undefined,
    approvedAt: approvedAt ? jsonToTimestamp(approvedAt) : undefined,
    rejectedAt: rejectedAt ? jsonToTimestamp(rejectedAt) : undefined,
    updatedAt: updatedAt ? jsonToTimestamp(updatedAt) : undefined,
    editHistory: editHistory?.map((h) => ({
      ...h,
      editedAt: jsonToTimestamp(h.editedAt),
    })),
  } as TimeEntry
}

export function storedEntryToJson(entry: StoredTimeEntry): JsonTimeEntry & {
  syncStatus: 'pending'
  localUpdatedAt: string
  localRevision: number
  integrity: string
} {
  return {
    ...timeEntryToJson(entry),
    syncStatus: entry.syncStatus,
    localUpdatedAt: entry.localUpdatedAt,
    localRevision: entry.localRevision,
    integrity: entry.integrity,
  }
}

export function storedEntryFromJson(
  json: JsonTimeEntry & {
    syncStatus: 'pending'
    localUpdatedAt: string
    localRevision: number
    integrity: string
  },
): StoredTimeEntry {
  return {
    ...timeEntryFromJson(json),
    syncStatus: 'pending',
    localUpdatedAt: json.localUpdatedAt,
    localRevision: json.localRevision,
    integrity: json.integrity,
  }
}

export function canonicalEntryPayload(entry: StoredTimeEntry): string {
  const { integrity: _i, ...rest } = entry
  return JSON.stringify(storedEntryToJson({ ...rest, integrity: '' } as StoredTimeEntry))
}
