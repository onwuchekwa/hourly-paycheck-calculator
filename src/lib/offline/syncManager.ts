import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore'
import { auth, db } from '../firebase'
import { punchesToFirestore, getPunches, normalizeEntry } from '../timeEntries'
import { getConnectivityMode } from './connectivityState'
import { getDeviceId, isVaultUnlocked } from './encryptedVault'
import { verifyEntryIntegrity } from './integrity'
import {
  clearPendingData,
  getPendingEntries,
  setPendingEntries,
} from './localStore'
import { refreshSnapshot } from './timeEntryRepository'
import { APP_VERSION } from './types'
import type { StoredTimeEntry } from './types'

export type SyncResult = {
  synced: number
  conflicts: string[]
  tampered: string[]
  errors: string[]
}

let syncing = false

export function isSyncInProgress(): boolean {
  return syncing
}

export async function flushSync(employeeId: string): Promise<SyncResult> {
  const result: SyncResult = { synced: 0, conflicts: [], tampered: [], errors: [] }

  if (getConnectivityMode() !== 'online') {
    result.errors.push('Not online')
    return result
  }

  if (!auth.currentUser) {
    result.errors.push('Sign in online to sync')
    return result
  }

  if (!isVaultUnlocked()) {
    result.errors.push('Vault locked')
    return result
  }

  try {
    await auth.currentUser.getIdToken(true)
  } catch {
    result.errors.push('Authentication expired — sign in online to sync')
    return result
  }

  if (syncing) return result
  syncing = true

  try {
    const pending = await getPendingEntries(employeeId)
    const sorted = [...pending].sort(
      (a, b) => Date.parse(a.localUpdatedAt) - Date.parse(b.localUpdatedAt),
    )

    const remaining: StoredTimeEntry[] = []

    for (const entry of sorted) {
      if (!(await verifyEntryIntegrity(entry))) {
        result.tampered.push(entry.id)
        remaining.push(entry)
        continue
      }

      try {
        const ref = doc(db, 'timeEntries', entry.id)
        const snap = await getDoc(ref)
        const normalized = normalizeEntry(entry)

        if (snap.exists()) {
          const server = snap.data()
          if (server.status === 'approved') {
            result.conflicts.push(entry.id)
            remaining.push(entry)
            continue
          }
          const serverUpdated = server.updatedAt as Timestamp | undefined
          if (serverUpdated && entry.updatedAt) {
            const localMs = entry.updatedAt.toMillis?.() ?? Date.parse(entry.localUpdatedAt)
            if (serverUpdated.toMillis() > localMs) {
              result.conflicts.push(entry.id)
              remaining.push(entry)
              continue
            }
          }

          await updateDoc(ref, {
            punches: punchesToFirestore(getPunches(normalized)),
            clockIn: null,
            clockOut: null,
            punchSource: entry.punchSource === 'button' ? 'offline_sync' : entry.punchSource,
            editHistory: entry.editHistory ?? [],
            status: entry.status,
            submittedAt: entry.submittedAt ?? null,
            rejectionReason: entry.rejectionReason ?? null,
            rejectedAt: entry.rejectedAt ?? null,
            offlineSyncMeta: {
              deviceId: getDeviceId(),
              syncedAt: new Date().toISOString(),
              appVersion: APP_VERSION,
              localRevision: entry.localRevision,
            },
            updatedAt: serverTimestamp(),
          })
        } else {
          await setDoc(ref, {
            employeeId: entry.employeeId,
            employeeName: entry.employeeName,
            workDate: entry.workDate,
            status: entry.status,
            punches: punchesToFirestore(getPunches(normalized)),
            punchSource: entry.punchSource === 'button' ? 'offline_sync' : entry.punchSource ?? 'offline_sync',
            editHistory: entry.editHistory ?? [],
            submittedAt: entry.submittedAt ?? null,
            offlineSyncMeta: {
              deviceId: getDeviceId(),
              syncedAt: new Date().toISOString(),
              appVersion: APP_VERSION,
              localRevision: entry.localRevision,
            },
            updatedAt: serverTimestamp(),
          })
        }
        result.synced += 1
      } catch (err) {
        result.errors.push(entry.id + ': ' + String(err))
        remaining.push(entry)
      }
    }

    if (remaining.length === 0) {
      await clearPendingData(employeeId)
    } else {
      await setPendingEntries(employeeId, remaining)
    }

    await refreshSnapshot(employeeId)
  } finally {
    syncing = false
  }

  return result
}
