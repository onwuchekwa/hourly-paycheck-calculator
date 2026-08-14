/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { Timestamp } from 'firebase/firestore'
import { clearSessionKey, deriveKey, setSessionKey } from '../src/lib/offline/encryptedVault'
import { findGlobalOpenPunch } from '../src/lib/timeEntries'
import { applyPendingOverlay } from '../src/lib/offline/timeEntryRepository'
import { withIntegrity } from '../src/lib/offline/integrity'
import { setPendingEntries } from '../src/lib/offline/localStore'
import type { TimeEntry } from '../src/lib/types'
import type { StoredTimeEntry } from '../src/lib/offline/types'

const EMPLOYEE_ID = 'emp1'

function baseEntry(overrides: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: `${EMPLOYEE_ID}_2026-08-13`,
    employeeId: EMPLOYEE_ID,
    employeeName: 'Test User',
    workDate: '2026-08-13',
    status: 'draft',
    punches: [],
    ...overrides,
  }
}

async function setupVault() {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await deriveKey('test-password', salt)
  await setSessionKey(key, EMPLOYEE_ID)
}

async function storePending(entry: TimeEntry): Promise<StoredTimeEntry> {
  const stored = await withIntegrity({
    ...entry,
    syncStatus: 'pending',
    localUpdatedAt: new Date().toISOString(),
    localRevision: 1,
  })
  await setPendingEntries(EMPLOYEE_ID, [stored])
  return stored
}

describe('applyPendingOverlay', () => {
  beforeEach(() => {
    clearSessionKey()
    sessionStorage.clear()
    localStorage.clear()
  })

  it('overlays pending entry onto server entry with same ID', async () => {
    await setupVault()
    const serverEntry = baseEntry({
      punches: [
        {
          clockIn: Timestamp.fromDate(new Date('2026-08-13T09:00:00')),
          clockOut: Timestamp.fromDate(new Date('2026-08-13T12:00:00')),
        },
      ],
    })
    const pendingEntry = baseEntry({
      punches: [
        {
          clockIn: Timestamp.fromDate(new Date('2026-08-13T09:00:00')),
          clockOut: null,
        },
      ],
    })
    await storePending(pendingEntry)

    const result = await applyPendingOverlay(EMPLOYEE_ID, [serverEntry])
    expect(result).toHaveLength(1)
    expect(result[0].punches?.[0].clockOut).toBeNull()
  })

  it('includes pending-only entry not on server', async () => {
    await setupVault()
    const pendingEntry = baseEntry({
      id: `${EMPLOYEE_ID}_2026-08-12`,
      workDate: '2026-08-12',
      punches: [
        {
          clockIn: Timestamp.fromDate(new Date('2026-08-12T09:00:00')),
          clockOut: null,
        },
      ],
    })
    await storePending(pendingEntry)

    const result = await applyPendingOverlay(EMPLOYEE_ID, [])
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(pendingEntry.id)
  })

  it('finds open punch in pending after overlay', async () => {
    await setupVault()
    const pendingEntry = baseEntry({
      punches: [
        {
          clockIn: Timestamp.fromDate(new Date('2026-08-13T17:42:00')),
          clockOut: null,
        },
      ],
    })
    await storePending(pendingEntry)

    const result = await applyPendingOverlay(EMPLOYEE_ID, [])
    const open = findGlobalOpenPunch(result)
    expect(open).not.toBeNull()
    expect(open?.entryId).toBe(pendingEntry.id)
  })

  it('excludes tampered pending entries', async () => {
    await setupVault()
    const stored = await storePending(
      baseEntry({
        punches: [
          {
            clockIn: Timestamp.fromDate(new Date('2026-08-13T17:42:00')),
            clockOut: null,
          },
        ],
      }),
    )
    const tampered = { ...stored, employeeName: 'Hacker' }
    await setPendingEntries(EMPLOYEE_ID, [tampered])

    const result = await applyPendingOverlay(EMPLOYEE_ID, [])
    expect(result).toHaveLength(0)
  })

  it('returns server entries unchanged when vault is locked', async () => {
    const serverEntry = baseEntry()
    const result = await applyPendingOverlay(EMPLOYEE_ID, [serverEntry])
    expect(result).toEqual([serverEntry])
  })
})
